from __future__ import annotations

import asyncio

import pytest

from chrome_plugin_jev import jev_model


def _choice(ids, selected):
    return {
        "choice": selected,
        "confidence": 1.0,
        "probabilities": {item: float(item == selected) for item in ids},
    }


def test_fill_only_rule_does_not_authorize_submission():
    assert "explicitly asks to submit or search" in jev_model.NEXT_ACTION
    assert "filling fields must not submit the form" in jev_model.NEXT_ACTION


def test_provider_error_detail_reports_validation_without_echoing_goal():
    goal = "Fill password: highly-sensitive-value"
    response = jev_model.httpx.Response(
        400,
        json={
            "error": {
                "message": f"Invalid questions for request {goal}",
                "type": "invalid_request_error",
                "code": 400,
            }
        },
    )

    detail = jev_model._provider_error_detail(response, {"state": {"goal": goal}})

    assert detail == (
        "Invalid questions for request [goal redacted] | "
        "invalid_request_error | 400"
    )
    assert "highly-sensitive-value" not in detail


def test_action_space_indexes_each_observed_node_once():
    actions = [
        {"id": "e1", "kind": "fill", "node": 10, "role": "textbox", "label": "Search", "value": ""},
        {"id": "e2", "kind": "click", "node": 10, "role": "textbox", "label": "Open Search", "value": ""},
        {"id": "e3", "kind": "click", "node": 20, "role": "button", "label": "Go", "value": ""},
        {"id": "wait", "kind": "wait", "label": "Wait"},
        {"id": "answer", "kind": "answer", "label": "Return the supported answer"},
    ]

    elements, targets, controls = jev_model.action_space(actions)

    assert len(elements) == 2
    assert elements[0]["operations"] == ["TYPE_TEXT", "CLICK"]
    assert targets["TYPE_TEXT"]["1"]["id"] == "e1"
    assert targets["CLICK"]["2"]["id"] == "e3"
    assert controls["WAIT"]["kind"] == "wait"
    assert controls["ANSWER"]["kind"] == "answer"


@pytest.mark.parametrize("mutation", ["unknown", "missing", "negative", "non_max"])
def test_invalid_choices_are_rejected(mutation):
    answer = _choice(["a", "b"], "a")
    if mutation == "unknown":
        answer["choice"] = "invented"
    elif mutation == "missing":
        del answer["probabilities"]["b"]
    elif mutation == "negative":
        answer["probabilities"]["b"] = -1
    else:
        answer["choice"] = "b"

    with pytest.raises(jev_model.JevProviderError, match="Invalid TypeSafe"):
        jev_model.validate_choice(answer, {"a", "b"})


def test_choose_sends_all_heads_but_consumes_only_selected_head(monkeypatch):
    monkeypatch.delenv("TYPESAFE_API_URL", raising=False)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test")
    page = {
        "url": "https://example.test",
        "title": "Search",
        "text": "Search Go",
        "actions": [
            {"id": "e1", "kind": "fill", "node": 10, "role": "textbox", "label": "Search", "value": ""},
            {"id": "e2", "kind": "click", "node": 20, "role": "button", "label": "Go", "value": ""},
        ],
    }
    client = jev_model.JevModelClient()
    sent = []

    async def post(_url, _key, body):
        sent.append(body)
        return {
            "model": "test",
            "answers": {
                "operation": _choice(body["questions"]["operation"]["criteria"], "TYPE_TEXT"),
                "type_text_target": _choice(["1"], "1"),
                "click_target": {"choice": "not-validated"},
            },
        }

    monkeypatch.setattr(client, "_post_json", post)
    decision = asyncio.run(client.choose(page, "Search for a book", []))

    assert decision["choice"] == "e1"
    request = sent[0]
    assert set(request["questions"]) == {"operation", "type_text_target", "click_target"}
    assert request["state"]["goal"] == "Search for a book"
    for question in request["questions"].values():
        assert isinstance(question["instructions"], str)
        assert question["instructions"]
        assert all(
            isinstance(description, str) and description
            for description in question["criteria"].values()
        )


def test_openrouter_endpoint_uses_openrouter_credential(monkeypatch):
    monkeypatch.setenv("TYPESAFE_API_URL", "https://openrouter.ai/api/alpha/decisions")
    monkeypatch.setenv("TYPESAFE_API_KEY", "wrong-provider-key")
    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.delenv("TYPESAFE_MODEL", raising=False)

    provider = jev_model.decision_provider()

    assert provider.api_key == "openrouter-key"
    assert provider.credential_name == "OPENROUTER_API_KEY"
    assert provider.model == "~typesafe/jev-latest"
    assert provider.name == "OpenRouter"


def test_direct_typesafe_endpoint_uses_typesafe_credential(monkeypatch):
    monkeypatch.setenv("TYPESAFE_API_URL", "https://api.typesafe.ai/v1/systemone")
    monkeypatch.setenv("TYPESAFE_API_KEY", "typesafe-key")
    monkeypatch.setenv("OPENROUTER_API_KEY", "wrong-provider-key")
    monkeypatch.delenv("TYPESAFE_MODEL", raising=False)

    provider = jev_model.decision_provider()

    assert provider.api_key == "typesafe-key"
    assert provider.credential_name == "TYPESAFE_API_KEY"
    assert provider.model == "jev-latest"
    assert provider.name == "TypeSafe"


def test_single_object_parser_accepts_provider_array_wrapper():
    assert jev_model.parse_single_object('[{"answer":"6,641 km2"}]') == {
        "answer": "6,641 km2"
    }
    assert jev_model.parse_single_object('["6,641 km2"]') == {
        "answer": "6,641 km2"
    }


@pytest.mark.parametrize("content", ["[]", "[{}, {}]", "42"])
def test_single_object_parser_rejects_ambiguous_shapes(content):
    with pytest.raises(ValueError):
        jev_model.parse_single_object(content)
