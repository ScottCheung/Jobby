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

# Setup path before importing shared_services
WORKER_ROOT = Path(__file__).resolve().parents[2]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from shared_services.runtime import get_runtime_value
from shared_services.browser.chrome import prepare_runtime_profile_copy
from shared_services.persistence.question_cache import QuestionCache
from shared_services.persistence.answer_resolver import resolve_answer

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
    "review",
    "review application",
    "review your application",
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


def _system_chrome_path() -> str | None:
    candidates: list[str] = []
    if sys.platform.startswith("darwin"):
        candidates.append("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    elif sys.platform.startswith("linux"):
        candidates.extend(["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"])
    elif sys.platform.startswith("win"):
        candidates.extend([
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ])
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None


def _default_user_data_dir() -> str:
    custom_path = str(get_runtime_value("browser_profile_path", "") or "").strip()
    if custom_path:
        return prepare_runtime_profile_copy(os.path.abspath(os.path.expanduser(custom_path)))
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


def _get_label_for_element(page, field) -> str:
    label = ""
    try:
        # 1. aria-label
        label = field.get_attribute("aria-label") or ""
        if label and label.strip():
            return label.strip()
            
        # 2. label[for="id"]
        id_attr = field.get_attribute("id")
        if id_attr:
            labels = page.locator(f"label[for='{id_attr}']")
            if labels.count() > 0:
                label_text = labels.first.inner_text() or ""
                if label_text.strip():
                    return label_text.strip()
                    
        # 3. Traverse up to find a <label>
        parent_label = field.locator("xpath=ancestor::label").first
        if parent_label.count() > 0:
            label_text = parent_label.inner_text() or ""
            if label_text.strip():
                return label_text.strip()
                
        # 4. Traverse up to find <fieldset><legend>
        fieldset = field.locator("xpath=ancestor::fieldset").first
        if fieldset.count() > 0:
            legend = fieldset.locator("legend").first
            if legend.count() > 0:
                legend_text = legend.inner_text() or ""
                if legend_text.strip():
                    return legend_text.strip()
    except Exception:
        pass
    return ""


def _fill_text_inputs(page, config: dict, question_cache: QuestionCache, work_location: str) -> None:
    inputs = page.locator("input[type='text'], input[type='email'], input[type='tel'], input[type='number'], input:not([type]), textarea")
    count = inputs.count()
    for i in range(count):
        try:
            field = inputs.nth(i)
            if not field.is_visible() or not field.is_enabled():
                continue
            
            # Skip file inputs or hidden inputs
            tag = field.evaluate("el => el.tagName.toLowerCase()")
            if tag == "input" and field.get_attribute("type") in ["file", "hidden", "radio", "checkbox", "submit", "button"]:
                continue
                
            label_org = _get_label_for_element(page, field)
            name_attr = field.get_attribute("name") or ""
            placeholder = field.get_attribute("placeholder") or ""
            
            if not label_org:
                label_org = placeholder or name_attr
            if not label_org:
                label_org = "Unknown text field"
                
            prev_answer = ""
            try:
                prev_answer = field.input_value()
            except Exception:
                pass
                
            field_type = "textarea" if tag == "textarea" else "text"
            
            # Use resolve_answer
            resolved, source = resolve_answer(
                label_org=label_org,
                field_type=field_type,
                options=None,
                work_location=work_location,
                question_cache=question_cache,
                job_description=None,
                prev_answer=prev_answer,
            )
            
            if resolved is not None:
                if str(resolved) != str(prev_answer):
                    _set_input_value(field, str(resolved))
                if source not in ("existing", "skipped", "unanswered"):
                    question_cache.save_answer(label_org, field_type, str(resolved), source, company="SEEK")
                    
        except Exception as e:
            print(f"[seek] Failed to process text input: {e}")


def _fill_selects(page, config: dict, question_cache: QuestionCache, work_location: str) -> None:
    selects = page.locator("select")
    count = selects.count()
    for i in range(count):
        try:
            select = selects.nth(i)
            if not select.is_visible() or not select.is_enabled():
                continue
                
            label_org = _get_label_for_element(page, select)
            name_attr = select.get_attribute("name") or ""
            if not label_org:
                label_org = name_attr or "Unknown select field"
                
            # Get options
            options_loc = select.locator("option")
            options_plain = []
            for j in range(options_loc.count()):
                opt = options_loc.nth(j)
                txt = (opt.inner_text() or "").strip()
                if txt:
                    options_plain.append(txt)
                    
            prev_answer = ""
            try:
                val = select.input_value()
                if val:
                    # find the text for this value
                    selected_opt = select.locator(f"option[value='{val}']").first
                    if selected_opt.count() > 0:
                        prev_answer = (selected_opt.inner_text() or "").strip()
            except Exception:
                pass
                
            resolved, source = resolve_answer(
                label_org=label_org,
                field_type="select",
                options=options_plain,
                work_location=work_location,
                question_cache=question_cache,
                job_description=None,
                prev_answer=prev_answer,
            )
            
            if resolved is not None:
                # Find the value for this resolved option
                for j in range(options_loc.count()):
                    opt = options_loc.nth(j)
                    txt = (opt.inner_text() or "").strip()
                    if txt.lower() == str(resolved).lower():
                        val = opt.get_attribute("value")
                        select.select_option(value=val)
                        if source not in ("existing", "skipped", "unanswered"):
                            question_cache.save_answer(label_org, "select", str(resolved), source, options=options_plain, company="SEEK")
                        break
        except Exception as e:
            print(f"[seek] Failed to process select input: {e}")


def _fill_radios_and_checkboxes(page, config: dict, question_cache: QuestionCache, work_location: str) -> None:
    # Handle Radio Groups
    groups = page.locator("fieldset, [role='radiogroup']")
    count = groups.count()
    for i in range(count):
        try:
            group = groups.nth(i)
            if not group.is_visible():
                continue
                
            # The question label is typically the legend or aria-label of the group
            label_org = ""
            legend = group.locator("legend").first
            if legend.count() > 0:
                label_org = (legend.inner_text() or "").strip()
            if not label_org:
                label_org = group.get_attribute("aria-label") or ""
            if not label_org:
                continue
                
            # Find all radio inputs in this group
            radios = group.locator("input[type='radio']")
            if radios.count() == 0:
                continue
                
            options_plain = []
            radio_elements = []
            prev_answer = None
            
            for j in range(radios.count()):
                radio = radios.nth(j)
                # Find the label text for this radio
                radio_label = ""
                id_attr = radio.get_attribute("id")
                if id_attr:
                    labels = page.locator(f"label[for='{id_attr}']")
                    if labels.count() > 0:
                        radio_label = (labels.first.inner_text() or "").strip()
                if not radio_label:
                    parent_label = radio.locator("xpath=ancestor::label").first
                    if parent_label.count() > 0:
                        radio_label = (parent_label.inner_text() or "").strip()
                if not radio_label:
                    radio_label = radio.get_attribute("value") or ""
                    
                options_plain.append(radio_label)
                radio_elements.append((radio, radio_label))
                
                try:
                    if radio.is_checked():
                        prev_answer = radio_label
                except Exception:
                    pass
            
            resolved, source = resolve_answer(
                label_org=label_org,
                field_type="radio",
                options=options_plain,
                work_location=work_location,
                question_cache=question_cache,
                job_description=None,
                prev_answer=prev_answer,
            )
            
            if resolved is not None:
                for radio, r_label in radio_elements:
                    if r_label.lower() == str(resolved).lower():
                        if not radio.is_checked():
                            radio.click(force=True)
                        if source not in ("existing", "skipped", "unanswered"):
                            question_cache.save_answer(label_org, "radio", str(resolved), source, options=options_plain, company="SEEK")
                        break
                        
        except Exception as e:
            print(f"[seek] Failed to process radio group: {e}")

    # Handle independent Checkboxes
    checkboxes = page.locator("input[type='checkbox']")
    for i in range(checkboxes.count()):
        try:
            checkbox = checkboxes.nth(i)
            if not checkbox.is_visible() or not checkbox.is_enabled():
                continue
                
            label_org = _get_label_for_element(page, checkbox)
            if not label_org:
                label_org = checkbox.get_attribute("name") or "Unknown checkbox"
                
            prev_answer = checkbox.is_checked()
            
            resolved, source = resolve_answer(
                label_org=label_org,
                field_type="checkbox",
                options=None,
                work_location=work_location,
                question_cache=question_cache,
                job_description=None,
                prev_answer=str(prev_answer),
            )
            
            should_check = resolved is None or str(resolved).lower() in ("yes", "true", "1", "check", "checked")
            if resolved is not None and str(resolved).lower() in ("no", "false", "0", "uncheck"):
                should_check = False
                
            if should_check and not checkbox.is_checked():
                checkbox.check(force=True)
                if source not in ("existing", "skipped", "unanswered"):
                    question_cache.save_answer(label_org, "checkbox", str(True), source, company="SEEK")
            elif not should_check and checkbox.is_checked():
                checkbox.uncheck(force=True)
                if source not in ("existing", "skipped", "unanswered"):
                    question_cache.save_answer(label_org, "checkbox", str(False), source, company="SEEK")
        except Exception as e:
            print(f"[seek] Failed to process checkbox: {e}")


def _use_existing_resume(page) -> bool:
    try:
        # Look for radio-style resume selector
        selectors = [
            "[data-testid='resume-selector'] input[type='radio']",
            "[data-testid*='resume'] input[type='radio']",
            "input[type='radio'][name*='resume']",
            "input[type='radio'][id*='resume']",
        ]
        for sel in selectors:
            loc = page.locator(sel)
            if loc.count() > 0:
                loc.first.click()
                print("[seek] Selected existing resume (first in list)")
                page.wait_for_timeout(500)
                return True
  
        # Styled card-style selectors
        cards = page.locator("[data-testid*='resume-option'], [class*='ResumeCard'], [class*='resume-card']")
        if cards.count() > 0:
            cards.first.click()
            print("[seek] Clicked existing resume card")
            page.wait_for_timeout(500)
            return True
    except Exception as e:
        print(f"[seek] Existing resume selection failed: {e}")
    return False


def _attach_resume(page, config: dict) -> bool:
    resume_dir = str(config.get("resume_dir") or "")
    resume_glob = str(config.get("resume_glob") or "*")
    resume_path = latest_resume(resume_dir, resume_glob)
    if not resume_path:
        return False
        
    try:
        file_inputs = page.locator("input[type='file']:visible, input[type='file']")
        if file_inputs.count() > 0:
            file_inputs.first.set_input_files(resume_path)
            print(f"[seek] Resume attached: {os.path.basename(resume_path)}")
            page.wait_for_timeout(1000)
            return True
    except Exception as e:
        print(f"[seek] set_input_files failed: {e}")
  
    # SEEK 'Quick Apply' may trigger a file chooser via a styled button
    try:
        upload_btns = page.locator("button:has-text('Upload'), button:has-text('resume'), button:has-text('CV'), [data-testid*='upload']:visible")
        for i in range(upload_btns.count()):
            btn = upload_btns.nth(i)
            try:
                if btn.is_visible():
                    with page.expect_file_chooser() as fc_info:
                        btn.click()
                    fc = fc_info.value
                    fc.set_files(resume_path)
                    print(f"[seek] Resume attached via chooser: {os.path.basename(resume_path)}")
                    page.wait_for_timeout(1000)
                    return True
            except Exception as e:
                print(f"[seek] Chooser failed: {e}")
    except Exception:
        pass
  
    return False


def _upload_resume(page, config: dict) -> None:
    if not _use_existing_resume(page):
        _attach_resume(page, config)


def _is_seek_first_page(page) -> bool:
    """Detect the first SEEK quick-apply page by its known controls."""
    try:
        for selector in [
            "[data-testid='resume-method-change']",
            "[data-testid='select-input']",
            "[data-testid='coverLetter-method-change']",
            "[data-testid='coverLetterTextInput']",
        ]:
            if page.locator(selector).count() > 0:
                return True
    except Exception:
        pass
    return False


def _choose_nth_real_option_after_opening(page, target_index: int = 1) -> bool:
    # Give the dropdown time to render its options
    page.wait_for_timeout(500)
    SKIP_TEXTS = {"", "select", "please select", "choose", "–", "-"}

    # Strategy 1: look inside a popup/listbox container
    popup_selectors = [
        "[role='listbox']:visible",
        "[role='combobox'] + *:visible",
        "[data-testid*='dropdown']:visible",
        "[data-testid*='option-list']:visible",
        "[class*='dropdown']:visible",
        "[class*='Dropdown']:visible",
        "[class*='menu']:visible",
        "[class*='Menu']:visible",
    ]
    for popup_sel in popup_selectors:
        try:
            popups = page.locator(popup_sel)
            if popups.count() == 0:
                continue
            popup = popups.first
            for item_sel in ["[role='option']", "li", "button", "[data-testid*='option']"]:
                try:
                    items = popup.locator(item_sel)
                    seen = 0
                    for idx in range(items.count()):
                        opt = items.nth(idx)
                        try:
                            if not opt.is_visible() or not opt.is_enabled():
                                continue
                            txt = normalize(opt.inner_text() or opt.get_attribute("aria-label") or "")
                            if txt in SKIP_TEXTS:
                                continue
                            seen += 1
                            if seen == target_index:
                                opt.click()
                                page.wait_for_timeout(300)
                                return True
                        except Exception:
                            continue
                except Exception:
                    continue
        except Exception:
            continue

    # Strategy 2: fall back to role='option' only (scoped to whole page)
    for selector in ["[role='option']:visible", "[data-testid*='option']:visible"]:
        try:
            options = page.locator(selector)
            seen = 0
            for idx in range(options.count()):
                opt = options.nth(idx)
                try:
                    if not opt.is_visible() or not opt.is_enabled():
                        continue
                    txt = normalize(opt.inner_text() or opt.get_attribute("aria-label") or "")
                    if txt in SKIP_TEXTS:
                        continue
                    seen += 1
                    if seen == target_index:
                        opt.click()
                        page.wait_for_timeout(300)
                        return True
                except Exception:
                    continue
        except Exception:
            continue
    return False


def _select_dropdown_option(page, trigger_selector: str, target_index: int = 1) -> bool:
    try:
        loc = page.locator(trigger_selector)
        if loc.count() == 0:
            return False
        loc = loc.first
        if not loc.is_visible() or not loc.is_enabled():
            return False

        tag_name = loc.evaluate("el => el.tagName.toLowerCase()")
        if tag_name == "select":
            # Native select
            options = loc.locator("option")
            seen = 0
            SKIP_TEXTS = {"", "select", "please select", "choose", "–", "-"}
            for i in range(options.count()):
                opt = options.nth(i)
                val = opt.get_attribute("value") or ""
                txt = normalize(opt.inner_text() or "")
                if not val.strip() or txt in SKIP_TEXTS:
                    continue
                seen += 1
                if seen == target_index:
                    loc.select_option(value=val)
                    page.wait_for_timeout(400)
                    return True
            return False

        # If it's a custom dropdown trigger, click it to open
        loc.click()
        page.wait_for_timeout(400)
        return _choose_nth_real_option_after_opening(page, target_index)
    except Exception as e:
        print(f"[seek] Dropdown selection failed for {trigger_selector}: {e}")
        return False


def _click_first_visible(page, selector: str) -> bool:
    try:
        loc = page.locator(selector)
        for idx in range(loc.count()):
            item = loc.nth(idx)
            try:
                if item.is_visible() and item.is_enabled():
                    item.click()
                    page.wait_for_timeout(300)
                    return True
            except Exception:
                continue
    except Exception:
        pass
    return False


def _select_dropdown_option_by_keyword(page, trigger_selector: str, keywords: list[str]) -> bool:
    try:
        loc = page.locator(trigger_selector)
        if loc.count() == 0:
            return False
        loc = loc.first
        if not loc.is_visible() or not loc.is_enabled():
            return False

        tag_name = loc.evaluate("el => el.tagName.toLowerCase()")
        if tag_name == "select":
            # Native select
            options = loc.locator("option")
            count = options.count()
            for i in range(count):
                opt = options.nth(i)
                val = opt.get_attribute("value") or ""
                txt = normalize(opt.inner_text() or "")
                if any(kw.lower() in txt for kw in keywords):
                    loc.select_option(value=val)
                    page.wait_for_timeout(400)
                    return True
            # Fallback to first non-empty option
            for i in range(count):
                opt = options.nth(i)
                val = opt.get_attribute("value") or ""
                txt = normalize(opt.inner_text() or "")
                if val.strip() and txt.strip():
                    loc.select_option(value=val)
                    page.wait_for_timeout(400)
                    return True
            return False

        # Custom dropdown trigger - click to open
        loc.click()
        page.wait_for_timeout(500)
        
        # Look for option items inside the popup container
        popup_selectors = [
            "[role='listbox']:visible",
            "[role='combobox'] + *:visible",
            "[data-testid*='dropdown']:visible",
            "[data-testid*='option-list']:visible",
            "[class*='dropdown']:visible",
            "[class*='Dropdown']:visible",
            "[class*='menu']:visible",
            "[class*='Menu']:visible",
        ]
        
        popup = None
        for popup_sel in popup_selectors:
            popups = page.locator(popup_sel)
            if popups.count() > 0:
                popup = popups.first
                break
                
        options_locator = None
        if popup:
            for item_sel in ["[role='option']", "li", "button", "[data-testid*='option']"]:
                items = popup.locator(item_sel)
                if items.count() > 0:
                    options_locator = items
                    break
        
        if not options_locator:
            for selector in ["[role='option']:visible", "[data-testid*='option']:visible"]:
                items = page.locator(selector)
                if items.count() > 0:
                    options_locator = items
                    break
                    
        if options_locator:
            count = options_locator.count()
            for i in range(count):
                opt = options_locator.nth(i)
                if opt.is_visible() and opt.is_enabled():
                    txt = normalize(opt.inner_text() or opt.get_attribute("aria-label") or "")
                    if any(kw.lower() in txt for kw in keywords):
                        opt.click()
                        page.wait_for_timeout(300)
                        return True
            # Fallback to first option if no match
            if count > 0:
                first_opt = options_locator.first
                first_opt.click()
                page.wait_for_timeout(300)
                return True
                
        return False
    except Exception as e:
        print(f"[seek] Keyword dropdown selection failed for {trigger_selector}: {e}")
        return False


def _handle_seek_first_page(page, config: dict) -> bool:
    touched = False

    # Choose resume method (e.g. existing SEEK profile resume)
    if _select_dropdown_option_by_keyword(page, "[data-testid='resume-method-change']", ["seek profile", "resume", "existing"]):
        print("[seek first page] resume seek profile option selected")
        touched = True
    elif _select_dropdown_option(page, "[data-testid='resume-method-change']", 1):
        print("[seek first page] resume first option selected")
        touched = True

    if _select_dropdown_option(page, "[data-testid='select-input']", 2):
        print("[seek first page] select-input second option selected")
        touched = True

    # Choose cover letter method (select 'Write cover letter')
    if _click_first_visible(page, "[aria-label='Write a cover letter'], [aria-label*='Write cover letter']"):
        print("[seek first page] Clicked 'Write a cover letter' aria-label directly")
        touched = True
    elif _select_dropdown_option_by_keyword(page, "[data-testid='coverLetter-method-change']", ["write", "text"]):
        print("[seek first page] cover letter method 'Write' selected")
        touched = True
    elif _click_first_visible(page, "[data-testid='coverLetter-method-change']"):
        print("[seek first page] cover letter method opened (fallback)")
        touched = True
        
    page.wait_for_timeout(600)  # wait for textarea to reveal

    # Fill cover letter text area
    try:
        cover_selectors = [
            "[data-testid='coverLetterTextInput']",
            "textarea[data-testid*='cover']",
            "textarea[name*='cover']",
            "textarea[id*='cover']",
            "textarea"
        ]
        cover_filled = False
        for sel in cover_selectors:
            cover = page.locator(sel).first
            if cover.count() > 0 and cover.is_visible() and cover.is_enabled():
                current = ""
                try:
                    current = (cover.input_value() or "").strip()
                except Exception:
                    try:
                        current = (cover.inner_text() or "").strip()
                    except Exception:
                        current = ""
                if not current:
                    cover_letter = str(config.get("cover_letter") or "").strip()
                    if not cover_letter:
                        # Fallback for manual testing when config is missing
                        cover_letter = "I am very interested in this role. Please review my attached resume. Thank you."
                    
                    if cover_letter:
                        cover.fill(cover_letter)
                        print(f"[seek first page] cover letter filled using selector: {sel}")
                        touched = True
                        cover_filled = True
                        break
        if not cover_filled:
            print("[seek first page] Warning: cover letter textarea was not found or already filled.")
    except Exception as e:
        print(f"[seek first page] cover letter fill failed: {e}")

    if touched:
        page.wait_for_timeout(int(FAST_WAIT * 1000))
    return touched


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
    button_selector = "button, a[role='button'], input[type='submit'], input[type='button'], [data-testid*='continue'], [data-testid*='next'], [data-automation*='continue'], [data-automation*='next']"
    buttons = page.locator(button_selector)
    found_buttons = []
    skipped_tabindex = []
    for i in range(buttons.count()):
        try:
            button = buttons.nth(i)
            if not button.is_visible():
                continue
            
            # Ignore sidebar/stepper navigation indicators (typically tabindex="-1")
            tabindex = button.get_attribute("tabindex")
            text = normalize(
                button.inner_text() or 
                button.get_attribute("value") or 
                button.get_attribute("aria-label") or 
                ""
            )
            
            if tabindex == "-1":
                if text:
                    skipped_tabindex.append(text)
                continue

            if text:
                found_buttons.append(text)
            if any(pattern == text or pattern in text for pattern in CONTINUE_PATTERNS):
                try:
                    button.scroll_into_view_if_needed(timeout=1000)
                    button.click(timeout=1500, force=True)
                    return True
                except Exception as click_err:
                    print(f"[seek] Attempted to click continue button '{text}' but failed: {click_err}")
                    continue
        except Exception:
            continue
    print(f"[seek] Debug: No continue button was successfully clicked.")
    print(f"[seek] Debug: Visible elements found: {found_buttons}")
    if skipped_tabindex:
        print(f"[seek] Debug: Elements skipped because of tabindex='-1': {skipped_tabindex}")
    return False


def apply_to_job(job_url: str, config: dict | None = None, job_context: dict | None = None, steps: list[str] | None = None) -> dict:
    return run(job_url, config_overrides=config, job_context=job_context, steps=steps)


def run(job_url: str, config_overrides: dict | None = None, job_context: dict | None = None, keep_open: bool = False, steps: list[str] | None = None) -> dict:
    sync_api = _install_playwright()
    playwright = sync_api.sync_playwright().start()
    browser = None
    context = None
    snapshot = dict(job_context or {})
    work_location = snapshot.get("location", "")
    question_cache = QuestionCache()
    result = {"status": "failed", "message": "Unknown initialization failure."}
    try:
        user_data_dir = _default_user_data_dir()
        os.makedirs(user_data_dir, exist_ok=True)
        launch_kwargs = {
            "user_data_dir": user_data_dir,
            "headless": False,
            "args": _browser_launch_args(),
            "viewport": {"width": 1440, "height": 1200},
        }
        system_chrome_path = _system_chrome_path()
        if system_chrome_path:
            launch_kwargs["executable_path"] = system_chrome_path
        else:
            launch_kwargs["channel"] = "chrome"
            
        print("[seek] Launching browser...")
        try:
            browser = playwright.chromium.launch_persistent_context(**launch_kwargs)
        except Exception as launch_err:
            print(f"[seek] Failed to launch Chrome. Checking fallback... Error: {launch_err}")
            # Fallback to temp profile if locked
            import tempfile
            temp_profile = tempfile.TemporaryDirectory(prefix="seek_bot_profile_")
            print(f"[seek] Using temporary profile: {temp_profile.name}")
            launch_kwargs["user_data_dir"] = temp_profile.name
            browser = playwright.chromium.launch_persistent_context(**launch_kwargs)

        context = browser
        page = context.pages[0] if context.pages else context.new_page()
        config = merge_config(config_overrides)
        
        print(f"[seek] Navigating to job URL: {job_url}...")
        page.goto(job_url, wait_until="domcontentloaded")
        page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))
        print("[seek] Job details page loaded.")
        
        snapshot = capture_job_snapshot(page, job_url, snapshot)
        
        # Check login status
        print("[seek] Checking login status...")
        if page_text_contains(page, ["sign in", "log in", "login"]):
            print("[seek] Seek sign-in is required before Quick Apply can continue. Waiting for manual login...")
            logged_in = False
            # Wait up to 5 minutes (300 seconds)
            for _ in range(300):
                if page.is_closed():
                    break
                
                # Check login status (if sign-in/login text is gone, we are logged in)
                if not page_text_contains(page, ["sign in", "log in", "login"]):
                    logged_in = True
                    break

                # Check if user clicked the "I have logged in" button on the overlay
                confirmed = False
                try:
                    confirmed = page.evaluate("() => window.seekBotLoggedInConfirmed === true")
                except Exception:
                    pass
                if confirmed:
                    logged_in = True
                    break

                # Inject/re-inject the prompt overlay if it is not present
                try:
                    page.evaluate("""() => {
                        if (document.getElementById('seek-bot-login-prompt')) return;
                        
                        const banner = document.createElement('div');
                        banner.id = 'seek-bot-login-prompt';
                        Object.assign(banner.style, {
                            position: 'fixed',
                            top: '24px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: '2147483647',
                            width: '450px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            webkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(15, 23, 42, 0.1)',
                            borderRadius: '16px',
                            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
                            padding: '16px 20px',
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            pointerEvents: 'auto',
                            transition: 'all 0.3s ease-in-out'
                        });

                        const header = document.createElement('div');
                        Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px' });
                        
                        const orb = document.createElement('div');
                        Object.assign(orb.style, {
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#e11d48',
                            boxShadow: '0 0 0 0 rgba(225, 29, 72, 0.7)',
                            animation: 'seekPulse 1.8s infinite'
                        });

                        if (!document.getElementById('seek-bot-style')) {
                            const style = document.createElement('style');
                            style.id = 'seek-bot-style';
                            style.textContent = `
                                @keyframes seekPulse {
                                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.7); }
                                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(225, 29, 72, 0); }
                                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
                                }
                            `;
                            document.head.appendChild(style);
                        }

                        const title = document.createElement('div');
                        title.textContent = 'Auto Apply: Login Required';
                        Object.assign(title.style, { fontWeight: '800', fontSize: '15px', color: '#0f172a' });

                        header.appendChild(orb);
                        header.appendChild(title);

                        const body = document.createElement('div');
                        body.textContent = 'Please log into your SEEK account in this browser window. The automator will resume automatically once you sign in, or you can click the button below after logging in.';
                        Object.assign(body.style, { fontSize: '13px', color: '#475569', lineHeight: '1.5', fontWeight: '500' });

                        const button = document.createElement('button');
                        button.id = 'seek-bot-confirm-login-btn';
                        button.textContent = 'I have logged in';
                        Object.assign(button.style, {
                            background: 'linear-gradient(135deg, #0a66c2, #1e3a8a)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            alignSelf: 'flex-end',
                            boxShadow: '0 4px 12px rgba(10, 102, 194, 0.2)',
                            transition: 'all 0.2s ease'
                        });
                        button.onclick = function() {
                            window.seekBotLoggedInConfirmed = true;
                        };

                        banner.appendChild(header);
                        banner.appendChild(body);
                        banner.appendChild(button);
                        document.body.appendChild(banner);
                    }""")
                except Exception:
                    pass

                page.wait_for_timeout(1000)

            # Cleanup banner when loop completes
            try:
                page.evaluate("() => { const b = document.getElementById('seek-bot-login-prompt'); if(b) b.remove(); }")
            except Exception:
                pass

            if not logged_in:
                print("[seek] Login timeout/canceled. Exiting flow.")
                result = {"status": "needs_login", "message": "Seek sign-in is required before Quick Apply can continue.", "final_url": page.url}
                record_application(snapshot, result)
                return result
            else:
                print("[seek] Successfully logged in!")

            # If logged in successfully, return to original job URL if we were redirected away
            if not page.url.startswith(job_url):
                print(f"[seek] Navigating back to original job: {job_url}...")
                page.goto(job_url, wait_until="domcontentloaded")
                page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))
        else:
            print("[seek] Already logged in / no sign-in required.")

        print("[seek] Attempting to click Apply / Quick Apply button...")
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
                    # Listen for new page context opening (target="_blank")
                    try:
                        with context.expect_event("page", timeout=3000) as page_info:
                            target.click(timeout=3000)
                        page = page_info.value
                        print(f"[seek] Switched to new tab: {page.url}")
                    except Exception:
                        # Fallback/default if it opens in the same tab (no new page event occurred)
                        print("[seek] Clicked apply button. Continuing in same tab.")
                    opened = True
                    break
            except Exception as click_err:
                print(f"[seek] Selector '{selector}' click failed: {click_err}")
                continue
        if not opened:
            print("[seek] Stopped: Could not find or click SEEK apply button.")
            result = {"status": "stopped", "message": "Could not find SEEK apply button.", "final_url": page.url}
            record_application(snapshot, result)
            return result
        
        # Wait for the apply page to finish loading and settle
        try:
            page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))

        if steps:
            print(f"[seek] Running custom click steps: {steps}")
            for step in steps:
                step = step.strip()
                if not step:
                    continue
                # Support data-testid, data-automation, or raw CSS selector
                if "=" in step or "[" in step or "." in step or "#" in step:
                    selector = step
                else:
                    selector = f"[data-testid='{step}'], [data-automation='{step}']"
                
                print(f"[seek] Custom step: clicking selector '{selector}'...")
                try:
                    locator = page.locator(selector).first
                    locator.scroll_into_view_if_needed(timeout=2000)
                    locator.click(timeout=3000, force=True)
                    print(f"[seek] Clicked '{selector}' successfully.")
                except Exception as e:
                    print(f"[seek] Failed to click '{selector}': {e}")
                page.wait_for_timeout(1000)
            
            # Post custom steps check
            if is_review_page(page):
                result = {"status": "review", "message": "Reached SEEK review page after custom steps.", "final_url": page.url}
            else:
                result = {"status": "stopped", "message": "Custom steps finished.", "final_url": page.url}
            record_application(snapshot, result)
            return result

        for _step in range(12):
            if _is_seek_first_page(page):
                print(f"[seek] Form step {_step + 1}: Handling SEEK first page...")
                _handle_seek_first_page(page, config)
            else:
                print(f"[seek] Form step {_step + 1}: Filling text inputs, selects, radios, checkboxes, resume and cover letter...")
                _fill_text_inputs(page, config, question_cache, work_location)
                _fill_selects(page, config, question_cache, work_location)
                _fill_radios_and_checkboxes(page, config, question_cache, work_location)
                _upload_resume(page, config)
                _fill_cover_letter(page, config)
            if is_review_page(page):
                print("[seek] Review page detected.")
                result = {"status": "review", "message": "Reached SEEK review page and stopped before submit.", "final_url": page.url}
                record_application(snapshot, result)
                return result
            print("[seek] Clicking continue/next...")
            if not _click_continue(page):
                print("[seek] Stopped: Could not click continue/next button.")
                break
            try:
                page.wait_for_load_state("domcontentloaded", timeout=4000)
            except Exception:
                pass
            page.wait_for_timeout(int(FAST_WAIT * 1000))
            page.wait_for_timeout(int(PAGE_SETTLE_WAIT * 1000))
        result = {"status": "stopped", "message": "Stopped before review because the next application step could not be completed.", "final_url": page.url}
        record_application(snapshot, result)
        return result
    except Exception as exc:
        print(f"[seek] Fatal exception occurred: {exc}")
        import traceback
        traceback.print_exc()
        result = {"status": "failed", "message": f"Fatal exception: {exc}", "final_url": page.url if 'page' in locals() and page else job_url}
        return result
    finally:
        if keep_open:
            try:
                input("\n[seek] Automation finished/stopped. Press Enter to close the browser...")
            except Exception:
                pass
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
    parser.add_argument("url", nargs="?", help="Full SEEK job URL")
    parser.add_argument("--url", dest="url_opt", help="Full SEEK job URL")
    parser.add_argument("--steps", help="Comma-separated data-testid values or CSS selectors to click sequentially")
    args = parser.parse_args()
    
    url = args.url or args.url_opt
    if not url:
        parser.error("The following arguments are required: url (or --url)")
    
    steps_list = [s.strip() for s in args.steps.split(",")] if args.steps else None
    result = run(url, keep_open=True, steps=steps_list)
    print(result)


if __name__ == "__main__":
    main()
