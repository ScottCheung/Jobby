import re

from shared_services.forms.clickers_and_finders import find_by_class, scroll_to_view, try_find_by_classes, try_xp
from shared_services.runtime import get_runtime_value
from linkedinBot.services.job_text_parser import first_non_empty_line, parse_company_location
from selenium.webdriver.common.by import By


_driver = None
_actions = None
_buffer = None
_print_lg = None
_discard_job = None


def bind_context(driver=None, actions=None, buffer_func=None, print_func=None, discard_job_func=None) -> None:
    global _driver, _actions, _buffer, _print_lg, _discard_job
    if driver is not None:
        _driver = driver
    if actions is not None:
        _actions = actions
    if buffer_func is not None:
        _buffer = buffer_func
    if print_func is not None:
        _print_lg = print_func
    if discard_job_func is not None:
        _discard_job = discard_job_func


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def _wait_between(speed: int = 0) -> None:
    if _buffer:
        _buffer(speed)


def get_job_main_details(job, blacklisted_companies: set, rejected_jobs: set) -> tuple[str, str, str, str, str, bool]:
    skip = False
    job_details_button = job.find_element("tag name", 'a')
    scroll_to_view(_driver, job_details_button, True)
    job_id = job.get_dom_attribute('data-occludable-job-id')
    title = first_non_empty_line(job_details_button.text)
    other_details = job.find_element("class name", 'artdeco-entity-lockup__subtitle').text
    company, work_location, work_style = parse_company_location(other_details)

    if company in blacklisted_companies:
        _log(f'Skipping "{title} | {company}" job (Blacklisted Company). Job ID: {job_id}!')
        skip = True
    elif job_id in rejected_jobs:
        _log(f'Skipping previously rejected "{title} | {company}" job. Job ID: {job_id}!')
        skip = True
    try:
        if job.find_element("class name", "job-card-container__footer-job-state").text == "Applied":
            skip = True
            _log(f'Already applied to "{title} | {company}" job. Job ID: {job_id}!')
    except Exception:
        pass
    try:
        if not skip:
            job_details_button.click()
    except Exception:
        _log(f'Failed to click "{title} | {company}" job on details button. Job ID: {job_id}!')
        if _discard_job:
            _discard_job()
        job_details_button.click()
    _wait_between(int(get_runtime_value("click_gap", 2)))
    work_location = refine_work_location(company, work_location)
    return (job_id, title, company, work_location, work_style, skip)


def refine_work_location(company: str, fallback_location: str) -> str:
    candidates: list[str] = []

    try:
        top_card = try_find_by_classes(
            _driver,
            [
                "job-details-jobs-unified-top-card__primary-description-container",
                "job-details-jobs-unified-top-card__primary-description",
                "jobs-unified-top-card__primary-description",
                "jobs-details__main-content",
            ],
        )
        if top_card and getattr(top_card, "text", None):
            candidates.extend(
                line.strip()
                for line in top_card.text.splitlines()
                if line and line.strip()
            )
    except Exception:
        pass

    try:
        bullet_nodes = _driver.find_elements(
            By.XPATH,
            "//*[contains(@class,'jobs-unified-top-card__bullet') or contains(@class,'tvm__text--low-emphasis')]",
        )
        candidates.extend(
            text.strip()
            for text in (node.text for node in bullet_nodes)
            if text and text.strip()
        )
    except Exception:
        pass

    normalized_company = (company or "").strip().lower()
    normalized_fallback = (fallback_location or "").strip().lower()

    for candidate in candidates:
        text = " ".join(candidate.split())
        if not text:
            continue

        lowered = text.lower()
        if lowered in {"unknown", normalized_company, normalized_fallback}:
            continue
        if any(
            token in lowered
            for token in (" ago", "applicant", "reposted", "promoted", "match", "alumni")
        ):
            continue

        parsed_company, parsed_location, _parsed_style = parse_company_location(text)
        if (
            parsed_location != "Unknown"
            and parsed_location.lower() != normalized_company
            and parsed_location.lower() != normalized_fallback
        ):
            return parsed_location

        # Fallback: keep a clean location-like line even if LinkedIn omitted the company separator.
        if re.search(r"[A-Za-z]", text) and "," in text and normalized_company not in lowered:
            return text

    return fallback_location


def check_blacklist(rejected_jobs: set, job_id: str, company: str, blacklisted_companies: set):
    jobs_top_card = try_find_by_classes(_driver, ["job-details-jobs-unified-top-card__primary-description-container", "job-details-jobs-unified-top-card__primary-description", "jobs-unified-top-card__primary-description", "jobs-details__main-content"])
    about_company_org = find_by_class(_driver, "jobs-company__box")
    scroll_to_view(_driver, about_company_org)
    about_company_org = about_company_org.text
    about_company = about_company_org.lower()
    skip_checking = False
    for word in list(get_runtime_value("about_company_good_words", []) or []):
        if word.lower() in about_company:
            _log(f'Found the word "{word}". So, skipped checking for blacklist words.')
            skip_checking = True
            break
    if not skip_checking:
        for word in list(get_runtime_value("about_company_bad_words", []) or []):
            if word.lower() in about_company:
                rejected_jobs.add(job_id)
                blacklisted_companies.add(company)
                raise ValueError(f'\n"{about_company_org}"\n\nContains "{word}".')
    _wait_between(int(get_runtime_value("click_gap", 2)))
    scroll_to_view(_driver, jobs_top_card)
    return rejected_jobs, blacklisted_companies, jobs_top_card


def follow_company(modal=None) -> None:
    modal = modal or _driver
    try:
        follow_checkbox_input = try_xp(modal, ".//input[@id='follow-company-checkbox' and @type='checkbox']", False)
        if follow_checkbox_input and follow_checkbox_input.is_selected() != bool(get_runtime_value("follow_companies", False)):
            try_xp(modal, ".//label[@for='follow-company-checkbox']")
    except Exception as e:
        _log("Failed to update follow companies checkbox!", e)
