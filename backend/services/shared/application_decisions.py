from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Mapping

from application_core.models import ApplicationDecision, JobCandidate, ReasonCode, ResumeStrategy
from application_core.policy import evaluate_policy, policy_from_settings
from application_core.settings import ApplicationSettings
from services.shared.application_matching import score_job_match


@dataclass(frozen=True, slots=True)
class CandidateEvaluation:
    """The deterministic result of evaluating one discovered job."""

    candidate: JobCandidate
    decision: ApplicationDecision
    should_generate_tailored_resume: bool
    matched_terms: tuple[str, ...] = ()


def candidate_from_payload(payload: Mapping[str, Any]) -> JobCandidate:
    """Translate platform-shaped data into the small domain candidate contract."""
    external_id = payload.get("external_id") or payload.get("job_id") or payload.get("id")
    if not external_id or not str(external_id).strip():
        raise ValueError("external_id is required")
    return JobCandidate(
        platform=str(payload.get("platform") or "linkedin"),
        external_id=str(external_id).strip(),
        title=str(payload.get("title") or ""),
        company=str(payload.get("company") or ""),
        match_score=payload.get("match_score"),
        priority_score=payload.get("priority_score"),
        recency_factor=payload.get("recency_factor"),
        easy_apply=bool(payload.get("easy_apply", False)),
        already_applied=bool(payload.get("already_applied", False)),
        description=str(payload.get("description") or payload.get("job_description") or ""),
    )


def evaluate_candidate(
    payload: Mapping[str, Any],
    *,
    settings: ApplicationSettings,
    resume_data: Mapping[str, Any] | None = None,
) -> CandidateEvaluation:
    candidate_payload = dict(payload)
    match_result = None
    if candidate_payload.get("description") and resume_data:
        user_years = (
            candidate_payload.get("user_years_experience")
            or (resume_data.get("years_of_experience") if isinstance(resume_data, dict) else None)
        )
        match_result = score_job_match(
            str(candidate_payload["description"]),
            dict(resume_data),
            job_title=str(candidate_payload.get("title") or ""),
            date_posted=candidate_payload.get("posted_at") or candidate_payload.get("date_posted"),
            technologies=candidate_payload.get("technologies"),
            user_years_experience=user_years,
        )
        if candidate_payload.get("match_score") is None:
            candidate_payload["match_score"] = match_result.match_score
        if candidate_payload.get("priority_score") is None:
            candidate_payload["priority_score"] = match_result.priority_score
        if candidate_payload.get("recency_factor") is None:
            candidate_payload["recency_factor"] = match_result.recency_factor
    candidate = candidate_from_payload(candidate_payload)
    decision = evaluate_policy(candidate, policy_from_settings(settings))
    if match_result:
        decision = decision.model_copy(update={"matched_terms": match_result.matched_terms})
    if (
        decision.action.value == "apply"
        and decision.resume_strategy is not None
        and decision.resume_strategy.value == "tailored"
        and not (settings.ai.enabled and settings.ai.allow_tailored_resume)
    ):
        decision = decision.model_copy(
            update={
                "reason_codes": (ReasonCode.MASTER_RESUME_RECOMMENDED,),
                "explanation": "AI tailoring is disabled, so the master resume will be used.",
                "resume_strategy": ResumeStrategy.MASTER,
            }
        )
    should_generate = (
        settings.ai.enabled
        and settings.ai.allow_tailored_resume
        and decision.action.value == "apply"
        and decision.resume_strategy is not None
        and decision.resume_strategy.value == "tailored"
    )
    return CandidateEvaluation(
        candidate=candidate,
        decision=decision,
        should_generate_tailored_resume=should_generate,
        matched_terms=match_result.matched_terms if match_result else (),
    )


def evaluation_to_dict(result: CandidateEvaluation) -> dict[str, Any]:
    candidate = result.candidate
    decision = result.decision
    return {
        "candidate": {
            "platform": candidate.platform,
            "external_id": candidate.external_id,
            "title": candidate.title,
            "company": candidate.company,
            "match_score": candidate.match_score,
            "priority_score": candidate.priority_score,
            "recency_factor": candidate.recency_factor,
            "easy_apply": candidate.easy_apply,
            "already_applied": candidate.already_applied,
            "description": candidate.description,
        },
        "decision": {
            "action": decision.action.value,
            "reason_codes": [code.value for code in decision.reason_codes],
            "explanation": decision.explanation,
            "score": decision.score,
            "resume_strategy": decision.resume_strategy.value if decision.resume_strategy else None,
            "requires_submit_confirmation": decision.requires_submit_confirmation,
        },
        "should_generate_tailored_resume": result.should_generate_tailored_resume,
        "matched_terms": list(result.matched_terms),
    }
