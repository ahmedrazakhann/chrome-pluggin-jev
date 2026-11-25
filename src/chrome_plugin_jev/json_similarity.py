"""Score how closely a JSON object's keys match the stored samples of the same website."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from .jev_model import JevConfigurationError, JevModelClient, parse_single_object
from .logs import clip, since

logger = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4.1"  # change here to use another OpenAI model; the key comes from OPENAI_API_KEY

# SIMILARITY = """You compare the KEYS (field names) of an input JSON object with the keys of sample JSON objects stored for the same page URL.
# Only key names matter. Keys match when they mean the same field even if spelled differently ("First name", "firstName" and "given_name" are one field; "Email" and "Phone" are not).
# Missing sample keys and extra input keys both lower the score. 100 means the same set of fields, 0 means no field in common.
# Reply with ONLY this JSON object and nothing else:
# {"score": <integer 0-100 for the most similar sample>, "best_match_id": <the id of that sample>, "reason": "<one short sentence>"}"""

SIMILARITY = """You are a strict JSON SCHEMA COMPARISON ENGINE.

Your job is to compare the keys of an input JSON object against every stored sample JSON object and identify the most structurally similar sample.

IMPORTANT: You are NOT comparing general similarity. You are comparing the completeness and equivalence of two sets of fields.

## STEP 1: EXTRACT ALL KEYS

Extract every top-level key from:
- The input JSON.
- Each sample JSON.

Count every key exactly once.

Ignore all values, including null values, arrays, objects, and data types. Only field names matter.

Do not ignore a key because its value is null or empty.

## STEP 2: MATCH FIELDS

Compare fields based on their actual semantic meaning.

Matching rules:
- Exact key matches have priority.
- Semantic matches are allowed when two different names clearly represent the same field.
- Differences in capitalization, spacing, underscores, camelCase, and naming conventions do not prevent a match.
- Synonyms are allowed only when they represent the same specific information.
- Similar categories do NOT mean equivalent fields.

Examples:
- "First Name" = "firstName" = "given_name"
- "Email" = "Email Address"
- "Phone" = "Phone Number"
- "Street Address" = "home address"
- "First Name" != "Full Name"
- "Email" != "Phone"
- "City" != "Country"
- "Current Salary" != "Expected Monthly Salary"

## STEP 3: BUILD A COMPLETE MATCHING INVENTORY

For EACH sample, internally create three separate lists:

A. MATCHED:
Every unique input key paired with exactly one equivalent sample key.

B. MISSING:
Every sample key that does not have a corresponding matched input key.

C. EXTRA:
Every input key that does not have a corresponding matched sample key.

CRITICAL RULES:
- Every input key MUST appear in exactly one of MATCHED or EXTRA.
- Every sample key MUST appear in exactly one of MATCHED or MISSING.
- Never reuse an input key.
- Never reuse a sample key.
- A single sample field cannot satisfy multiple input fields.
- A single input field cannot satisfy multiple sample fields.
- If two input keys represent the same sample field, match only one and classify the other as EXTRA.
- Never discard, overlook, or silently ignore any key.

## STEP 4: VERIFY COUNTS

Before calculating the score, verify these equations:

input_key_count = matched_count + extra_count

sample_key_count = matched_count + missing_count

If either equation is incorrect, redo the matching inventory.

Do not calculate the score until both equations are satisfied.

## STEP 5: CALCULATE SCORE

Use ONLY this mathematical formula:

score = (2 * matched_count / (input_key_count + sample_key_count)) * 100

Round to the nearest integer.

Special cases:
- Both objects have zero keys: 100.
- Only one object has zero keys: 0.

NEVER estimate, guess, or subjectively assign a score.

## STEP 6: ABSOLUTE SCORING CONDITIONS

- 100 is allowed ONLY when missing_count = 0 AND extra_count = 0.
- Any missing field MUST reduce the score.
- Any extra field MUST reduce the score.
- If input and sample have different numbers of keys, 100 is impossible.
- If two fields are semantically similar but cannot be uniquely paired, count the unmatched field.
- Do not award 100 because the majority of fields match.
- Do not prioritize semantic resemblance over actual field accounting.

## STEP 7: COMPARE ALL SAMPLES

Repeat STEPS 2-6 independently for EVERY sample.

Choose the sample with the highest calculated score.

If scores tie, choose the sample with the greatest number of matched fields.

## STEP 8: FINAL AUDIT

Before responding, confirm:
1. Every input key has been accounted for.
2. Every sample key has been accounted for.
3. Missing fields have been counted.
4. Extra fields have been counted.
5. No key has been matched more than once.
6. The score follows the exact formula.
7. A score of 100 has zero missing and zero extra fields.

If any condition fails, redo the comparison.

## OUTPUT

Return ONLY valid JSON:

{
  "score": <integer 0-100>,
  "best_match_id": <sample ID>,
  "reason": "<one short sentence identifying the missing and extra fields, if any>"
}

Do not include Markdown, additional explanations, or any other output.
"""

class SimilarityError(RuntimeError):
    """The model gave no usable comparison."""


def same_url_samples(website_url: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rows with a JSON sample stored under exactly this URL (ignoring surrounding spaces and a trailing /)."""

    def normal(url: str | None) -> str:
        return (url or "").strip().rstrip("/")

    wanted = normal(website_url)
    return [r for r in rows if wanted and isinstance(r.get("sample_json"), dict) and normal(r.get("website_url")) == wanted]


async def compare_with_samples(website_url: str, data: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Ask the model how similar ``data``'s keys are to the samples stored for exactly this URL; None if there are none."""

    samples = same_url_samples(website_url, rows)[:20]
    if not samples:
        logger.info("Similarity: no sample stored for the exact URL %s", website_url)
        return None
    key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not key:
        logger.warning("Similarity: OPENAI_API_KEY is not set")
        raise JevConfigurationError("Comparison requires OPENAI_API_KEY")

    def keys_only(value: Any) -> Any:  # same structure, values removed: they are never sent to the model
        if isinstance(value, dict):
            return {k: keys_only(v) for k, v in value.items()}
        return [keys_only(value[0])] if isinstance(value, list) and value else None

    request = {
        "input": keys_only(data),
        "samples": [{"id": s["id"], "name": s.get("name"), "keys": keys_only(s["sample_json"])} for s in samples],
    }
    body: dict[str, Any] = {
        "model": OPENAI_MODEL,
        "temperature": 0,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SIMILARITY},
            {"role": "user", "content": json.dumps(request, ensure_ascii=False)},
        ],
    }
    logger.info("Similarity: comparing %d key(s) with %d sample(s) for %s using %s", len(keys_only(data)), len(samples), website_url, OPENAI_MODEL)
    started = time.perf_counter()
    result = await JevModelClient()._post_json(OPENAI_URL, key, body)
    try:
        answer = parse_single_object(result["choices"][0]["message"]["content"])
        score = max(0, min(100, round(float(answer["score"]))))
        best = next(s for s in samples if s["id"] == answer["best_match_id"])
    except (KeyError, IndexError, TypeError, ValueError, StopIteration) as error:
        logger.warning("Similarity: unusable model answer after %d ms: %s", since(started), clip(result, 200))
        raise SimilarityError("The model returned no valid comparison") from error
    logger.info("Similarity: score %d%% (best match #%s %r) in %d ms - %s", score, best["id"], best.get("name"), since(started), clip(answer.get("reason", ""), 120))
    return {
        "website_url": website_url,
        "score": score,
        "best_match": {"id": best["id"], "name": best.get("name")},
        "reason": str(answer.get("reason", ""))[:300],
        "model": OPENAI_MODEL,
    }
