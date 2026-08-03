from __future__ import annotations

import os
import sys
from types import SimpleNamespace

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from shared_services.browser.playwright_runtime import (
    PlaywrightBrowserSession,
    browser_launch_args,
    resolve_profile_directory,
)


def test_browser_launch_args_are_stable_and_platform_neutral() -> None:
    args = browser_launch_args()

    assert "--disable-blink-features=AutomationControlled" in args
    assert "--no-first-run" in args
    assert "--no-default-browser-check" in args


def test_profile_resolution_uses_explicit_runtime_path(monkeypatch, tmp_path) -> None:
    profile = tmp_path / "profile"
    profile.mkdir()
    monkeypatch.setattr(
        "shared_services.browser.playwright_runtime.get_runtime_value",
        lambda key, default=None: str(profile) if key == "browser_profile_path" else default,
    )

    resolved = resolve_profile_directory()

    assert resolved == str(profile)


def test_profile_resolution_falls_back_to_system_temp(monkeypatch) -> None:
    monkeypatch.setattr(
        "shared_services.browser.playwright_runtime.get_runtime_value",
        lambda _key, default=None: default,
    )

    resolved = resolve_profile_directory()

    assert os.path.basename(resolved).startswith("jobby-playwright-")


def test_session_detaches_from_desktop_chrome_without_closing_browser_or_context(monkeypatch) -> None:
    import playwright.sync_api as sync_api

    class FakeContext:
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True

    context = FakeContext()

    class FakeBrowser:
        def __init__(self):
            self.contexts = [context]
            self.closed = False

        def close(self):
            self.closed = True

    browser = FakeBrowser()

    class FakeChromium:
        def connect_over_cdp(self, endpoint):
            assert endpoint == "http://127.0.0.1:9222"
            return browser

    class FakePlaywright:
        stopped = False
        chromium = FakeChromium()

        def stop(self):
            self.stopped = True

    playwright = FakePlaywright()

    class FakeStarter:
        def start(self):
            return playwright

    monkeypatch.setenv("AUTO_JOB_CHROME_DEBUGGER_ADDRESS", "127.0.0.1:9222")
    monkeypatch.setattr(sync_api, "sync_playwright", lambda: FakeStarter())

    session = PlaywrightBrowserSession()
    assert session.start() is context
    assert session.attached is True
    session.close()
    assert browser.closed is False
    assert context.closed is False
    assert playwright.stopped is True
