import atexit
import signal
import sys
import time
from datetime import datetime
from pathlib import Path

from selenium.common.exceptions import NoSuchWindowException, WebDriverException

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "worker"))

from modules.helpers import critical_error_log
from modules.generic_assist import (
    click_primary_next,
    detect_submit_controls,
    fill_generic_form,
    looks_like_final_confirm_page,
)
from modules.linkedin.linkedin_status import bot_status, update_bot_stats
from modules.persistence import QuestionCache
from modules.persistence.worker_config import apply_api_worker_config
import modules.open_chrome as open_chrome


driver = None
actions = None
wait = None
options = None
question_cache = None


def _shutdown_browser(*_args) -> None:
    global driver
    if driver:
        try:
            driver.quit()
        except Exception:
            pass


def _handle_termination(signum, frame) -> None:
    _shutdown_browser()
    raise KeyboardInterrupt


atexit.register(_shutdown_browser)
for _sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(_sig, _handle_termination)
    except Exception:
        pass


def _emit_progress(message: str, submitted: int = 0, skipped: int = 0, failed: int = 0) -> None:
    update_bot_stats(submitted=submitted, skipped=skipped, failed=failed)
    bot_status(message, status="running")


def assist_current_page() -> None:
    global question_cache
    current_url = driver.current_url if driver else ""
    _emit_progress("Connected to the current browser session.")

    if not current_url or current_url.startswith("data:"):
        _emit_progress("Open the target application page in Chrome, then start assist mode again.")
        return

    _emit_progress("Inspecting the current application page.")
    time.sleep(1)

    max_steps = 5
    total_filled = 0

    for step in range(1, max_steps + 1):
        if looks_like_final_confirm_page(driver):
            submit_controls = detect_submit_controls(driver)
            submit_hint = (
                f" Final controls: {', '.join(submit_controls[:3])}."
                if submit_controls
                else ""
            )
            _emit_progress(
                "Reached the final confirmation step. Please review and submit manually."
                + submit_hint,
                submitted=total_filled,
            )
            return

        filled = fill_generic_form(driver, question_cache=question_cache)
        total_filled += len(filled)

        if filled:
            _emit_progress(
                f"Filled {len(filled)} fields on step {step}.",
                submitted=total_filled,
            )
        else:
            _emit_progress(f"No known fields found on step {step}.")

        if looks_like_final_confirm_page(driver):
            submit_controls = detect_submit_controls(driver)
            submit_hint = (
                f" Final controls: {', '.join(submit_controls[:3])}."
                if submit_controls
                else ""
            )
            _emit_progress(
                "Reached the final confirmation step. Please review and submit manually."
                + submit_hint,
                submitted=total_filled,
            )
            return

        moved = click_primary_next(driver)
        if not moved:
            submit_controls = detect_submit_controls(driver)
            if submit_controls:
                _emit_progress(
                    "Detected submit controls and stopped before submitting. Please review manually.",
                    submitted=total_filled,
                )
            else:
                _emit_progress(
                    "No safe next button found. Please review this step manually.",
                    submitted=total_filled,
                )
            return

        _emit_progress(f"Moved to the next step from step {step}.", submitted=total_filled)
        time.sleep(2)

    _emit_progress("Stopped before final submission. Please confirm the last step manually.", submitted=total_filled)


def main() -> None:
    global driver, actions, wait, options, question_cache
    interrupted = False
    completed = False

    bot_status("Starting third-party assist mode...", status="starting")

    try:
        apply_api_worker_config(globals())
        question_cache = QuestionCache()
        options, driver, actions, wait = open_chrome.initialize_chrome_session()
        assist_current_page()
        completed = True
    except KeyboardInterrupt:
        interrupted = True
        bot_status("Third-party assist stopped by user.", status="cancelled")
    except (NoSuchWindowException, WebDriverException):
        bot_status("Browser closed or unavailable.", status="failed")
    except Exception as exc:
        critical_error_log("In Generic Assist Main", exc)
        bot_status(f"Fatal error: {str(exc)}", status="failed")
    finally:
        if completed and not interrupted:
            bot_status(
                f"Assist session ready for final user confirmation at {datetime.now().isoformat()}",
                status="success",
            )
        _shutdown_browser()


if __name__ == "__main__":
    main()
