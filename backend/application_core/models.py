from __future__ import annotations
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator


class ApplicationAction(str, Enum):
    APPLY = "apply"
    SKIP = "skip"


class ResumeStrategy(str, Enum):
    MASTER = "master"
    TAILORED = "tailored"


class ApplicationState(str, Enum):
    PLANNED = "planned"
    PREPARING = "preparing"
    AWAITING_USER_REVIEW = "awaiting_user_review"
    READY_TO_SUBMIT = "ready_to_submit"
    SUBMITTING = "submitting"
    SUBMITTED = "submitted"
    FAILED = "failed"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class ReasonCode(str, Enum):
    HIGH_MATCH_TAILORING_RECOMMENDED = "high_match_tailoring_recommended"
    MASTER_RESUME_RECOMMENDED = "master_resume_recommended"
    MATCH_BELOW_THRESHOLD = "match_below_threshold"
    BLACKLISTED_COMPANY = "blacklisted_company"
    BLACKLISTED_JOB_TERM = "blacklisted_job_term"
    ALREADY_APPLIED = "already_applied"
    NOT_SUPPORTED_APPLICATION_TYPE = "not_supported_application_type"


class JobCandidate(BaseModel):
    platform: str
    external_id: str
    title: str
    company: str
    match_score: float | None = None
    easy_apply: bool = True
    already_applied: bool = False
    description: str | None = None


class ApplicationDecision(BaseModel):
    action: ApplicationAction
    reason_codes: tuple[ReasonCode, ...] = Field(default_factory=tuple)
    explanation: str = ""
    score: float | None = None
    resume_strategy: ResumeStrategy | None = None
    requires_submit_confirmation: bool = True

    @field_validator("reason_codes", mode="before")
    @classmethod
    def _coerce_reason_codes(cls, value: Any) -> tuple[ReasonCode, ...]:
        if isinstance(value, (list, tuple, set, frozenset)):
            res = []
            for item in value:
                if isinstance(item, ReasonCode):
                    res.append(item)
                elif isinstance(item, str):
                    res.append(ReasonCode(item))
            return tuple(res)
        return ()


class ApplicationPlan(BaseModel):
    candidate: JobCandidate
    decision: ApplicationDecision
    idempotency_key: str
    state: ApplicationState = ApplicationState.PLANNED
    review_reason: str | None = None
