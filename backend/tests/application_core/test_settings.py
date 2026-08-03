from __future__ import annotations

import pytest

from application_core.settings import (
    AISettings,
    ApplicationSettings,
    AutomationSettings,
    PolicySettings,
    ResumeSettings,
)


def test_settings_are_separated_by_responsibility() -> None:
    settings = ApplicationSettings(
        automation=AutomationSettings(max_jobs_per_run=12),
        ai=AISettings(enabled=True, provider="openai", model="gpt-test"),
        resume=ResumeSettings(tailored_match_threshold=0.82),
        policy=PolicySettings(
            minimum_match_threshold=0.60,
            blacklisted_companies=("Example Co",),
        ),
    )

    assert settings.automation.max_jobs_per_run == 12
    assert settings.ai.enabled is True
    assert settings.ai.model == "gpt-test"
    assert settings.resume.tailored_match_threshold == 0.82
    assert settings.policy.minimum_match_threshold == 0.60
    assert settings.policy.blacklisted_companies == ("Example Co",)


def test_automation_requires_human_confirmation_by_default() -> None:
    settings = AutomationSettings()

    assert settings.require_submit_confirmation is True
    assert settings.stop_on_unknown_question is True
    assert settings.execution_mode == "human_confirmed"


def test_automation_review_channel_is_explicit() -> None:
    assert AutomationSettings().review_channel == "browser"
    assert AutomationSettings(review_channel="console").review_channel == "console"
    with pytest.raises(ValueError):
        AutomationSettings(review_channel="silent")


def test_automation_confirmation_cannot_be_disabled() -> None:
    assert AutomationSettings(require_submit_confirmation=False).require_submit_confirmation is True


def test_ai_settings_validate_confidence_and_budget() -> None:
    with pytest.raises(ValueError):
        AISettings(min_confidence=1.1)
    with pytest.raises(ValueError):
        AISettings(daily_budget=-1)


def test_resume_settings_validate_tailoring_threshold() -> None:
    with pytest.raises(ValueError):
        ResumeSettings(tailored_match_threshold=-0.1)


def test_settings_can_be_serialized_without_mixing_sections() -> None:
    payload = ApplicationSettings().to_dict()

    assert set(payload) == {"automation", "ai", "resume", "policy"}
    assert "model" in payload["ai"]
    assert "require_submit_confirmation" in payload["automation"]
    assert "tailored_match_threshold" in payload["resume"]
    assert "minimum_match_threshold" in payload["policy"]
