from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

from application_core.models import (
    ApplicationAction,
    ApplicationDecision,
    ApplicationPlan,
    ApplicationState,
    JobCandidate,
    ReasonCode,
    ResumeStrategy,
)


def append_plan_event(
    raw_data: Mapping[str, Any] | None,
    *,
    action: str,
    from_state: str | None,
    to_state: str,
    actor: str = "system",
    occurred_at: str | None = None,
) -> dict[str, Any]:
    """Return a new raw-data object with one immutable transition event appended."""
    updated = dict(raw_data or {})
    events = list(updated.get("application_plan_events") or [])
    events.append(
        {
            "action": str(action),
            "from_state": from_state,
            "to_state": str(to_state),
            "actor": str(actor or "system"),
            "occurred_at": occurred_at or datetime.now(timezone.utc).isoformat(),
        }
    )
    updated["application_plan_events"] = events
    return updated


def plan_requires_tailored_resume(plan: ApplicationPlan) -> bool:
    """Return whether this durable decision permits tailored resume generation."""
    return (
        plan.decision.action is ApplicationAction.APPLY
        and plan.decision.resume_strategy is ResumeStrategy.TAILORED
    )


def plan_can_be_reevaluated(plan: ApplicationPlan) -> bool:
    """Allow deterministic low-match skips to follow current scoring policy.

    User decisions and submission states remain durable. Only an automatic
    score-based skip may be replaced when the worker sees the job again.
    """
    return (
        plan.state is ApplicationState.SKIPPED
        and ReasonCode.MATCH_BELOW_THRESHOLD in plan.decision.reason_codes
    )


def plan_to_dict(plan: ApplicationPlan) -> dict[str, Any]:
    candidate = plan.candidate
    decision = plan.decision
    return {
        "candidate": {
            "platform": candidate.platform,
            "external_id": candidate.external_id,
            "title": candidate.title,
            "company": candidate.company,
            "match_score": candidate.match_score,
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
            "matched_terms": list(decision.matched_terms),
        },
        "idempotency_key": plan.idempotency_key,
        "state": plan.state.value,
        "review_reason": plan.review_reason,
    }


def plan_from_dict(payload: Mapping[str, Any]) -> ApplicationPlan:
    candidate_payload = payload.get("candidate")
    decision_payload = payload.get("decision")
    if not isinstance(candidate_payload, Mapping) or not isinstance(decision_payload, Mapping):
        raise ValueError("application plan must contain candidate and decision objects")

    candidate = JobCandidate(
        platform=candidate_payload.get("platform", ""),
        external_id=candidate_payload.get("external_id", ""),
        title=candidate_payload.get("title", ""),
        company=candidate_payload.get("company", ""),
        match_score=candidate_payload.get("match_score"),
        easy_apply=bool(candidate_payload.get("easy_apply", False)),
        already_applied=bool(candidate_payload.get("already_applied", False)),
        description=str(candidate_payload["description"]) if candidate_payload.get("description") is not None else None,
    )
    resume_strategy = decision_payload.get("resume_strategy")
    decision = ApplicationDecision(
        action=ApplicationAction(decision_payload.get("action")),
        reason_codes=tuple(ReasonCode(code) for code in decision_payload.get("reason_codes", ())),
        explanation=str(decision_payload.get("explanation") or ""),
        score=decision_payload.get("score"),
        resume_strategy=ResumeStrategy(resume_strategy) if resume_strategy else None,
        requires_submit_confirmation=bool(decision_payload.get("requires_submit_confirmation", False)),
        matched_terms=tuple(str(item) for item in decision_payload.get("matched_terms", ())),
    )
    idempotency_key = str(payload.get("idempotency_key") or "").strip()
    if not idempotency_key:
        raise ValueError("application plan idempotency_key is required")
    return ApplicationPlan(
        candidate=candidate,
        decision=decision,
        idempotency_key=idempotency_key,
        state=ApplicationState(payload.get("state")),
        review_reason=payload.get("review_reason"),
    )
