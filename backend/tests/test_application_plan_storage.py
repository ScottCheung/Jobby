from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

import pytest

from application_core.models import ApplicationAction, ApplicationState, ResumeStrategy
from application_core.policy import ApplicationPolicy, evaluate_policy
from application_core.models import JobCandidate
from application_core.workflow import begin_preparation, create_application_plan, mark_prepared, reject_review
from services.shared.application_plans import (
    append_plan_event,
    plan_can_be_reevaluated,
    plan_from_dict,
    plan_requires_tailored_resume,
    plan_to_dict,
)
from services.shared.schemas import (
    ApplicationFieldInstruction,
    ApplicationFormFieldInput,
    ApplicationFormInstructionsResponse,
    ApplicationPlanActionRequest,
    ApplicationPlanCreateRequest,
)


def make_plan():
    candidate = JobCandidate(
        platform="linkedin",
        external_id="job-42",
        title="Engineer",
        company="Example Co",
        match_score=0.72,
    )
    decision = evaluate_policy(candidate, ApplicationPolicy(require_submit_confirmation=True))
    return create_application_plan(candidate, decision)


def test_application_plan_round_trips_without_losing_review_contract() -> None:
    plan = make_plan()
    restored = plan_from_dict(plan_to_dict(plan))

    assert restored.candidate == plan.candidate
    assert restored.decision == plan.decision
    assert restored.idempotency_key == "linkedin:job-42"
    assert restored.state is ApplicationState.PLANNED


def test_review_state_can_be_persisted_and_approved() -> None:
    plan = mark_prepared(begin_preparation(make_plan()))
    plan = reject_review(plan, "User does not want to apply")
    restored = plan_from_dict(plan_to_dict(plan))

    assert restored.state is ApplicationState.REJECTED
    assert restored.review_reason == "User does not want to apply"


def test_malformed_persisted_plan_is_rejected() -> None:
    payload = plan_to_dict(make_plan())
    payload["decision"]["action"] = "unknown"

    with pytest.raises(ValueError):
        plan_from_dict(payload)


def test_plan_api_contract_separates_creation_from_state_actions() -> None:
    create = ApplicationPlanCreateRequest(
        candidate={
            "external_id": "job-42",
            "title": "Engineer",
            "company": "Example Co",
        },
        job_description="Build APIs",
    )
    action = ApplicationPlanActionRequest(action="approve")

    assert create.candidate.external_id == "job-42"
    assert action.action == "approve"


def test_form_instructions_omit_unavailable_optional_field_identifiers() -> None:
    target = ApplicationFormFieldInput(
        key="email",
        type="email",
        label="Email address",
    )
    response = ApplicationFormInstructionsResponse(
        application_id="018f8b31-66a8-7d42-8c01-9b423f15df91",
        instructions=[
            ApplicationFieldInstruction(
                commandId="instruction-1",
                target=target,
                value="candidate@example.com",
            )
        ],
        unanswered_fields=[],
    )

    target_payload = response.model_dump(exclude_none=True)["instructions"][0]["target"]

    assert "id" not in target_payload
    assert "name" not in target_payload


def test_plan_events_are_append_only_and_do_not_mutate_existing_raw_data() -> None:
    raw_data = {"application_plan": {"state": "planned"}}

    updated = append_plan_event(
        raw_data,
        action="prepare",
        from_state="planned",
        to_state="preparing",
        actor="worker",
        occurred_at="2026-08-01T00:00:00Z",
    )

    assert raw_data == {"application_plan": {"state": "planned"}}
    assert updated["application_plan_events"] == [
        {
            "action": "prepare",
            "from_state": "planned",
            "to_state": "preparing",
            "actor": "worker",
            "occurred_at": "2026-08-01T00:00:00Z",
        }
    ]


def test_only_apply_tailored_plans_can_generate_tailored_resume() -> None:
    plan = make_plan()
    assert plan_requires_tailored_resume(plan) is False
    tailored_candidate = JobCandidate(
        platform="linkedin",
        external_id="job-43",
        title="Engineer",
        company="Example Co",
        match_score=0.95,
    )
    tailored_plan = create_application_plan(
        tailored_candidate,
        evaluate_policy(tailored_candidate, ApplicationPolicy(require_submit_confirmation=True)),
    )
    assert plan_requires_tailored_resume(tailored_plan) is True


def test_only_automatic_low_match_skip_can_be_reevaluated() -> None:
    low_match_candidate = JobCandidate(
        platform="linkedin",
        external_id="job-low",
        title="Frontend Engineer",
        company="Example Co",
        match_score=0.20,
    )
    low_match_plan = create_application_plan(
        low_match_candidate,
        evaluate_policy(low_match_candidate, ApplicationPolicy(minimum_match_threshold=0.55)),
    )

    assert plan_can_be_reevaluated(low_match_plan) is True
    assert plan_can_be_reevaluated(make_plan()) is False

    rejected = reject_review(mark_prepared(begin_preparation(make_plan())), "User rejected submission")
    assert plan_can_be_reevaluated(rejected) is False
