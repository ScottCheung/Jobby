from __future__ import annotations

from typing import Any

from application_core.settings import (
    AISettings,
    ApplicationSettings,
    AutomationSettings,
    PolicySettings,
    ResumeSettings,
    from_legacy_runtime_settings,
)


SECTION_NAMES = ("automation", "ai", "resume", "policy")


def application_settings_from_storage(
    stored: dict[str, Any] | None,
    *,
    legacy_runtime: dict[str, Any] | None = None,
    legacy_policy: dict[str, Any] | None = None,
) -> ApplicationSettings:
    """Load v2 settings, falling back to legacy runtime keys only when needed."""
    stored = stored or {}
    payload = stored.get("settings") if isinstance(stored.get("settings"), dict) else stored
    if not any(name in payload for name in SECTION_NAMES):
        return from_legacy_runtime_settings(legacy_runtime, policy_values=legacy_policy)

    return ApplicationSettings(
        automation=AutomationSettings(**dict(payload.get("automation") or {})),
        ai=AISettings(**dict(payload.get("ai") or {})),
        resume=ResumeSettings(**dict(payload.get("resume") or {})),
        policy=PolicySettings(**dict(payload.get("policy") or {})),
    )


def application_settings_to_storage(settings: ApplicationSettings) -> dict[str, dict[str, Any]]:
    return settings.to_dict()
