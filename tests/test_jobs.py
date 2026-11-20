from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from chrome_plugin_jev import jobs


def test_instruction_job_uses_jev_agent(monkeypatch):
    calls = []

    class FakeAgent:
        def __init__(self, bridge, *, user_id):
            calls.append((bridge, user_id))

        async def run(self, instruction, **kwargs):
            calls.append((instruction, kwargs))
            return SimpleNamespace(
                status="done",
                text="Completed",
                session_id="jev-session",
                steps=({"kind": "click"},),
            )

    monkeypatch.setattr(jobs, "JevBrowserAgent", FakeAgent)
    updates = AsyncMock()
    monkeypatch.setattr(jobs.job_store, "update", updates)
    job = jobs.Job(
        id="job-1",
        user_id=42,
        request={"instruction": "Complete the page", "profile": "Work", "session": "task-1"},
    )

    asyncio.run(jobs.run_job(job))

    assert calls[0][1] == 42
    assert calls[1] == (
        "Complete the page",
        {"browser_session": "task-1", "profile": "Work", "target_url": None},
    )
    assert updates.await_args_list[-1].kwargs["status"] == "done"
    assert updates.await_args_list[-1].kwargs["result"]["jevSessionId"] == "jev-session"


def test_target_url_with_instruction_runs_agent_after_navigation():
    request = jobs.normalize_instruction(
        {"instruction": "Open the first result", "targetUrl": "https://example.com"}
    )

    assert jobs._commands_for(request) == []


def test_target_url_alone_preserves_direct_navigation_contract():
    request = jobs.normalize_instruction({"targetUrl": "https://example.com"})

    assert jobs._commands_for(request) == [
        {
            "action": "navigate",
            "args": {"url": "https://example.com"},
            "profile": None,
            "session": None,
        }
    ]
