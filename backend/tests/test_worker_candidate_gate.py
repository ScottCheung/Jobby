from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from shared_services.persistence.worker_decision import (
    build_candidate_payload,
    decision_gate,
    should_generate_tailored_resume,
)


def test_candidate_payload_is_platform_neutral() -> None:
    payload = build_candidate_payload(
        platform="linkedin",
        external_id="123",
        title="Backend Engineer",
        company="Example Co",
        description="Python APIs",
        easy_apply=True,
    )

    assert payload == {
        "platform": "linkedin",
        "external_id": "123",
        "title": "Backend Engineer",
        "company": "Example Co",
        "description": "Python APIs",
        "easy_apply": True,
        "already_applied": False,
    }


def test_decision_gate_returns_durable_action_and_reason() -> None:
    result = decision_gate(
        {
            "decision": {
                "action": "skip",
                "explanation": "The company is blacklisted.",
            }
        }
    )

    assert result == {"action": "skip", "reason": "The company is blacklisted."}


def test_malformed_decision_fails_closed_to_review() -> None:
    result = decision_gate({})

    assert result["action"] == "review"
    assert result["reason"]


def test_tailored_resume_generation_is_limited_to_apply_tailored_plans() -> None:
    assert should_generate_tailored_resume({
        "plan": {"decision": {"action": "apply", "resume_strategy": "tailored"}}
    })
    assert not should_generate_tailored_resume({
        "plan": {"decision": {"action": "apply", "resume_strategy": "master"}}
    })
    assert not should_generate_tailored_resume({
        "plan": {"decision": {"action": "review", "resume_strategy": "tailored"}}
    })
