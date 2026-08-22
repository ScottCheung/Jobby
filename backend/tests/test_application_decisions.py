from __future__ import annotations

import os
import sys
from copy import deepcopy

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

import pytest

from application_core.models import ApplicationAction, ReasonCode, ResumeStrategy
from application_core.settings import AISettings, ApplicationSettings, PolicySettings
from services.shared.application_decisions import (
    evaluate_candidate,
    evaluation_to_dict,
)
from services.shared.schemas import ApplicationDecisionRequest


def settings(*, ai_enabled: bool = True) -> ApplicationSettings:
    return ApplicationSettings(
        ai=AISettings(enabled=ai_enabled, allow_tailored_resume=True),
        policy=PolicySettings(
            minimum_match_threshold=0.60,
            blacklisted_companies=("Blocked Co",),
        ),
    )


def candidate_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "platform": "linkedin",
        "external_id": "job-123",
        "title": "Backend Engineer",
        "company": "Good Co",
        "match_score": 0.91,
        "easy_apply": True,
        "already_applied": False,
    }
    payload.update(overrides)
    return payload


def test_evaluation_maps_candidate_payload_and_exposes_explainable_decision() -> None:
    result = evaluate_candidate(candidate_payload(), settings= settings())

    assert result.candidate.external_id == "job-123"
    assert result.decision.action is ApplicationAction.APPLY
    assert result.decision.reason_codes == (ReasonCode.HIGH_MATCH_TAILORING_RECOMMENDED,)
    assert result.decision.resume_strategy is ResumeStrategy.TAILORED
    assert result.should_generate_tailored_resume is True

    serialized = evaluation_to_dict(result)
    assert serialized["decision"]["action"] == "apply"
    assert serialized["decision"]["reason_codes"] == ["high_match_tailoring_recommended"]
    assert serialized["decision"]["resume_strategy"] == "tailored"
    assert serialized["should_generate_tailored_resume"] is True


@pytest.mark.parametrize(
    "overrides, reason",
    [
        ({"company": "Blocked Co", "match_score": 0.99}, "blacklisted_company"),
        ({"match_score": 0.20}, "match_below_threshold"),
    ],
)
def test_skipped_candidates_never_trigger_tailored_resume_generation(
    overrides: dict[str, object], reason: str
) -> None:
    result = evaluate_candidate(candidate_payload(**overrides), settings=settings())

    assert result.decision.action is ApplicationAction.SKIP
    assert result.decision.reason_codes[0].value == reason
    assert result.should_generate_tailored_resume is False


def test_tailored_resume_generation_requires_ai_to_be_enabled() -> None:
    result = evaluate_candidate(candidate_payload(), settings=settings(ai_enabled=False))

    assert result.decision.action is ApplicationAction.APPLY
    assert result.decision.resume_strategy is ResumeStrategy.MASTER
    assert result.should_generate_tailored_resume is False


def test_tailored_resume_generation_requires_allow_flag() -> None:
    restricted = ApplicationSettings(
        ai=AISettings(enabled=True, allow_tailored_resume=False),
        policy=PolicySettings(minimum_match_threshold=0.60),
    )

    result = evaluate_candidate(candidate_payload(), settings=restricted)

    assert result.decision.resume_strategy is ResumeStrategy.MASTER
    assert result.should_generate_tailored_resume is False


def test_invalid_candidate_payload_is_rejected() -> None:
    with pytest.raises(ValueError, match="external_id is required"):
        evaluate_candidate(candidate_payload(external_id=""), settings=settings())


def test_missing_score_is_derived_before_policy_evaluation_when_resume_is_available() -> None:
    result = evaluate_candidate(
        candidate_payload(match_score=None, description="Python FastAPI APIs"),
        settings=settings(ai_enabled=False),
        resume_data={"skills": [{"skills": ["Python", "FastAPI"]}]},
    )

    assert result.candidate.match_score is not None
    assert result.matched_terms == ("fastapi", "python")
    assert result.decision.action is ApplicationAction.APPLY


def test_extracted_technologies_are_matched_without_a_job_description() -> None:
    result = evaluate_candidate(
        candidate_payload(
            match_score=None,
            technologies=["Python", "React", "TypeScript", "PostgreSQL", "TDD"],
        ),
        settings=settings(ai_enabled=False),
        resume_data={"skills": ["Python", "React", "TypeScript", "PostgreSQL"]},
    )

    assert result.candidate.match_score is not None
    assert {"python", "react", "typescript", "postgresql"} <= set(result.matched_terms)
    assert "tdd" not in result.matched_terms


def test_profile_skills_affect_scoring_without_mutating_resume_data() -> None:
    resume_data = {
        "skills": [
            {
                "type": "Frontend",
                "skills": ["React", "Next.js", "TypeScript"],
            }
        ]
    }
    original_resume = deepcopy(resume_data)

    result = evaluate_candidate(
        candidate_payload(
            match_score=None,
            description="Git source control experience is required",
            technologies=["Git"],
        ),
        settings=settings(ai_enabled=False),
        resume_data=resume_data,
        profile_skills=["Git"],
    )

    assert "git" in result.matched_terms
    assert result.candidate.skill_score is not None
    assert result.candidate.skill_score >= 0.8
    assert resume_data == original_resume
    assert resume_data["skills"][0]["skills"] == ["React", "Next.js", "TypeScript"]


def test_decision_request_keeps_candidate_as_a_nested_contract() -> None:
    request = ApplicationDecisionRequest(candidate=candidate_payload())

    assert request.candidate.external_id == "job-123"
    assert request.candidate.platform == "linkedin"
