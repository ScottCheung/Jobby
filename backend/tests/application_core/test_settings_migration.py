from __future__ import annotations

from application_core.settings import from_legacy_runtime_settings


def test_legacy_runtime_settings_are_mapped_into_separate_sections() -> None:
    settings = from_legacy_runtime_settings(
        {
            "switch_number": 12,
            "use_AI": True,
            "llm_provider": "openai",
            "llm_model": "gpt-test",
            "question_similarity_threshold": 0.99,
            "ai_min_confidence": 0.88,
            "tailored_resume_threshold": 0.78,
            "enable_tailored_resume": False,
        },
        policy_values={
            "minimum_match_threshold": 0.62,
            "blacklisted_companies": ["Example Co"],
        },
    )

    assert settings.automation.max_jobs_per_run == 12
    assert settings.automation.execution_mode == "human_confirmed"
    assert settings.automation.require_submit_confirmation is True
    assert settings.ai.enabled is True
    assert settings.ai.provider == "openai"
    assert settings.ai.model == "gpt-test"
    assert settings.ai.min_confidence == 0.88
    assert settings.resume.tailored_match_threshold == 0.78
    assert settings.ai.allow_tailored_resume is False
    assert settings.policy.minimum_match_threshold == 0.62
    assert settings.policy.blacklisted_companies == ("Example Co",)


def test_legacy_missing_values_preserve_safe_defaults() -> None:
    settings = from_legacy_runtime_settings({"run_in_background": True})

    assert settings.automation.execution_mode == "human_confirmed"
    assert settings.automation.require_submit_confirmation is True
    assert settings.automation.stop_on_unknown_question is True
