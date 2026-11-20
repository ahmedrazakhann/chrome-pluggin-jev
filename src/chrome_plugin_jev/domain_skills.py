"""Resolve versioned domain guidance from the application's skill API."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
import yaml


class DomainSkillError(RuntimeError):
    pass


@dataclass(frozen=True)
class DomainSkill:
    skill_id: str
    version: str
    matched_domains: tuple[str, ...]
    markdown: str

    def audit(self) -> dict[str, Any]:
        result = {
            "skillId": self.skill_id,
            "version": self.version,
            "matchedDomains": list(self.matched_domains),
        }
        if not self.matched_domains:
            result["source"] = "generic"
        return result

    def as_model_context(self) -> dict[str, Any]:
        markdown = self.markdown[:32_000]
        context: dict[str, Any] = {
            "skill_id": self.skill_id,
            "version": self.version,
            "markdown": markdown,
        }
        policy = self.frame_policy()
        if policy:
            context["frame_policy"] = policy
        return context

    def party_lookup_enabled(self) -> bool:
        policy = _frontmatter(self.markdown).get("party_lookup")
        return isinstance(policy, dict) and policy.get("enabled") is True

    def frame_policy(self) -> dict[str, Any] | None:
        metadata = _frontmatter(self.markdown)
        raw = metadata.get("frame_policy")
        if raw is None:
            return None
        if not isinstance(raw, dict):
            raise DomainSkillError("domain skill frame_policy must be an object")
        strategy = raw.get("strategy", "top")
        if strategy not in {"top", "exact", "all"}:
            raise DomainSkillError("domain skill frame_policy has invalid strategy")
        allow_all = raw.get("allow_all_frames", False)
        if not isinstance(allow_all, bool):
            raise DomainSkillError("domain skill allow_all_frames must be boolean")
        if strategy == "all" and not allow_all:
            raise DomainSkillError("all-frame strategy requires allow_all_frames: true")
        expected = raw.get("expected_matches", 1)
        if (
            isinstance(expected, bool)
            or not isinstance(expected, int)
            or not 1 <= expected <= 20
        ):
            raise DomainSkillError(
                "domain skill expected_matches must be between 1 and 20"
            )
        targets = raw.get("targets", [])
        if strategy == "exact" and (not isinstance(targets, list) or not targets):
            raise DomainSkillError("exact frame strategy requires targets")
        clean_targets: list[dict[str, str]] = []
        for target in targets:
            if not isinstance(target, dict):
                raise DomainSkillError("domain skill frame target must be an object")
            origin = target.get("origin")
            if not isinstance(origin, str) or _origin(origin) != origin.rstrip("/"):
                raise DomainSkillError("domain skill frame target has invalid origin")
            clean = {"origin": origin.rstrip("/")}
            path_prefix = target.get("path_prefix")
            if path_prefix is not None:
                if not isinstance(path_prefix, str) or not path_prefix.startswith("/"):
                    raise DomainSkillError("domain skill path_prefix must start with /")
                clean["pathPrefix"] = path_prefix
            label = target.get("label")
            if isinstance(label, str) and label.strip():
                clean["label"] = label.strip()[:100]
            clean_targets.append(clean)
        return {
            "strategy": strategy,
            "allowAllFrames": allow_all,
            "expectedMatches": expected,
            "targets": clean_targets,
            "onMismatch": "needs_review",
        }


def _frontmatter(markdown: str) -> dict[str, Any]:
    if not markdown.startswith("---\n"):
        return {}
    try:
        _, raw, _ = markdown.split("---", 2)
        payload = yaml.safe_load(raw)
    except (ValueError, yaml.YAMLError) as error:
        raise DomainSkillError("domain skill has invalid YAML frontmatter") from error
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        raise DomainSkillError("domain skill frontmatter must be an object")
    return payload


def _origin(value: str) -> str | None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


@lru_cache(maxsize=1)
def generic_form_skill() -> DomainSkill:
    path = (
        Path(__file__).resolve().parents[2]
        / "domain-skills"
        / "generic-form-fallback.md"
    )
    try:
        markdown = path.read_text(encoding="utf-8").strip()
    except OSError as error:
        raise DomainSkillError(
            f"generic form skill could not be loaded: {error}"
        ) from error
    if not markdown:
        raise DomainSkillError("generic form skill is empty")
    return DomainSkill(
        skill_id="generic-form-fallback",
        version="1",
        matched_domains=(),
        markdown=markdown,
    )


def _host(url: str) -> str | None:
    parsed = urlparse(url)
    return (
        parsed.hostname.lower()
        if parsed.scheme in {"http", "https"} and parsed.hostname
        else None
    )


def _domain_matches(pattern: str, host: str) -> bool:
    pattern = pattern.strip().lower().rstrip(".")
    if pattern.startswith("*."):
        suffix = pattern[2:]
        return host.endswith(f".{suffix}")
    return pattern == host


class DomainSkillResolver:
    def __init__(
        self,
        *,
        endpoint: str | None = None,
        token: str | None = None,
        local_directory: str | Path | None = None,
    ) -> None:
        self.endpoint = (
            endpoint if endpoint is not None else os.getenv("DOMAIN_SKILL_API_URL", "")
        ).strip()
        self.token = (
            token if token is not None else os.getenv("DOMAIN_SKILL_API_TOKEN", "")
        ).strip()
        configured_local = os.getenv("DOMAIN_SKILL_LOCAL_DIR", "").strip()
        self.local_directory = Path(
            local_directory
            if local_directory is not None
            else configured_local
            if configured_local
            else Path(__file__).resolve().parents[2] / "domain-skills"
        )

    async def resolve(self, urls: list[str]) -> DomainSkill | None:
        domains = list(dict.fromkeys(host for url in urls if (host := _host(url))))
        if not domains:
            return None
        if not self.endpoint:
            return self._resolve_local(domains)
        params: list[tuple[str, str]] = [("domain", domains[0])]
        params.extend(("frameDomain", domain) for domain in domains[1:])
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        timeout = float(os.getenv("DOMAIN_SKILL_API_TIMEOUT_SECONDS", "5"))
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    self.endpoint, params=params, headers=headers
                )
        except httpx.HTTPError as error:
            raise DomainSkillError(
                f"domain skill API request failed: {error}"
            ) from error
        if response.status_code == 404:
            return self._resolve_local(domains)
        if not response.is_success:
            raise DomainSkillError(
                f"domain skill API returned HTTP {response.status_code}"
            )
        try:
            payload = response.json()
        except ValueError as error:
            raise DomainSkillError("domain skill API returned invalid JSON") from error
        return self._parse(payload, set(domains))

    def _resolve_local(self, domains: list[str]) -> DomainSkill | None:
        if not self.local_directory.is_dir():
            return None
        matches: list[DomainSkill] = []
        for path in sorted(self.local_directory.rglob("*.md")):
            try:
                markdown = path.read_text(encoding="utf-8").strip()
                metadata = _frontmatter(markdown)
            except (OSError, UnicodeError, DomainSkillError):
                continue
            patterns = metadata.get("domains")
            if not isinstance(patterns, list) or not all(
                isinstance(item, str) for item in patterns
            ):
                continue
            matched = tuple(
                pattern
                for pattern in patterns
                if any(_domain_matches(pattern, domain) for domain in domains)
            )
            if not matched:
                continue
            name = metadata.get("name")
            version = metadata.get("version")
            if (
                not isinstance(name, str)
                or not name.strip()
                or not isinstance(version, str)
            ):
                raise DomainSkillError(
                    f"local domain skill {path.name} has invalid identity"
                )
            skill = DomainSkill(name.strip(), version.strip(), matched, markdown)
            skill.frame_policy()
            matches.append(skill)
        if len(matches) > 1:
            raise DomainSkillError("multiple local domain skills match the page")
        return matches[0] if matches else None

    @staticmethod
    def _parse(payload: Any, hosts: set[str | None]) -> DomainSkill:
        if not isinstance(payload, dict):
            raise DomainSkillError("domain skill response must be an object")
        skill_id = payload.get("skillId") or payload.get("skill_id")
        version = payload.get("version")
        markdown = payload.get("markdown")
        domains = payload.get("matchedDomains") or payload.get("matched_domains")
        if not all(
            isinstance(value, str) and value.strip()
            for value in (skill_id, version, markdown)
        ):
            raise DomainSkillError(
                "domain skill response is missing skillId, version, or markdown"
            )
        if (
            not isinstance(domains, list)
            or not domains
            or not all(isinstance(item, str) for item in domains)
        ):
            raise DomainSkillError("domain skill response has invalid matchedDomains")
        clean_hosts = {host for host in hosts if host}
        if not any(
            _domain_matches(domain, host) for domain in domains for host in clean_hosts
        ):
            raise DomainSkillError(
                "domain skill response does not match the requested URL"
            )
        if len(markdown.encode("utf-8")) > 256_000:
            raise DomainSkillError("domain skill markdown exceeds 256 KB")
        skill = DomainSkill(
            skill_id.strip(), version.strip(), tuple(domains), markdown.strip()
        )
        skill.frame_policy()
        return skill
