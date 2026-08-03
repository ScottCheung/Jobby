from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from shared_services.persistence.worker_config import submission_safety_from_application_settings


def test_submit_confirmation_defaults_to_true_during_migration() -> None:
    safety = submission_safety_from_application_settings({})

    assert safety == {
        "require_submit_confirmation": True,
        "allow_final_submission": True,
        "execution_mode": "human_confirmed",
        "review_channel": "browser",
    }


def test_background_execution_cannot_disable_the_human_gate() -> None:
    safety = submission_safety_from_application_settings(
        {
            "automation": {
                "execution_mode": "human_confirmed",
                "require_submit_confirmation": True,
            }
        }
    )

    assert safety["require_submit_confirmation"] is True
    assert safety["allow_final_submission"] is True
    assert safety["review_channel"] == "browser"


def test_explicit_false_confirmation_cannot_disable_human_gate() -> None:
    safety = submission_safety_from_application_settings(
        {"automation": {"execution_mode": "submit", "require_submit_confirmation": False}}
    )

    assert safety["require_submit_confirmation"] is True
    assert safety["allow_final_submission"] is True


def test_prepare_only_never_allows_final_submission() -> None:
    safety = submission_safety_from_application_settings(
        {"automation": {"execution_mode": "prepare_only", "require_submit_confirmation": True}}
    )

    assert safety["require_submit_confirmation"] is True
    assert safety["allow_final_submission"] is False
    assert safety["review_channel"] == "browser"


def test_console_review_channel_is_exposed_without_weakening_gate() -> None:
    safety = submission_safety_from_application_settings(
        {"automation": {"review_channel": "console"}}
    )

    assert safety["review_channel"] == "console"
    assert safety["require_submit_confirmation"] is True
