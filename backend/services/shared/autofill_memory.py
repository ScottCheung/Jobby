"""Platform-scoped memory helpers for user-corrected application fields."""

from __future__ import annotations

from services.shared.autofill_profile import normalize_scene


def platform_mapping_scene(platform: str | None, scene: str | None) -> str:
    """Scope learned rules to an ATS while preserving generic-rule fallback.

    No database migration is needed: `FieldMappingRule.scene` already forms
    part of a rule's uniqueness boundary. Generic pages retain their existing
    scene values for backwards compatibility.
    """
    normalized_platform = normalize_scene(platform or "generic")
    normalized_scene = normalize_scene(scene)
    if normalized_platform == "generic":
        return normalized_scene
    return f"ats_{normalized_platform}__{normalized_scene}"[:100]


def fallback_mapping_scenes(platform: str | None, scene: str | None) -> tuple[str, ...]:
    scoped = platform_mapping_scene(platform, scene)
    generic = normalize_scene(scene)
    return (scoped,) if scoped == generic else (scoped, generic)
