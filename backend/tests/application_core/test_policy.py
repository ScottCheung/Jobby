from __future__ import annotations

import pytest

from application_core.models import (
    ApplicationAction,
    JobCandidate,
    ReasonCode,
    ResumeStrategy,
)
from application_core.policy import ApplicationPolicy, evaluate_policy
from application_core.policy import policy_from_settings
from application_core.settings import ApplicationSettings, PolicySettings, ResumeSettings


def candidate(**overrides) -> JobCandidate:
    values = {
        "platform": "linkedin",
        "external_id": "123",
        "title": "Full-Stack Developer",
        "company": "Example Co",
        "match_score": 0.70,
        "easy_apply": True,
        "already_applied": False,
    }
    values.update(overrides)
    return JobCandidate(**values)


def test_blacklisted_job_terms_skip_before_score_or_resume_selection() -> None:
    job = candidate(title="Senior Clearance Engineer", match_score=0.99)
    policy = ApplicationPolicy(blacklisted_job_terms=frozenset({"clearance"}))

    decision = evaluate_policy(job, policy)

    assert decision.action is ApplicationAction.SKIP
    assert decision.reason_codes == (ReasonCode.BLACKLISTED_JOB_TERM,)


def test_blacklisted_company_wins_over_high_match_score() -> None:
    policy = ApplicationPolicy(
        blacklisted_companies=frozenset({"example co"}),
        tailored_match_threshold=0.75,
    )

    decision = evaluate_policy(candidate(match_score=0.98), policy)

    assert decision.action is ApplicationAction.SKIP
    assert ReasonCode.BLACKLISTED_COMPANY in decision.reason_codes
    assert decision.resume_strategy is None
    assert decision.explanation


def test_already_applied_is_idempotently_skipped() -> None:
    decision = evaluate_policy(candidate(already_applied=True), ApplicationPolicy())

    assert decision.action is ApplicationAction.SKIP
    assert ReasonCode.ALREADY_APPLIED in decision.reason_codes


def test_low_match_job_is_skipped_without_tailored_resume() -> None:
    policy = ApplicationPolicy(minimum_match_threshold=0.60)

    decision = evaluate_policy(candidate(match_score=0.59), policy)

    assert decision.action is ApplicationAction.SKIP
    assert ReasonCode.MATCH_BELOW_THRESHOLD in decision.reason_codes
    assert decision.resume_strategy is None


def test_normal_match_uses_master_resume() -> None:
    policy = ApplicationPolicy(
        minimum_match_threshold=0.55,
        tailored_match_threshold=0.80,
        require_submit_confirmation=True,
    )

    decision = evaluate_policy(candidate(match_score=0.70), policy)

    assert decision.action is ApplicationAction.APPLY
    assert decision.resume_strategy is ResumeStrategy.MASTER
    assert decision.requires_submit_confirmation is True


def test_high_match_job_requests_tailored_resume() -> None:
    policy = ApplicationPolicy(
        minimum_match_threshold=0.55,
        tailored_match_threshold=0.75,
        require_submit_confirmation=True,
    )

    decision = evaluate_policy(candidate(match_score=0.90), policy)

    assert decision.action is ApplicationAction.APPLY
    assert decision.resume_strategy is ResumeStrategy.TAILORED
    assert ReasonCode.HIGH_MATCH_TAILORING_RECOMMENDED in decision.reason_codes
    assert decision.requires_submit_confirmation is True


def test_non_easy_apply_can_be_rejected_by_policy() -> None:
    policy = ApplicationPolicy(only_easy_apply=True)

    decision = evaluate_policy(candidate(easy_apply=False), policy)

    assert decision.action is ApplicationAction.SKIP
    assert ReasonCode.NOT_SUPPORTED_APPLICATION_TYPE in decision.reason_codes


def test_invalid_thresholds_are_rejected() -> None:
    with pytest.raises(ValueError):
        ApplicationPolicy(minimum_match_threshold=1.1)


def test_policy_is_built_from_application_settings() -> None:
    settings = ApplicationSettings(
        policy=PolicySettings(
            minimum_match_threshold=0.65,
            only_easy_apply=True,
            blacklisted_companies=("Example Co",),
        ),
        resume=ResumeSettings(tailored_match_threshold=0.85),
    )

    policy = policy_from_settings(settings)

    assert policy.minimum_match_threshold == 0.65
    assert policy.tailored_match_threshold == 0.85
    assert policy.only_easy_apply is True
    assert "example co" in policy.blacklisted_companies
