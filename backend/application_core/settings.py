from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field, field_validator


class AutomationSettings(BaseModel):
    max_jobs_per_run: int = Field(default=10, ge=1)
    require_submit_confirmation: bool = True
    stop_on_unknown_question: bool = True
    execution_mode: str = "human_confirmed"
    review_channel: str = "browser"

    @field_validator("review_channel")
    @classmethod
    def validate_review_channel(cls, value: str) -> str:
        if value not in {"browser", "console"}:
            raise ValueError("review_channel must be 'browser' or 'console'")
        return value

    @field_validator("require_submit_confirmation")
    @classmethod
    def enforce_require_submit_confirmation(cls, value: bool) -> bool:
        return True


class AISettings(BaseModel):
    enabled: bool = True
    provider: str = "deepseek"
    model: str = "deepseek-chat"
    min_confidence: float = Field(default=0.7, ge=0.0, le=1.0)
    daily_budget: float = Field(default=5.0, ge=0.0)
    allow_tailored_resume: bool = True


class ResumeSettings(BaseModel):
    tailored_match_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class PolicySettings(BaseModel):
    minimum_match_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    blacklisted_companies: tuple[str, ...] = Field(default_factory=tuple)
    blacklisted_job_terms: tuple[str, ...] = Field(default_factory=tuple)
    only_easy_apply: bool = True

    @field_validator("blacklisted_companies", "blacklisted_job_terms", mode="before")
    @classmethod
    def _coerce_tuple(cls, value: Any) -> tuple[str, ...]:
        if isinstance(value, (list, set, tuple)):
            return tuple(str(item) for item in value)
        return ()


class ApplicationSettings(BaseModel):
    automation: AutomationSettings = Field(default_factory=AutomationSettings)
    ai: AISettings = Field(default_factory=AISettings)
    resume: ResumeSettings = Field(default_factory=ResumeSettings)
    policy: PolicySettings = Field(default_factory=PolicySettings)

    def to_dict(self) -> dict[str, dict[str, Any]]:
        return {
            "automation": self.automation.model_dump(),
            "ai": self.ai.model_dump(),
            "resume": self.resume.model_dump(),
            "policy": self.policy.model_dump(),
        }


def from_legacy_runtime_settings(
    runtime_values: dict[str, Any] | None = None,
    policy_values: dict[str, Any] | None = None,
) -> ApplicationSettings:
    rv = runtime_values or {}
    pv = policy_values or {}

    max_jobs = rv.get("switch_number") or rv.get("max_jobs") or 10
    allow_tailored = rv.get("enable_tailored_resume")
    if allow_tailored is None:
        allow_tailored = True

    return ApplicationSettings(
        automation=AutomationSettings(
            max_jobs_per_run=int(max_jobs) if str(max_jobs).isdigit() else 10,
            require_submit_confirmation=True,
            stop_on_unknown_question=bool(rv.get("stop_on_unknown_question", True)),
            execution_mode="human_confirmed",
            review_channel="browser",
        ),
        ai=AISettings(
            enabled=bool(rv.get("use_AI", True)),
            provider=str(rv.get("llm_provider", "deepseek")),
            model=str(rv.get("llm_model", "deepseek-chat")),
            min_confidence=float(rv.get("ai_min_confidence", 0.7)),
            allow_tailored_resume=bool(allow_tailored),
        ),
        resume=ResumeSettings(
            tailored_match_threshold=float(rv.get("tailored_resume_threshold", 0.7)),
        ),
        policy=PolicySettings(
            minimum_match_threshold=float(pv.get("minimum_match_threshold", 0.5)),
            blacklisted_companies=tuple(pv.get("blacklisted_companies") or ()),
            blacklisted_job_terms=tuple(pv.get("blacklisted_job_terms") or ()),
            only_easy_apply=bool(pv.get("only_easy_apply", True)),
        ),
    )
