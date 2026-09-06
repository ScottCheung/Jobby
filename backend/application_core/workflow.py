from __future__ import annotations
from application_core.models import (
    ApplicationAction,
    ApplicationDecision,
    ApplicationPlan,
    ApplicationState,
    JobCandidate,
)


class PlanTransitionError(RuntimeError):
    pass


def create_application_plan(candidate: JobCandidate, decision: ApplicationDecision) -> ApplicationPlan:
    idempotency_key = f"{candidate.platform}:{candidate.external_id}"
    initial_state = (
        ApplicationState.SKIPPED
        if decision.action is ApplicationAction.SKIP
        else ApplicationState.PLANNED
    )
    return ApplicationPlan(
        candidate=candidate,
        decision=decision,
        idempotency_key=idempotency_key,
        state=initial_state,
    )


def begin_preparation(plan: ApplicationPlan) -> ApplicationPlan:
    if plan.state not in (ApplicationState.PLANNED, ApplicationState.AWAITING_USER_REVIEW):
        raise PlanTransitionError(f"Cannot begin preparation from state {plan.state}")
    plan.state = ApplicationState.PREPARING
    return plan


def request_review(plan: ApplicationPlan, reason: str = "unknown_required_question") -> ApplicationPlan:
    if plan.state is not ApplicationState.PREPARING:
        raise PlanTransitionError(f"Cannot request review from state {plan.state}")
    plan.state = ApplicationState.AWAITING_USER_REVIEW
    plan.review_reason = reason
    return plan


def mark_prepared(plan: ApplicationPlan) -> ApplicationPlan:
    if plan.state is not ApplicationState.PREPARING:
        raise PlanTransitionError(f"Cannot mark prepared from state {plan.state}")
    if plan.decision.requires_submit_confirmation:
        plan.state = ApplicationState.AWAITING_USER_REVIEW
        plan.review_reason = "submit_confirmation_required"
    else:
        plan.state = ApplicationState.READY_TO_SUBMIT
    return plan


def approve_review(plan: ApplicationPlan) -> ApplicationPlan:
    if plan.state is not ApplicationState.AWAITING_USER_REVIEW:
        raise PlanTransitionError(f"Cannot approve review from state {plan.state}")
    plan.state = ApplicationState.READY_TO_SUBMIT
    plan.review_reason = None
    return plan


def reject_review(plan: ApplicationPlan, reason: str = "User rejected application") -> ApplicationPlan:
    if plan.state not in (ApplicationState.AWAITING_USER_REVIEW, ApplicationState.PLANNED, ApplicationState.PREPARING):
        raise PlanTransitionError(f"Cannot reject review from state {plan.state}")
    plan.state = ApplicationState.REJECTED
    plan.review_reason = reason
    return plan


def begin_submission(plan: ApplicationPlan) -> ApplicationPlan:
    if plan.state is not ApplicationState.READY_TO_SUBMIT:
        raise PlanTransitionError(f"Cannot begin submission from state {plan.state}")
    plan.state = ApplicationState.SUBMITTING
    return plan


def mark_submitted(plan: ApplicationPlan) -> ApplicationPlan:
    if plan.state is not ApplicationState.SUBMITTING:
        raise PlanTransitionError(f"Cannot mark submitted from state {plan.state}")
    plan.state = ApplicationState.SUBMITTED
    return plan


def mark_failed(plan: ApplicationPlan, reason: str = "Application submission failed") -> ApplicationPlan:
    plan.state = ApplicationState.FAILED
    plan.review_reason = reason
    return plan
