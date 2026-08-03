from __future__ import annotations

import pytest

from application_core.models import (
    ApplicationAction,
    ApplicationState,
    JobCandidate,
    ReasonCode,
    ResumeStrategy,
)
from application_core.policy import ApplicationDecision
from application_core.workflow import (
    PlanTransitionError,
    approve_review,
    begin_preparation,
    begin_submission,
    create_application_plan,
    mark_prepared,
    mark_submitted,
    request_review,
    reject_review,
)


def candidate() -> JobCandidate:
    return JobCandidate(
        platform="linkedin",
        external_id="123",
        title="Full-Stack Developer",
        company="Example Co",
        match_score=0.90,
        easy_apply=True,
    )


def apply_decision(*, confirmation: bool = True) -> ApplicationDecision:
    return ApplicationDecision(
        action=ApplicationAction.APPLY,
        reason_codes=(ReasonCode.HIGH_MATCH_TAILORING_RECOMMENDED,),
        explanation="High match.",
        score=0.90,
        resume_strategy=ResumeStrategy.TAILORED,
        requires_submit_confirmation=confirmation,
    )


def test_skip_plan_is_terminal_and_cannot_be_approved() -> None:
    decision = ApplicationDecision(
        action=ApplicationAction.SKIP,
        reason_codes=(ReasonCode.BLACKLISTED_COMPANY,),
        explanation="Blacklisted.",
    )
    plan = create_application_plan(candidate(), decision)

    assert plan.state is ApplicationState.SKIPPED
    with pytest.raises(PlanTransitionError):
        approve_review(plan)


def test_preparation_requires_durable_user_confirmation_before_submission() -> None:
    plan = create_application_plan(candidate(), apply_decision())

    begin_preparation(plan)
    mark_prepared(plan)

    assert plan.state is ApplicationState.AWAITING_USER_REVIEW
    assert plan.review_reason == "submit_confirmation_required"

    approve_review(plan)
    assert plan.state is ApplicationState.READY_TO_SUBMIT

    begin_submission(plan)
    assert plan.state is ApplicationState.SUBMITTING
    mark_submitted(plan)
    assert plan.state is ApplicationState.SUBMITTED


def test_user_rejection_is_terminal_and_cannot_submit() -> None:
    plan = create_application_plan(candidate(), apply_decision())
    begin_preparation(plan)
    request_review(plan, "unknown_required_question")
    reject_review(plan, "User chose not to apply")

    assert plan.state is ApplicationState.REJECTED
    assert plan.review_reason == "User chose not to apply"
    with pytest.raises(PlanTransitionError):
        begin_submission(plan)


def test_prepared_plan_without_confirmation_can_be_submitted() -> None:
    plan = create_application_plan(candidate(), apply_decision(confirmation=False))
    begin_preparation(plan)
    mark_prepared(plan)

    assert plan.state is ApplicationState.READY_TO_SUBMIT


def test_same_candidate_has_stable_idempotency_key() -> None:
    first = create_application_plan(candidate(), apply_decision())
    second = create_application_plan(candidate(), apply_decision())

    assert first.idempotency_key == "linkedin:123"
    assert second.idempotency_key == first.idempotency_key


def test_invalid_transition_is_rejected() -> None:
    plan = create_application_plan(candidate(), apply_decision())

    with pytest.raises(PlanTransitionError):
        mark_submitted(plan)

