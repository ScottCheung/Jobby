from __future__ import annotations
from typing import FrozenSet
from pydantic import BaseModel, Field, field_validator

from application_core.models import (
    ApplicationAction,
    ApplicationDecision,
    JobCandidate,
    ReasonCode,
    ResumeStrategy,
)
from application_core.settings import ApplicationSettings


class ApplicationPolicy(BaseModel):
    minimum_match_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    tailored_match_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    blacklisted_companies: FrozenSet[str] = Field(default_factory=frozenset)
    blacklisted_job_terms: FrozenSet[str] = Field(default_factory=frozenset)
    only_easy_apply: bool = True
    require_submit_confirmation: bool = True

    @field_validator("blacklisted_companies", "blacklisted_job_terms", mode="before")
    @classmethod
    def _coerce_frozenset(cls, value: Any) -> FrozenSet[str]:
        if isinstance(value, (list, set, tuple, frozenset)):
            return frozenset(str(item).lower() for item in value)
        return frozenset()


def policy_from_settings(settings: ApplicationSettings) -> ApplicationPolicy:
    return ApplicationPolicy(
        minimum_match_threshold=settings.policy.minimum_match_threshold,
        tailored_match_threshold=settings.resume.tailored_match_threshold,
        blacklisted_companies=frozenset(s.lower() for s in settings.policy.blacklisted_companies),
        blacklisted_job_terms=frozenset(s.lower() for s in settings.policy.blacklisted_job_terms),
        only_easy_apply=settings.policy.only_easy_apply,
        require_submit_confirmation=settings.automation.require_submit_confirmation,
    )


def evaluate_policy(candidate: JobCandidate, policy: ApplicationPolicy | None = None) -> ApplicationDecision:
    policy = policy or ApplicationPolicy()

    if candidate.already_applied:
        return ApplicationDecision(
            action=ApplicationAction.SKIP,
            reason_codes=(ReasonCode.ALREADY_APPLIED,),
            explanation="Job already applied.",
        )

    if policy.only_easy_apply and not candidate.easy_apply:
        return ApplicationDecision(
            action=ApplicationAction.SKIP,
            reason_codes=(ReasonCode.NOT_SUPPORTED_APPLICATION_TYPE,),
            explanation="External application type is not supported.",
        )

    title_lower = candidate.title.lower()
    for term in policy.blacklisted_job_terms:
        if term in title_lower:
            return ApplicationDecision(
                action=ApplicationAction.SKIP,
                reason_codes=(ReasonCode.BLACKLISTED_JOB_TERM,),
                explanation=f"Job title contains blacklisted term '{term}'.",
            )

    company_lower = candidate.company.lower()
    for comp in policy.blacklisted_companies:
        if comp in company_lower or company_lower in comp:
            return ApplicationDecision(
                action=ApplicationAction.SKIP,
                reason_codes=(ReasonCode.BLACKLISTED_COMPANY,),
                explanation=f"Company '{candidate.company}' is blacklisted.",
            )

    score = candidate.match_score if candidate.match_score is not None else 0.70
    if score < policy.minimum_match_threshold:
        return ApplicationDecision(
            action=ApplicationAction.SKIP,
            reason_codes=(ReasonCode.MATCH_BELOW_THRESHOLD,),
            explanation=f"Match score {score:.2f} is below minimum threshold {policy.minimum_match_threshold:.2f}.",
            score=score,
        )

    if score >= policy.tailored_match_threshold:
        return ApplicationDecision(
            action=ApplicationAction.APPLY,
            reason_codes=(ReasonCode.HIGH_MATCH_TAILORING_RECOMMENDED,),
            explanation=f"Match score {score:.2f} qualifies for tailored resume application.",
            score=score,
            resume_strategy=ResumeStrategy.TAILORED,
            requires_submit_confirmation=policy.require_submit_confirmation,
        )

    return ApplicationDecision(
        action=ApplicationAction.APPLY,
        reason_codes=(ReasonCode.MASTER_RESUME_RECOMMENDED,),
        explanation=f"Match score {score:.2f} qualifies for master resume application.",
        score=score,
        resume_strategy=ResumeStrategy.MASTER,
        requires_submit_confirmation=policy.require_submit_confirmation,
    )
