#!/usr/bin/env python3
"""
SEEK Auto-Apply Bot
Usage: python3 worker/debug_seek_job.py --url "https://au.seek.com/job/92765205"

Behaviour:
  - Opens the job page and clicks "Apply" / "Quick apply"
  - Fills every text field with defaults (see CONFIG below)
  - Selects first option for every <select> / radio group
  - Attaches the most-recently-modified resume from RESUME_DIR
  - Pastes COVER_LETTER_TEXT into any cover-letter textarea
  - Keeps clicking "Continue" / "Next" through every step
  - STOPS on the Review / Confirm page — does NOT submit
"""

import argparse
import glob
import copy
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

ROOT = next(
    (parent for parent in Path(__file__).resolve().parents if (parent / "worker" / "config").is_dir()),
    Path(__file__).resolve().parents[3],
)
sys.path.append(str(ROOT / "worker"))

from modules.persistence import ApplicationLogger

# ──────────────────────────────────────────────
#  USER CONFIG  (edit these before running)
# ──────────────────────────────────────────────
CONFIG = {
    # ── Personal details ───────────────────────
    "first_name":   "Scott",
    "last_name":    "Cheung",
    "email":        "scott5443003@gmail.com]",
    "phone":        "0434344292",
    "address":      "Unit 85, 15-23 Lusty Street, Wolli Creek NSW 2205",

    # ── Resume ─────────────────────────────────
    # Folder that contains your resume PDFs/DOCXs.
    # The script picks the most-recently-modified file.
    "resume_dir":   os.path.abspath(os.path.join(os.path.dirname(__file__), "all resumes/default")),
    "resume_glob":  "resume.pdf",          # change to "*.docx" if needed

    # ── Cover letter ───────────────────────────
    "cover_letter": (
        "Dear Hiring Manager,\n\n"
        "I am excited to apply for this position. My background and skills "
        "align closely with what you are looking for, and I am confident I "
        "would be a strong contributor to your team.\n\n"
        "Please find my resume attached. I look forward to the opportunity "
        "to discuss how I can add value to your organisation.\n\n"
        "Kind regards,\nScott"
    ),

    # ── Misc defaults ──────────────────────────
    "default_text": "N/A",
    "salary":       "80000",
    "notice":       "2 weeks",
    "linkedin":     "https://www.linkedin.com/in/scottcheung1110",
    "website":      "https://xianzhe.site",
    "right_to_work": "Yes",
}

DEFAULT_CONFIG = copy.deepcopy(CONFIG)

# ──────────────────────────────────────────────
#  STOP KEYWORDS — pause on the review page
# ──────────────────────────────────────────────
REVIEW_KEYWORDS = [
    "review your application", "submit your application",
    "check your details", "confirm your details",
    "/apply/review", "/application/review",
]

# ──────────────────────────────────────────────
#  CONTINUE / NEXT button patterns
# ──────────────────────────────────────────────
CONTINUE_PATTERNS = [
    "continue", "next", "proceed", "save and continue",
    "save & continue", "save and next",
]

FAST_WAIT = 0.4
PAGE_SETTLE_WAIT = 0.8
 

 
# ══════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════
 
def latest_resume(directory: str, pattern: str) -> str | None:
    """Return the path of the most recently modified file matching pattern."""
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
        app_logger = ApplicationLogger()
        status = str(result.get("status") or "stopped")
        message = str(result.get("message") or status)
        record_status = "submitted" if status == "review" else "skipped"
        application_type = "SEEK Quick Apply review reached" if status == "review" else "SEEK Quick Apply stopped"
        if status == "needs_login":
            application_type = "SEEK Quick Apply blocked by login"

        app_logger.log_application(
            {
                "platform": "seek",
                "job_id": snapshot.get("job_id") or extract_seek_job_id(snapshot.get("job_link")),
                "title": snapshot.get("title"),
                "company": snapshot.get("company"),
                "work_location": snapshot.get("work_location"),
                "job_link": snapshot.get("job_link"),
                "job_description": snapshot.get("job_description"),
                "status": record_status,
                "application_type": application_type,
                "skip_reason": None if status == "review" else message,
                "date_applied": datetime.now().isoformat() if status == "review" else None,
                "raw_data": {
                    "seek_status": status,
                    "seek_message": message,
                    "seek_final_url": result.get("final_url"),
                    "quick_apply": True,
                },
            }
        )
    except Exception as exc:
        print(f"[seek record] failed: {exc}")


def merge_config(overrides: dict | None = None) -> dict:
    merged = copy.deepcopy(DEFAULT_CONFIG)
    if overrides:
        for key, value in overrides.items():
            if value not in (None, ""):
                merged[key] = value
    return merged


def page_text_contains(page, phrases) -> bool:
    """
    Lightweight page check that avoids reading the full body unless needed.
    Tries headings and buttons first, then falls back to the body text.
    """
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
    """Return True if the current page looks like the final review step."""
    url_lower = page.url.lower()
    title = ""
    try:
        title = normalize(page.title() or "")
    except Exception:
        pass
    for kw in REVIEW_KEYWORDS:
        if kw in title or kw.replace(" ", "-") in url_lower or kw.replace(" ", "") in url_lower:
            return True
    if page_text_contains(page, REVIEW_KEYWORDS):
        return True
    return False


def is_login_page(page) -> bool:
    """Return True if SEEK is asking for sign-in before continuing."""
    try:
        if page.locator("[data-testid='login-form']").count() > 0:
            return True
        return page_text_contains(page, ["email me a sign in code", "continue with google"])
    except Exception:
        return False
 
 
def find_continue_button(page):
    """
    Return the most-likely 'Continue / Next' button, or None.
    Priority: exact label match > partial match > aria-label match.
    """
    # 1. All clickable elements with text
    for selector in [
        "button:visible",
        "a[role='button']:visible",
        "[type='submit']:visible",
    ]:
        try:
            elems = page.query_selector_all(selector)
        except Exception:
            continue
        for el in elems:
            try:
                txt = normalize(el.inner_text())
            except Exception:
                txt = ""
            for pat in CONTINUE_PATTERNS:
                if pat == txt or pat in txt:
                    return el
        # second pass — partial
        for el in elems:
            try:
                txt = normalize(el.inner_text())
            except Exception:
                txt = ""
            for pat in CONTINUE_PATTERNS:
                if pat in txt:
                    return el
    return None


def find_apply_button(page):
    """Return the most likely Apply / Quick apply button, or None."""
    for label in ["Quick apply", "Apply now", "Apply"]:
        try:
            candidate = page.get_by_text(label, exact=True).first
            if candidate.count() and candidate.is_visible():
                return candidate.element_handle()
        except Exception:
            pass

    patterns = [
        "apply now",
        "quick apply",
        "apply",
    ]
    selectors = [
        "a:visible",
        "button:visible",
        "a[role='button']:visible",
        "[type='button']:visible",
        "[type='submit']:visible",
    ]
    for selector in selectors:
        try:
            elems = page.query_selector_all(selector)
        except Exception:
            continue
        for el in elems:
            try:
                txt = normalize(el.inner_text() or el.get_attribute("aria-label") or "")
            except Exception:
                txt = ""
            for pat in patterns:
                if txt == pat or pat in txt:
                    return el
    return None
 
 
# ══════════════════════════════════════════════
#  FIELD FILLERS
# ══════════════════════════════════════════════
 
def fill_text_fields(page, config):
    """Fill every visible text / email / tel / number / textarea."""
    inputs = page.query_selector_all(
        "input:not([type='hidden']):not([type='submit']):not([type='button'])"
        ":not([type='checkbox']):not([type='radio']):not([type='file']):visible, "
        "textarea:visible"
    )
    for inp in inputs:
        try:
            if not inp.is_visible() or not inp.is_enabled():
                continue
            current = (inp.input_value() or "").strip()
            if current:            # already filled — skip
                continue
 
            itype  = (inp.get_attribute("type") or "text").lower()
            name   = normalize(inp.get_attribute("name") or inp.get_attribute("id") or inp.get_attribute("data-testid") or "")
            label  = _get_label(page, inp)
 
            value = _pick_value(name, label, itype, config)
            inp.fill(value)
            time.sleep(0.1)
        except Exception as e:
            print(f"    [text] skip — {e}")
 
 
def _get_label(page, element) -> str:
    """Try to find associated <label> text for an input."""
    try:
        eid = element.get_attribute("id")
        if eid:
            label_el = page.query_selector(f"label[for='{eid}']")
            if label_el:
                return normalize(label_el.inner_text())
    except Exception:
        pass
    # Aria
    try:
        aria = element.get_attribute("aria-label") or element.get_attribute("placeholder") or ""
        return normalize(aria)
    except Exception:
        return ""
 
 
def _pick_value(name: str, label: str, itype: str, config: dict) -> str:
    ctx = name + " " + label
    c   = config
 
    if any(k in ctx for k in ["firstname", "first_name", "first name", "given"]):
        return c["first_name"]
    if any(k in ctx for k in ["lastname", "last_name", "last name", "surname", "family"]):
        return c["last_name"]
    if "email" in ctx or itype == "email":
        return c["email"]
    if any(k in ctx for k in ["phone", "mobile", "tel", "contact number"]) or itype in ("tel", "phone"):
        return c["phone"]
    if any(k in ctx for k in ["address", "suburb", "postcode", "city", "location"]):
        return c["address"]
    if any(k in ctx for k in ["linkedin", "linked in"]):
        return c["linkedin"]
    if any(k in ctx for k in ["website", "portfolio", "url"]):
        return c["website"]
    if any(k in ctx for k in ["salary", "expected", "remuneration", "rate"]):
        return c["salary"]
    if any(k in ctx for k in ["notice", "availability", "start date", "available"]):
        return c["notice"]
    if any(k in ctx for k in ["cover", "letter", "motivation", "message"]):
        return c["cover_letter"]
    if itype == "number":
        return "0"
    if itype == "url":
        return c["website"]
    return c["default_text"]
 
 
def fill_cover_letter(page, config):
    """Specifically target cover letter textareas (may have rich-text editors)."""
    # Seek uses a <textarea> or a contenteditable div for cover letters
    for selector in [
        "textarea[data-testid*='cover']:visible",
        "textarea[name*='cover']:visible",
        "textarea[id*='cover']:visible",
        "[contenteditable='true']:visible",
        "textarea:visible",
    ]:
        try:
            els = page.query_selector_all(selector)
            for el in els:
                lbl = _get_label(page, el)
                name = normalize(el.get_attribute("name") or el.get_attribute("id") or "")
                if any(k in name+lbl for k in ["cover", "letter", "motivation", "message"]):
                    current = (el.input_value() or el.inner_text() or "").strip()
                    if not current:
                        el.fill(config["cover_letter"])
                        print("    [cover letter] filled")
                        return
        except Exception:
            pass


def click_first_visible(page, selector: str):
    """Click the first visible match for a selector and return True on success."""
    try:
        loc = page.locator(selector)
        for idx in range(loc.count()):
            item = loc.nth(idx)
            try:
                if item.is_visible() and item.is_enabled():
                    item.click()
                    time.sleep(0.3)
                    return True
            except Exception:
                continue
    except Exception:
        pass
    return False


def choose_nth_real_option_after_opening(page, target_index: int = 1):
    """
    After a dropdown has been opened, choose the Nth real option.
    Searches only inside the visible dropdown popup container to avoid
    accidentally matching unrelated buttons/li elements on the page.
    Falls back to a full-page scoped search if no popup container found.
    """
    # Give the dropdown time to render its options
    time.sleep(0.5)

    # Placeholder texts to skip (not real options)
    SKIP_TEXTS = {"", "select", "please select", "choose", "–", "-"}

    # ── Strategy 1: look inside a popup/listbox container ──────────────
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
            # Look for option items within the popup
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
                                time.sleep(0.3)
                                return True
                        except Exception:
                            continue
                except Exception:
                    continue
        except Exception:
            continue

    # ── Strategy 2: fall back to role='option' only (scoped to whole page) ──
    # Reset seen per selector pass so counts don't bleed across selector types
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
                        time.sleep(0.3)
                        return True
                except Exception:
                    continue
        except Exception:
            continue

    return False


def select_dropdown_option(page, trigger_selector: str, target_index: int = 1) -> bool:
    """
    Robust dropdown option selection.
    If the element is a native <select>, selects the Nth real option using select_option.
    If it is a custom dropdown, clicks the trigger to open it, then clicks the Nth visible option.
    """
    try:
        loc = page.locator(trigger_selector)
        if loc.count() == 0:
            return False
        loc = loc.first
        if not loc.is_visible() or not loc.is_enabled():
            return False

        # Check if the element itself is a <select>
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
            time.sleep(FAST_WAIT)
            return True
            return False

        # If it's a custom dropdown trigger, click it to open
        loc.click()
        time.sleep(FAST_WAIT)
        return choose_nth_real_option_after_opening(page, target_index)
    except Exception as e:
        print(f"    [dropdown selection] failed for {trigger_selector}: {e}")
        return False


def handle_seek_first_page(page, config):
    """
    Fill the first SEEK quick-apply page in a fixed order:
    1. choose resume method
    2. choose Second select-input option
    3. choose cover letter method
    4. fill cover letter text
    5. continue
    """
    touched = False

    if select_dropdown_option(page, "[data-testid='resume-method-change']", 1):
        print("    [seek first page] resume first option selected")
        touched = True

    if select_dropdown_option(page, "[data-testid='select-input']", 2):
        print("    [seek first page] select-input second option selected")
        touched = True

    if click_first_visible(page, "[data-testid='coverLetter-method-change']"):
        print("    [seek first page] cover letter method opened")
        touched = True

    try:
        cover = page.locator("[data-testid='coverLetterTextInput']").first
        if cover.count() and cover.is_visible() and cover.is_enabled():
            current = ""
            try:
                current = (cover.input_value() or "").strip()
            except Exception:
                try:
                    current = (cover.inner_text() or "").strip()
                except Exception:
                    current = ""
            if not current:
                cover.fill(config["cover_letter"])
                print("    [seek first page] cover letter filled")
                touched = True
    except Exception as e:
        print(f"    [seek first page] cover letter skip — {e}")

    if touched:
        time.sleep(FAST_WAIT)
    return touched


def is_seek_first_page(page) -> bool:
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
 
 
def select_defaults(page):
    """Choose first option for every unfilled <select>."""
    selects = page.query_selector_all("select:visible")
    for sel in selects:
        try:
            if not sel.is_visible() or not sel.is_enabled():
                continue
            current = sel.input_value()
            options = sel.query_selector_all("option")
            values  = [o.get_attribute("value") or "" for o in options if o.get_attribute("value")]
            # Skip if already on a real value (not blank/placeholder)
            if current and current.strip() and current not in ("", "0", "null", "undefined", "placeholder"):
                continue
            # Pick first non-empty, non-placeholder option
            for v in values:
                if v.strip() and v.lower() not in ("", "0", "null", "undefined", "select", "please select", "choose"):
                    sel.select_option(value=v)
                    time.sleep(0.1)
                    break
        except Exception as e:
            print(f"    [select] skip — {e}")
 
 
def select_radio_defaults(page):
    """
    For each radio group, if nothing is selected yet, click the first option.
    Also handles styled div/button radio replacements.
    """
    # Standard radio
    try:
        radios = page.query_selector_all("input[type='radio']:visible")
        seen_groups: set[str] = set()
        for r in radios:
            name = r.get_attribute("name") or ""
            if name in seen_groups:
                continue
            # Check if group already has a selection
            group = page.query_selector_all(f"input[type='radio'][name='{name}']")
            if any(g.is_checked() for g in group):
                seen_groups.add(name)
                continue
            r.click()
            seen_groups.add(name)
            time.sleep(0.1)
    except Exception as e:
        print(f"    [radio] {e}")
 
    # SEEK sometimes uses <li role="radio"> or <div role="radio">
    try:
        aria_radios = page.query_selector_all("[role='radio']:visible, [role='radiogroup']:visible")
        for ar in aria_radios:
            try:
                if ar.get_attribute("role") == "radiogroup":
                    first = ar.query_selector("[role='radio']")
                    if first and first.get_attribute("aria-checked") != "true":
                        first.click()
                        time.sleep(0.1)
                elif ar.get_attribute("aria-checked") not in ("true", "false"):
                    ar.click()
                    time.sleep(0.1)
            except Exception:
                pass
    except Exception:
        pass
 
 
def handle_checkboxes(page):
    """Check any required checkboxes that are unchecked (e.g. 'I agree')."""
    try:
        cbs = page.query_selector_all("input[type='checkbox']:visible")
        for cb in cbs:
            try:
                required = cb.get_attribute("required") or cb.get_attribute("aria-required")
                if required and not cb.is_checked():
                    cb.click()
                    time.sleep(0.1)
            except Exception:
                pass
    except Exception:
        pass
 
 
def attach_resume(page, resume_path: str):
    """Upload the resume file wherever a file input is visible."""
    try:
        file_inputs = page.query_selector_all("input[type='file']:visible, input[type='file']")
        for fi in file_inputs:
            try:
                fi.set_input_files(resume_path)
                print(f"    [resume] attached: {os.path.basename(resume_path)}")
                time.sleep(1)
                return True
            except Exception as e:
                print(f"    [resume] set_input_files failed: {e}")
    except Exception as e:
        print(f"    [resume] query failed: {e}")
 
    # SEEK 'Quick Apply' may trigger a file chooser via a styled button
    try:
        upload_btns = page.query_selector_all(
            "button:has-text('Upload'), button:has-text('resume'), "
            "button:has-text('CV'), [data-testid*='upload']:visible"
        )
        for btn in upload_btns:
            try:
                with page.expect_file_chooser() as fc_info:
                    btn.click()
                fc = fc_info.value
                fc.set_files(resume_path)
                print(f"    [resume] attached via chooser: {os.path.basename(resume_path)}")
                time.sleep(1)
                return True
            except Exception as e:
                print(f"    [resume] chooser failed: {e}")
    except Exception:
        pass
 
    return False
 
 
def use_existing_resume(page):
    """
    SEEK 'Quick Apply' shows already-uploaded resumes.
    Click the first (most recent) one if present.
    """
    try:
        # Look for radio-style resume selector
        selectors = [
            "[data-testid='resume-selector'] input[type='radio']",
            "[data-testid*='resume'] input[type='radio']",
            "input[type='radio'][name*='resume']",
            "input[type='radio'][id*='resume']",
        ]
        for sel in selectors:
            radios = page.query_selector_all(sel)
            if radios:
                radios[0].click()
                print("    [resume] selected existing (first in list)")
                time.sleep(0.5)
                return True
 
        # Styled card-style selectors
        cards = page.query_selector_all(
            "[data-testid*='resume-option'], [class*='ResumeCard'], [class*='resume-card']"
        )
        if cards:
            cards[0].click()
            print("    [resume] clicked existing resume card")
            time.sleep(0.5)
            return True
    except Exception as e:
        print(f"    [resume] existing-selection failed: {e}")
    return False
 
 
# ══════════════════════════════════════════════
#  STEP PROCESSOR
# ══════════════════════════════════════════════
 
def process_step(page, step_num: int, resume_path: str | None, config: dict):
    print(f"\n── Step {step_num} ──────────────────────────────")
    print(f"   URL: {page.url}")
    try:
        heading = page.inner_text("h1, h2, [data-testid*='heading'], [class*='Heading']") or ""
        print(f"   Heading: {heading[:100].strip()}")
    except Exception:
        pass
 
    time.sleep(1)  # let dynamic content settle

    if is_seek_first_page(page):
        handle_seek_first_page(page, config)
        return

    # 1. Resume handling
    if not use_existing_resume(page):
        if resume_path:
            attach_resume(page, resume_path)
 
    # 2. Cover letter
    fill_cover_letter(page, config)
 
    # 3. Text / textarea fields
    fill_text_fields(page, config)
 
    # 4. Dropdowns
    select_defaults(page)
 
    # 5. Radio groups
    select_radio_defaults(page)
 
    # 6. Required checkboxes
    handle_checkboxes(page)
 
    time.sleep(0.5)
 
 
# ══════════════════════════════════════════════
#  MAIN FLOW
# ══════════════════════════════════════════════
 
def run(
    job_url: str,
    headless: bool = False,
    no_sandbox: bool = False,
    keep_open: bool = True,
    close_on_finish: bool = False,
    config_overrides: dict | None = None,
    job_context: dict | None = None,
    status_callback=None,
):
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    config = merge_config(config_overrides)

    def emit_status(message: str) -> None:
        print(message)
        if status_callback:
            try:
                status_callback(message)
            except Exception:
                pass

    result = {
        "job_url": job_url,
        "status": "started",
        "reached_review": False,
        "needs_login": False,
        "message": "",
        "final_url": job_url,
        "job": dict(job_context or {}),
    }

    resume_path = latest_resume(config["resume_dir"], config["resume_glob"])
    if resume_path:
        emit_status(f"📄 Resume: {resume_path}")
    else:
        emit_status(f"⚠️  No resume found in {config['resume_dir']} matching {config['resume_glob']}")
        emit_status("   Upload will be skipped. Set resume_dir to fix this.")

    # Keep a dedicated browser profile for the bot. Reusing your main Chrome
    # profile often fails because Chrome locks it while it is already open.
    user_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "bot_profile_dir"))
    os.makedirs(user_data_dir, exist_ok=True)

    system = platform.system()
    browser_args = [
        "--start-maximized",
    ]
    chromium_sandbox = system != "Linux" or not no_sandbox
    if system == "Linux":
        browser_args.append("--disable-dev-shm-usage")
        if no_sandbox:
            browser_args.append("--no-sandbox")
            browser_args.append("--disable-setuid-sandbox")

    with sync_playwright() as p:
        emit_status(f"🔧 Loading Bot Profile from: {user_data_dir}")

        def launch_with_profile(profile_dir: str):
            return p.chromium.launch_persistent_context(
                user_data_dir=profile_dir,  # 【关键】指向独立目录，而不是本机默认 Chrome 目录
                channel="chrome",          # 依然调用本机安装的 Chrome 实体，拟真度最高
                headless=headless,
                args=browser_args,
                chromium_sandbox=chromium_sandbox,
                viewport={"width": 1440, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )

        temp_profile = None
        try:
            try:
                ctx = launch_with_profile(user_data_dir)
            except Exception as e:
                msg = str(e).lower()
                if "existing browser session" not in msg and "profile is already in use" not in msg:
                    raise
                temp_profile = tempfile.TemporaryDirectory(prefix="seek_bot_profile_")
                emit_status("⚠️  Bot profile is already open. Using a temporary browser profile for this run.")
                emit_status(f"🔧 Temporary Profile: {temp_profile.name}")
                ctx = launch_with_profile(temp_profile.name)

            # persistent_context 默认会提供一个 pages 数组，我们直接取第一个即可，避免打开多余的空白页
            page = ctx.pages[0] if ctx.pages else ctx.new_page()

            # ── 1. Open the job listing ──
            emit_status(f"\n🌐 Opening job page: {job_url}")
            page.goto(job_url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(PAGE_SETTLE_WAIT)
            result["final_url"] = page.url
            result["job"] = capture_job_snapshot(page, job_url, result.get("job"))

            # ── 2. Click Apply / Quick apply ──
            for _ in range(3):
                apply_btn = find_apply_button(page)
                if not apply_btn:
                    break
                try:
                    emit_status("▶ Clicking Apply button")
                    apply_btn.click()
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=2000)
                    except Exception:
                        pass
                    time.sleep(PAGE_SETTLE_WAIT)
                    break
                except Exception:
                    time.sleep(FAST_WAIT)

            # ── 3. Walk through the form steps ──
            for step_num in range(1, 21):
                if is_login_page(page):
                    result["status"] = "needs_login"
                    result["needs_login"] = True
                    result["message"] = "SEEK is asking for sign-in."
                    result["final_url"] = page.url
                    result["job"] = capture_job_snapshot(page, job_url, result.get("job"))
                    emit_status("🔐 SEEK is asking for sign-in. Stopping here because the application cannot continue without login.")
                    break

                if is_review_page(page):
                    result["status"] = "review"
                    result["reached_review"] = True
                    result["message"] = "Review page reached. Stopped before submission."
                    result["final_url"] = page.url
                    result["job"] = capture_job_snapshot(page, job_url, result.get("job"))
                    emit_status("\n✅ Review page reached. Stopping before submission.")
                    break

                process_step(page, step_num, resume_path, config)

                next_btn = find_continue_button(page)
                if not next_btn:
                    result["status"] = "stopped"
                    result["message"] = "No Continue / Next button found."
                    result["final_url"] = page.url
                    result["job"] = capture_job_snapshot(page, job_url, result.get("job"))
                    emit_status("ℹ️  No Continue / Next button found. Stopping.")
                    break

                try:
                    emit_status("▶ Clicking Continue / Next")
                    next_btn.click()
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=2000)
                    except Exception:
                        pass
                    time.sleep(PAGE_SETTLE_WAIT)
                    result["final_url"] = page.url
                    result["job"] = capture_job_snapshot(page, job_url, result.get("job"))
                except Exception as e:
                    result["status"] = "failed"
                    result["message"] = f"Could not click Continue / Next: {e}"
                    result["final_url"] = page.url
                    result["job"] = capture_job_snapshot(page, job_url, result.get("job"))
                    emit_status(f"⚠️  Could not click Continue / Next: {e}")
                    break

            if result["status"] == "started":
                result["status"] = "stopped"
                result["message"] = "Reached maximum form steps before review."
                try:
                    result["final_url"] = page.url
                except Exception:
                    pass
                result["job"] = capture_job_snapshot(page, job_url, result.get("job"))

            if keep_open and not headless:
                input("\nBrowser is open for inspection. Press Enter here to close it...")
        finally:
            record_application(result.get("job") or {}, result)
            if close_on_finish:
                try:
                    ctx.close()
                except Exception:
                    pass
            if temp_profile:
                temp_profile.cleanup()

    return result

# ══════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════
 
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SEEK Auto-Apply Bot")
    parser.add_argument("--url", required=True, help="SEEK job URL to apply to")
    parser.add_argument(
        "--headless",
        action="store_true",
        default=False,
        help="Run browser in headless mode (default: visible)",
    )
    parser.add_argument(
        "--no-sandbox",
        action="store_true",
        default=False,
        help="Run Chrome without its OS sandbox on Linux",
    )
    parser.add_argument(
        "--close-after-load",
        action="store_true",
        default=False,
        help="Close the browser immediately after the page loads",
    )
    args = parser.parse_args()
 
    # Basic URL validation
    if "seek.com" not in args.url:
        print("⚠️  Warning: URL does not look like a SEEK job. Continuing anyway …")
 
    run(
        args.url,
        headless=args.headless,
        no_sandbox=args.no_sandbox,
        keep_open=not args.close_after_load,
    )
