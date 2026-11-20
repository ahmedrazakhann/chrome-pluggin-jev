"""Authentication helpers shared by the Chrome extension API."""

from __future__ import annotations

import hashlib
import hmac
import os
from typing import Optional

import httpx
from fastapi import Header, HTTPException

def backend_api_base_url() -> str:
    """Local stand-in for packages.platform_services.api_config."""
    base = os.getenv("BASE_LOCAL_URL", "http://127.0.0.1").rstrip("/")
    port = os.getenv("API_PORT", "8000")
    version = os.getenv("API_VERSION", "3")
    return f"{base}:{port}/api/v{version}"

PLUGIN_TOKEN_HEADER = "X-Chrome-Plugin-Token"


def _configured_token() -> str:
    expected = os.getenv("CHROME_PLUGIN_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Chrome plugin authentication is not configured")
    return expected


def require_plugin_token(
    x_chrome_plugin_token: Optional[str] = Header(default=None, alias=PLUGIN_TOKEN_HEADER),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """Require the configured local pairing token on HTTP bridge routes."""
    expected = _configured_token()
    candidate = (x_chrome_plugin_token or "").strip()
    if not candidate and (authorization or "").lower().startswith("bearer "):
        candidate = authorization[7:].strip()
    if not candidate or not hmac.compare_digest(candidate, expected):
        raise HTTPException(status_code=401, detail="Chrome plugin authentication required")
    return expected


def verify_extension_user(
    x_portal_user_id: Optional[int] = Header(default=None, alias="X-Portal-User-ID"),
    x_portal_email: Optional[str] = Header(default=None, alias="X-Portal-Email"),
    x_portal_user_signature: Optional[str] = Header(default=None, alias="X-Portal-User-Signature"),
    x_chrome_plugin_token: Optional[str] = Header(default=None, alias=PLUGIN_TOKEN_HEADER),
) -> dict[str, int | str]:
    """Return a signed portal identity supplied by an authenticated extension.

    The identity headers are metadata, not proof of identity.  The signature
    binds them to the configured local pairing token so an unauthenticated
    caller cannot impersonate a portal user by setting headers directly.
    """

    token = require_plugin_token(x_chrome_plugin_token, authorization=None)
    email = (x_portal_email or "").strip()
    if x_portal_user_id is None or x_portal_user_id <= 0 or not email or "@" not in email or not x_portal_user_signature:
        raise HTTPException(status_code=401, detail="Extension authentication required")
    signed_value = f"{x_portal_user_id}:{email}".encode("utf-8")
    expected_signature = hmac.new(token.encode("utf-8"), signed_value, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(x_portal_user_signature.strip(), expected_signature):
        raise HTTPException(status_code=401, detail="Invalid extension user assertion")

    return {"id": x_portal_user_id, "email": email}


def verify_extension_token(token: str | None) -> None:
    """Validate the required shared token used by WebSocket links."""

    expected = _configured_token()
    if not token or not hmac.compare_digest(token.strip(), expected):
        raise HTTPException(status_code=401, detail="Invalid Chrome plugin token")


async def verify_extension_connection_token(token: str | None) -> dict[str, int | bool]:
    """Accept either the legacy service token or a portal-managed user token."""
    candidate = (token or "").strip()
    if not candidate:
        raise HTTPException(status_code=401, detail="Chrome plugin token required")

    legacy = os.getenv("CHROME_PLUGIN_TOKEN", "").strip()
    if legacy and hmac.compare_digest(candidate, legacy):
        return {"valid": True, "user_id": 0}

    api_base = backend_api_base_url()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(f"{api_base}/settings/chrome-plugin/verify", json={"token": candidate})
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="Portal token validation is unavailable") from error
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Chrome plugin token")
    body = response.json()
    return {"valid": True, "user_id": int(body["user_id"])}


async def require_bridge_user(
    x_chrome_plugin_token: Optional[str] = Header(default=None, alias=PLUGIN_TOKEN_HEADER),
    authorization: Optional[str] = Header(default=None),
) -> int:
    """Authenticate HTTP bridge calls exactly like WebSocket connections."""
    candidate = (x_chrome_plugin_token or "").strip()
    if not candidate and (authorization or "").lower().startswith("bearer "):
        candidate = authorization[7:].strip()
    identity = await verify_extension_connection_token(candidate)
    return int(identity["user_id"])
