import os
import re
from typing import Literal

import config.personals as personals
import config.search as search_config
from config.questions import default_resume_path
from modules.clickers_and_finders import find_by_class
from selenium.webdriver.common.by import By


_driver = None
_print_lg = None
_re_experience = re.compile(r'[(]?\s*(\d+)\s*[)]?\s*[-to]*\s*\d*[+]*\s*year[s]?', re.IGNORECASE)


def bind_context(driver=None, print_func=None) -> None:
    global _driver, _print_lg
    if driver is not None:
        _driver = driver
    if print_func is not None:
        _print_lg = print_func


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def extract_years_of_experience(text: str) -> int:
    matches = re.findall(_re_experience, text)
    if len(matches) == 0:
        _log(f'\n{text}\n\nCouldn\'t find experience requirement in About the Job!')
        return 0
    return max([int(match) for match in matches if int(match) <= 12])


def get_job_description(
) -> tuple[
    str | Literal['Unknown'],
    int | Literal['Unknown'],
    bool,
    str | None,
    str | None
]:
    '''
    Extract job description from About the Job.
    '''
    job_description = "Unknown"
    experience_required = "Unknown"
    skip = False
    skip_reason = None
    skip_message = None
    try:
        found_masters = 0
        job_description = find_by_class(_driver, "jobs-box__html-content").text
        _log(f"Captured job description length: {len(job_description.strip()) if isinstance(job_description, str) else 0}")
        job_description_low = job_description.lower()
        for word in search_config.bad_words:
            if word.lower() in job_description_low:
                skip_message = f'\n{job_description}\n\nContains bad word "{word}". Skipping this job!\n'
                skip_reason = "Found a Bad Word in About Job"
                skip = True
                break
        if not skip and personals.security_clearance == False and ('polygraph' in job_description_low or 'clearance' in job_description_low or 'secret' in job_description_low):
            skip_message = f'\n{job_description}\n\nFound "Clearance" or "Polygraph". Skipping this job!\n'
            skip_reason = "Asking for Security clearance"
            skip = True
        if not skip:
            if personals.did_masters and 'master' in job_description_low:
                _log(f'Found the word "master" in \n{job_description}')
                found_masters = 2
            experience_required = extract_years_of_experience(job_description)
            if personals.current_experience > -1 and experience_required > personals.current_experience + found_masters:
                skip_message = f'\n{job_description}\n\nExperience required {experience_required} > Current Experience {personals.current_experience + found_masters}. Skipping this job!\n'
                skip_reason = "Required experience is high"
                skip = True
    except Exception:
        if job_description == "Unknown":
            _log("Unable to extract job description!")
        else:
            experience_required = "Error in extraction"
            _log("Unable to extract years of experience required!")
    finally:
        return job_description, experience_required, skip, skip_reason, skip_message


def upload_resume(modal, resume: str) -> tuple[bool, str]:
    try:
        modal.find_element(By.NAME, "file").send_keys(os.path.abspath(resume))
        return True, os.path.basename(default_resume_path)
    except Exception:
        return False, "Previous resume"
