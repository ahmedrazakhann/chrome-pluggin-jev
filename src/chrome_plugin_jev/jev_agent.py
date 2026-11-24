"""Bounded Jev Ultrafast-style browser agent for human instructions."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from .jev_browser import ExtensionBrowser, StalePage
from .jev_model import MAX_STEPS, JevModelClient, NoFieldValue
from .logs import clip, since

logger = logging.getLogger(__name__)

# The extension refuses an action when the page differs from what was read.
# A real change settles after one re-read; repeated refusals mean it never will.
MAX_STALE_RETRIES = 3


@dataclass(frozen=True)
class JevAgentResult:
    session_id: str
    status: str
    text: str
    steps: tuple[dict[str, Any], ...]
    page: dict[str, Any]


class JevBrowserAgent:
    def __init__(
        self,
        bridge: Any,
        *,
        user_id: int = 0,
        model: JevModelClient | None = None,
        max_steps: int | None = None,
    ) -> None:
        self.bridge = bridge
        self.user_id = user_id
        self.model = model or JevModelClient()
        self.max_steps = max_steps or int(os.getenv("JEV_MAX_STEPS", str(MAX_STEPS)))
        if not 1 <= self.max_steps <= 120:
            raise ValueError("JEV_MAX_STEPS must be between 1 and 120")

    async def run(
        self,
        instruction: str,
        *,
        browser_session: str | None = None,
        profile: str | None = None,
        tab_id: int | None = None,
        target_url: str | None = None,
    ) -> JevAgentResult:
        goal = instruction.strip()
        if not goal:
            raise ValueError("instruction must not be empty")
        session_id = browser_session or f"jev-{uuid4()}"
        browser = ExtensionBrowser(
            self.bridge,
            user_id=self.user_id,
            profile=profile,
            session=session_id,
            tab_id=tab_id,
        )
        started = time.perf_counter()
        # Count and time every kind of work so the end of the run says where
        # the time went: [calls, total ms].
        stats = {name: [0, 0] for name in ("page reads", "Jev", "text helper", "answer helper", "browser actions")}

        def track(name: str, began: float) -> int:
            elapsed = since(began)
            stats[name][0] += 1
            stats[name][1] += elapsed
            return elapsed

        async def observe(reason: str) -> dict[str, Any]:
            began = time.perf_counter()
            observed = await browser.observe(goal)
            logger.debug(
                "Read page (%s) in %d ms: %s | %d controls, %d chars of text",
                reason, track("page reads", began), clip(observed.get("url", ""), 100),
                len(observed.get("actions", [])), len(str(observed.get("text", ""))),
            )
            return observed

        def finish(result: JevAgentResult) -> JevAgentResult:
            breakdown = ", ".join(f"{name} {count}x/{total} ms" for name, (count, total) in stats.items() if count)
            log = logger.info if result.status == "done" else logger.warning
            log(
                "Agent finished: %s after %d action(s) in %d ms | %s | %s",
                result.status, len(result.steps), since(started), clip(result.text, 120), breakdown,
            )
            return result

        logger.debug("Agent start: session=%s max_steps=%d", session_id, self.max_steps)
        await browser.prepare(goal, target_url)
        page = await observe("start")
        history: list[dict[str, Any]] = []
        model_calls = 0
        stale_in_a_row = 0
        # Fields the text helper had no value for. All their options stay out of
        # Jev's choices so it moves on instead of picking the same field again.
        skipped_fields: set[int] = set()
        # The field whose Search button opened the current popup. Several fields
        # can share one popup ("Search Port" serves three port fields), so its
        # labels name that field too: "Search Port [for Port of Discharge] › Name".
        lookup_for: str | None = None

        while len(history) < self.max_steps and model_calls < self.max_steps * 2:
            try:
                if skipped_fields:
                    page = {
                        **page,
                        "actions": [
                            item for item in page["actions"]
                            if item.get("node") not in skipped_fields
                        ],
                    }
                in_popup = any(" › " in str(item.get("label", "")) for item in page["actions"])
                if not in_popup:
                    lookup_for = None
                elif lookup_for:
                    page = {
                        **page,
                        "actions": [
                            {**item, "label": str(item["label"]).replace(" › ", f" [for {lookup_for}] › ", 1)}
                            if " › " in str(item.get("label", "")) and "[for " not in str(item["label"]) else item
                            for item in page["actions"]
                        ],
                    }
                began = time.perf_counter()
                decision = await self.model.choose(page, goal, history)
                waited = track("Jev", began)
                model_calls += 1
                selected = decision["choice"]
                chosen = next((item for item in page["actions"] if item.get("id") == selected), None)
                alternatives = sorted(
                    decision.get("operation_probabilities", {}).items(), key=lambda item: item[1], reverse=True
                )[1:3]
                logger.debug(
                    "Step %d: Jev chose %s%s (confidence %.2f) in %d ms (API %s ms)%s",
                    len(history) + 1, decision.get("operation"),
                    f" on {clip(chosen.get('label', selected), 70)!r}" if chosen else "",
                    decision.get("confidence") or 0, waited, decision.get("latency_ms"),
                    " | next best: " + ", ".join(f"{name} {value:.2f}" for name, value in alternatives) if alternatives else "",
                )
                if selected == "answer":
                    fresh_page = await observe("confirm before answering")
                    if fresh_page["fingerprint"] != page["fingerprint"]:
                        logger.debug("Page changed before answering; asking Jev again")
                        page = fresh_page
                        continue
                    began = time.perf_counter()
                    answer, answer_helper = await self.model.page_answer(
                        goal, fresh_page, history
                    )
                    logger.info(
                        "Answer helper replied in %d ms: %r", track("answer helper", began), clip(answer or "(none)", 120)
                    )
                    if not answer:
                        return finish(JevAgentResult(
                            session_id=session_id,
                            status="needs_human",
                            text="The current page did not visibly support the requested answer.",
                            steps=tuple(history),
                            page=fresh_page,
                        ))
                    source = str(fresh_page.get("url", "")).strip()
                    text = answer if not source else f"{answer}\n\nSource: {source}"
                    history.append(
                        {
                            "step": len(history) + 1,
                            "action": "Return answer",
                            "kind": "answer",
                            "choice": selected,
                            "operation": decision.get("operation"),
                            "confidence": decision.get("confidence"),
                            "latency_ms": decision.get("latency_ms"),
                            "answer_helper": answer_helper,
                            "page_changed": False,
                            "url": source,
                            "elapsed_ms": round((time.perf_counter() - started) * 1000),
                        }
                    )
                    return finish(JevAgentResult(
                        session_id=session_id,
                        status="done",
                        text=text,
                        steps=tuple(history),
                        page=fresh_page,
                    ))
                if selected in {"DONE", "BLOCKED"}:
                    fresh_page = await observe(f"confirm {selected}")
                    if fresh_page["fingerprint"] != page["fingerprint"]:
                        logger.debug("Page changed after Jev said %s; asking again", selected)
                        page = fresh_page
                        continue
                    status = "done" if selected == "DONE" else "needs_human"
                    text = (
                        f"Task completed in {len(history)} browser action(s)."
                        if status == "done"
                        else "Jev could not find a safe observed action to continue."
                    )
                    return finish(JevAgentResult(
                        session_id=session_id,
                        status=status,
                        text=text,
                        steps=tuple(history),
                        page=fresh_page,
                    ))

                action = next(
                    item for item in page["actions"] if item.get("id") == selected
                )
                value = None
                text_helper = None
                text_ms = None
                if action.get("kind") == "fill":
                    began = time.perf_counter()
                    try:
                        value, text_helper = await self.model.field_text(
                            goal, action, page, history
                        )
                    except NoFieldValue as error:
                        # Nothing to type: record a skip so Jev sees it and picks
                        # something else (e.g. closes the lookup it opened).
                        track("text helper", began)
                        label = action.get("label", selected)
                        logger.warning(
                            "Step %d: no value for %r, skipping the field | %s",
                            len(history) + 1, clip(label, 60), clip(error, 200),
                        )
                        if isinstance(action.get("node"), int):
                            skipped_fields.add(action["node"])
                        history.append({
                            "step": len(history) + 1,
                            "action": (
                                f"Skipped {label}: the goal has no value to type there. If the goal names "
                                "the item instead of giving its code, use this field's Search button."
                            ),
                            "kind": "skip",
                            "choice": selected,
                            "operation": decision.get("operation"),
                            "target": decision.get("target"),
                            "confidence": decision.get("confidence"),
                            "latency_ms": decision.get("latency_ms"),
                            "text": None,
                            "page_changed": False,
                            "url": page.get("url"),
                            "elapsed_ms": since(started),
                        })
                        continue
                    text_ms = track("text helper", began)

                began = time.perf_counter()
                await browser.act(action, page, text=value)
                stale_in_a_row = 0
                label = str(action.get("label", ""))
                if action.get("kind") == "click" and label.startswith("Search ") and " › " not in label:
                    lookup_for = label.removeprefix("Search ").strip()
                act_ms = track("browser actions", began)
                step = {
                    "step": len(history) + 1,
                    "action": action.get("label", selected),
                    "kind": action.get("kind"),
                    "choice": selected,
                    "operation": decision.get("operation"),
                    "target": decision.get("target"),
                    "confidence": decision.get("confidence"),
                    "latency_ms": decision.get("latency_ms"),
                    "text": value,
                    "text_helper": text_helper,
                    "page_changed": None,
                    "url": page.get("url"),
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                }
                history.append(step)
                previous = page
                page = await observe(f"after step {step['step']}")
                step["page_changed"] = page["fingerprint"] != previous["fingerprint"]
                step["url"] = page.get("url")
                step["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
                # One line per step: what was done, how sure Jev was, and where the time went.
                unsure = (decision.get("confidence") or 0) < 0.5 and alternatives
                logger.info(
                    "Step %d: %s %r%s (confidence %.2f%s) | Jev %d ms%s, browser %d ms | %s",
                    step["step"], decision.get("operation"), clip(step["action"], 60),
                    f" = {clip(value, 60)!r}" if value is not None else "",
                    decision.get("confidence") or 0,
                    ", unsure: next " + ", ".join(f"{name} {prob:.2f}" for name, prob in alternatives) if unsure else "",
                    waited, f", text {text_ms} ms" if text_ms is not None else "", act_ms,
                    "page changed" if step["page_changed"] else "page did NOT change",
                )

                # Skips are decisions, not page actions, so they don't count here.
                repeated = [item for item in history if item["kind"] != "skip"][-3:]
                if (
                    len(repeated) == 3
                    and all(
                        item["page_changed"] is False and item["kind"] != "wait"
                        for item in repeated
                    )
                ):
                    return finish(JevAgentResult(
                        session_id=session_id,
                        status="needs_human",
                        text="Stopped after three browser actions made no observable progress.",
                        steps=tuple(history),
                        page=page,
                    ))
            except StalePage as error:
                stale_in_a_row += 1
                logger.warning(
                    "Browser refused the action (%d in a row): %s", stale_in_a_row, clip(error, 140)
                )
                if stale_in_a_row >= MAX_STALE_RETRIES:
                    return finish(JevAgentResult(
                        session_id=session_id,
                        status="needs_human",
                        text=(
                            f"Stopped: the browser refused the next action {stale_in_a_row} times in a row "
                            f"({str(error).removeprefix('Stale page: ').split(';')[0]})."
                        ),
                        steps=tuple(history),
                        page=page,
                    ))
                page = await observe("stale page")
                continue
            except StopIteration as error:
                raise RuntimeError(
                    "Jev selected an action that was not present in the observation"
                ) from error

        return finish(JevAgentResult(
            session_id=session_id,
            status="needs_human",
            text=(
                f"Stopped at the configured {self.max_steps}-action safety limit."
                if len(history) >= self.max_steps
                else f"Stopped after {model_calls} Jev calls without finishing ({len(history)} actions)."
            ),
            steps=tuple(history),
            page=page,
        ))
