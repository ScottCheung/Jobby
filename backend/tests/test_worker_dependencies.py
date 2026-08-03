from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

import dependency_check


def test_dependency_check_reports_missing_modules(monkeypatch) -> None:
    def fake_find_spec(module_name: str):
        return None if module_name == "fpdf" else object()

    monkeypatch.setattr(dependency_check.importlib.util, "find_spec", fake_find_spec)

    assert dependency_check.missing_worker_dependencies() == [
        ("fpdf", "fpdf2>=2.7.0"),
    ]


def test_dependency_install_hint_uses_current_interpreter() -> None:
    hint = dependency_check.dependency_install_hint()

    assert hint.startswith(f"{sys.executable} -m pip install -r ")
    assert hint.endswith(os.path.join("worker", "requirements.txt"))
