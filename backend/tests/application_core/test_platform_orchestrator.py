from __future__ import annotations

import pytest

from application_core.models import (
    ApplicationAction,
    ApplicationState,
    JobCandidate,
    ReasonCode,
    ResumeStrategy,
)
from application_core.orchestrator import ApplicationOrchestrator
from application_core.platforms import (
    ApplicationPreparation,
    PlatformCapabilities,
    PlatformCapabilityError,
)
from application_core.policy import ApplicationDecision
from application_core.workflow import approve_review, create_application_plan


class FakeAdapter:
    platform_name = "fake"
    capabilities = PlatformCapabilities(
        supports_resume_upload=True,
        supports_human_review=True,
        supports_submission=True,
    )

    def __init__(self, preparation: ApplicationPreparation | None = None) -> None:
        self.preparation = preparation or ApplicationPreparation()
        self.prepared = []
        self.submitted = []

    def prepare_application(self, plan):
        self.prepared.append(plan.idempotency_key)
        return self.preparation

    def submit_application(self, plan):
        self.submitted.append(plan.idempotency_key)
        return {"external_id": plan.candidate.external_id, "status": "submitted"}


def candidate() -> JobCandidate:
    return JobCandidate(
        platform="fake",
        external_id="123",
        title="Developer",
        company="Example Co",
        match_score=0.70,
        easy_apply=True,
    )


def decision() -> ApplicationDecision:
    return ApplicationDecision(
        action=ApplicationAction.APPLY,
        reason_codes=(ReasonCode.MASTER_RESUME_RECOMMENDED,),
        explanation="Use the master resume.",
        score=0.70,
        resume_strategy=ResumeStrategy.MASTER,
        requires_submit_confirmation=True,
    )


def test_orchestrator_prepares_and_waits_for_confirmation() -> None:
    adapter = FakeAdapter()
    orchestrator = ApplicationOrchestrator(adapter)
    plan = create_application_plan(candidate(), decision())

    orchestrator.prepare(plan)

    assert plan.state is ApplicationState.AWAITING_USER_REVIEW
    assert adapter.prepared == ["fake:123"]
    with pytest.raises(ValueError):
        orchestrator.submit(plan)

    approve_review(plan)
    result = orchestrator.submit(plan)

    assert plan.state is ApplicationState.SUBMITTED
    assert adapter.submitted == ["fake:123"]
    assert result["status"] == "submitted"


def test_adapter_can_request_review_for_unknown_required_fields() -> None:
    adapter = FakeAdapter(ApplicationPreparation(review_reason="unknown_required_question"))
    orchestrator = ApplicationOrchestrator(adapter)
    plan = create_application_plan(candidate(), decision())

    orchestrator.prepare(plan)

    assert plan.state is ApplicationState.AWAITING_USER_REVIEW
    assert plan.review_reason == "unknown_required_question"


def test_tailored_resume_requires_upload_capability() -> None:
    adapter = FakeAdapter()
    adapter.capabilities = PlatformCapabilities(
        supports_resume_upload=False,
        supports_human_review=True,
        supports_submission=True,
    )
    tailored_decision = ApplicationDecision(
        action=ApplicationAction.APPLY,
        reason_codes=(ReasonCode.HIGH_MATCH_TAILORING_RECOMMENDED,),
        explanation="Tailored resume required.",
        score=0.95,
        resume_strategy=ResumeStrategy.TAILORED,
        requires_submit_confirmation=True,
    )
    plan = create_application_plan(candidate(), tailored_decision)

    with pytest.raises(PlatformCapabilityError):
        ApplicationOrchestrator(adapter).prepare(plan)

    assert plan.state is ApplicationState.FAILED

