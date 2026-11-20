"""Exercise the unpacked extension against a running plugin service.

Set CHROME_PLUGIN_TEST_TOKEN and CHROME_TEST_BINARY, then run this script with
--service-url, --target-url, and --expected-h1. It uses an isolated temporary
Chromium profile and never prints the token.
"""

import argparse
import asyncio
import base64
import hashlib
import json
import os
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import httpx
from websockets.asyncio.client import connect


ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extension"


def devtools_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def extension_id() -> str:
    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256(base64.b64decode(manifest["key"])).hexdigest()[:32]
    return "".join(chr(ord("a") + int(char, 16)) for char in digest)


async def evaluate(ws_url: str, expression: str):
    async with connect(ws_url, max_size=2**20) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": expression, "returnByValue": True, "awaitPromise": True},
        }))
        while True:
            response = json.loads(await ws.recv())
            if response.get("id") == 1:
                result = response.get("result", {})
                if result.get("exceptionDetails"):
                    raise RuntimeError("Chromium evaluation failed")
                return result.get("result", {}).get("value")


def wait_for_extension(port: int, identifier: str) -> None:
    for _ in range(80):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=1) as response:
                targets = json.load(response)
            if any(target["url"].startswith(f"chrome-extension://{identifier}/") for target in targets):
                return
        except OSError:
            pass
        time.sleep(0.25)
    raise RuntimeError("Unpacked extension did not start in Chromium")


async def run_commands(service_url: str, token: str, target_url: str, expected_h1: str) -> None:
    headers = {"X-Chrome-Plugin-Token": token}
    api = f"{service_url}/api/chrome_plugin"
    async with httpx.AsyncClient(timeout=70) as client:
        status = await client.get(f"{api}/status", headers=headers)
        status.raise_for_status()
        assert status.json()["connected"], "Extension is not connected"
        job = await client.post(f"{api}/jobs", headers=headers, json={
            "commands": [
                {"action": "navigate", "args": {"url": target_url, "newTab": True}},
                {"action": "evaluate", "args": {"code": "document.querySelector('h1')?.textContent?.trim()"}},
            ],
        })
        job.raise_for_status()
        job_id = job.json()["id"]
        for _ in range(80):
            await asyncio.sleep(0.25)
            result = await client.get(f"{api}/jobs/{job_id}", headers=headers)
            result.raise_for_status()
            body = result.json()
            if body["status"] not in {"queued", "running"}:
                break
        else:
            raise TimeoutError("Browser job did not finish")
        if body["status"] != "done":
            raise AssertionError(f"Browser job failed: {body.get('error')}")
        navigate_result, evaluate_result = body["result"]["results"]
        actual_h1 = evaluate_result.get("value")
        print(json.dumps({"connected": True, "opened": navigate_result.get("url"), "first_h1": actual_h1}))
        assert actual_h1 == expected_h1, f"Expected {expected_h1!r}, got {actual_h1!r}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service-url", default="http://127.0.0.1:8110")
    parser.add_argument("--target-url", default="https://example.com")
    parser.add_argument("--expected-h1", default="Example Domain")
    args = parser.parse_args()
    token = os.environ["CHROME_PLUGIN_TEST_TOKEN"]
    binary = os.environ["CHROME_TEST_BINARY"]
    identifier = extension_id()
    port = devtools_port()
    with tempfile.TemporaryDirectory(prefix="twenty-plugin-e2e-", dir=ROOT) as profile:
        assert Path(profile).resolve().is_relative_to(ROOT)
        environment = os.environ.copy()
        environment.update({"LOCALAPPDATA": profile, "TEMP": profile, "TMP": profile})
        command = [
            binary, "--headless=new", "--no-sandbox", "--disable-breakpad",
            "--no-first-run", "--no-default-browser-check", f"--user-data-dir={profile}",
            f"--disable-extensions-except={EXTENSION}", f"--load-extension={EXTENSION}",
            f"--remote-debugging-port={port}", "--remote-allow-origins=*", "about:blank",
        ]
        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW, env=environment, cwd=profile)
        try:
            wait_for_extension(port, identifier)
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/json/new?chrome-extension://{identifier}/popup.html",
                method="PUT",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                popup = json.load(response)
            ws_url = popup["webSocketDebuggerUrl"]
            for _ in range(40):
                if asyncio.run(evaluate(ws_url, "document.querySelector('#statusText')?.textContent")) in {"Connected", "Disconnected"}:
                    break
                time.sleep(0.2)
            else:
                raise RuntimeError("Extension popup script did not initialize")
            setup = (
                "document.querySelector('#backendUrl').value=" + json.dumps(args.service_url) + ";"
                "document.querySelector('#pluginToken').value=" + json.dumps(token) + ";"
                "document.querySelector('#connect').click();"
            )
            asyncio.run(evaluate(ws_url, setup))
            for _ in range(60):
                state = asyncio.run(evaluate(ws_url, "({status:document.querySelector('#statusText').textContent,"
                                              "message:document.querySelector('#message').textContent})"))
                if state["status"] == "Connected":
                    break
                time.sleep(0.25)
            else:
                detail = asyncio.run(evaluate(ws_url, "(async()=>({"
                                              "worker:await chrome.runtime.sendMessage({type:'GET_STATUS'}),"
                                              "tokenLength:document.querySelector('#pluginToken').value.length,"
                                              "buttonDisabled:document.querySelector('#connect').disabled"
                                              "}))()"))
                raise RuntimeError(f"Extension popup failed to connect: {state}, {detail}")
            asyncio.run(run_commands(args.service_url, token, args.target_url, args.expected_h1))
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
