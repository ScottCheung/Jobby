from __future__ import annotations

import argparse
import glob
import os
import platform
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from shared_services.runtime import get_runtime_value
REVIEW_KEYWORDS = [
    "review your application",
    "submit your application",
    "check your details",
    "confirm your details",
    "/apply/review",
    "/application/review",
]
FINAL_SUBMIT_SELECTORS = [
    "[data-testid='review-submit-application']",
]
CONTINUE_PATTERNS = [
    "continue",
    "next",
    "proceed",
    "save and continue",
    "save & continue",
    "save and next",
]
FAST_WAIT = 0.4
PAGE_SETTLE_WAIT = 0.8


def latest_resume(directory: str, pattern: str) -> str | None:
    files = glob.glob(os.path.join(directory, pattern))
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def normalize(text: str) -> str:
    return text.lower().strip()


def clean_text(value: object | None) -> str | None:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def extract_seek_job_id(value: object | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    match = re.search(r"/job/(\d+)", text)
    if match:
        return match.group(1)
    match = re.search(r"\b(\d{6,})\b", text)
    return match.group(1) if match else ""


def canonical_seek_job_url(job_id: str) -> str:
    return f"https://au.seek.com/job/{job_id}"


def capture_job_snapshot(page, job_url: str, job_context: dict | None = None) -> dict:
    snapshot = dict(job_context or {})
    snapshot.setdefault("platform", "seek")
    snapshot.setdefault("job_link", job_url)
    snapshot.setdefault("job_id", extract_seek_job_id(snapshot.get("job_id") or job_url))
    selectors = {
        "title": ["h1[data-automation='job-detail-title']", "[data-automation='job-detail-title']", "h1"],
        "company": ["[data-automation='advertiser-name']", "[data-automation='job-detail-company']", "a[data-automation='company-link']"],
        "work_location": ["[data-automation='job-detail-location']", "[data-automation='job-location']"],
    }
    for key, css_list in selectors.items():
        if snapshot.get(key):
            continue
        for css in css_list:
            try:
                text = clean_text(page.locator(css).first.inner_text())
                if text:
                    snapshot[key] = text
                    break
            except Exception:
                continue
    if not snapshot.get("job_description"):
        for selector in ["[data-automation='jobAdDetails']", "[data-automation='jobDescription']", "main"]:
            try:
                text = clean_text(page.locator(selector).first.inner_text())
                if text and len(text) > 80:
                    snapshot["job_description"] = text
                    break
            except Exception:
                continue
    try:
        current_id = extract_seek_job_id(page.url)
        if current_id:
            snapshot["job_id"] = current_id
            snapshot["job_link"] = canonical_seek_job_url(current_id)
    except Exception:
        pass
    return snapshot


def record_application(snapshot: dict, result: dict) -> None:
    try:
        status = str(result.get("status") or "stopped")
        _message = str(result.get("message") or status)
        _record_status = "submitted" if status == "review" else "skipped"
        _application_type = "SEEK Quick Apply review reached" if status == "review" else "SEEK Quick Apply stopped"
        if status == "needs_login":
            _application_type = "SEEK Quick Apply blocked by login"
        _ = snapshot
    except Exception as exc:
        print(f"[seek record] failed: {exc}")


def merge_config(overrides: dict | None = None) -> dict:
    merged = {}
    if overrides:
        for key, value in overrides.items():
            if value not in (None, ""):
                merged[key] = value
    return merged


def page_text_contains(page, phrases) -> bool:
    try:
        snippet = normalize(page.locator("h1, h2, h3, button, [role='button']").all_text_contents()[0] or "")
        for phrase in phrases:
            if phrase in snippet:
                return True
    except Exception:
        pass
    try:
        body = normalize(page.inner_text("body") or "")
        return any(phrase in body for phrase in phrases)
    except Exception:
        return False


def is_review_page(page) -> bool:
    for selector in FINAL_SUBMIT_SELECTORS:
        try:
            if page.locator(selector).count() > 0 and page.locator(selector).first.is_visible():
                return True
        except Exception:
            continue
    url_lower = page.url.lower()
    title = ""
    try:
        title = normalize(page.title() or "")
    except Exception:
        pass
    for kw in REVIEW_KEYWORDS:
        if kw in url_lower or kw in title:
            return True
    return page_text_contains(page, REVIEW_KEYWORDS)


def _install_playwright():
    import importlib

    try:
        return importlib.import_module("playwright.sync_api")
    except ModuleNotFoundError:
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
        return importlib.import_module("playwright.sync_api")


def _browser_launch_args() -> list[str]:
    args = [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter",
        "--no-default-browser-check",
        "--no-first-run",
        "--start-maximized",
    ]
    if platform.system() == "Linux":
        args.extend(["--no-sandbox"])
    return args


def _default_user_data_dir() -> str:
    home = Path.home()
    if sys.platform.startswith("darwin"):
        return str(home / ".auto-job-apply-profile-seek")
    if sys.platform.startswith("linux"):
        return str(home / ".auto-job-apply-profile-seek")
    return r"C:\temp\auto-job-apply-profile-seek"


def _set_input_value(locator, value: str) -> bool:
    try:
        locator.click(timeout=1500)
        locator.fill("")
        locator.type(value, delay=20)
        return True
    except Exception:
        return False


def _pick_option_group(container, value: str) -> bool:
    value_norm = normalize(value)
    try:
        labels = container.locator("label").all()
        for label in labels:
            text = clean_text(label.inner_text()) or ""
            if value_norm in normalize(text) or normalize(text) in value_norm:
                label.click(timeout=1000)
                return True
    except Exception:
        pass
    return False


def _fill_text_inputs(page, config: dict) -> None:
    mappings = {
        "first": config.get("first_name"),
        "last": config.get("last_name"),
        "email": config.get("email"),
        "phone": config.get("phone"),
        "mobile": config.get("phone"),
        "address": config.get("address"),
        "linkedin": config.get("linkedin"),
        "website": config.get("website"),
        "salary": config.get("salary"),
        "notice": config.get("notice"),
    }
    inputs = page.locator("input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea")
    count = inputs.count()
    for i in range(count):
        try:
            field = inputs.nth(i)
            if not field.is_visible():
                continue
            name = normalize(field.get_attribute("name") or "")
            aria = normalize(field.get_attribute("aria-label") or "")
            placeholder = normalize(field.get_attribute("placeholder") or "")
            joined = " ".join([name, aria, placeholder])
            value = None
            for key, candidate in mappings.items():
                if key in joined and candidate:
                    value = str(candidate)
                    break
            if value:
                _set_input_value(field, value)
        except Exception:
            continue


def _fill_selects(page, config: dict) -> None:
    selects = page.locator("select")
    count = selects.count()
    for i in range(count):
        try:
            select = selects.nth(i)
            if not select.is_visible():
                continue
            descriptor = normalize(" ".join([select.get_attribute("name") or "", select.get_attribute("aria-label") or ""]))
            if "work" in descriptor or "citizen" in descriptor or "visa" in descriptor:
                try:
                    select.select_option(label=str(config.get("right_to_work") or "Yes"))
                except Exception:
                    pass
        except Exception:
            continue


def _fill_radios_and_checkboxes(page, config: dict) -> None:
    groups = page.locator("fieldset, [role='radiogroup']")
    count = groups.count()
    for i in range(count):
        try:
            group = groups.nth(i)
            text = normalize(group.inner_text() or "")
            if any(token in text for token in ["work rights", "right to work", "citizen", "visa"]):
                _pick_option_group(group, str(config.get("right_to_work") or "Yes"))
        except Exception:
            continue
    checkboxes = page.locator("input[type='checkbox']")
    for i in range(checkboxes.count()):
        try:
            checkbox = checkboxes.nth(i)
            if checkbox.is_visible() and checkbox.is_checked():
                checkbox.uncheck(timeout=500)
        except Exception:
            continue


def _upload_resume(page, config: dict) -> None:
    resume_dir = str(config.get("resume_dir") or "")
    resume_glob = str(config.get("resume_glob") or "*")
    resume_path = latest_resume(resume_dir, resume_glob)
    if not resume_path:
        return
    file_input = page.locator("input[type='file']")
    if file_input.count() > 0:
        try:
            file_input.first.set_input_files(resume_path)
        except Exception:
            pass


def _fill_cover_letter(page, config: dict) -> None:
    cover_letter = str(config.get("cover_letter") or "").strip()
    if not cover_letter:
        return
    textareas = page.locator("textarea")
    for i in range(textareas.count()):
        try:
            area = textareas.nth(i)
            descriptor = normalize(
                " ".join(
                    [
                        area.get_attribute("name") or "",
                        area.get_attribute("aria-label") or "",
                        area.get_attribute("placeholder") or "",
                    ]
                )
            )
            if "cover" in descriptor:
                area.fill(cover_letter)
        except Exception:
            continue


def _click_continue(page) -> bool:
    button_selector = "button, a[role='button']"
    buttons = page.locator(button_selector)
    for i in range(buttons.count()):
        try:
            button = buttons.nth(i)
            if not button.is_visible():
                continue
            text = normalize(button.inner_text() or "")
            if any(pattern == text or pattern in text for pattern in CONTINUE_PATTERNS):
                button.click(timeout=1200)
                return True
        except Exception:
            continue
    return False


def apply_to_job(job_url: str, config: dict | None = None, job_context: dict | None = None) -> dict:
    return run(job_url, config_overrides=config, job_context=job_context)


def run(job_url: str, config_overrides: dict | None = None, job_context: dict | None = None) -> dict:
    sync_api = _install_playwright()
    playwright = sync_api.sync_playwright().start()
    browser = None
    context = None
    snapshot = dict(job_context or {})
    try:
        user_data_dir = _default_user_data_dir()
        os.makedirs(user_data_dir, exist_ok=True)
        browser = playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            args=_browser_launch_args(),
            viewport={"width": 1440, "height": 1200},
        )
        context = browser
        page = context.pages[0] if context.pages else context.new_page()
        config = merge_config(config_overrides)
        page.goto(job_url, wait_until="domcontentloaded")
        page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))
        snapshot = capture_job_snapshot(page, job_url, snapshot)
        if page_text_contains(page, ["sign in", "log in", "login"]):
            result = {"status": "needs_login", "message": "Seek sign-in is required before Quick Apply can continue.", "final_url": page.url}
            record_application(snapshot, result)
            return result
        apply_triggers = [
            "a[data-automation='job-detail-apply']",
            "button[data-automation='job-detail-apply']",
            "a:has-text('Apply')",
            "button:has-text('Apply')",
            "a:has-text('Quick apply')",
            "button:has-text('Quick apply')",
        ]
        opened = False
        for selector in apply_triggers:
            try:
                target = page.locator(selector).first
                if target.count() > 0 and target.is_visible():
                    target.click(timeout=1500)
                    opened = True
                    break
            except Exception:
                continue
        if not opened:
            result = {"status": "stopped", "message": "Could not find SEEK apply button.", "final_url": page.url}
            record_application(snapshot, result)
            return result
        page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))
        for _step in range(12):
            _fill_text_inputs(page, config)
            _fill_selects(page, config)
            _fill_radios_and_checkboxes(page, config)
            _upload_resume(page, config)
            _fill_cover_letter(page, config)
            if is_review_page(page):
                result = {"status": "review", "message": "Reached SEEK review page and stopped before submit.", "final_url": page.url}
                record_application(snapshot, result)
                return result
            if not _click_continue(page):
                break
            page.wait_for_timeout(int(FAST_WAIT * 1000))
            page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))
        result = {"status": "stopped", "message": "Stopped before review because the next application step could not be completed.", "final_url": page.url}
        record_application(snapshot, result)
        return result
    finally:
        try:
            if context:
                context.close()
        except Exception:
            pass
        try:
            if browser and browser is not context:
                browser.close()
        except Exception:
            pass
        try:
            playwright.stop()
        except Exception:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SEEK Quick Apply against a single job URL.")
    parser.add_argument("--url", required=True, help="Full SEEK job URL")
    args = parser.parse_args()
    result = run(args.url)
    print(result)


if __name__ == "__main__":
    main()
