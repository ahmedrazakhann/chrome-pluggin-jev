"""Small in-memory job queue for extension commands and deterministic tasks."""

from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .bridge import BridgeError, bridge_manager
from .jev_agent import JevBrowserAgent


JobStatus = str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class Job:
    id: str
    request: dict[str, Any]
    user_id: int = 0
    status: JobStatus = "queued"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    result: dict[str, Any] | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["createdAt"] = value.pop("created_at")
        value["updatedAt"] = value.pop("updated_at")
        return {key: item for key, item in value.items() if item is not None}


class JobStore:
    def __init__(self, max_jobs: int = 500) -> None:
        self._jobs: dict[str, Job] = {}
        self._max_jobs = max_jobs
        self._lock = asyncio.Lock()

    async def create(self, request: dict[str, Any], user_id: int = 0) -> Job:
        job = Job(id=str(uuid4()), request=request, user_id=user_id)
        async with self._lock:
            self._jobs[job.id] = job
            while len(self._jobs) > self._max_jobs:
                oldest = min(self._jobs.values(), key=lambda item: item.created_at)
                self._jobs.pop(oldest.id, None)
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        return sorted(self._jobs.values(), key=lambda item: item.created_at, reverse=True)

    async def update(self, job_id: str, **patch: Any) -> Job:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise KeyError(job_id)
            for key, value in patch.items():
                setattr(job, key, value)
            job.updated_at = _now()
            return job


job_store = JobStore()


def normalize_instruction(value: Any, *, profile: str | None = None) -> dict[str, Any]:
    """Normalize text/JSON input without discarding user data."""

    if isinstance(value, str):
        instruction = value
    elif value is None:
        instruction = ""
    elif isinstance(value, list):
        instruction = json.dumps(value, indent=2, ensure_ascii=False)
    elif isinstance(value, dict):
        obj = dict(value)
        text_value = next(
            (obj[key].strip() for key in ("instruction", "prompt", "message", "text") if isinstance(obj.get(key), str) and obj[key].strip()),
            None,
        )
        rest = {key: item for key, item in obj.items() if key not in {"instruction", "prompt", "message", "text", "profile", "session", "title"}}
        if text_value and rest:
            instruction = f"{text_value}\n\n{json.dumps(rest, indent=2, ensure_ascii=False)}"
        else:
            instruction = text_value or json.dumps(obj, indent=2, ensure_ascii=False)
    else:
        instruction = str(value)
    request = {"instruction": instruction, "body": value}
    if isinstance(value, dict):
        for key in ("profile", "session", "title", "targetUrl", "target_url", "commands", "action", "args"):
            if key in value:
                request[key] = value[key]
    if profile and not request.get("profile"):
        request["profile"] = profile
    return request


def _commands_for(request: dict[str, Any]) -> list[dict[str, Any]]:
    body = request.get("body")
    if isinstance(body, dict) and isinstance(body.get("commands"), list):
        return [item for item in body["commands"] if isinstance(item, dict) and isinstance(item.get("action"), str)]
    if isinstance(body, dict) and isinstance(body.get("action"), str):
        return [body]
    target_url = request.get("targetUrl") or request.get("target_url")
    has_instruction = isinstance(body, dict) and any(
        isinstance(body.get(key), str) and body[key].strip()
        for key in ("instruction", "prompt", "message", "text")
    )
    if isinstance(target_url, str) and target_url.strip() and not has_instruction:
        return [{"action": "navigate", "args": {"url": target_url}, "profile": request.get("profile"), "session": request.get("session")}]
    return []


async def run_job(job: Job) -> None:
    await job_store.update(job.id, status="running")
    try:
        commands = _commands_for(job.request)
        if not commands:
            result = await JevBrowserAgent(
                bridge_manager, user_id=job.user_id
            ).run(
                job.request["instruction"],
                browser_session=job.request.get("session") or f"portal-{job.id}",
                profile=job.request.get("profile"),
                target_url=job.request.get("targetUrl") or job.request.get("target_url"),
            )
            await job_store.update(
                job.id,
                status=result.status,
                result={
                    "status": result.status,
                    "text": result.text,
                    "jevSessionId": result.session_id,
                    "steps": list(result.steps),
                },
            )
            return
        results = []
        for command in commands:
            action = command.get("action")
            args = command.get("args") if isinstance(command.get("args"), dict) else {}
            result = await bridge_manager.call_tool(
                action,
                args,
                session=command.get("session") or job.request.get("session"),
                profile=command.get("profile") or job.request.get("profile"),
                user_id=job.user_id,
            )
            results.append(result)
        needs_human = any(isinstance(result, dict) and result.get("status") == "needs_human" for result in results)
        status = "needs_human" if needs_human else "done"
        await job_store.update(job.id, status=status, result={"status": status, "results": results})
    except BridgeError as error:
        message = str(error)
        status = "needs_human" if "human" in message.lower() else "failed"
        await job_store.update(job.id, status=status, error=message, result={"status": status, "notes": message})
    except Exception as error:  # pragma: no cover - defensive boundary for background tasks
        await job_store.update(job.id, status="failed", error=str(error), result={"status": "failed", "notes": str(error)})


def schedule_job(job: Job) -> None:
    asyncio.create_task(run_job(job))
