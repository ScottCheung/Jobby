from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

import pytest

from shared_services.persistence.plan_waiter import (
    PlanRejected,
    PlanWaitTimeout,
    wait_for_plan_ready,
)


def test_waiter_returns_when_console_approval_moves_plan_to_ready() -> None:
    responses = iter([
        {"plan": {"state": "awaiting_user_review"}},
        {"plan": {"state": "ready_to_submit"}},
    ])
    sleeps: list[float] = []

    result = wait_for_plan_ready(
        lambda _application_id: next(responses),
        "application-1",
        timeout_seconds=5,
        poll_seconds=0.25,
        sleep_fn=sleeps.append,
    )

    assert result["plan"]["state"] == "ready_to_submit"
    assert sleeps == [0.25]


def test_waiter_stops_when_user_rejects_plan() -> None:
    with pytest.raises(PlanRejected, match="not a fit"):
        wait_for_plan_ready(
            lambda _application_id: {
                "plan": {
                    "state": "rejected",
                    "review_reason": "not a fit",
                }
            },
            "application-1",
            timeout_seconds=5,
            sleep_fn=lambda _seconds: None,
        )


def test_waiter_accepts_api_client_plan_fetcher() -> None:
    from shared_services.persistence.api_client import BotApiClient

    client = BotApiClient(base_url="http://api.test", enabled=True)
    responses = iter([
        {"plan": {"state": "awaiting_user_review"}},
        {"plan": {"state": "ready_to_submit"}},
    ])
    client.get_application_plan = lambda _application_id: next(responses)  # type: ignore[method-assign]

    result = wait_for_plan_ready(
        client.get_application_plan,
        "application-1",
        timeout_seconds=5,
        poll_seconds=0.25,
        sleep_fn=lambda _seconds: None,
    )

    assert result["plan"]["state"] == "ready_to_submit"


def test_waiter_times_out_without_busy_looping() -> None:
    with pytest.raises(PlanWaitTimeout):
        wait_for_plan_ready(
            lambda _application_id: {"plan": {"state": "awaiting_user_review"}},
            "application-1",
            timeout_seconds=0,
            poll_seconds=0.1,
            sleep_fn=lambda _seconds: None,
        )


def test_waiter_can_report_current_state_for_worker_heartbeats() -> None:
    responses = iter([
        {"plan": {"state": "awaiting_user_review"}},
        {"plan": {"state": "ready_to_submit"}},
    ])
    states: list[str] = []

    wait_for_plan_ready(
        lambda _application_id: next(responses),
        "application-1",
        timeout_seconds=5,
        poll_seconds=0.25,
        sleep_fn=lambda _seconds: None,
        on_poll=lambda response: states.append(response["plan"]["state"]),
    )

    assert states == ["awaiting_user_review", "ready_to_submit"]
