from __future__ import annotations

import json
import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from shared_services.runtime_status import bot_diagnostic, bot_status, update_bot_stats


def test_status_protocol_matches_desktop_consumer(capsys) -> None:
    bot_status("Ready", status="waiting", plan_id="plan-1")
    update_bot_stats(submitted=1, skipped=2, failed=3, prepared=4)

    lines = capsys.readouterr().out.strip().splitlines()
    status = json.loads(lines[0].split(":", 1)[1])
    stats = json.loads(lines[1].split(":", 1)[1])
    assert status == {
        "type": "status",
        "message": "Ready",
        "status": "waiting",
        "plan_id": "plan-1",
    }
    assert stats["type"] == "status"
    assert stats["stats"] == {"submitted": 1, "skipped": 2, "failed": 3, "prepared": 4}


def test_diagnostic_protocol_preserves_run_and_decision_context(capsys) -> None:
    bot_diagnostic(
        "candidate_decision",
        "run-1",
        external_id="job-1",
        action="skip",
        reason="Already applied",
    )

    line = capsys.readouterr().out.strip()
    payload = json.loads(line.split(":", 1)[1])
    assert payload == {
        "type": "diagnostic",
        "event": "candidate_decision",
        "run_id": "run-1",
        "external_id": "job-1",
        "action": "skip",
        "reason": "Already applied",
    }
