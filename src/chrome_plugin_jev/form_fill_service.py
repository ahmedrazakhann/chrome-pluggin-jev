"""Deterministic-first form-fill orchestration with a bounded Jev fallback."""

from __future__ import annotations

import logging
import os
import time
from typing import Any
from urllib.parse import urlparse

from .domain_skills import DomainSkillError, generic_form_skill
from .form_dropdown import fill_dropdown
from .form_fill import FormFillError, flatten_record
from .party_lookup import fill_party, party_request
from .jev_fallback import fallback_reason
from .logs import clip, since

logger = logging.getLogger(__name__)


def _origin(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    return (
        f"{parsed.scheme}://{parsed.netloc}"
        if parsed.scheme in {"http", "https"} and parsed.netloc
        else None
    )


def _selected_label(field: dict[str, Any] | None) -> str:
    if not field:
        return ""
    value = field.get("beforeValue", "")
    option = next(
        (item for item in field.get("options", []) if item.get("value") == value),
        {},
    )
    return str(option.get("label") or value).casefold().strip()


class FormFillService:
    def __init__(self, *, bridge, matcher, skill_resolver=None, fallback=None) -> None:
        self.bridge = bridge
        self.matcher = matcher
        self.skill_resolver = skill_resolver
        self.fallback = fallback

    async def run(
        self,
        *,
        record: dict[str, Any],
        profile: str | None = None,
        tab_id: int | None = None,
        confidence_threshold: float = 0.75,
        max_rounds: int = 5,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        logger.info("Form fill start: tab %s, up to %d round(s), confidence >= %.2f", tab_id, max_rounds, confidence_threshold)
        try:
            result = await self._run(
                record=record, profile=profile, tab_id=tab_id,
                confidence_threshold=confidence_threshold, max_rounds=max_rounds,
            )
        except Exception as error:
            logger.warning("Form fill failed after %d ms: %s", since(started), error)
            raise
        fallback = result.get("fallback") or {}
        log = logger.info if result.get("status") == "done" else logger.warning
        log(
            "Form fill finished: %s in %d ms | %s filled, %s skipped, %s failed | stop: %s%s",
            result.get("status"), since(started), result.get("filled"), result.get("skipped"),
            result.get("failed"), result.get("stopReason"),
            f" | fallback {fallback.get('status') or fallback.get('reason')}" if fallback else "",
        )
        return result

    async def _run(
        self,
        *,
        record: dict[str, Any],
        profile: str | None,
        tab_id: int | None,
        confidence_threshold: float,
        max_rounds: int,
    ) -> dict[str, Any]:
        candidates = flatten_record(record)
        if not candidates:
            raise FormFillError("record contains no fillable values")
        candidate_count = len(candidates)
        logger.debug("Form fill: %d value(s) in the record to place", candidate_count)
        rounds: list[dict[str, Any]] = []
        total_filled = total_skipped = total_failed = 0
        attempted: set[str] = set()
        stop_reason = "round_limit"
        command_timeout = float(os.getenv("CHROME_PLUGIN_COMMAND_TIMEOUT", "300"))
        target_args = {"_tabId": tab_id} if tab_id is not None else {}
        skill = None
        skill_error = None
        skill_resolved = False
        active_frame_policy: dict[str, Any] | None = None
        lookup_enabled = False
        page_urls: list[str] = []
        last_snapshot: dict[str, Any] = {}
        expected_party_code: tuple[str, str] | None = None

        for round_number in range(1, max_rounds + 1):
            scan_args: dict[str, Any] = {
                **target_args,
                "settleMs": 250,
                "maxWaitMs": 3_000,
            }
            if active_frame_policy:
                scan_args["framePolicy"] = active_frame_policy
            began = time.perf_counter()
            snapshot = await self.bridge.call_tool(
                "scan_form",
                scan_args,
                profile=profile,
                timeout=command_timeout,
            )
            if not isinstance(snapshot, dict) or not isinstance(
                snapshot.get("fields"), list
            ):
                raise FormFillError("extension returned an invalid form snapshot")
            logger.debug(
                "Round %d: scanned the form in %d ms: %d field(s), %d already filled | %s",
                round_number, since(began), len(snapshot["fields"]),
                sum(1 for field in snapshot["fields"] if field.get("occupied")), _origin(snapshot.get("url")),
            )
            last_snapshot = snapshot
            if expected_party_code:
                expected_name, expected_code = expected_party_code
                retained = next((field for field in snapshot["fields"] if field.get("name") == expected_name), None)
                if not retained or retained.get("beforeValue") != expected_code:
                    stop_reason = "party_code_not_retained"
                    total_failed += 1
                    break
                expected_party_code = None
            if not target_args and isinstance(snapshot.get("tabId"), int):
                target_args = {"_tabId": snapshot["tabId"]}
            frame_origins = snapshot.get("frameOrigins") or snapshot.get(
                "frameUrls", []
            )
            page_urls = list(
                dict.fromkeys(
                    [
                        origin
                        for url in [snapshot.get("url"), *frame_origins]
                        if (origin := _origin(url))
                    ]
                )
            )
            if not skill_resolved:
                skill_resolved = True
                if self.skill_resolver:
                    try:
                        skill = await self.skill_resolver.resolve(page_urls)
                    except DomainSkillError as error:
                        skill_error = str(error)
                if skill:
                    lookup_enabled = skill.party_lookup_enabled()
                    if lookup_enabled:
                        # Company names are lookup queries, never values for Code inputs.
                        party_names = {"importer", "exporter", "notify_party", "cargo_handler", "agent"}
                        candidates = [candidate for candidate in candidates if candidate.path.split(".", 1)[0] not in party_names]
                    active_frame_policy = skill.frame_policy()
                    if active_frame_policy:
                        snapshot = await self.bridge.call_tool(
                            "scan_form",
                            {
                                **target_args,
                                "settleMs": 250,
                                "maxWaitMs": 3_000,
                                "framePolicy": active_frame_policy,
                            },
                            profile=profile,
                            timeout=command_timeout,
                        )
                        if not isinstance(snapshot, dict) or not isinstance(
                            snapshot.get("fields"), list
                        ):
                            raise FormFillError(
                                "extension returned an invalid frame snapshot"
                            )
                        last_snapshot = snapshot
                        frame_origins = snapshot.get("frameOrigins", [])
                        page_urls = list(
                            dict.fromkeys(
                                [
                                    origin
                                    for url in [snapshot.get("url"), *frame_origins]
                                    if (origin := _origin(url))
                                ]
                            )
                        )

            if lookup_enabled and snapshot.get("framePolicy", {}).get("status") == "matched":
                regime_field = next((field for field in snapshot["fields"] if field.get("name") == "value(regimeTypeId)"), None)
                regime = _selected_label(regime_field)
                intent = str(record.get("declaration_category", "")).casefold().strip()
                if regime in {"import", "export"} and intent in {"import", "export"} and regime != intent:
                    stop_reason = "party_regime_mismatch"
                    total_failed += 1
                    rounds.append({"round": round_number, "lookup": {"status": "needs_review", "reason": "record regime differs from portal"}})
                    break
                if regime in {"import", "export"}:
                    request = party_request(record, regime)
                    declaration_type = next((field for field in snapshot["fields"] if field.get("name") == "value(decTypeId)"), None)
                    code_name = f"value({regime}erCode)"
                    code_field = next((field for field in snapshot["fields"] if field.get("name") == code_name), None)
                    if request and declaration_type and declaration_type.get("occupied") and code_field and not code_field.get("occupied"):
                        began = time.perf_counter()
                        outcome = await fill_party(
                            bridge=self.bridge, matcher=self.matcher, snapshot=snapshot,
                            party=regime, requested=request, target_args=target_args,
                            profile=profile, timeout=command_timeout,
                            confidence_threshold=confidence_threshold,
                        )
                        rounds.append({"round": round_number, "lookup": outcome})
                        logger.info(
                            "Round %d: %s search for %r -> %s in %d ms%s",
                            round_number, regime, clip(request.get("name", ""), 60), outcome.get("status"), since(began),
                            f" (code {outcome.get('code')})" if outcome.get("code") else f" ({outcome.get('reason')})" if outcome.get("reason") else "",
                        )
                        if outcome.get("status") == "needs_review":
                            stop_reason = "party_match_needs_review"
                            break
                        if outcome.get("status") != "filled":
                            stop_reason = "party_lookup_failed"
                            total_failed += 1
                            break
                        total_filled += 1
                        expected_party_code = (code_name, outcome["code"])
                        continue

            if not candidates:
                stop_reason = "no_remaining_candidates"
                break

            empty_fields = [
                field
                for field in snapshot["fields"]
                if not field.get("occupied")
                and field.get("fingerprint", field["fieldId"] + field.get("label", ""))
                not in attempted
            ]
            if not empty_fields:
                logger.debug("Round %d: no empty fields left to fill", round_number)
                stop_reason = (
                    "frame_policy_mismatch"
                    if snapshot.get("framePolicy", {}).get("status") == "mismatch"
                    else "no_empty_fields"
                )
                safe_snapshot = {**snapshot, "url": _origin(snapshot.get("url"))}
                safe_snapshot.pop("frameUrls", None)
                safe_snapshot["frameOrigins"] = page_urls[1:]
                rounds.append(
                    {
                        "round": round_number,
                        "snapshot": safe_snapshot,
                        "assignments": [],
                        "skipped": [],
                    }
                )
                break

            model_snapshot = {**snapshot, "fields": empty_fields}
            model_snapshot["url"] = _origin(snapshot.get("url")) or ""
            model_snapshot.pop("frameUrls", None)
            model_snapshot["frameOrigins"] = page_urls[1:]
            if skill:
                model_snapshot["domainSkill"] = skill.as_model_context()
            began = time.perf_counter()
            mapping = await self.matcher.match(
                candidates=candidates,
                snapshot=model_snapshot,
                confidence_threshold=confidence_threshold,
            )
            total_skipped += len(mapping.skipped)
            labels = {field["fieldId"]: field.get("label") or field.get("name") or field["fieldId"] for field in empty_fields}
            logger.info(
                "Round %d: Jev matched %d of %d empty field(s) in %d ms",
                round_number, len(mapping.assignments), len(empty_fields), since(began),
            )
            for item in mapping.assignments:
                logger.debug(
                    "Round %d:   %r <- %s = %r (confidence %.2f)",
                    round_number, clip(labels.get(item["fieldId"], item["fieldId"]), 50),
                    item.get("recordPath"), clip(item.get("value"), 60), item.get("confidence") or 0,
                )
            for item in mapping.skipped:
                logger.debug(
                    "Round %d:   skipped %r: %s", round_number,
                    clip(labels.get(item.get("fieldId"), item.get("fieldId")), 50), item.get("reason"),
                )
            round_result: dict[str, Any] = {
                "round": round_number,
                "snapshotId": snapshot.get("snapshotId"),
                "url": _origin(snapshot.get("url")),
                "fieldCount": len(snapshot["fields"]),
                "assignments": mapping.assignments,
                "skipped": mapping.skipped,
                "model": mapping.model,
                "usage": mapping.usage,
            }
            if not mapping.assignments:
                stop_reason = "no_confident_matches"
                rounds.append(round_result)
                break

            by_id = {field["fieldId"]: field for field in empty_fields}
            interactive = next(
                (
                    item
                    for item in mapping.assignments
                    if by_id[item["fieldId"]].get("inputType") in {"combobox", "select"}
                ),
                None,
            )
            if (
                interactive
                and by_id[interactive["fieldId"]].get("inputType") == "combobox"
            ):
                field = by_id[interactive["fieldId"]]
                attempted.add(
                    field.get("fingerprint", field["fieldId"] + field.get("label", ""))
                )
                began = time.perf_counter()
                outcome = await fill_dropdown(
                    bridge=self.bridge,
                    matcher=self.matcher,
                    snapshot=snapshot,
                    field=field,
                    assignment=interactive,
                    target_args=target_args,
                    profile=profile,
                    timeout=command_timeout,
                    confidence_threshold=confidence_threshold,
                )
                logger.info(
                    "Round %d: search dropdown %r -> %s in %d ms",
                    round_number, clip(field.get("label", ""), 50), outcome.get("status"), since(began),
                )
                round_result["assignments"] = [interactive]
                round_result["apply"] = {
                    "filled": outcome.get("filled", 0),
                    "results": [outcome],
                    "changed": True,
                }
                rounds.append(round_result)
                total_filled += int(outcome.get("filled") or 0)
                total_failed += int(outcome.get("status") != "filled")
                continue

            if interactive:
                applied_assignments = [
                    item
                    for item in mapping.assignments
                    if by_id[item["fieldId"]].get("inputType")
                    not in {"combobox", "select"}
                ]
                applied_assignments.append(interactive)
            else:
                applied_assignments = mapping.assignments
            round_result["assignments"] = applied_assignments

            began = time.perf_counter()
            apply_result = await self.bridge.call_tool(
                "apply_fill_plan",
                {
                    **target_args,
                    "snapshotId": snapshot["snapshotId"],
                    "assignments": applied_assignments,
                    "settleMs": 250,
                    "maxWaitMs": 3_000,
                },
                profile=profile,
                timeout=command_timeout,
            )
            if not isinstance(apply_result, dict):
                raise FormFillError("extension returned an invalid fill result")
            round_result["apply"] = apply_result
            rounds.append(round_result)
            problems = [item for item in apply_result.get("results", []) if item.get("status") != "filled"]
            logger.info(
                "Round %d: wrote %s field(s) in %d ms%s",
                round_number, apply_result.get("filled", 0), since(began),
                " | not written: " + "; ".join(
                    f"{clip(labels.get(item.get('fieldId'), item.get('fieldId')), 40)!r} ({item.get('status')}: {item.get('reason')})"
                    for item in problems
                ) if problems else "",
            )
            if apply_result.get("status") == "stale":
                stop_reason = "stale_snapshot_retry"
                continue
            total_filled += int(apply_result.get("filled") or 0)
            total_failed += sum(
                item.get("status") in {"failed", "skipped"}
                for item in apply_result.get("results", [])
            )
            for assignment in applied_assignments:
                field = by_id[assignment["fieldId"]]
                attempted.add(
                    field.get("fingerprint", field["fieldId"] + field.get("label", ""))
                )
            if total_failed:
                stop_reason = "write_failed"
                break
            if interactive and apply_result.get("filled"):
                continue
            if not apply_result.get("changed"):
                stop_reason = "form_stable"
                break

        if expected_party_code:
            stop_reason = "party_code_unverified"
            total_failed += 1
        if lookup_enabled and active_frame_policy and stop_reason not in {"frame_policy_mismatch", "party_match_needs_review"}:
            final_snapshot = await self.bridge.call_tool(
                "scan_form",
                {**target_args, "settleMs": 250, "maxWaitMs": 3_000, "framePolicy": active_frame_policy},
                profile=profile,
                timeout=command_timeout,
            )
            if isinstance(final_snapshot, dict) and isinstance(final_snapshot.get("fields"), list):
                last_snapshot = final_snapshot
                if final_snapshot.get("framePolicy", {}).get("status") == "mismatch":
                    stop_reason = "frame_policy_mismatch"
                    total_failed += 1
                else:
                    regime_field = next((item for item in final_snapshot["fields"] if item.get("name") == "value(regimeTypeId)"), None)
                    regime = _selected_label(regime_field)
                    if regime in {"import", "export"}:
                        code_name = f"value({regime}erCode)"
                        code_field = next((item for item in final_snapshot["fields"] if item.get("name") == code_name), None)
                        if not code_field or not code_field.get("occupied"):
                            stop_reason = "required_party_missing"
                            total_failed += 1
                    elif str(record.get("declaration_category", "")).casefold().strip() in {"import", "export"}:
                        stop_reason = "regime_missing"
                        total_failed += 1
        status = (
            "done"
            if total_filled
            and not total_skipped
            and not total_failed
            and stop_reason != "round_limit"
            else "needs_review"
        )
        if not total_filled and not total_failed:
            status = "no_match"
        if stop_reason == "frame_policy_mismatch":
            status = "needs_review"
        if stop_reason == "party_match_needs_review":
            status = "needs_review"
        result: dict[str, Any] = {
            "status": status,
            "filled": total_filled,
            "skipped": total_skipped,
            "failed": total_failed,
            "stopReason": stop_reason,
            "candidateCount": candidate_count,
            "rounds": rounds,
            "page": {
                "url": _origin(last_snapshot.get("url")),
                "frameOrigins": page_urls[1:],
                "unsupportedFrames": last_snapshot.get("unsupportedFrames", 0),
                "fieldCount": len(last_snapshot.get("fields", [])),
                "framePolicy": last_snapshot.get("framePolicy"),
                "selectedFrames": last_snapshot.get("selectedFrames", []),
            },
            "domainSkill": skill.audit() if skill else None,
        }
        if skill_error:
            result["domainSkillError"] = skill_error
        reason = fallback_reason(result)
        if reason:
            if not skill:
                try:
                    skill = generic_form_skill()
                    result["domainSkill"] = skill.audit()
                except DomainSkillError as error:
                    result["status"] = "needs_review"
                    result["fallback"] = {
                        "attempted": False,
                        "reason": "generic_skill_unavailable",
                        "trigger": reason,
                    }
                    result["genericSkillError"] = str(error)
            if "fallback" in result:
                return result
            if not self.fallback:
                result["fallback"] = {
                    "attempted": False,
                    "reason": "jev_fallback_disabled",
                    "trigger": reason,
                }
            else:
                logger.info("Form fill handing over to the Jev agent (reason: %s)", reason)
                began = time.perf_counter()
                fallback = await self.fallback.run(
                    skill=skill,
                    record=record,
                    tab_id=target_args["_tabId"],
                    profile=profile,
                    reason=reason,
                    page_urls=page_urls,
                )
                logger.info(
                    "Jev agent fallback: %s, %d field(s) filled in %d ms", fallback.status, fallback.filled, since(began)
                )
                result["fallback"] = {**fallback.as_dict(), "trigger": reason}
                result["filled"] += fallback.filled
                if (
                    fallback.status == "done"
                    and fallback.verified
                    and fallback.filled > 0
                ):
                    result["status"] = "done"
                    result["stopReason"] = "jev_verified"
                else:
                    result["status"] = "needs_review"
        return result
