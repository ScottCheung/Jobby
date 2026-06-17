import importlib.util
import os
import random
import re
import ssl
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus, urlparse

import certifi
from selenium.common.exceptions import NoSuchWindowException, TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

cafile = certifi.where()
os.environ.setdefault("SSL_CERT_FILE", cafile)
os.environ.setdefault("REQUESTS_CA_BUNDLE", cafile)
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=cafile)

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "worker"))

from config.search import (  # noqa: E402
    bad_words,
    randomize_search_order,
    search_location,
    search_terms,
    switch_number,
)
from config.personals import *  # noqa: E402,F403
from config.questions import *  # noqa: E402,F403
from config.questions import default_resume_path  # noqa: E402
from config.secrets import username  # noqa: E402
import modules.open_chrome as open_chrome  # noqa: E402
from modules.helpers import critical_error_log, print_lg  # noqa: E402
from modules.linkedin.linkedin_status import (  # noqa: E402
    bind_context,
    bot_status,
    sync_status_widget,
    update_bot_stats,
    wait_if_bot_paused,
)
from modules.persistence import QuestionCache  # noqa: E402
from modules.persistence.worker_config import apply_api_worker_config  # noqa: E402


driver = None
actions = None
wait = None
options = None
question_cache = None
seek_apply_module = None

reviewed_count = 0
quick_apply_count = 0
failed_count = 0
skip_count = 0


def sync_stats_to_status() -> None:
    update_bot_stats(
        submitted=quick_apply_count,
        skipped=skip_count,
        failed=failed_count,
    )


def _shutdown_browser(*_args) -> None:
    global driver
    if driver:
        try:
            driver.quit()
        except Exception:
            pass


def _clean_text(value: object | None) -> str | None:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def _safe_title(value: object | None) -> str | None:
    text = _clean_text(value)
    if not text:
        return None
    lowered = text.lower()
    if any(marker in lowered for marker in ["<html", "<head", "<script", "<meta", "apple-mobile-web-app"]):
        return None
    return text


def _extract_seek_job_id(value: object | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        parsed = urlparse(text)
        match = re.search(r"/job/(\d+)", parsed.path or "")
        if match:
            return match.group(1)
        match = re.search(r"(?:jobId|jobid)=(\d+)", parsed.query or "")
        if match:
            return match.group(1)
    except Exception:
        pass
    match = re.search(r"\b(\d{6,})\b", text)
    return match.group(1) if match else ""


def _canonical_job_url(job_id: str) -> str:
    return f"https://au.seek.com/job/{job_id}"


def _load_seek_apply_module():
    global seek_apply_module
    if seek_apply_module is not None:
        return seek_apply_module

    module_path = ROOT / "worker" / "testSeek" / "seek_bot_profile" / "11.py"
    spec = importlib.util.spec_from_file_location("seek_playwright_apply", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load SEEK apply module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    seek_apply_module = module
    return module


def _build_seek_apply_config() -> dict:
    resume_path = os.path.abspath(os.path.expanduser(str(globals().get("default_resume_path") or default_resume_path or "")))
    return {
        "first_name": str(globals().get("first_name") or "").strip(),
        "last_name": str(globals().get("last_name") or "").strip(),
        "email": str(globals().get("email") or globals().get("username") or "").strip(),
        "phone": str(globals().get("phone_number") or "").strip(),
        "address": " ".join(
            part
            for part in [
                str(globals().get("street") or "").strip(),
                str(globals().get("current_city") or "").strip(),
                str(globals().get("state") or "").strip(),
                str(globals().get("zipcode") or "").strip(),
            ]
            if part
        ),
        "resume_dir": os.path.dirname(resume_path) if resume_path else None,
        "resume_glob": os.path.basename(resume_path) if resume_path else None,
        "cover_letter": str(globals().get("cover_letter") or "").strip(),
        "salary": str(globals().get("desired_salary") or "").strip(),
        "notice": str(globals().get("notice_period") or "").strip(),
        "linkedin": str(globals().get("linkedIn") or "").strip(),
        "website": str(globals().get("website") or "").strip(),
        "right_to_work": str(globals().get("us_citizenship") or globals().get("require_visa") or "Yes").strip(),
    }


def _seek_search_url(term: str) -> str:
    url = f"https://www.seek.com.au/jobs?keywords={quote_plus(term)}"
    if str(search_location or "").strip():
        url += f"&where={quote_plus(str(search_location).strip())}"
    return url


def _wait_for_result_cards() -> list:
    selectors = [
        "[data-automation='normalJob']",
        "article[data-automation]",
        "article",
    ]
    last_error = None
    for selector in selectors:
        try:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
            cards = [card for card in driver.find_elements(By.CSS_SELECTOR, selector) if card.is_displayed()]
            if cards:
                return cards
        except Exception as exc:
            last_error = exc
    raise last_error or RuntimeError("SEEK result cards were not found")


def _extract_from_card(card) -> dict | None:
    link = None
    title = None
    company = None
    location = None

    for selector in ["a[data-automation='jobTitle']", "a[data-testid='job-title']", "h3 a", "a[href*='/job/']"]:
        try:
            node = card.find_element(By.CSS_SELECTOR, selector)
            href = _clean_text(node.get_attribute("href"))
            text = _safe_title(node.text)
            if href and _extract_seek_job_id(href):
                link = href
            if text:
                title = text
            if link and title:
                break
        except Exception:
            continue

    if not link:
        try:
            link = driver.execute_script(
                """
                const root = arguments[0];
                const link = root.querySelector("a[href*='/job/']");
                return link ? link.href : null;
                """,
                card,
            )
        except Exception:
            link = None

    job_id = _extract_seek_job_id(link)
    if not job_id:
        return None

    for selector in ["[data-automation='jobCompany']", "[data-testid='job-company']", "[data-automation='advertiser-name']"]:
        try:
            company = _clean_text(card.find_element(By.CSS_SELECTOR, selector).text)
            if company:
                break
        except Exception:
            continue

    for selector in ["[data-automation='jobLocation']", "[data-testid='job-location']", "[data-automation='jobSuburb']"]:
        try:
            location = _clean_text(card.find_element(By.CSS_SELECTOR, selector).text)
            if location:
                break
        except Exception:
            continue

    return {
        "platform": "seek",
        "job_id": job_id,
        "title": title or f"SEEK job {job_id}",
        "company": company or "Unknown Company",
        "work_location": location or str(search_location or "Australia"),
        "job_link": _canonical_job_url(job_id),
    }


def _open_job_details(details: dict) -> None:
    driver.get(details["job_link"])
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    time.sleep(1.0)


def _capture_job_description() -> str | None:
    for selector in ["[data-automation='jobAdDetails']", "[data-automation='jobDescription']", "main"]:
        try:
            text = _clean_text(driver.find_element(By.CSS_SELECTOR, selector).text)
            if text and len(text) > 80:
                return text
        except Exception:
            continue
    return None


def _refine_details_from_page(details: dict) -> dict:
    refined = dict(details)
    title_selectors = ["h1[data-automation='job-detail-title']", "[data-automation='job-detail-title']", "h1"]
    company_selectors = ["[data-automation='advertiser-name']", "[data-automation='job-detail-company']", "a[data-automation='company-link']"]
    location_selectors = ["[data-automation='job-detail-location']", "[data-automation='job-location']"]

    for selector, key in [(title_selectors, "title"), (company_selectors, "company"), (location_selectors, "work_location")]:
        for css in selector:
            try:
                text = _safe_title(driver.find_element(By.CSS_SELECTOR, css).text) if key == "title" else _clean_text(driver.find_element(By.CSS_SELECTOR, css).text)
                if text:
                    refined[key] = text
                    break
            except Exception:
                continue

    current_id = _extract_seek_job_id(driver.current_url)
    if current_id:
        refined["job_id"] = current_id
        refined["job_link"] = _canonical_job_url(current_id)
    refined["job_description"] = _capture_job_description()
    return refined


def _has_quick_apply() -> bool:
    selectors = [
        "a[data-automation='job-detail-apply']",
        "button[data-automation='job-detail-apply']",
        "a[href*='/apply']",
        "button",
        "a",
    ]
    for selector in selectors:
        try:
            for node in driver.find_elements(By.CSS_SELECTOR, selector):
                if not node.is_displayed():
                    continue
                text = " ".join(
                    part
                    for part in [
                        _clean_text(node.text),
                        _clean_text(node.get_attribute("aria-label")),
                        _clean_text(node.get_attribute("href")),
                    ]
                    if part
                ).lower()
                if "quick apply" in text:
                    return True
        except Exception:
            continue
    return False


def _skip_reason(details: dict) -> str | None:
    haystack = " ".join(
        str(details.get(key) or "")
        for key in ["title", "company", "job_description"]
    ).lower()
    for word in bad_words or []:
        needle = str(word or "").strip().lower()
        if needle and needle in haystack:
            return f'Matched configured skip word "{word}"'
    return None


def _run_quick_apply(details: dict) -> dict:
    module = _load_seek_apply_module()
    job_url = _canonical_job_url(details["job_id"])

    def status_callback(message: str) -> None:
        cleaned = _clean_text(message)
        if cleaned:
            bot_status(f"SEEK apply: {cleaned}", status="running")

    result = module.run(
        job_url,
        headless=False,
        no_sandbox=False,
        keep_open=False,
        close_on_finish=False,
        config_overrides=_build_seek_apply_config(),
        job_context=details,
        status_callback=status_callback,
    )
    if not isinstance(result, dict):
        result = {"status": "stopped", "message": "SEEK apply flow finished without a structured result."}
    result.setdefault("job_url", job_url)
    return result


def check_login() -> None:
    driver.get("https://www.seek.com.au/")
    time.sleep(2)
    sync_status_widget(driver)
    if driver.find_elements(By.XPATH, "//a[contains(., 'Sign in') or contains(., 'Log in')]"):
        bot_status("Please sign into SEEK in the Chrome window if Quick Apply asks for it.", status="running")
    else:
        bot_status("Detected an active SEEK browser session.", status="running")


def apply_to_seek_jobs(terms: list[str]) -> None:
    global reviewed_count, quick_apply_count, failed_count, skip_count
    seen_job_ids: set[str] = set()

    ordered_terms = list(terms)
    if randomize_search_order:
        random.shuffle(ordered_terms)

    for term in ordered_terms:
        wait_if_bot_paused()
        bot_status(f'Searching SEEK for "{term}"...', status="running")
        driver.get(_seek_search_url(term))
        sync_status_widget(driver)

        try:
            cards = _wait_for_result_cards()
        except Exception as exc:
            failed_count += 1
            sync_stats_to_status()
            bot_status(f'SEEK results did not load for "{term}": {exc}', status="failed")
            continue

        limit = max(1, int(switch_number or 15))
        bot_status(f'Found {len(cards)} SEEK results for "{term}". Reviewing up to {limit}.', status="running")

        reviewed_for_term = 0
        for card in cards:
            wait_if_bot_paused()
            if reviewed_for_term >= limit:
                break

            details = _extract_from_card(card)
            if not details:
                skip_count += 1
                sync_stats_to_status()
                bot_status("Skipped one SEEK card because no job id was found.", status="running")
                continue

            if details["job_id"] in seen_job_ids:
                continue
            seen_job_ids.add(details["job_id"])
            reviewed_for_term += 1

            try:
                bot_status(f'Opening "{details["title"]}" at {details["company"]}...', status="running")
                _open_job_details(details)
                reviewed_count += 1
                details = _refine_details_from_page(details)

                reason = _skip_reason(details)
                if reason:
                    skip_count += 1
                    sync_stats_to_status()
                    bot_status(f'Skipping "{details["title"]}" at {details["company"]}: {reason}.', status="running")
                    continue

                if not _has_quick_apply():
                    skip_count += 1
                    sync_stats_to_status()
                    bot_status(f'Reviewed "{details["title"]}" at {details["company"]}", but it is not SEEK Quick Apply.', status="running")
                    continue

                bot_status(f'Quick Apply found. Handing job {details["job_id"]} to the SEEK apply bot...', status="running")
                result = _run_quick_apply(details)
                seek_status = str(result.get("status") or "stopped")
                message = str(result.get("message") or seek_status)

                if seek_status == "review":
                    quick_apply_count += 1
                    sync_stats_to_status()
                    bot_status(f'SEEK Quick Apply reached review for "{details["title"]}".', status="success")
                elif seek_status == "needs_login":
                    skip_count += 1
                    sync_stats_to_status()
                    bot_status(f'SEEK needs sign-in before applying to "{details["title"]}".', status="running")
                else:
                    failed_count += 1
                    sync_stats_to_status()
                    bot_status(f'SEEK Quick Apply stopped for "{details["title"]}": {message}', status="failed")

            except Exception as exc:
                failed_count += 1
                sync_stats_to_status()
                print_lg("Error processing SEEK result:", exc)
                bot_status(f'Error processing SEEK job {details.get("job_id")}: {exc}', status="failed")


def main():
    global driver, actions, wait, options, question_cache
    interrupted = False
    bot_status("Starting SEEK automation...", status="starting")
    try:
        apply_api_worker_config(globals())
        question_cache = QuestionCache()
        options, driver, actions, wait = open_chrome.initialize_chrome_session()
        bind_context(driver, actions)
        check_login()
        terms = search_terms or ["software engineer"]
        apply_to_seek_jobs(terms)
    except KeyboardInterrupt:
        interrupted = True
        bot_status("SEEK automation interrupted by user.", status="cancelled")
    except (NoSuchWindowException, WebDriverException, TimeoutException) as exc:
        bot_status(f"Browser closed or invalid session: {exc}", status="failed")
    except Exception as exc:
        critical_error_log("In SEEK Applier Main", exc)
        bot_status(f"Fatal SEEK automation error: {exc}", status="failed")
    finally:
        if not interrupted:
            bot_status("SEEK automation completed.", status="success")
        _shutdown_browser()


if __name__ == "__main__":
    main()
