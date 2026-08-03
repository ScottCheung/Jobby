from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

import pytest

from shared_services.persistence.submission_gate import (
    PlanNotReady,
    begin_submission_after_approval,
)


def test_begin_submission_requires_ready_to_submit_state() -> None:
    actions: list[tuple[str, str]] = []

    with pytest.raises(PlanNotReady):
        begin_submission_after_approval(
            lambda _application_id: {"plan": {"state": "awaiting_user_review"}},
            lambda application_id, action: actions.append((application_id, action)) or {"plan": {"state": "submitting"}},
            "application-1",
        )

    assert actions == []


def test_begin_submission_calls_api_only_after_approval() -> None:
    actions: list[tuple[str, str]] = []

    result = begin_submission_after_approval(
        lambda _application_id: {"plan": {"state": "ready_to_submit"}},
        lambda application_id, action: actions.append((application_id, action)) or {"plan": {"state": "submitting"}},
        "application-1",
    )

    assert actions == [("application-1", "begin_submission")]
    assert result["plan"]["state"] == "submitting"


def test_begin_submission_rejects_missing_plan() -> None:
    with pytest.raises(PlanNotReady):
        begin_submission_after_approval(
            lambda _application_id: {},
            lambda _application_id, _action: {},
            "application-1",
        )
