from __future__ import annotations

import hashlib
import hmac

from fastapi.testclient import TestClient

from app import _package_content_hash, _source_content_hash, app


def test_health_starts_without_opencode_runtime():
    with TestClient(app) as client:
        response = client.get("/chrome-plugin/health")

    assert response.status_code == 200
    assert response.json() == {"service": "chrome_plugin_jev", "status": "ok"}


def test_signed_portal_identity_is_preserved(monkeypatch):
    token = "test-pairing-token"
    email = "browser.user@example.com"
    user_id = 73
    signature = hmac.new(
        token.encode("utf-8"),
        f"{user_id}:{email}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    monkeypatch.setenv("CHROME_PLUGIN_TOKEN", token)

    with TestClient(app) as client:
        response = client.get(
            "/api/chrome_plugin/user",
            headers={
                "X-Chrome-Plugin-Token": token,
                "X-Portal-User-ID": str(user_id),
                "X-Portal-Email": email,
                "X-Portal-User-Signature": signature,
            },
        )

    assert response.status_code == 200
    assert response.json() == {"id": user_id, "email": email, "authenticated": True}


def test_extension_websocket_handshake_and_status(monkeypatch):
    token = "test-pairing-token"
    monkeypatch.setenv("CHROME_PLUGIN_TOKEN", token)

    with TestClient(app) as client:
        with client.websocket_connect(
            f"/api/chrome_plugin/ws?token={token}&profile=Work",
            subprotocols=["chrome-plugin", token],
        ) as websocket:
            websocket.send_json(
                {
                    "type": "hello",
                    "payload": {"extensionId": "test-extension", "extensionVersion": "1.2.0"},
                }
            )
            assert websocket.receive_json() == {"type": "hello_ack"}

            response = client.get(
                "/api/chrome_plugin/status",
                headers={"X-Chrome-Plugin-Token": token},
            )
            assert response.status_code == 200
            status = response.json()
            assert status["extensionConnected"] is True
            assert status["connections"] == [
                {
                    "profile": "Work",
                    "connected": True,
                    "extensionId": "test-extension",
                    "extensionVersion": "1.2.0",
                    "connectedAt": status["connections"][0]["connectedAt"],
                    "lastSeen": status["connections"][0]["lastSeen"],
                    "pendingCalls": 0,
                }
            ]


def test_powershell_package_uses_same_content_as_extension_source():
    from pathlib import Path

    package = Path(__file__).parents[1] / "dist" / "releases" / "twenty-chrome-plugin-1.2.0.zip"
    if package.exists():
        assert _package_content_hash(package) == _source_content_hash()
