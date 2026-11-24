"""FastAPI surface for the Twenty Chrome extension and WebBridge.

The public identity endpoints retain the original portal contract.  The
WebBridge routes are the Python replacement for the original ingest server:
the extension connects once over WebSocket, while HTTP callers send commands
and poll jobs through this router.
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field

from .auth import require_bridge_user, verify_extension_connection_token, verify_extension_user
from .bridge import BridgeError, BridgeTimeout, BridgeUnavailable, bridge_manager
from .form_fill import (
    FormFillConfigurationError,
    FormFillError,
    FormFillProviderError,
    TypeSafeFormMatcher,
    create_form_fill_service,
)
from .extension_settings import SettingsUnavailable, create_extension_setting, list_extension_settings
from .jobs import job_store, normalize_instruction, schedule_job

router = APIRouter()


class CommandRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    action: str = Field(min_length=1, max_length=100)
    args: dict[str, Any] = Field(default_factory=dict)
    session: str | None = Field(default=None, max_length=200)
    profile: str | None = Field(default=None, max_length=300)


class FormFillRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    record: dict[str, Any]
    profile: str | None = Field(default=None, max_length=300)
    tab_id: int | None = Field(default=None, alias="tabId", ge=0)
    confidence_threshold: float = Field(default=0.75, alias="confidenceThreshold", ge=0, le=1)
    max_rounds: int = Field(default=5, alias="maxRounds", ge=1, le=8)


class ExtensionSettingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    website_url: str = Field(min_length=1, max_length=2000, pattern=r"^https?://")
    sample_json: dict[str, Any] = Field(min_length=1)


class JevRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Any
    questions: dict[str, Any]
    model: str | None = Field(default=None, max_length=100)


def _bridge_http_error(error: BridgeError) -> HTTPException:
    if isinstance(error, BridgeUnavailable):
        return HTTPException(status_code=503, detail=str(error))
    if isinstance(error, BridgeTimeout):
        return HTTPException(status_code=504, detail=str(error))
    return HTTPException(status_code=502, detail=str(error))


@router.get("/")
def root(user: dict[str, Any] = Depends(verify_extension_user)) -> dict[str, Any]:
    return {
        "service": "Twenty Portal Chrome Extension API",
        "status": "ok",
        "user_id": user["id"],
        "email": user["email"],
    }


@router.get("/health")
def health() -> dict[str, Any]:
    return {"service": "Twenty Portal Chrome Plugin Bridge", "status": "ok", **bridge_manager.status()}


@router.get("/status")
def status(user_id: int = Depends(require_bridge_user)) -> dict[str, Any]:
    return bridge_manager.status(user_id)


@router.get("/user")
def get_user(user: dict[str, Any] = Depends(verify_extension_user)) -> dict[str, Any]:
    return {"id": user["id"], "email": user["email"], "authenticated": True}


@router.get("/data")
def get_extension_data(user: dict[str, Any] = Depends(verify_extension_user)) -> dict[str, Any]:
    return {
        "user_id": user["id"],
        "email": user["email"],
        "last_sync": None,
        "sync_status": "ready",
    }


@router.get("/settings")
def get_settings(_: int = Depends(require_bridge_user)) -> dict[str, Any]:
    try:
        return {"settings": list_extension_settings()}
    except SettingsUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/settings", status_code=201)
def create_setting(payload: ExtensionSettingRequest, _: int = Depends(require_bridge_user)) -> dict[str, Any]:
    if len(json.dumps(payload.sample_json, ensure_ascii=False).encode("utf-8")) > 100_000:
        raise HTTPException(status_code=413, detail="sample_json exceeds 100 KB")
    try:
        return create_extension_setting(payload.name, payload.website_url, payload.sample_json)
    except SettingsUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/sync")
def sync_data(body: dict[str, Any], user: dict[str, Any] = Depends(verify_extension_user)) -> dict[str, Any]:
    return {"success": True, "user_id": user["id"], "synced_at": None, "data_received": body}


@router.post("/command")
async def command(payload: CommandRequest, user_id: int = Depends(require_bridge_user)) -> Any:
    # Keep compatibility with the source endpoint, which accepted both
    # {action, args:{...}} and {action, url:...} shapes.
    args = dict(payload.args)
    if not args and payload.model_extra:
        args = {
            key: value
            for key, value in payload.model_extra.items()
            if key not in {"action", "session", "profile"}
        }
    try:
        return await bridge_manager.call_tool(
            payload.action,
            args,
            session=payload.session,
            profile=payload.profile,
            user_id=user_id,
            timeout=float(os.getenv("CHROME_PLUGIN_COMMAND_TIMEOUT", "300")),
        )
    except BridgeError as error:
        raise _bridge_http_error(error) from error


@router.post("/form-fill")
async def form_fill(payload: FormFillRequest, user_id: int = Depends(require_bridge_user)) -> dict[str, Any]:
    """Idempotently map a record onto the current live form; never submits it."""
    try:
        return await create_form_fill_service(user_id).run(
            record=payload.record, profile=payload.profile, tab_id=payload.tab_id,
            confidence_threshold=payload.confidence_threshold, max_rounds=payload.max_rounds,
        )
    except BridgeError as error:
        raise _bridge_http_error(error) from error
    except FormFillConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except FormFillProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except FormFillError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/jev")
async def jev(payload: JevRequest, _: int = Depends(require_bridge_user)) -> dict[str, Any]:
    if not 1 <= len(payload.questions) <= 40:
        raise HTTPException(status_code=422, detail="questions must contain 1 to 40 entries")
    request = payload.model_dump(exclude_none=True)
    if len(json.dumps(request, ensure_ascii=False).encode("utf-8")) > 256_000:
        raise HTTPException(status_code=413, detail="Jev request exceeds 256 KB")
    try:
        return await TypeSafeFormMatcher().ask(request)
    except FormFillConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except FormFillProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


async def _read_body(request: Request) -> Any:
    raw = await request.body()
    if not raw:
        return ""
    try:
        return json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return raw.decode("utf-8", errors="replace")


@router.get("/jobs")
def list_jobs(user_id: int = Depends(require_bridge_user)) -> dict[str, Any]:
    return {"jobs": [job.as_dict() for job in job_store.list() if job.user_id == user_id]}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user_id: int = Depends(require_bridge_user)) -> dict[str, Any]:
    job = job_store.get(job_id)
    if job is None or job.user_id != user_id:
        raise HTTPException(status_code=404, detail="job not found")
    return job.as_dict()


@router.post("/jobs", status_code=202)
@router.post("/", status_code=202, include_in_schema=False)
async def create_job(request: Request, profile: str | None = None, user_id: int = Depends(require_bridge_user)) -> dict[str, Any]:
    body = await _read_body(request)
    normalized = normalize_instruction(body, profile=profile)
    job = await job_store.create(normalized, user_id=user_id)
    schedule_job(job)
    return job.as_dict()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    protocols = [item.strip() for item in websocket.headers.get("sec-websocket-protocol", "").split(",")]
    subprotocol = "chrome-plugin" if len(protocols) >= 2 and protocols[0] == "chrome-plugin" else None
    token = websocket.query_params.get("token") or websocket.headers.get("x-chrome-plugin-token")
    if not token and subprotocol:
        token = protocols[1]
    try:
        identity = await verify_extension_connection_token(token)
    except HTTPException as error:
        await websocket.close(code=4401, reason=str(error.detail))
        return

    profile = websocket.query_params.get("profile", "default").strip() or "default"
    connection = await bridge_manager.register(websocket, profile, int(identity["user_id"]), subprotocol)
    try:
        await bridge_manager.websocket_loop(connection)
    except WebSocketDisconnect:
        await bridge_manager.unregister(connection)
