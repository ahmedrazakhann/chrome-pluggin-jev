"""Async WebSocket bridge between FastAPI and the Chrome MV3 extension.

The extension owns all browser and CDP work.  The server only maintains a
small, per-profile connection registry and correlates ``tool_call`` frames
with ``tool_result`` frames.  This keeps the Python implementation independent
while preserving Agent WebBridge's wire protocol.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from .logs import since

logger = logging.getLogger(__name__)


class BridgeError(RuntimeError):
    """Base class for bridge failures that are safe to expose to API clients."""


class BridgeUnavailable(BridgeError):
    """No extension is connected for the requested profile."""


class BridgeTimeout(BridgeError):
    """The extension did not answer a tool call in time."""


class BridgeToolError(BridgeError):
    """The extension returned a tool error."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class BridgeConnection:
    websocket: WebSocket
    profile: str
    user_id: int
    connected_at: str = field(default_factory=_now)
    last_seen: str = field(default_factory=_now)
    extension_id: str | None = None
    extension_version: str | None = None
    pending: dict[str, asyncio.Future[Any]] = field(default_factory=dict)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, message: dict[str, Any]) -> None:
        async with self.send_lock:
            await self.websocket.send_text(json.dumps(message, separators=(",", ":")))


class BridgeManager:
    """Connection registry and request/response multiplexer."""

    def __init__(self) -> None:
        self._connections: dict[tuple[int, str], BridgeConnection] = {}
        self._lock = asyncio.Lock()

    async def register(self, websocket: WebSocket, profile: str, user_id: int = 0, subprotocol: str | None = None) -> BridgeConnection:
        await websocket.accept(subprotocol=subprotocol)
        connection = BridgeConnection(websocket=websocket, profile=profile or "default", user_id=user_id)
        key = (connection.user_id, connection.profile)
        async with self._lock:
            previous = self._connections.get(key)
            self._connections[key] = connection
        if previous is not None and previous is not connection:
            await self._close_connection(previous, "replaced by a newer extension connection")
        logger.debug("Chrome extension connected (user %s, profile %r)", connection.user_id, connection.profile)
        return connection

    async def unregister(self, connection: BridgeConnection) -> None:
        async with self._lock:
            key = (connection.user_id, connection.profile)
            if self._connections.get(key) is connection:
                self._connections.pop(key, None)
        # The extension reconnects routinely; it only matters when calls were in flight.
        logger.log(
            logging.WARNING if connection.pending else logging.DEBUG,
            "Chrome extension disconnected (user %s, profile %r, %d call(s) still waiting)",
            connection.user_id, connection.profile, len(connection.pending),
        )
        error = BridgeUnavailable("Chrome extension disconnected")
        for future in list(connection.pending.values()):
            if not future.done():
                future.set_exception(error)
        connection.pending.clear()

    async def _close_connection(self, connection: BridgeConnection, reason: str) -> None:
        for future in list(connection.pending.values()):
            if not future.done():
                future.set_exception(BridgeUnavailable(reason))
        connection.pending.clear()
        try:
            await connection.websocket.close(code=4001, reason=reason[:120])
        except Exception:
            pass

    def _pick(self, profile: str | None, user_id: int) -> BridgeConnection | None:
        connections = {key[1]: value for key, value in self._connections.items() if key[0] == user_id}
        if profile and profile in connections:
            return connections[profile]
        if "default" in connections:
            return connections["default"]
        if len(connections) == 1:
            return next(iter(connections.values()))
        return None

    async def call_tool(
        self,
        action: str,
        args: dict[str, Any] | None = None,
        *,
        session: str | None = None,
        profile: str | None = None,
        user_id: int = 0,
        timeout: float = 300.0,
    ) -> Any:
        connection = self._pick(profile, user_id)
        if connection is None:
            wanted = f" for profile {profile!r}" if profile else ""
            raise BridgeUnavailable(f"No Chrome extension is connected{wanted}")

        request_id = str(uuid4())
        started = time.perf_counter()
        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        connection.pending[request_id] = future
        try:
            try:
                await connection.send(
                    {
                        "type": "tool_call",
                        "requestId": request_id,
                        "payload": {
                            "name": action,
                            "args": {**(args or {}), "_session": session} if session else (args or {}),
                        },
                    }
                )
            except Exception as error:
                raise BridgeUnavailable("Chrome extension connection is no longer available") from error
            try:
                result = await asyncio.wait_for(future, timeout=timeout)
            except asyncio.TimeoutError as error:
                logger.warning("Extension tool %s timed out after %d ms", action, since(started))
                raise BridgeTimeout(f"Chrome extension timed out after {timeout:.0f}s") from error
            except BridgeToolError as error:
                logger.debug("Extension tool %s failed after %d ms: %s", action, since(started), error)
                raise
            elapsed = since(started)
            # Every tool call at DEBUG; slow ones at INFO so they stand out.
            logger.log(logging.INFO if elapsed >= 3000 else logging.DEBUG, "Extension tool %s took %d ms", action, elapsed)
            return result
        finally:
            connection.pending.pop(request_id, None)

    async def handle_message(self, connection: BridgeConnection, message: Any) -> None:
        connection.last_seen = _now()
        if not isinstance(message, dict):
            return
        message_type = message.get("type")
        if message_type == "hello":
            payload = message.get("payload") if isinstance(message.get("payload"), dict) else {}
            connection.extension_id = _as_string(payload.get("extensionId"))
            connection.extension_version = _as_string(payload.get("extensionVersion"))
            await connection.send({"type": "hello_ack"})
            return
        if message_type == "ping":
            await connection.send({"type": "pong"})
            return
        if message_type == "pong":
            return
        if message_type != "tool_result":
            return

        request_id = message.get("responseToRequestId")
        future = connection.pending.get(request_id)
        if future is None or future.done():
            return
        payload = message.get("payload")
        if isinstance(payload, dict) and payload.get("error"):
            future.set_exception(BridgeToolError(str(payload["error"])))
        elif isinstance(payload, dict) and "data" in payload:
            future.set_result(payload["data"])
        else:
            future.set_result(payload)

    def status(self, user_id: int | None = None) -> dict[str, Any]:
        connections = []
        for connection in self._connections.values():
            if user_id is not None and connection.user_id != user_id:
                continue
            connections.append(
                {
                    "profile": connection.profile,
                    "connected": True,
                    "extensionId": connection.extension_id,
                    "extensionVersion": connection.extension_version,
                    "connectedAt": connection.connected_at,
                    "lastSeen": connection.last_seen,
                    "pendingCalls": len(connection.pending),
                }
            )
        return {
            "ok": True,
            "connected": bool(connections),
            "extensionConnected": bool(connections),
            "connections": connections,
            # ``daemons`` keeps the status shape used by the original
            # ingest server while the richer connection list is Python-native.
            "daemons": connections,
        }

    async def websocket_loop(self, connection: BridgeConnection) -> None:
        try:
            while True:
                raw = await connection.websocket.receive_text()
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                await self.handle_message(connection, message)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            await self.unregister(connection)


def _as_string(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


bridge_manager = BridgeManager()
