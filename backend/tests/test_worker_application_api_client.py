from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from shared_services.persistence.api_client import BotApiClient
from shared_services.persistence.application_logger import ApplicationLogger


def test_worker_client_routes_decision_and_plan_commands_to_api() -> None:
    client = BotApiClient(base_url="http://api.test", enabled=True)
    calls: list[tuple[str, str, dict | None]] = []

    def fake_request(method: str, path: str, payload: dict | None = None, query=None, **_kwargs):
        calls.append((method, path, payload))
        return {"ok": True}

    client.request = fake_request  # type: ignore[method-assign]

    client.evaluate_application_decision({"external_id": "job-1"})
    client.create_application_plan({"candidate": {"external_id": "job-1"}})
    client.get_application_plan("application-1")
    client.generate_application_plan_resume("application-1")
    client.apply_application_plan_action("application-1", "confirm_submit")

    assert calls == [
        ("POST", "/api/application-decisions", {"candidate": {"external_id": "job-1"}}),
        ("POST", "/api/application-plans", {"candidate": {"external_id": "job-1"}}),
        ("GET", "/api/application-plans/application-1", None),
        ("POST", "/api/application-plans/application-1/tailored-resume", None),
        (
            "POST",
            "/api/application-plans/application-1/actions",
            {"action": "confirm_submit"},
        ),
    ]


def test_tailored_resume_request_allows_backend_ai_timeout() -> None:
    client = BotApiClient(base_url="http://api.test", timeout_seconds=30, enabled=True)
    calls: list[dict] = []

    def fake_request(*args, **kwargs):
        calls.append({"args": args, "kwargs": kwargs})
        return {"resume_data": {}}

    client.request = fake_request  # type: ignore[method-assign]

    client.generate_application_plan_resume("application-1")

    assert calls[0]["kwargs"]["timeout_seconds"] == 120


def test_application_logger_preserves_embedded_application_plan_data() -> None:
    payload = ApplicationLogger._to_api_payload(
        {
            "job_id": "job-1",
            "status": "submitted",
            "raw_data": {"application_plan": {"state": "submitted"}},
        }
    )

    assert payload["raw_data"]["application_plan"]["state"] == "submitted"
    assert "raw_data" not in payload["raw_data"]


def test_application_logger_does_not_regress_a_durable_plan_snapshot() -> None:
    current = {
        "raw_data": {
            "application_plan": {"state": "awaiting_user_review"},
            "application_plan_events": [{"action": "request_review"}],
        }
    }
    incoming = {
        "raw_data": {
            "application_plan": {"state": "planned"},
            "application_plan_events": [],
        }
    }

    merged = ApplicationLogger._merge_plan_snapshot(current, incoming)

    assert merged["raw_data"]["application_plan"]["state"] == "awaiting_user_review"
    assert merged["raw_data"]["application_plan_events"] == [{"action": "request_review"}]
