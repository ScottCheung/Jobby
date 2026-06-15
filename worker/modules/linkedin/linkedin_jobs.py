import config.search as search_config
from config.settings import click_gap, follow_companies
from modules.clickers_and_finders import find_by_class, scroll_to_view, try_find_by_classes, try_xp
from modules.linkedin.job_text_parser import first_non_empty_line, parse_company_location


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
    _wait_between(click_gap)
    return (job_id, title, company, work_location, work_style, skip)


def check_blacklist(rejected_jobs: set, job_id: str, company: str, blacklisted_companies: set):
    jobs_top_card = try_find_by_classes(_driver, ["job-details-jobs-unified-top-card__primary-description-container", "job-details-jobs-unified-top-card__primary-description", "jobs-unified-top-card__primary-description", "jobs-details__main-content"])
    about_company_org = find_by_class(_driver, "jobs-company__box")
    scroll_to_view(_driver, about_company_org)
    about_company_org = about_company_org.text
    about_company = about_company_org.lower()
    skip_checking = False
    for word in search_config.about_company_good_words:
        if word.lower() in about_company:
            _log(f'Found the word "{word}". So, skipped checking for blacklist words.')
            skip_checking = True
            break
    if not skip_checking:
        for word in search_config.about_company_bad_words:
            if word.lower() in about_company:
                rejected_jobs.add(job_id)
                blacklisted_companies.add(company)
                raise ValueError(f'\n"{about_company_org}"\n\nContains "{word}".')
    _wait_between(click_gap)
    scroll_to_view(_driver, jobs_top_card)
    return rejected_jobs, blacklisted_companies, jobs_top_card


def follow_company(modal=None) -> None:
    modal = modal or _driver
    try:
        follow_checkbox_input = try_xp(modal, ".//input[@id='follow-company-checkbox' and @type='checkbox']", False)
        if follow_checkbox_input and follow_checkbox_input.is_selected() != follow_companies:
            try_xp(modal, ".//label[@for='follow-company-checkbox']")
    except Exception as e:
        _log("Failed to update follow companies checkbox!", e)
