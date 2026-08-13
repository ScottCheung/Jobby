import os
import re
import time

from selenium.common.exceptions import ElementClickInterceptedException, NoSuchElementException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


WIDGET_VERSION = "2026-06-15-inline-status-v10"
STATUS_WIDGET_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "shared_services", "assets", "javascript", "status_injector.js",
)
STATUS_WIDGET_VERSION_PLACEHOLDER = "__LINKEDIN_STATUS_WIDGET_VERSION__"
__all__ = [
    "WIDGET_VERSION",
    "bind_context",
    "sync_status_widget",
    "update_linkedin_status",
    "bot_status",
    "update_bot_stats",
    "is_linkedin_bot_paused",
    "wait_if_bot_paused",
    "wait_for_filter_action",
    "set_status_widget_compact",
    "set_status_widget_hidden",
    "filters_modal_open",
    "search_results_visible",
    "show_results_submission_finished",
    "short_filter_error",
    "click_show_results_button",
]

_driver = None
_actions = None
_last_status_sync = 0.0
_last_status_message = None
_last_widget_sync = 0.0
_bot_pause_announced = False


def bind_context(driver=None, actions=None) -> None:
    global _driver, _actions
    if driver is not None:
        _driver = driver
    if actions is not None:
        _actions = actions


def _current_driver():
    return _driver


def _clean_status_text(message) -> str | None:
    text = str(message or "").strip()
    if not text:
        return None
    text = re.sub(r"^\[Status\]\s*", "", text).strip()
    text = re.sub(r"\s+", " ", text)
    if not text or set(text) <= {"_", "-", "#", "@", ">"}:
        return None
    if len(text) > 220:
        text = text[:217].rstrip() + "..."
    return text


def _current_widget_version() -> str:
    try:
        return str(os.path.getmtime_ns(STATUS_WIDGET_FILE))
    except Exception:
        return WIDGET_VERSION


def _load_widget_source(widget_version: str) -> str | None:
    if not os.path.exists(STATUS_WIDGET_FILE):
        return None
    with open(STATUS_WIDGET_FILE, "r", encoding="utf-8") as f:
        return f.read().replace(STATUS_WIDGET_VERSION_PLACEHOLDER, widget_version)


def sync_status_widget(driver=None) -> None:
    global _last_widget_sync
    driver = driver or _current_driver()
    if driver is None:
        return
    try:
        if not str(driver.current_url or "").startswith(("http://", "https://")):
            return
    except Exception:
        return

    widget_version = _current_widget_version()
    now = time.time()
    if now - _last_widget_sync < 0.75:
        return

    try:
        is_init = driver.execute_script(
            "return window.linkedinBotStatusInitialized === true && window.linkedinBotStatusVersion === arguments[0];",
            widget_version,
        )
    except Exception:
        is_init = False

    if is_init:
        _last_widget_sync = now
        return

    js_code = _load_widget_source(widget_version)
    if not js_code:
        return

    try:
        driver.execute_script(
            "window.linkedinBotStatusInitialized = true; window.linkedinBotStatusVersion = arguments[0];\n" + js_code,
            widget_version,
        )
        try:
            has_style = driver.execute_script(
                "return !!document.getElementById('linkedin-bot-status-style');"
            )
            has_root = driver.execute_script(
                "return !!document.getElementById('linkedin-bot-status-root');"
            )
            if not has_style or not has_root:
                print(f"LinkedIn status widget injected incompletely. style={has_style}, root={has_root}")
        except Exception:
            pass
        _last_widget_sync = now
    except Exception:
        pass


def update_linkedin_status(message, force: bool = False) -> None:
    global _last_status_sync, _last_status_message
    status_text = _clean_status_text(message)
    if not status_text:
        return
    now = time.time()
    if not force and now - _last_status_sync < 0.35:
        return
    if status_text == _last_status_message and now - _last_status_sync < 0.5:
        return
    try:
        driver = _current_driver()
        if driver is None:
            return
        if not str(driver.current_url or "").startswith(("http://", "https://")):
            return
        sync_status_widget(driver)
        driver.execute_script(
            "if (window.updateLinkedInBotStatus) window.updateLinkedInBotStatus(arguments[0]);",
            status_text,
        )
        _last_status_sync = now
        _last_status_message = status_text
    except Exception:
        pass


_bot_stats = {"submitted": 0, "skipped": 0, "failed": 0}

def update_bot_stats(submitted=None, skipped=None, failed=None) -> None:
    global _bot_stats
    if submitted is not None:
        _bot_stats["submitted"] = submitted
    if skipped is not None:
        _bot_stats["skipped"] = skipped
    if failed is not None:
        _bot_stats["failed"] = failed


def bot_status(message: str, status: str = "running") -> None:
    update_linkedin_status(f"[Status] {message}", force=True)
    import json
    from datetime import datetime
    payload = {
        "type": "status",
        "status": status,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "stats": _bot_stats
    }
    print(f"__BOT_STATUS__:{json.dumps(payload)}", flush=True)


def is_linkedin_bot_paused() -> bool:
    try:
        driver = _current_driver()
        if driver is None:
            return False
        if not str(driver.current_url or "").startswith(("http://", "https://")):
            return False
        sync_status_widget(driver)
        return bool(driver.execute_script("return !!window.linkedinBotPaused;"))
    except Exception:
        return False


def wait_if_bot_paused() -> None:
    global _bot_pause_announced
    while is_linkedin_bot_paused():
        if not _bot_pause_announced:
            bot_status("Paused. Click resume when you are ready.")
            _bot_pause_announced = True
        time.sleep(0.5)
    if _bot_pause_announced:
        _bot_pause_announced = False
        bot_status("Resumed. Continuing automation.")


def wait_for_filter_action(message: str) -> str:
    try:
        driver = _current_driver()
        if driver is None:
            return "skip"
        sync_status_widget(driver)
        driver.execute_script(
            "if (window.showLinkedInBotFilterRecovery) window.showLinkedInBotFilterRecovery(arguments[0]);",
            message,
        )
        while True:
            action = driver.execute_script("return window.linkedinBotFilterAction || null;")
            if action in ("retry", "skip"):
                driver.execute_script("window.linkedinBotFilterAction = null;")
                return action
            wait_if_bot_paused()
            time.sleep(0.5)
    except Exception:
        return "skip"


def set_status_widget_compact(compact: bool) -> None:
    try:
        driver = _current_driver()
        if driver is None:
            return
        if not str(driver.current_url or "").startswith(("http://", "https://")):
            return
        sync_status_widget(driver)
        driver.execute_script(
            "if (window.setLinkedInBotStatusCompact) window.setLinkedInBotStatusCompact(arguments[0]);",
            compact,
        )
    except Exception:
        pass


def set_status_widget_hidden(hidden: bool) -> None:
    try:
        driver = _current_driver()
        if driver is None:
            return
        if not str(driver.current_url or "").startswith(("http://", "https://")):
            return
        sync_status_widget(driver)
        driver.execute_script(
            """
            const root = document.getElementById('linkedin-bot-status-root');
            if (root) root.style.display = arguments[0] ? 'none' : '';
            """,
            hidden,
        )
    except Exception:
        pass


def filters_modal_open() -> bool:
    try:
        driver = _current_driver()
        if driver is None:
            return False
        return bool(driver.execute_script(
            """
            const showButton = document.querySelector('button[data-test-reusables-filters-modal-show-results-button="true"]');
            const visibleShowButton = !!(showButton && showButton.offsetParent !== null);
            const dialog = document.querySelector('[role="dialog"]');
            const visibleDialog = !!(dialog && dialog.offsetParent !== null && /filter/i.test(dialog.innerText || ''));
            return visibleShowButton || visibleDialog;
            """
        ))
    except Exception:
        return False


def search_results_visible() -> bool:
    try:
        driver = _current_driver()
        if driver is None:
            return False
        return bool(driver.execute_script(
            """
            return !!document.querySelector(
              '.jobs-search-results-list, .jobs-search-results, .scaffold-layout__list, .jobs-search-two-pane__wrapper'
            );
            """
        ))
    except Exception:
        return False


def show_results_submission_finished() -> bool:
    for _ in range(6):
        wait_if_bot_paused()
        if not filters_modal_open():
            return True
        time.sleep(0.35)
    return False


def short_filter_error(error: Exception) -> str:
    message = str(error or "").strip()
    if not message or message.lower().startswith("stacktrace"):
        return "LinkedIn did not confirm the filter click. This is often a temporary page animation or ChromeDriver timing issue."
    first_line = message.splitlines()[0].strip()
    return first_line[:220]


def click_show_results_button() -> None:
    wait_if_bot_paused()
    set_status_widget_compact(True)
    if not filters_modal_open() and search_results_visible():
        bot_status("Search filters already appear applied. Continuing.")
        return
    locators = [
        (By.CSS_SELECTOR, 'button[data-test-reusables-filters-modal-show-results-button="true"]'),
        (By.XPATH, '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "apply current filters to show")]'),
        (By.XPATH, '//button[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "show results")]'),
    ]
    driver = _current_driver()
    last_error = None
    try:
        for attempt in range(3):
            for by, selector in locators:
                try:
                    button = WebDriverWait(driver, 4).until(EC.presence_of_element_located((by, selector)))
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", button)
                    time.sleep(0.25)
                    wait_if_bot_paused()
                    set_status_widget_hidden(True)
                    try:
                        if attempt == 0:
                            WebDriverWait(driver, 4).until(EC.element_to_be_clickable((by, selector))).click()
                        elif attempt == 1 and _actions is not None:
                            _actions.move_to_element(button).pause(0.1).click().perform()
                        else:
                            driver.execute_script("arguments[0].click();", button)
                    finally:
                        set_status_widget_hidden(False)
                    if show_results_submission_finished():
                        bot_status("Search filters submitted.")
                        return
                except Exception as e:
                    set_status_widget_hidden(False)
                    last_error = e
            if show_results_submission_finished():
                bot_status("Search filters submitted.")
                return
            time.sleep(0.6)
    finally:
        set_status_widget_hidden(False)
    if last_error:
        raise last_error
    if search_results_visible():
        bot_status("Could not confirm the filter button click, but results are visible. Continuing.")
        return
    raise NoSuchElementException("Show results button was not found.")
