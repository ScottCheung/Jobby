from __future__ import annotations
from typing import Any
from application_core.models import ApplicationPlan, ApplicationState, ResumeStrategy
from application_core.platforms import PlatformCapabilityError
from application_core.workflow import (
    begin_preparation,
    begin_submission,
    mark_failed,
    mark_prepared,
    mark_submitted,
    request_review,
)

class ApplicationOrchestrator:
    def __init__(self, adapter: Any) -> None:
        self.adapter = adapter

    def prepare(self, plan: ApplicationPlan) -> Any:
        if plan.decision.resume_strategy is ResumeStrategy.TAILORED and not getattr(
            self.adapter.capabilities, "supports_resume_upload", True
        ):
            mark_failed(plan, "Platform does not support tailored resume upload")
            raise PlatformCapabilityError("Platform does not support tailored resume upload")

        begin_preparation(plan)
        prep = self.adapter.prepare_application(plan)
        if prep and getattr(prep, "review_reason", None):
            request_review(plan, prep.review_reason)
        else:
            mark_prepared(plan)
        return prep

    def submit(self, plan: ApplicationPlan) -> Any:
        if plan.state is not ApplicationState.READY_TO_SUBMIT:
            raise ValueError(f"Plan must be in ready_to_submit state, currently: {plan.state}")
        begin_submission(plan)
        try:
            result = self.adapter.submit_application(plan)
            mark_submitted(plan)
            return result
        except Exception as exc:
            mark_failed(plan, str(exc))
            raise
