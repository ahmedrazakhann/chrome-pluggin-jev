from __future__ import annotations

import asyncio

from chrome_plugin_jev.jev_agent import JevBrowserAgent
from chrome_plugin_jev.jev_browser import (
    ExtensionBrowser,
    google_search_url,
    research_search_url,
    requested_navigation_url,
)


def _page(value=""):
    return {
        "url": "https://example.test/",
        "title": "Search",
        "text": f"Search {value}",
        "scroll": {"y": 0, "height": 700},
        "page_key": [1, "https://example.test/", 0, 0, 1000, 700, [[10, value, False, 0, False, False]]],
        "guards": {"10": [10, "textbox", "Search", value]},
        "actions": [
            {"id": "e1", "kind": "fill", "node": 10, "role": "textbox", "label": "Search", "value": value},
            {"id": "wait", "kind": "wait", "label": "Wait"},
        ],
    }


class FakeBridge:
    def __init__(self):
        self.value = ""
        self.calls = []

    async def call_tool(self, action, args=None, **kwargs):
        self.calls.append((action, args or {}, kwargs))
        if action == "list_tabs":
            return {"tabs": [{"tabId": 7, "url": "https://example.test/", "active": True}]}
        if action == "find_tab":
            return {"success": True, "tabId": 7, "url": "https://example.test/"}
        if action == "jev_observe":
            return _page(self.value)
        if action == "jev_act":
            self.value = args["text"]
            return {"executed": args["action"]["id"]}
        raise AssertionError(action)


class FakeModel:
    def __init__(self):
        self.calls = 0

    async def choose(self, page, goal, history):
        self.calls += 1
        if not history:
            return {
                "choice": "e1",
                "operation": "TYPE_TEXT",
                "target": "1",
                "confidence": 1.0,
                "latency_ms": 1,
            }
        return {
            "choice": "DONE",
            "operation": "DONE",
            "target": None,
            "confidence": 1.0,
            "latency_ms": 1,
        }

    async def field_text(self, goal, action, page, history):
        return "book", {"model": "test", "latency_ms": 1, "usage": {}}


def test_agent_runs_observe_decide_act_loop():
    bridge = FakeBridge()
    result = asyncio.run(JevBrowserAgent(bridge, model=FakeModel()).run("Search for a book"))

    assert result.status == "done"
    assert result.session_id.startswith("jev-")
    assert len(result.steps) == 1
    assert result.steps[0]["kind"] == "fill"
    assert bridge.value == "book"
    assert [call[0] for call in bridge.calls] == [
        "list_tabs",
        "find_tab",
        "jev_observe",
        "jev_act",
        "jev_observe",
        "jev_observe",
    ]


class AnswerModel:
    async def choose(self, page, goal, history):
        assert any(action["id"] == "answer" for action in page["actions"])
        return {
            "choice": "answer",
            "operation": "ANSWER",
            "target": None,
            "confidence": 0.99,
            "latency_ms": 1,
        }

    async def page_answer(self, goal, page, history):
        return "The park covers 6,641 square kilometres.", {
            "model": "test",
            "latency_ms": 1,
            "usage": {},
        }


def test_agent_returns_supported_page_answer():
    result = asyncio.run(
        JevBrowserAgent(FakeBridge(), model=AnswerModel()).run(
            "Find and report the area"
        )
    )

    assert result.status == "done"
    assert result.text == (
        "The park covers 6,641 square kilometres.\n\n"
        "Source: https://example.test/"
    )
    assert result.steps[-1]["kind"] == "answer"


def test_explicit_google_search_instruction_gets_search_url():
    goal = """Google search Banff NAtional Park
Go to Wikipedia or better page
Find the area"""

    assert google_search_url(goal) == (
        "https://www.google.com/search?q=Banff+NAtional+Park"
    )


def test_browser_prepares_explicit_google_search_without_current_tab():
    class SearchBridge:
        def __init__(self):
            self.calls = []

        async def call_tool(self, action, args=None, **kwargs):
            self.calls.append((action, args, kwargs))
            assert action == "navigate"
            return {"success": True, "tabId": 19}

    bridge = SearchBridge()
    browser = ExtensionBrowser(
        bridge, user_id=4, profile="Work", session="research"
    )
    asyncio.run(browser.prepare("Google search Banff National Park"))

    assert browser.tab_id == 19
    assert bridge.calls[0][1] == {
        "url": "https://www.google.com/search?q=Banff+National+Park"
    }


def test_bare_domain_after_go_to_becomes_https_navigation():
    goal = "Go to trytwenty.ai and find the name of the CEO"

    assert requested_navigation_url(goal) == "https://trytwenty.ai"


def test_browser_navigates_bare_domain_before_inspecting_current_tab():
    class NavigationBridge:
        def __init__(self):
            self.calls = []

        async def call_tool(self, action, args=None, **kwargs):
            self.calls.append((action, args, kwargs))
            assert action == "navigate"
            return {"success": True, "tabId": 23}

    bridge = NavigationBridge()
    browser = ExtensionBrowser(
        bridge, user_id=4, profile="Work", session="research"
    )
    asyncio.run(
        browser.prepare("Go to trytwenty.ai and find the name of the CEO")
    )

    assert browser.tab_id == 23
    assert bridge.calls[0][1] == {"url": "https://trytwenty.ai"}


def test_factual_site_task_gets_bounded_web_search_fallback():
    goal = "Go to trytwenty.ai and find the name of the CEO"

    assert research_search_url(goal) == (
        "https://www.google.com/search?"
        "q=Go+to+trytwenty.ai+and+find+the+name+of+the+CEO"
    )

    page = asyncio.run(
        ExtensionBrowser(
            FakeBridge(), user_id=4, profile="Work", session="research"
        ).observe(goal)
    )
    search_action = next(
        action for action in page["actions"] if action["id"] == "search_web"
    )
    assert search_action["kind"] == "navigate"
    assert search_action["url"] == research_search_url(goal)
