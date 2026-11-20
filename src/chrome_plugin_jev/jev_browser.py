"""Browser adapter for the Jev loop over Twenty's extension bridge."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any
from urllib.parse import quote_plus
from urllib.parse import urlparse

from .bridge import BridgeToolError


URL_PATTERN = re.compile(r"https?://[^\s<>'\"`]+", re.IGNORECASE)
GOOGLE_SEARCH_PATTERNS = (
    re.compile(r"^\s*google\s+search(?:\s+for)?\s+(.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*search\s+google(?:\s+for)?\s+(.+?)\s*$", re.IGNORECASE),
)
NAVIGATION_TARGET_PATTERN = re.compile(
    r"\b(?:(?:go|navigate)\s+to|open|visit)\s+"
    r"(?P<target>(?:https?://)?(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+"
    r"[a-z]{2,63}(?::\d{1,5})?(?:/[^\s<>'\"`]*)?)",
    re.IGNORECASE,
)
RESEARCH_PATTERN = re.compile(
    r"\b(?:find|identify|look\s+up|research|who\s+is|what\s+is|name\s+of)\b",
    re.IGNORECASE,
)


class StalePage(RuntimeError):
    """The page changed after observation and before execution."""


def fingerprint(state: dict[str, Any]) -> str:
    content = {
        key: state.get(key)
        for key in ("url", "text", "actions", "scroll")
    }
    return hashlib.sha256(
        json.dumps(content, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def explicit_urls(goal: str) -> list[str]:
    values: list[str] = []
    for match in URL_PATTERN.findall(goal):
        value = match.rstrip(".,);]}")
        if value not in values:
            values.append(value)
    return values[:5]


def google_search_url(goal: str) -> str | None:
    """Translate an explicit Google-search instruction into a bounded URL."""

    for line in goal.splitlines():
        for pattern in GOOGLE_SEARCH_PATTERNS:
            match = pattern.fullmatch(line)
            if match and (query := match.group(1).strip()):
                return f"https://www.google.com/search?q={quote_plus(query[:500])}"
    return None


def requested_navigation_url(goal: str) -> str | None:
    """Return a safe HTTP(S) URL explicitly named after a navigation verb."""

    match = NAVIGATION_TARGET_PATTERN.search(goal)
    if not match:
        return None
    target = match.group("target").rstrip(".,);]}")
    candidate = target if target.lower().startswith(("http://", "https://")) else f"https://{target}"
    parsed = urlparse(candidate)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or "." not in parsed.hostname
        or parsed.username
        or parsed.password
    ):
        return None
    try:
        _ = parsed.port
    except ValueError:
        return None
    return candidate


def research_search_url(goal: str) -> str | None:
    """Offer a deterministic web-search fallback for factual research goals."""

    if not RESEARCH_PATTERN.search(goal):
        return None
    query = " ".join(goal.split())[:500]
    return f"https://www.google.com/search?q={quote_plus(query)}"


class ExtensionBrowser:
    def __init__(
        self,
        bridge: Any,
        *,
        user_id: int,
        profile: str | None,
        session: str,
        tab_id: int | None = None,
    ) -> None:
        self.bridge = bridge
        self.user_id = user_id
        self.profile = profile
        self.session = session
        self.tab_id = tab_id

    async def _call(self, action: str, args: dict[str, Any] | None = None) -> Any:
        payload = dict(args or {})
        if self.tab_id is not None:
            payload.setdefault("_tabId", self.tab_id)
        return await self.bridge.call_tool(
            action,
            payload,
            session=self.session,
            profile=self.profile,
            user_id=self.user_id,
        )

    async def prepare(self, goal: str, target_url: str | None = None) -> None:
        if target_url:
            result = await self._call("navigate", {"url": target_url})
            if isinstance(result, dict) and isinstance(result.get("tabId"), int):
                self.tab_id = result["tabId"]
            return
        navigation_url = requested_navigation_url(goal)
        if navigation_url:
            result = await self._call("navigate", {"url": navigation_url})
            if isinstance(result, dict) and isinstance(result.get("tabId"), int):
                self.tab_id = result["tabId"]
            return
        search_url = google_search_url(goal)
        if search_url:
            result = await self._call("navigate", {"url": search_url})
            if isinstance(result, dict) and isinstance(result.get("tabId"), int):
                self.tab_id = result["tabId"]
            return
        if self.tab_id is not None:
            return

        def _http_tabs(payload: Any) -> list[dict[str, Any]]:
            items = payload.get("tabs", []) if isinstance(payload, dict) else []
            return [
                item
                for item in items
                if isinstance(item, dict)
                and str(item.get("url", "")).startswith(("http://", "https://"))
            ]

        # Many Chrome windows each expose an active tab. Prefer the active tab in
        # the last-focused window (the one the user is looking at).
        focused = await self._call(
            "list_tabs", {"lastFocusedWindow": True, "active": True}
        )
        selected = next(iter(_http_tabs(focused)), None)
        if selected is None:
            tabs = await self._call("list_tabs")
            candidates = _http_tabs(tabs)
            selected = next(
                (item for item in candidates if item.get("active")),
                None,
            )
            if selected is None:
                selected = next(iter(candidates), None)
        if selected is not None:
            result = await self._call(
                "find_tab", {"url": selected["url"], "active": True}
            )
            if isinstance(result, dict) and isinstance(result.get("tabId"), int):
                self.tab_id = result["tabId"]
            return
        urls = explicit_urls(goal)
        if not urls:
            raise RuntimeError(
                "No ordinary web tab is available. Open a page or include an explicit http(s) URL."
            )
        result = await self._call("navigate", {"url": urls[0], "newTab": True})
        if isinstance(result, dict) and isinstance(result.get("tabId"), int):
            self.tab_id = result["tabId"]

    async def observe(self, goal: str) -> dict[str, Any]:
        page = await self._call("jev_observe")
        if not isinstance(page, dict) or not isinstance(page.get("actions"), list):
            raise RuntimeError("The Chrome extension returned an invalid Jev observation")
        page["fingerprint"] = fingerprint(page)
        current_url = str(page.get("url", ""))
        for index, url in enumerate(explicit_urls(goal), start=1):
            if current_url.rstrip("/") != url.rstrip("/"):
                page["actions"].append(
                    {
                        "id": f"navigate_to_{index}",
                        "kind": "navigate",
                        "label": f"Navigate to the explicit task URL {url}",
                        "url": url,
                    }
                )
        search_url = research_search_url(goal)
        if search_url and "google.com/search" not in current_url.lower():
            page["actions"].append(
                {
                    "id": "search_web",
                    "kind": "navigate",
                    "label": (
                        "Search the web for the requested factual information "
                        "if the current site does not visibly contain it"
                    ),
                    "url": search_url,
                }
            )
        if str(page.get("text", "")).strip():
            page["actions"].append(
                {
                    "id": "answer",
                    "kind": "answer",
                    "label": (
                        "Return the requested factual answer from information "
                        "visibly supported on this page"
                    ),
                }
            )
        return page

    async def act(
        self,
        action: dict[str, Any],
        page: dict[str, Any],
        *,
        text: str | None = None,
    ) -> Any:
        if action.get("kind") == "navigate":
            return await self._call("navigate", {"url": action["url"]})
        try:
            return await self._call(
                "jev_act",
                {
                    "action": action,
                    "pageKey": page.get("page_key"),
                    "guard": page.get("guards", {}).get(str(action.get("node"))),
                    "text": text,
                },
            )
        except BridgeToolError as error:
            if "stale" in str(error).lower() or "changed" in str(error).lower():
                raise StalePage(str(error)) from error
            raise
