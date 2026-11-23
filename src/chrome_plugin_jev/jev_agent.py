"""Bounded Jev Ultrafast-style browser agent for human instructions."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from .jev_browser import ExtensionBrowser, StalePage
from .jev_model import MAX_STEPS, JevModelClient


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
        await browser.prepare(goal, target_url)
        page = await browser.observe(goal)
        history: list[dict[str, Any]] = []
        started = time.perf_counter()
        model_calls = 0

        while len(history) < self.max_steps and model_calls < self.max_steps * 2:
            try:
                decision = await self.model.choose(page, goal, history)
                model_calls += 1
                selected = decision["choice"]
                if selected == "answer":
                    fresh_page = await browser.observe(goal)
                    if fresh_page["fingerprint"] != page["fingerprint"]:
                        page = fresh_page
                        continue
                    answer, answer_helper = await self.model.page_answer(
                        goal, fresh_page, history
                    )
                    if not answer:
                        return JevAgentResult(
                            session_id=session_id,
                            status="needs_human",
                            text="The current page did not visibly support the requested answer.",
                            steps=tuple(history),
                            page=fresh_page,
                        )
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
                    return JevAgentResult(
                        session_id=session_id,
                        status="done",
                        text=text,
                        steps=tuple(history),
                        page=fresh_page,
                    )
                if selected in {"DONE", "BLOCKED"}:
                    fresh_page = await browser.observe(goal)
                    if fresh_page["fingerprint"] != page["fingerprint"]:
                        page = fresh_page
                        continue
                    status = "done" if selected == "DONE" else "needs_human"
                    text = (
                        f"Task completed in {len(history)} browser action(s)."
                        if status == "done"
                        else "Jev could not find a safe observed action to continue."
                    )
                    return JevAgentResult(
                        session_id=session_id,
                        status=status,
                        text=text,
                        steps=tuple(history),
                        page=fresh_page,
                    )

                action = next(
                    item for item in page["actions"] if item.get("id") == selected
                )
                value = None
                text_helper = None
                if action.get("kind") == "fill":
                    value, text_helper = await self.model.field_text(
                        goal, action, page, history
                    )

                await browser.act(action, page, text=value)
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
                page = await browser.observe(goal)
                step["page_changed"] = page["fingerprint"] != previous["fingerprint"]
                step["url"] = page.get("url")
                step["elapsed_ms"] = round((time.perf_counter() - started) * 1000)

                repeated = history[-3:]
                if (
                    len(repeated) == 3
                    and all(
                        item["page_changed"] is False and item["kind"] != "wait"
                        for item in repeated
                    )
                ):
                    return JevAgentResult(
                        session_id=session_id,
                        status="needs_human",
                        text="Stopped after three browser actions made no observable progress.",
                        steps=tuple(history),
                        page=page,
                    )
            except StalePage:
                page = await browser.observe(goal)
                continue
            except StopIteration as error:
                raise RuntimeError(
                    "Jev selected an action that was not present in the observation"
                ) from error

        return JevAgentResult(
            session_id=session_id,
            status="needs_human",
            text=f"Stopped at the configured {self.max_steps}-action safety limit.",
            steps=tuple(history),
            page=page,
        )
