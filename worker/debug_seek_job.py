import argparse
import json
import os
import ssl
import sys
import time
from pathlib import Path

import certifi
from selenium.webdriver.common.by import By


cafile = certifi.where()
os.environ.setdefault("SSL_CERT_FILE", cafile)
os.environ.setdefault("REQUESTS_CA_BUNDLE", cafile)
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=cafile)

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "worker"))

import modules.open_chrome as open_chrome
import runSeekBot as seek_bot
from modules.generic_assist import (
    collect_current_form_answers,
    detect_submit_controls,
    fill_generic_form,
    looks_like_final_confirm_page,
)
from modules.persistence.question_cache import QuestionCache
from modules.persistence.worker_config import apply_api_worker_config
from selenium.webdriver.support.ui import Select


def _safe_text(node) -> str | None:
    try:
        text = str(node.text or "").strip()
        return text or None
    except Exception:
        return None


def _snapshot_buttons(driver) -> list[dict]:
    rows = []
    for node in driver.find_elements(
        By.CSS_SELECTOR,
        "button, input[type='button'], input[type='submit'], a",
    ):
        try:
            text = (
                str(
                    node.text
                    or node.get_attribute("aria-label")
                    or node.get_attribute("title")
                    or node.get_attribute("value")
                    or ""
                ).strip()
            )
            if not text:
                continue
            rows.append(
                {
                    "text": text,
                    "tag": node.tag_name,
                    "href": node.get_attribute("href"),
                    "enabled": bool(node.is_enabled()),
                    "displayed": bool(node.is_displayed()),
                }
            )
        except Exception:
            continue
    return rows[:30]


def _snapshot_form_fields(driver) -> list[dict]:
    fields = []
    for node in driver.find_elements(By.CSS_SELECTOR, "input, textarea, select"):
        try:
            if not node.is_displayed():
                continue
            field_type = seek_bot._clean_text(node.get_attribute("type")) or node.tag_name
            label = None
            try:
                label = seek_bot._clean_text(
                    node.get_attribute("aria-label")
                    or node.get_attribute("placeholder")
                    or node.get_attribute("name")
                )
            except Exception:
                label = None

            row = {
                "tag": node.tag_name,
                "field_type": field_type,
                "label": label,
                "value": node.get_attribute("value"),
                "data_testid": node.get_attribute("data-testid"),
            }
            if node.tag_name == "select":
                select = Select(node)
                row["options"] = [
                    str(option.text or "").strip()
                    for option in select.options
                    if str(option.text or "").strip()
                ]
            fields.append(row)
        except Exception:
            continue
    return fields


def _run_debug_quick_apply(driver, question_cache: QuestionCache, max_steps: int) -> dict:
    result = {
        "quick_apply_clicked": False,
        "quick_apply_button_label": None,
        "steps": [],
        "final_state": "not_started",
        "final_message": "",
        "submit_controls": [],
    }

    button, label = seek_bot._find_quick_apply_control()
    result["quick_apply_button_label"] = label
    if not button:
        result["final_state"] = "no_quick_apply_button"
        result["final_message"] = "Quick Apply button not found on this page"
        return result

    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
        # time.sleep(1)
        button.click()
        # time.sleep(3)
        result["quick_apply_clicked"] = True
    except Exception as exc:
        result["final_state"] = "click_failed"
        result["final_message"] = f"Failed to click Quick Apply: {exc}"
        return result

    for step_index in range(1, max_steps + 1):
        before_answers = collect_current_form_answers(driver)
        material_actions, material_blockers = seek_bot._prepare_seek_resume_and_cover_letter()
        filled = fill_generic_form(driver, question_cache=question_cache)
        after_answers = collect_current_form_answers(driver)
        submit_controls = detect_submit_controls(driver)
        is_final = looks_like_final_confirm_page(driver)

        step_row = {
            "step": step_index,
            "url": driver.current_url,
            "form_fields": _snapshot_form_fields(driver),
            "material_actions": material_actions,
            "material_blockers": material_blockers,
            "validation_messages": seek_bot._collect_seek_validation_messages(),
            "filled": filled,
            "answers_before": before_answers,
            "answers_after": after_answers,
            "submit_controls": submit_controls,
            "looks_like_final_confirm_page": is_final,
        }
        result["steps"].append(step_row)

        if is_final or submit_controls:
            result["final_state"] = "awaiting_manual_submit"
            result["final_message"] = "Reached submit/review stage without submitting"
            result["submit_controls"] = submit_controls
            return result

        moved = seek_bot._click_seek_continue()
        step_row["clicked_next"] = bool(moved)
        if not moved:
            result["final_state"] = "stopped_no_next"
            result["final_message"] = "No safe next button found after filling current step"
            return result

        time.sleep(2)

    result["final_state"] = "max_steps_reached"
    result["final_message"] = f"Stopped after {max_steps} steps"
    return result


def run_debug_job(url: str, max_steps: int) -> dict:
    apply_api_worker_config(globals())

    options, driver, actions, wait = open_chrome.initialize_chrome_session()
    seek_bot.driver = driver
    seek_bot.actions = actions
    seek_bot.wait = wait
    seek_bot.options = options
    seek_bot.question_cache = QuestionCache()

    driver.get(url)
    time.sleep(3)

    page_details = seek_bot.extract_seek_job_details_from_page(url)
    quick_apply_detected = seek_bot._detect_quick_apply()

    result = {
        "input_url": url,
        "current_url": driver.current_url,
        "page_title": driver.title,
        "job": page_details,
        "quick_apply_detected": quick_apply_detected,
        "quick_apply_debug": None,
        "visible_buttons": _snapshot_buttons(driver),
    }

    if quick_apply_detected:
        result["quick_apply_debug"] = _run_debug_quick_apply(
            driver,
            seek_bot.question_cache,
            max_steps=max_steps,
        )

    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Debug a single Seek job page without saving applications",
    )
    parser.add_argument("--url", required=True, help="Full Seek job URL")
    parser.add_argument(
        "--max-steps",
        type=int,
        default=6,
        help="Maximum Quick Apply steps to attempt before stopping",
    )
    parser.add_argument(
        "--keep-open",
        action="store_true",
        help="Keep the browser open after printing results",
    )
    args = parser.parse_args()

    driver = None
    try:
        result = run_debug_job(args.url, args.max_steps)
        driver = seek_bot.driver
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        if args.keep_open and driver:
            print("\nBrowser kept open for manual inspection. Press Ctrl+C to exit.")
            while True:
                time.sleep(1)
    finally:
        if not args.keep_open and seek_bot.driver:
            try:
                seek_bot.driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    main()
