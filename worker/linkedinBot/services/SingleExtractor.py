from __future__ import annotations

from selenium.webdriver.common.by import By

from linkedinBot.services.job_text_parser import clean_linkedin_title, parse_company_location
from linkedinBot.services.linkedin_job_details import get_job_description


def extract_job(driver, job_url: str) -> dict:
    driver.get(job_url)

    title = "Unknown"
    company = "Unknown"
    work_location = "Unknown"
    work_style = None

    try:
        title = clean_linkedin_title(driver.title) or title
    except Exception:
        pass

    try:
        subtitle = driver.find_element(By.CLASS_NAME, "job-details-jobs-unified-top-card__primary-description").text
        company, work_location, work_style = parse_company_location(subtitle)
    except Exception:
        pass

    job_description, experience_required, _skip, _skip_reason, _skip_message = get_job_description()

    return {
        "platform": "linkedin",
        "job_link": job_url,
        "title": title,
        "company": company,
        "work_location": work_location,
        "work_style": work_style,
        "job_description": job_description,
        "experience_required": experience_required,
    }
