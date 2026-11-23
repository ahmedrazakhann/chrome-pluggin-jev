"""Helpers for short, readable log lines with timings."""

from __future__ import annotations

import time
from typing import Any


def clip(value: Any, limit: int = 80) -> str:
    """One-line, length-bounded text for a log message."""

    text = " ".join(str(value).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def since(started: float) -> int:
    """Milliseconds elapsed since a time.perf_counter() reading."""

    return round((time.perf_counter() - started) * 1000)
