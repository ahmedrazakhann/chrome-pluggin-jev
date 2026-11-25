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

SIMILARITY = """You compare the KEYS (field names) of an input JSON object with the keys of sample JSON objects stored for the same page URL.
Only key names matter. Keys match when they mean the same field even if spelled differently ("First name", "firstName" and "given_name" are one field; "Email" and "Phone" are not).
Missing sample keys and extra input keys both lower the score. 100 means the same set of fields, 0 means no field in common.
Reply with ONLY this JSON object and nothing else:
{"score": <integer 0-100 for the most similar sample>, "best_match_id": <the id of that sample>, "reason": "<one short sentence>"}"""


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
    key = (os.getenv("TEXT_MODEL_API_KEY") or os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not key:
        logger.warning("Similarity: no TEXT_MODEL_API_KEY or OPENROUTER_API_KEY configured")
        raise JevConfigurationError("Comparison requires TEXT_MODEL_API_KEY or OPENROUTER_API_KEY")
    base_url = (os.getenv("TEXT_MODEL_BASE_URL") or os.getenv("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
    model = os.getenv("TEXT_MODEL") or "openai/gpt-4o-mini"

    def keys_only(value: Any) -> Any:  # same structure, values removed: they are never sent to the model
        if isinstance(value, dict):
            return {k: keys_only(v) for k, v in value.items()}
        return [keys_only(value[0])] if isinstance(value, list) and value else None

    request = {
        "input": keys_only(data),
        "samples": [{"id": s["id"], "name": s.get("name"), "keys": keys_only(s["sample_json"])} for s in samples],
    }
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SIMILARITY},
            {"role": "user", "content": json.dumps(request, ensure_ascii=False)},
        ],
    }
    if os.getenv("TEXT_MODEL_REASONING", "").lower() == "none":
        body["reasoning"] = {"enabled": False}
    logger.info("Similarity: comparing %d key(s) with %d sample(s) for %s using %s", len(keys_only(data)), len(samples), website_url, model)
    started = time.perf_counter()
    result = await JevModelClient()._post_json(base_url + "/chat/completions", key, body)
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
        "model": model,
    }
