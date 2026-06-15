import csv
from datetime import datetime
from typing import Literal

import pyautogui
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from config.settings import close_tabs, easy_apply_only, failed_file_name, file_name, logs_folder_path
from modules.clickers_and_finders import wait_span_click
from modules.helpers import truncate_for_csv
from modules.linkedin.linkedin_status import bot_status, wait_if_bot_paused
from modules.persistence import ApplicationLogger


_driver = None
_actions = None
_wait = None
_print_lg = None
_application_logger = None
_linkedIn_tab = None
_tabs_count = 1
_dailyEasyApplyLimitReached = False


def bind_context(driver=None, actions=None, wait=None, print_func=None, application_logger=None) -> None:
    global _driver, _actions, _wait, _print_lg, _application_logger
    if driver is not None:
        _driver = driver
    if actions is not None:
        _actions = actions
    if wait is not None:
        _wait = wait
    if print_func is not None:
        _print_lg = print_func
    if application_logger is not None:
        _application_logger = application_logger


def set_runtime_state(linkedin_tab=None, tabs_count=None, daily_easy_apply_limit_reached=None) -> None:
    global _linkedIn_tab, _tabs_count, _dailyEasyApplyLimitReached
    if linkedin_tab is not None:
        _linkedIn_tab = linkedin_tab
    if tabs_count is not None:
        _tabs_count = tabs_count
    if daily_easy_apply_limit_reached is not None:
        _dailyEasyApplyLimitReached = daily_easy_apply_limit_reached


def get_runtime_state() -> tuple[int, bool]:
    return _tabs_count, _dailyEasyApplyLimitReached


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def external_apply(pagination_element: WebElement, job_id: str, job_link: str, resume: str, date_listed, application_link: str, screenshot_name: str) -> tuple[bool, str, int, bool]:
    global _tabs_count, _dailyEasyApplyLimitReached
    wait_if_bot_paused()
    bot_status(f"Checking external application link for job {job_id}...")
    if easy_apply_only:
        try:
            if "exceeded the daily application limit" in _driver.find_element("class name", "artdeco-inline-feedback__message").text:
                _dailyEasyApplyLimitReached = True
        except Exception:
            pass
        bot_status(f"Skipping job {job_id}: Easy Apply did not start.")
        _log("Easy apply failed I guess!")
        if pagination_element is not None:
            return True, application_link, _tabs_count, _dailyEasyApplyLimitReached
    try:
        wait_if_bot_paused()
        bot_status(f"Opening external application for job {job_id}...")
        _wait.until(EC.element_to_be_clickable(("xpath", ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3')]"))).click()
        wait_span_click(_driver, "Continue", 1, True, False)
        windows = _driver.window_handles
        _tabs_count = len(windows)
        _driver.switch_to.window(windows[-1])
        application_link = _driver.current_url
        bot_status(f"Captured external application link for job {job_id}.")
        _log('Got the external application link "{}"'.format(application_link))
        if close_tabs and _driver.current_window_handle != _linkedIn_tab:
            _driver.close()
        _driver.switch_to.window(_linkedIn_tab)
        return False, application_link, _tabs_count, _dailyEasyApplyLimitReached
    except Exception as e:
        bot_status(f"Failed to open external application for job {job_id}.")
        _log("Failed to apply!")
        failed_job(job_id, job_link, resume, date_listed, "Probably didn't find Apply button or unable to switch tabs.", e, application_link, screenshot_name)
        return True, application_link, _tabs_count, _dailyEasyApplyLimitReached


def failed_job(job_id: str, job_link: str, resume: str, date_listed, error: str, exception: Exception, application_link: str, screenshot_name: str,
               title: str = "Unknown", company: str = "Unknown", search_term: str = "Unknown", work_location: str = "Unknown",
               questions_list: set | None = None, work_style: str = "Unknown") -> None:
    try:
        with open(failed_file_name, "a", newline="", encoding="utf-8") as file:
            fieldnames = ["Job ID", "Job Link", "Resume Tried", "Date listed", "Date Tried", "Assumed Reason", "Stack Trace", "External Job link", "Screenshot Name"]
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            if file.tell() == 0:
                writer.writeheader()
            writer.writerow({
                "Job ID": truncate_for_csv(job_id),
                "Job Link": truncate_for_csv(job_link),
                "Resume Tried": truncate_for_csv(resume),
                "Date listed": truncate_for_csv(date_listed),
                "Date Tried": datetime.now(),
                "Assumed Reason": truncate_for_csv(error),
                "Stack Trace": truncate_for_csv(exception),
                "External Job link": truncate_for_csv(application_link),
                "Screenshot Name": truncate_for_csv(screenshot_name),
            })
    except Exception as e:
        _log("Failed to update failed jobs list!", e)
        pyautogui.alert("Failed to update the excel of failed jobs!\nProbably because of 1 of the following reasons:\n1. The file is currently open or in use by another program\n2. Permission denied to write to the file\n3. Failed to find the file", "Failed Logging")

    try:
        _application_logger.log_application({
            "job_id": job_id,
            "title": title,
            "company": company,
            "job_link": job_link,
            "external_application_link": application_link,
            "application_type": "easy_apply" if application_link == "Easy Applied" else "external",
            "status": "failed",
            "search_term": search_term,
            "work_location": work_location,
            "work_style": work_style,
            "resume": resume,
            "date_posted": str(date_listed),
            "date_applied": None,
            "questions": ApplicationLogger.format_questions(questions_list),
            "screenshot": screenshot_name,
            "error": str(error),
            "stack_trace": str(exception),
        })
    except Exception as e:
        _log("Failed to update JSON application log for failed job!", e)


def screenshot(job_id: str, failed_at: str) -> str:
    screenshot_name = "{} - {} - {}.png".format(job_id, failed_at, str(datetime.now()))
    path = logs_folder_path + "/screenshots/" + screenshot_name.replace(":", ".")
    _driver.save_screenshot(path.replace("//", "/"))
    return screenshot_name


def submitted_jobs(job_id: str, title: str, company: str, work_location: str, work_style: str, description: str, experience_required: int | Literal["Unknown", "Error in extraction"],
                   skills: list[str] | Literal["In Development"], hr_name: str | Literal["Unknown"], hr_link: str | Literal["Unknown"], resume: str,
                   reposted: bool, date_listed: datetime | Literal["Unknown"], date_applied: datetime | Literal["Pending"], job_link: str, application_link: str,
                   questions_list: set | None, connect_request: Literal["In Development"], search_term: str = "Unknown") -> None:
    try:
        with open(file_name, mode="a", newline="", encoding="utf-8") as csv_file:
            fieldnames = ["Job ID", "Title", "Company", "Work Location", "Work Style", "About Job", "Experience required", "Skills required", "HR Name", "HR Link", "Resume", "Re-posted", "Date Posted", "Date Applied", "Job Link", "External Job link", "Questions Found", "Connect Request"]
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            if csv_file.tell() == 0:
                writer.writeheader()
            writer.writerow({
                "Job ID": truncate_for_csv(job_id),
                "Title": truncate_for_csv(title),
                "Company": truncate_for_csv(company),
                "Work Location": truncate_for_csv(work_location),
                "Work Style": truncate_for_csv(work_style),
                "About Job": truncate_for_csv(description),
                "Experience required": truncate_for_csv(experience_required),
                "Skills required": truncate_for_csv(skills),
                "HR Name": truncate_for_csv(hr_name),
                "HR Link": truncate_for_csv(hr_link),
                "Resume": truncate_for_csv(resume),
                "Re-posted": truncate_for_csv(reposted),
                "Date Posted": truncate_for_csv(date_listed),
                "Date Applied": truncate_for_csv(date_applied),
                "Job Link": truncate_for_csv(job_link),
                "External Job link": truncate_for_csv(application_link),
                "Questions Found": truncate_for_csv(questions_list),
                "Connect Request": truncate_for_csv(connect_request),
            })
    except Exception as e:
        _log("Failed to update submitted jobs list!", e)
        pyautogui.alert("Failed to update the excel of applied jobs!\nProbably because of 1 of the following reasons:\n1. The file is currently open or in use by another program\n2. Permission denied to write to the file\n3. Failed to find the file", "Failed Logging")

    try:
        _application_logger.log_application({
            "job_id": job_id,
            "title": title,
            "company": company,
            "job_link": job_link,
            "external_application_link": application_link,
            "application_type": "easy_apply" if application_link == "Easy Applied" else "external",
            "status": "submitted",
            "search_term": search_term,
            "work_location": work_location,
            "work_style": work_style,
            "experience_required": experience_required,
            "skills": skills,
            "description": description,
            "hr_name": hr_name,
            "hr_link": hr_link,
            "resume": resume,
            "reposted": reposted,
            "date_posted": str(date_listed),
            "date_applied": str(date_applied),
            "questions": ApplicationLogger.format_questions(questions_list),
            "connect_request": connect_request,
            "screenshot": None,
            "error": None,
        })
    except Exception as e:
        _log("Failed to update JSON application log!", e)


def discard_job() -> None:
    _actions.send_keys(Keys.ESCAPE).perform()
    wait_span_click(_driver, "Discard", 2)
