import re
import time
from typing import Iterable
from html import unescape
from urllib.parse import urlparse

from selenium.webdriver.common.by import By


_TECH_KEYWORDS = [
    "python", "java", "javascript", "typescript", "c#", "c++", "golang", "go", "ruby", "php", "scala",
    "kotlin", "swift", "rust", "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "sqlite",
    "oracle", "snowflake", "bigquery", "dynamodb", "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "ansible", "jenkins", "github actions", "gitlab ci", "ci/cd", "linux", "unix", "bash", "powershell",
    "react", "next.js", "nextjs", "vue", "angular", "node.js", "nodejs", "express", "django", "flask", "laravel",
    "fastapi", "spring", "spring boot", ".net", "asp.net", "rest", "graphql", "microservices", "api", "apis",
    "selenium", "playwright", "pytest", "jest", "cypress", "storybook", "html", "css", "sass", "tailwind",
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "machine learning", "data engineering",
    "airflow", "spark", "hadoop", "etl", "nlp", "llm", "openai", "deepseek", "langchain", "rag",
    "json", "xml", "technical support", "microsoft word", "low-code", "no-code", "automation", "ai",
]

_SKILL_BLACKLIST = {
    "functions",
    "the ability to collaborate across teams",
    "excellent communication skills",
    "backend development best practices",
    "within a growing",
    "fast-paced environment",
    "growing",
    "environment",
    "retail discounts",
    "training",
    "you’ll thrive here",
    "you'll thrive here",
    "such as java",
    "lead proof-of-concept",
    "experimentation initiatives",
    "deploying ai",
    "no-code platforms (e",
    "no-code tools (e",
    "logs",
}

_NON_TECH_SKILLS = {
    "technical support",
    "microsoft word",
}


def clean_text(value: object | None) -> str | None:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def extract_seek_job_id(value: object | None) -> str:
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


def canonical_seek_job_url(job_id: str) -> str:
    return f"https://au.seek.com/job/{job_id}"


def _first_text(driver, selectors: Iterable[str]) -> str | None:
    for selector in selectors:
        try:
            text = clean_text(driver.find_element(By.CSS_SELECTOR, selector).text)
            if text:
                return text
        except Exception:
            continue
    return None


def _extract_job_description(driver) -> str | None:
    selectors = [
        "[data-automation='jobAdDetails']",
        "[data-automation='jobDescription']",
        "[data-testid='job-details']",
        "main",
    ]
    for selector in selectors:
        try:
            text = clean_text(driver.find_element(By.CSS_SELECTOR, selector).text)
            if text and len(text) > 80:
                return text
        except Exception:
            continue
    return None


def _extract_salary(driver, description: str | None = None) -> str | None:
    salary = _first_text(
        driver,
        [
            "[data-automation='job-detail-salary']",
            "[data-testid='job-salary']",
            "[data-automation='jobSalary']",
        ],
    )
    if salary:
        return salary

    haystack = description or ""
    salary_patterns = [
        r"\$\s?\d[\d,]*(?:\.\d+)?\s*(?:-\s*\$?\s?\d[\d,]*(?:\.\d+)?)?\s*(?:per\s+(?:year|annum|hour|day)|/hour|/hr|/day|/year|k\b)?",
        r"\b\d{2,3}k(?:\s*-\s*\d{2,3}k)?\b",
    ]
    for pattern in salary_patterns:
        match = re.search(pattern, haystack, flags=re.IGNORECASE)
        if match:
            return clean_text(match.group(0))
    return None


def _extract_work_style(driver, description: str | None = None) -> str | None:
    work_style = _first_text(
        driver,
        [
            "[data-automation='job-detail-work-type']",
            "[data-testid='job-work-type']",
        ],
    )
    if work_style:
        return work_style

    haystack = (description or "").lower()
    for label in ("remote", "hybrid", "on-site", "onsite"):
        if label in haystack:
            return "on-site" if label == "onsite" else label
    return None


def _normalize_skill(skill: str) -> str:
    value = clean_text(skill) or ""
    lowered = value.lower()
    alias_map = {
        "postgres": "postgresql",
        "go": "golang",
        "nodejs": "node.js",
        "nextjs": "next.js",
        "next": "next.js",
        "node": "node.js",
        "react (typescript preferred)": "react",
        "typescript preferred": "typescript",
        "api": "apis",
        "rest api": "apis",
        "rest apis": "apis",
        "third-party apis": "apis",
        "3rd-party apis": "apis",
        "restful apis": "apis",
        "automation tools": "automation",
        "artificial intelligence": "ai",
    }
    return alias_map.get(lowered, lowered)


def _looks_like_skill(value: str) -> bool:
    text = clean_text(value) or ""
    lowered = text.lower()
    if len(text) < 2 or len(text) > 30:
        return False
    if lowered in _SKILL_BLACKLIST:
        return False
    if re.search(r"\b(ability|collaborate|communication|functions|experience|environment|growing|preferred strong)\b", lowered):
        return False
    if not re.search(r"[.+#/]|[0-9]", text) and len(text.split()) > 3:
        return False
    return bool(re.search(r"[a-z]", lowered))


def _extract_skills(description: str | None) -> list[str]:
    if not description:
        return []

    lowered = f" {description.lower()} "
    found: list[str] = []
    for keyword in _TECH_KEYWORDS:
        pattern = rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])"
        if re.search(pattern, lowered):
            found.append(keyword)

    normalized: list[str] = []
    seen: set[str] = set()
    for skill in found:
        canonical = _normalize_skill(skill)
        if not _looks_like_skill(canonical):
            continue
        if canonical in _NON_TECH_SKILLS:
            continue
        if canonical not in seen:
            seen.add(canonical)
            normalized.append(canonical)
    return normalized


def _extract_location_from_description(description: str | None) -> str | None:
    if not description:
        return None
    patterns = [
        r"\b([A-Z][A-Za-z ]+,\s*[A-Z][A-Za-z ]+\s+NSW)\b",
        r"\b([A-Z][A-Za-z ]+,\s*[A-Z][A-Za-z ]+\s+VIC)\b",
        r"\b([A-Z][A-Za-z ]+,\s*[A-Z][A-Za-z ]+\s+QLD)\b",
        r"\b([A-Z][A-Za-z ]+,\s*[A-Z][A-Za-z ]+\s+WA)\b",
        r"\b([A-Z][A-Za-z ]+,\s*[A-Z][A-Za-z ]+\s+SA)\b",
        r"\b([A-Z][A-Za-z ]+,\s*[A-Z][A-Za-z ]+\s+ACT)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, description)
        if match:
            return clean_text(match.group(1))
    return None


def _extract_experience_requirement(description: str | None) -> tuple[int | None, str | None]:
    if not description:
        return None, None

    patterns = [
        r"(?P<raw>\bminimum\s+\d+\+?\s+year(?:s)?(?:\s+of)?(?:\s+hands-on)?\s+[a-z0-9\s./+-]*?experience\b)",
        r"(?P<raw>\b\d+\+?\s+year(?:s)?(?:\s+of)?(?:\s+hands-on)?\s+[a-z0-9\s./+-]*?experience\b)",
        r"(?P<raw>\b\d+\+?\s+year(?:s)?\s+experience\b)",
    ]

    for pattern in patterns:
        match = re.search(pattern, description, flags=re.IGNORECASE)
        if not match:
            continue
        raw_text = clean_text(match.group("raw"))
        years_match = re.search(r"(\d+)", raw_text or "")
        years = int(years_match.group(1)) if years_match else None
        return years, raw_text

    return None, None


def extract_seek_job_details(driver, job_url: str, settle_seconds: float = 2.0) -> dict:
    driver.get(job_url)
    time.sleep(settle_seconds)

    title = _first_text(
        driver,
        ["h1[data-automation='job-detail-title']", "[data-automation='job-detail-title']", "h1"],
    )
    company = _first_text(
        driver,
        ["[data-automation='advertiser-name']", "[data-automation='job-detail-company']", "a[data-automation='company-link']"],
    )
    work_location = _first_text(
        driver,
        [
            "[data-automation='job-detail-location']",
            "[data-automation='job-location']",
            "span[data-automation='job-detail-location']",
            "a[data-automation='job-detail-location']",
        ],
    )
    job_description = _extract_job_description(driver)
    if not work_location:
        work_location = _extract_location_from_description(job_description)
    salary = _extract_salary(driver, job_description)
    work_style = _extract_work_style(driver, job_description)
    experience_years, experience_requirement_text = _extract_experience_requirement(job_description)

    current_url = clean_text(driver.current_url) or job_url
    job_id = extract_seek_job_id(current_url) or extract_seek_job_id(job_url)
    canonical_url = canonical_seek_job_url(job_id) if job_id else current_url

    return {
        "platform": "seek",
        "job_id": job_id or None,
        "title": title or "Unknown",
        "company": company or "Unknown",
        "work_location": work_location or "Unknown",
        "work_style": work_style,
        "job_link": canonical_url,
        "job_description": job_description,
        "salary": salary,
        "experience_years": experience_years,
        "experience_requirement_text": experience_requirement_text,
        "skills": _extract_skills(job_description),
    }


def extract_seek_job_details_from_html(html: str, job_url: str) -> dict:
    text = html or ""

    def extract_meta(patterns: list[str]) -> str | None:
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
            if match:
                return clean_text(match.group(1))
        return None

    def extract_html_block(patterns: list[str]) -> str | None:
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
            if not match:
                continue
            block = match.group(1)
            block = unescape(block)
            block = re.sub(r"<script[\s\S]*?</script>", " ", block, flags=re.IGNORECASE)
            block = re.sub(r"<style[\s\S]*?</style>", " ", block, flags=re.IGNORECASE)
            block = re.sub(r"<[^>]+>", " ", block)
            block = block.replace("\\n", " ").replace("&nbsp;", " ")
            cleaned = clean_text(block)
            if cleaned:
                return cleaned
        return None

    title = extract_meta([
        r'"jobTitle"\s*:\s*"([^"]+)"',
        r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"',
        r"<title>([^<]+)</title>",
    ])
    company = extract_meta([
        r'"hiringOrganization"\s*:\s*\{[^{}]*"name"\s*:\s*"([^"]+)"',
        r'"advertiser-name"[^>]*>\s*([^<]+)\s*<',
    ])
    work_location = extract_meta([
        r'>\s*([A-Za-z0-9 .,-]+,\s*[A-Za-z ]+(?:NSW|VIC|QLD|WA|SA|ACT))\s*<',
        r'data-automation="job-detail-location"[\s\S]{0,200}?>([^<]+)<',
        r'"location"\s*:\s*"([^"]+)"',
    ])
    salary = extract_meta([
        r'(\$\s?\d[\d,]*(?:\.\d+)?\s*[–-]\s*\$?\s?\d[\d,]*(?:\.\d+)?\s*per\s+year)',
        r'"baseSalary"[\s\S]*?"value"[\s\S]*?"minValue"\s*:\s*"?([^,"}]+)',
    ])

    description = extract_html_block([
        r'<div[^>]+data-automation="jobAdDetails"[^>]*>([\s\S]*?)</div>\s*</div>\s*</div>',
        r'<div[^>]+data-automation="jobAdDetails"[^>]*>([\s\S]*?)</div>',
    ])

    if not description:
        description = extract_meta([
            r'"description"\s*:\s*"(.+?)"\s*,\s*"identifier"',
        ])
        if description:
            description = unescape(description)
            description = re.sub(r"<[^>]+>", " ", description)
            description = description.replace("\\n", " ").replace("&nbsp;", " ")
            description = clean_text(description)

    experience_years, experience_requirement_text = _extract_experience_requirement(description)
    if not work_location:
        work_location = _extract_location_from_description(description)
    job_id = extract_seek_job_id(job_url)

    return {
        "platform": "seek",
        "job_id": job_id or None,
        "title": title or "Unknown",
        "company": company or "Unknown",
        "work_location": work_location or "Unknown",
        "work_style": None,
        "job_link": canonical_seek_job_url(job_id) if job_id else job_url,
        "job_description": description,
        "salary": salary,
        "experience_years": experience_years,
        "experience_requirement_text": experience_requirement_text,
        "skills": _extract_skills(description),
    }
