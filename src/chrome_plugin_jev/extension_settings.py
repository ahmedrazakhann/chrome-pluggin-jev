"""Read access to the extension_settings table (website URL -> sample JSON)."""

from __future__ import annotations

import logging
import os
from typing import Any

import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger(__name__)


class SettingsUnavailable(RuntimeError):
    pass


def list_extension_settings() -> list[dict[str, Any]]:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SettingsUnavailable("DATABASE_URL is not configured")
    try:
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10) as conn:
            return conn.execute(
                "select id, website_url, sample_json, system_prompt, created_at "
                "from public.extension_settings order by id"
            ).fetchall()
    except psycopg.Error as error:
        logger.error("extension_settings query failed: %s", error)
        raise SettingsUnavailable("Could not read extension settings") from error
