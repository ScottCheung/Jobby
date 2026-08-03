from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from services.shared.application_settings import (
    application_settings_from_storage,
    application_settings_to_storage,
)


def test_v2_settings_round_trip_preserves_section_boundaries() -> None:
    source = {
        "automation": {
            "execution_mode": "prepare_only",
            "review_channel": "browser",
            "max_jobs_per_run": 8,
            "max_retries": 1,
            "require_submit_confirmation": True,
            "stop_on_unknown_question": True,
        },
        "ai": {
            "enabled": True,
            "provider": "openai",
            "model": "gpt-test",
            "min_confidence": 0.8,
            "max_calls_per_job": 2,
            "daily_budget": 4.5,
            "allow_tailored_resume": True,
        },
        "resume": {
            "master_resume_id": "resume-1",
            "tailored_match_threshold": 0.82,
            "require_tailored_review": True,
        },
        "policy": {
            "minimum_match_threshold": 0.61,
            "only_easy_apply": True,
            "blacklisted_companies": ["Example Co"],
            "blacklisted_job_terms": ["clearance"],
            "whitelisted_companies": ["Trusted Co"],
        },
    }

    settings = application_settings_from_storage(source)
    saved = application_settings_to_storage(settings)

    assert saved == source


def test_legacy_runtime_values_are_used_only_when_v2_settings_are_absent() -> None:
    settings = application_settings_from_storage(
        {"settings": {}},
        legacy_runtime={"switch_number": 11, "use_AI": True},
        legacy_policy={
            "only_easy_apply": True,
            "blacklisted_companies": ["Blocked Co"],
        },
    )

    assert settings.automation.max_jobs_per_run == 11
    assert settings.ai.enabled is True
    assert settings.policy.only_easy_apply is True
    assert settings.policy.blacklisted_companies == ("Blocked Co",)


def test_v2_settings_take_precedence_over_legacy_runtime_values() -> None:
    settings = application_settings_from_storage(
        {
            "automation": {"max_jobs_per_run": 4},
            "ai": {"enabled": False},
            "resume": {},
        },
        legacy_runtime={"switch_number": 99, "use_AI": True},
    )

    assert settings.automation.max_jobs_per_run == 4
    assert settings.ai.enabled is False


def test_policy_only_v2_payload_does_not_fall_back_to_legacy_policy() -> None:
    settings = application_settings_from_storage(
        {"policy": {"blacklisted_companies": ["New Blocked Co"]}},
        legacy_policy={"blacklisted_companies": ["Old Blocked Co"]},
    )

    assert settings.policy.blacklisted_companies == ("New Blocked Co",)
