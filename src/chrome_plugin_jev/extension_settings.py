"""Read access to the extension_settings table (website URL -> sample JSON)."""

from __future__ import annotations

import logging
import os
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

logger = logging.getLogger(__name__)


class SettingsUnavailable(RuntimeError):
    pass


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SettingsUnavailable("DATABASE_URL is not configured")
    return url


def list_extension_settings() -> list[dict[str, Any]]:
    url = _database_url()
    try:
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10) as conn:
            return conn.execute(
                "select id, name, website_url, sample_json, system_prompt, created_at "
                "from public.extension_settings order by id"
            ).fetchall()
    except psycopg.Error as error:
        logger.error("extension_settings query failed: %s", error)
        raise SettingsUnavailable("Could not read extension settings") from error


def create_extension_setting(name: str, website_url: str, sample_json: dict[str, Any]) -> dict[str, Any]:
    url = _database_url()
    try:
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10) as conn:
            return conn.execute(
                "insert into public.extension_settings (name, website_url, sample_json) values (%s, %s, %s) "
                "returning id, name, website_url, sample_json, system_prompt, created_at",
                (name, website_url, Json(sample_json)),
            ).fetchone()
    except psycopg.Error as error:
        logger.error("extension_settings insert failed: %s", error)
        raise SettingsUnavailable("Could not save extension setting") from error
