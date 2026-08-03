"""Resume text extraction and strict normalisation for the master resume."""

from __future__ import annotations

import json
import logging
import re
from copy import deepcopy
from io import BytesIO
from typing import Any

from pypdf import PdfReader

from services.shared.deepseek import DeepSeekError, _complete


logger = logging.getLogger(__name__)


class ResumeParseError(ValueError):
    pass


RESUME_SCHEMA = {
    "basics": {
        "first_name": None,
        "middle_name": None,
        "last_name": None,
        "email": None,
        "phone": None,
        "location": {"city": None, "state": None, "country": None, "postal_code": None},
        "linkedin_id": None,
        "website": None,
        "portfolio_url": None,
    },
    "summary": None,

    "experience": [
        {
            "company": None,
            "title": None,
            "location": None,
            "start_date": None,
            "end_date": None,
            "description": [],
            "technologies": [],
        }
    ],
       "projects": [
        {
            "name": None,
            "url": None,
            "start_date": None,
            "end_date": None,
            "description": [],
            "technologies": [],
        }
    ],
    "education": [
        {
            "institution": None,
            "degree": None,
            "field_of_study": None,
            "location": None,
            "start_date": None,
            "end_date": None,
            "highlights": [],
        }
    ],
    "skills": [{"type": None, "skills": []}],
    "certifications": [
        {
            "type": None,
            "certifications": [
                {
                    "name": None,
                    "issuer": None,
                    "issue_date": None,
                    "expiry_date": None,
                    "credential_url": None,
                }
            ],
        }
    ],
    "links": [{"type": None, "link": None}],
    "languages": [{"name": None, "proficiency": None}],
    "other": [{"type": None, "title": None, "organization": None, "location": None, "date": None, "description": []}],
    "search_terms": [],
}

RESUME_PROMPT = (
    "Extract factual resume data from the supplied text as one compact JSON object only.\n"
    "Rules:\n"
    "- Never invent, silently correct, translate, or modernize source text. Preserve names, titles, certificate names, technologies, and spelling exactly as written.\n"
    "- Omit missing fields entirely.\n"
    "- Classify content by its nearest section heading. A field label inside a section does not start a new top-level section.\n"
    "- Keep the order of experience, education, and projects.\n"
    "- Experience: title is the exact role, company is the employer, location is the place, dates go to start_date/end_date, Description text and bullets go to description, and Technologies goes to technologies.\n"
    "- Projects: preserve name, the first project URL, dates, Description text plus bullets, and every item under Technologies. Never drop labeled Description or Technologies lines.\n"
    "- Education: degree is only the qualification (for example Bachelor of Science); field_of_study is only the major/discipline (for example Computer Science). Split combined text such as 'Bachelor of Science in Computer Science'. Preserve institution, location, and dates.\n"
    "- Extract dates exactly as written, including YYYY.MM, MM.YYYY, YYYY-MM, month-name, and inline ranges such as '2022.02 - 2023.12 Institution' or 'Company 04.2023 - 07.2023 Role'.\n"
    "- Repair obvious PDF line-wrap splits such as 'plat-\\nform' into 'platform', but do not otherwise rewrite sentences.\n"
    "- Do not merge multiple job titles or multiple bullet items into one string.\n"
    "- Ignore resume-template instructions or coaching text such as 'Tip to jobseeker'.\n"
    "- Put a section named Projects, Projects and Merits, Selected Projects, or similar in projects, including talks, research projects, hackathons, and awards listed in that section.\n"
    "- Put courses, workshops, and extra-curricular education in other with type Professional Development, not in projects.\n"
    "- For extracurricular activities, use type Extracurricular Activities and retain the organization, role/title, location, and date when present.\n"
    "- Put volunteering, awards, publications, extracurricular activities, interests, and other uncategorized resume sections in other.\n"
    "- skills entries must be atomic tags; split comma-separated, slash-separated, and ampersand-separated skill strings into separate tags.\n"
    "- A Languages group inside Skills means programming languages and belongs only in skills. languages is exclusively for human/spoken languages explicitly indicated by words such as Spoken Languages, Fluent, Native, C1, or bilingual.\n"
    "- Use linkedin_id only, never a full LinkedIn URL.\n"
    "- links must be [{type, link}].\n"
    "- skills must be [{type, skills:[...]}].\n"
    "- certifications must be [{type, certifications:[{name, issuer, issue_date, expiry_date, credential_url}]}].\n"
    "- languages must include both name and proficiency when present, for example {\"name\":\"English\",\"proficiency\":\"C1 - Advanced\"}.\n"
    "- search_terms is required: include 3 to 8 concise job titles inferred only from the candidate's recent experience, headline, and skills.\n"
    "- Use exactly the supplied schema's top-level keys and nested field names; do not create aliases or extra keys.\n"
    "- Use Other for uncategorized skills or certifications.\n"
    "- basics may include first_name, middle_name, last_name, email, phone, location, linkedin_id, website, portfolio_url, headline.\n"
)


RESUME_COMPACT_PROMPT = """Extract factual resume data as compact JSON. Preserve source spelling, order, and section classification; never invent, correct, translate, or merge items. Omit missing fields.
Schema:
basics{first_name,middle_name,last_name,email,phone,location{city,state,country,postal_code},linkedin_id,website,portfolio_url,headline}; summary; experience[]{company,title,location,start_date,end_date,description,technologies[]}; projects[]{name,url,start_date,end_date,description,technologies[]}; education[]{institution,degree,field_of_study,location,start_date,end_date,highlights}; skills[]{type,skills[]}; certifications[]{type,certifications[]{name,issuer,issue_date,expiry_date,credential_url}}; links[]{type,link}; languages[]{name,proficiency}; other[]{type,title,organization,location,date,description}; search_terms[].
The resume is supplied as numbered lines. For summary, description, and highlights, return {"line_ids":[...]} instead of copying source text whenever possible. Each item may be one line number or an array of line numbers that form one wrapped paragraph/bullet. Return literal text only when line references cannot represent the value accurately.
Rules:
- Experience: exact role->title, employer->company, place->location, and exact dates. Project and education fields follow their nearest heading. In education, degree is the qualification only and field_of_study is the major/discipline only; split combined qualifications such as "Bachelor of Science in Computer Science".
- Preserve date text in numeric, month-name, and inline ranges; a date range may precede an institution. Description text, job titles, and bullets stay separate and complete. Technologies are atomic tags. Split comma, slash, semicolon, pipe, and ampersand separated skills.
- Projects/Selected Projects/Projects and Merits include talks, research, hackathons, and awards in that section. Courses/workshops go to other(type=Professional Development). Volunteering, awards, publications, activities, and interests go to other.
- Extracurricular activities use other(type=Extracurricular Activities) and retain organization, title, location, and date.
- A Languages group inside Skills is programming skills. languages is only explicitly spoken/human languages with proficiency cues.
- Use the LinkedIn slug as linkedin_id. links is [{type,link}]. Use Other for uncategorized skill/certification groups.
- search_terms is required: 3-8 concise job titles inferred only from recent experience, headline, and skills.
- Ignore template coaching text. Return only the specified keys and valid JSON."""


_TOP_LEVEL_SECTION_HEADINGS = {
    "experience": {"experience", "workexperience", "professionalexperience", "employmenthistory", "workhistory"},
    "projects": {"projects", "selectedprojects", "projectsandmerits", "projectsachievements"},
    "education": {"education", "academicbackground", "academicqualifications"},
    "skills": {"skills", "technicalskills", "skillsandinterests", "coreskills"},
    "certifications": {"certifications", "licensesandcertifications", "certificates"},
    "languages": {"languages", "spokenlanguages"},
}

_COACHING_LINE_RE = re.compile(
    r"^(?:tip\s+to\s+(?:the\s+)?jobseeker|references\s+available\s+upon\s+request)\b",
    re.IGNORECASE,
)


class _OptimizedParseRejected(ValueError):
    pass


def _text(value: Any, limit: int = 2000) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:limit] or None


_LEADING_LIST_MARKER_RE = re.compile(
    r"^\s*(?:(?:[-*·•●▪◦‣–—]+\s*)|(?:\d{1,3}[.)](?:\s+|(?=[A-Z]))))+"
)


def _strip_list_marker(value: str) -> str:
    return _LEADING_LIST_MARKER_RE.sub("", value).strip()


def _has_list_marker(value: str) -> bool:
    return bool(_LEADING_LIST_MARKER_RE.match(value))


_DEGREE_PREFIX_RE = re.compile(
    r"^(?:associate(?:'s)?|bachelor(?:'s)?|master(?:'s)?|doctor(?:ate)?|ph\.?d\.?|"
    r"diploma|certificate|b\.?a\.?|b\.?s\.?c?\.?|b\.?eng\.?|m\.?a\.?|m\.?s\.?c?\.?|"
    r"m\.?eng\.?|mba)(?=\s|$)",
    re.IGNORECASE,
)


def _split_education_qualification(
    degree: str | None,
    field_of_study: str | None,
) -> tuple[str | None, str | None]:
    """Split a combined qualification only when the source has a clear boundary."""
    if degree and field_of_study:
        return degree, field_of_study
    combined = degree or field_of_study
    if not combined or not _DEGREE_PREFIX_RE.match(combined):
        return degree, field_of_study

    patterns = (
        r"^(?P<degree>.+?)\s+(?:in|major(?:ed)?\s+in)\s+(?P<field>.+)$",
        r"^(?P<degree>.+?)\s*[,|–—]\s*(?P<field>.+)$",
        r"^(?P<degree>.+?)\s+-\s+(?P<field>.+)$",
        r"^(?P<degree>.+?)\s*\((?P<field>[^()]+)\)\s*$",
        r"^(?P<degree>(?:B|M)\.?(?:A|S|Sc|Eng)\.?)\s+(?P<field>.+)$",
    )
    for pattern in patterns:
        match = re.match(pattern, combined, flags=re.IGNORECASE)
        if not match:
            continue
        split_degree = match.group("degree").strip()
        split_field = match.group("field").strip()
        if split_degree and split_field and _DEGREE_PREFIX_RE.match(split_degree):
            return split_degree, split_field
    return degree, field_of_study


def _list_of_text(value: Any, limit: int = 50, item_limit: int = 1000) -> list[str]:
    if isinstance(value, str):
        value = re.split(r"[\n\r•·\u2022]+", value)
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for raw in value[:limit]:
        item = _text(raw, item_limit)
        if item:
            item = _strip_list_marker(item)
        if item and item not in result:
            result.append(item)
    return result


def _split_skill_text(value: Any) -> list[str]:
    if not isinstance(value, str):
        return []
    parts = re.split(r"(?:\s*/\s*|,\s*|;\s*|\|\s*|&\s*|\n+)", value)
    result: list[str] = []
    for part in parts:
        item = part.strip(" -•\t")
        if item and item not in result:
            result.append(item)
    return result


def _skill_values(value: Any) -> list[str]:
    if isinstance(value, list):
        result: list[str] = []
        for raw in value:
            if isinstance(raw, str):
                for item in _split_skill_text(raw):
                    if item not in result:
                        result.append(item)
            else:
                item = _text(raw, 100)
                if item and item not in result:
                    result.append(item)
        return result
    if isinstance(value, str):
        return _split_skill_text(value)
    return []


def _bullet_values(value: Any) -> list[str]:
    if isinstance(value, str):
        value = re.split(r"[\n\r•·\u2022]+", value)
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for raw in value[:50]:
        item = _text(raw, 1000)
        if item:
            item = _strip_list_marker(item)
        if item and item not in result:
            result.append(item)
    return result


def _normalise_location(value: Any) -> dict:
    value = value if isinstance(value, dict) else {}
    location = {
        "city": _text(value.get("city"), 255),
        "state": _text(value.get("state"), 100),
        "country": _text(value.get("country"), 100),
        "postal_code": _text(value.get("postal_code"), 50),
    }
    return {key: item for key, item in location.items() if item}


def _clean_dict_fields(source: dict[str, Any], fields: list[str], limit: int = 255) -> dict[str, str]:
    result: dict[str, str] = {}
    for field in fields:
        value = _text(source.get(field), limit)
        if value:
          result[field] = value
    return result


def _normalise_linkedin_id(value: Any) -> str | None:
    text = _text(value, 255)
    if not text:
        return None
    text = text.replace("https://", "").replace("http://", "")
    text = text.replace("www.linkedin.com/in/", "").replace("linkedin.com/in/", "")
    text = text.strip("/ ")
    return text or None


def _normalise_linkedin_url(value: Any) -> str | None:
    text = _text(value, 2048)
    if not text:
        return None
    if text.startswith("http://") or text.startswith("https://"):
        return text
    if "linkedin.com/in/" in text:
        slug = text.split("linkedin.com/in/", 1)[1].strip("/ ")
        return f"https://www.linkedin.com/in/{slug}" if slug else None
    slug = _normalise_linkedin_id(text)
    return f"https://www.linkedin.com/in/{slug}" if slug else None


def _append_unique(items: list[dict[str, Any]], item: dict[str, Any]) -> None:
    if item not in items:
        items.append(item)


DATE_RANGE_RE = re.compile(
    r"(?P<start>(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
    r"Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{4})"
    r"\s*(?:-|–|—|to)\s*"
    r"(?P<end>Present|Current|Now|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{4})",
    re.IGNORECASE,
)

NUMERIC_DATE_RANGE_RE = re.compile(
    r"(?P<start>(?:\d{4}[./-]\d{1,2}|\d{1,2}[./-]\d{4}|\d{4}))"
    r"\s*(?:-|–|—|to)\s*"
    r"(?P<end>Present|Current|Now|(?:\d{4}[./-]\d{1,2}|\d{1,2}[./-]\d{4}|\d{4}))",
    re.IGNORECASE,
)

DATE_START_RE = re.compile(
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
    r"Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}",
    re.IGNORECASE,
)

YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def _compact_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip().lower()


def _date_range_from_text(text: str) -> tuple[str | None, str | None]:
    match = DATE_RANGE_RE.search(text) or NUMERIC_DATE_RANGE_RE.search(text)
    if match:
        return match.group("start").strip(), match.group("end").strip()
    return None, None


def _find_line_date_range(lines: list[str], primary: str | None, *fallbacks: str | None) -> tuple[str | None, str | None]:
    primary_needle = _compact_text(primary)
    fallback_needles = [_compact_text(needle) for needle in fallbacks if _compact_text(needle)]
    if not primary_needle and not fallback_needles:
        return None, None
    for index, line in enumerate(lines):
        compact_line = _compact_text(line)
        if not compact_line:
            continue
        if primary_needle:
            if primary_needle not in compact_line:
                continue
        elif not any(needle in compact_line for needle in fallback_needles):
            continue
        start, end = _date_range_from_text(line)
        if start or end:
            return start, end
    return None, None


def _heading_key(value: str) -> str:
    """Tolerate PDF extraction that removes spaces from section headings."""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _source_section_bullets(
    lines: list[str],
    start_headings: set[str],
    end_headings: set[str],
) -> list[str]:
    active = False
    bullets: list[str] = []
    for line in lines:
        key = _heading_key(line)
        if not active:
            if key in start_headings:
                active = True
            continue
        if key in end_headings:
            break
        if _has_list_marker(line):
            bullet = _strip_list_marker(line)
            if bullet:
                bullets.append(bullet)
    return bullets


def _same_resume_item(left: str, right: str) -> bool:
    left_key = _heading_key(left)
    right_key = _heading_key(right)
    return bool(left_key and right_key and (left_key in right_key or right_key in left_key))


def _project_from_other(item: dict[str, Any]) -> dict[str, Any] | None:
    description = _bullet_values(item.get("description"))
    if not description:
        return None
    first, *remaining = description
    name, separator, detail = first.partition(":")
    project: dict[str, Any] = {"name": name.strip() or first}
    details = ([detail.strip()] if separator and detail.strip() else []) + remaining
    if details:
        project["description"] = details
    return project


def _reclassify_source_sections(lines: list[str], resume_data: dict) -> None:
    """Correct LLM fallback classifications using explicit source section headings."""
    other = resume_data.get("other")
    if not isinstance(other, list):
        return

    project_bullets = _source_section_bullets(
        lines,
        {"projectsandmerits", "projects", "selectedprojects", "projectsachievements"},
        {"skills", "languages", "spokenlanguages", "education", "experience", "othereducation"},
    )
    development_bullets = _source_section_bullets(
        lines,
        {"othereducation", "extracurriculareducation", "professionaldevelopment"},
        {"experience", "projectsandmerits", "projects", "skills", "languages", "spokenlanguages"},
    )
    if not project_bullets and not development_bullets:
        return

    projects = [dict(item) for item in resume_data.get("projects", []) if isinstance(item, dict)]
    remaining_other: list[Any] = []
    for item in other:
        if not isinstance(item, dict):
            remaining_other.append(item)
            continue
        content = " ".join(_bullet_values(item.get("description")))
        if any(_same_resume_item(content, bullet) for bullet in project_bullets):
            project = _project_from_other(item)
            if project and project not in projects:
                projects.append(project)
            continue
        if any(_same_resume_item(content, bullet) for bullet in development_bullets):
            next_item = dict(item)
            next_item["type"] = "Professional Development"
            remaining_other.append(next_item)
            continue
        remaining_other.append(item)
    if projects:
        resume_data["projects"] = projects
    if remaining_other:
        resume_data["other"] = remaining_other
    else:
        resume_data.pop("other", None)


def _enrich_extracurricular_activities(lines: list[str], resume_data: dict) -> None:
    """Restore activity context when a PDF parser gives the model only role titles."""
    other = resume_data.get("other")
    if not isinstance(other, list):
        return
    # Activity headings are not bullets; collect them directly from the source section.
    active = False
    headings: list[str] = []
    for line in lines:
        key = _heading_key(line)
        if key in {"extracurricularactivities", "activities", "leadershipactivities"}:
            active = True
            continue
        if active and key in {"skillsandinterests", "skills", "licensesandcertifications", "certifications", "education", "experience"}:
            break
        if active and not line.lstrip().startswith(("•", "-", "*")) and DATE_START_RE.search(line):
            headings.append(line)
    if not headings:
        return

    for item in other:
        if not isinstance(item, dict):
            continue
        title = _text(item.get("title"))
        if not title:
            continue
        for heading in headings:
            if "|" in heading:
                before, role_and_date = heading.split("|", 1)
            else:
                title_match = re.search(re.escape(title), heading, flags=re.IGNORECASE)
                if not title_match:
                    continue
                before = heading[:title_match.start()].strip(" -–—")
                role_and_date = heading[title_match.start():]
            date_match = DATE_START_RE.search(role_and_date)
            role = role_and_date[:date_match.start()].strip(" -–—") if date_match else role_and_date.strip()
            if not _same_resume_item(title, role):
                continue
            location_parts = re.split(r"\s*[–—]\s*|\s+-\s+", before.strip(), maxsplit=1)
            organization, location = location_parts[0], ""
            if len(location_parts) == 2:
                organization, location = location_parts
            item["type"] = "Extracurricular Activities"
            item["title"] = role
            if organization.strip():
                item["organization"] = organization.strip()
            if location.strip(" -–—"):
                item["location"] = location.strip(" -–—")
            if date_match:
                item["date"] = role_and_date[date_match.start():].strip()
            break


def enrich_resume_data_from_source(text: str, resume_data: dict) -> dict:
    """Fill obvious dates from source text when the model misses inline ranges."""
    if not text or not isinstance(resume_data, dict):
        return resume_data
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    result = dict(resume_data)

    experience = result.get("experience")
    if isinstance(experience, list):
        next_experience: list[Any] = []
        for item in experience:
            if not isinstance(item, dict):
                next_experience.append(item)
                continue
            entry = dict(item)
            if not entry.get("start_date") or not entry.get("end_date"):
                start, end = _find_line_date_range(lines, entry.get("company"), entry.get("title"))
                if start and not entry.get("start_date"):
                    entry["start_date"] = start
                if end and not entry.get("end_date"):
                    entry["end_date"] = end
            next_experience.append(entry)
        result["experience"] = next_experience

    education = result.get("education")
    if isinstance(education, list):
        next_education: list[Any] = []
        for item in education:
            if not isinstance(item, dict):
                next_education.append(item)
                continue
            entry = dict(item)
            if not entry.get("start_date") or not entry.get("end_date"):
                start, end = _find_line_date_range(lines, entry.get("institution"), entry.get("degree"), entry.get("field_of_study"))
                if start or end:
                    if start:
                        entry["start_date"] = start
                    if end:
                        entry["end_date"] = end
                else:
                    compact_institution = _compact_text(entry.get("institution"))
                    for line in lines:
                        if compact_institution and compact_institution in _compact_text(line):
                            year = YEAR_RE.search(line)
                            if year:
                                entry["end_date"] = year.group(0)
                                break
            next_education.append(entry)
        result["education"] = next_education

    projects = result.get("projects")
    if isinstance(projects, list):
        next_projects: list[Any] = []
        for item in projects:
            if not isinstance(item, dict):
                next_projects.append(item)
                continue
            entry = dict(item)
            if not entry.get("start_date") or not entry.get("end_date"):
                start, end = _find_line_date_range(lines, entry.get("name"), entry.get("url"))
                if start and not entry.get("start_date"):
                    entry["start_date"] = start
                if end and not entry.get("end_date"):
                    entry["end_date"] = end
            next_projects.append(entry)
        result["projects"] = next_projects

    source_languages = _extract_source_languages(lines)
    if source_languages:
        raw_languages = result.get("languages")
        languages = [dict(item) for item in raw_languages if isinstance(item, dict)] if isinstance(raw_languages, list) else []
        for index, source_entry in enumerate(source_languages):
            if index < len(languages):
                if not languages[index].get("name") and source_entry.get("name"):
                    languages[index]["name"] = source_entry["name"]
                if not languages[index].get("proficiency") and source_entry.get("proficiency"):
                    languages[index]["proficiency"] = source_entry["proficiency"]
            else:
                languages.append(source_entry)
        result["languages"] = languages

    _reclassify_source_sections(lines, result)
    _enrich_extracurricular_activities(lines, result)

    return result


def _extract_source_languages(lines: list[str]) -> list[dict[str, str]]:
    for index, line in enumerate(lines):
        heading_match = re.match(r"^(spoken\s*)?languages?\b", line, flags=re.IGNORECASE)
        if not heading_match:
            continue
        content = line.split(":", 1)[1].strip() if ":" in line else ""
        if not content and index + 1 < len(lines):
            content = lines[index + 1].strip()
        if not content:
            return []
        is_explicitly_spoken = bool(heading_match.group(1))
        has_proficiency = bool(
            re.search(
                r"\b(?:native|fluent|bilingual|beginner|intermediate|advanced|professional|elementary|"
                r"[abc][12])\b",
                content,
                flags=re.IGNORECASE,
            )
        )
        if not is_explicitly_spoken and not has_proficiency:
            continue
        fluent_match = re.match(r"^fluent\s+in\s+(.+)$", content, flags=re.IGNORECASE)
        if fluent_match:
            return [
                {"name": name.strip(), "proficiency": "Fluent"}
                for name in re.split(r"\s*(?:,|\band\b|&)\s*", fluent_match.group(1), flags=re.IGNORECASE)
                if name.strip()
            ]
        languages: list[dict[str, str]] = []
        for raw_item in re.split(r"\s*[,;]\s*", content):
            item = raw_item.strip()
            if not item:
                continue
            match = re.match(r"^(?P<name>[A-Za-z][A-Za-z .'-]*?)(?:\s*\((?P<paren>[^)]+)\)|\s+-\s+(?P<dash>.+))?$", item)
            if not match:
                continue
            name = match.group("name").strip()
            proficiency = (match.group("paren") or match.group("dash") or "").strip()
            if not name:
                continue
            entry = {"name": name}
            if proficiency:
                entry["proficiency"] = proficiency
            languages.append(entry)
        return languages
    return []


def extract_pdf_source(content: bytes) -> dict:
    try:
        reader = PdfReader(BytesIO(content))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:
        raise ResumeParseError("The PDF could not be read. Upload a text-based PDF.") from exc
    if not text:
        raise ResumeParseError("No selectable text was found in this PDF. Upload a text-based PDF.")
    return {
        "page_count": len(reader.pages),
        "character_count": len(text),
        "text": text,
    }


def extract_pdf_text(content: bytes) -> str:
    return str(extract_pdf_source(content)["text"])


def normalize_resume_data(raw: Any) -> dict:
    """Drop model extras and omit missing fields entirely."""
    raw = raw if isinstance(raw, dict) else {}
    basics_raw = raw.get("basics") if isinstance(raw.get("basics"), dict) else {}
    result: dict[str, Any] = {}

    basics: dict[str, Any] = {}
    for field in ("first_name", "middle_name", "last_name", "email", "phone", "headline"):
        value = _text(basics_raw.get(field), 255 if field != "email" else 255)
        if value:
            basics[field] = value
    location = _normalise_location(basics_raw.get("location"))
    if location:
        basics["location"] = location
    linkedin_id = _normalise_linkedin_id(basics_raw.get("linkedin_id") or basics_raw.get("linkedin_url"))
    if linkedin_id:
        basics["linkedin_id"] = linkedin_id
    website = _text(basics_raw.get("website"), 2048)
    if website:
        basics["website"] = website
    portfolio_url = _text(basics_raw.get("portfolio_url"), 2048)
    if portfolio_url:
        basics["portfolio_url"] = portfolio_url
    if basics:
        result["basics"] = basics

    summary = _text(raw.get("summary"), 5000)
    if summary:
        result["summary"] = summary

    links: list[dict[str, Any]] = []
    raw_links = raw.get("links") if isinstance(raw.get("links"), list) else []
    for item in raw_links:
        if not isinstance(item, dict):
            continue
        link = _text(item.get("link"), 2048)
        if not link:
            continue
        link_type = _text(item.get("type"), 100) or "Other"
        _append_unique(links, {"type": link_type, "link": link})
    legacy_link_map = [
        ("LinkedIn", _normalise_linkedin_url(basics_raw.get("linkedin_id") or basics_raw.get("linkedin_url"))),
        ("Website", website),
        ("Portfolio", portfolio_url),
    ]
    for link_type, link in legacy_link_map:
        if link:
            _append_unique(links, {"type": link_type, "link": link})
    if links:
        result["links"] = links

    experience: list[dict[str, Any]] = []
    for item in raw.get("experience", []) if isinstance(raw.get("experience"), list) else []:
        if not isinstance(item, dict):
            continue
        entry: dict[str, Any] = {}
        for field in ("company", "title", "location", "start_date", "end_date"):
            value = _text(item.get(field), 255)
            if value:
                entry[field] = value
        description = _bullet_values(item.get("description") or item.get("items"))
        if description:
            entry["description"] = description
        technologies = _skill_values(item.get("technologies"))
        if technologies:
            entry["technologies"] = technologies
        if entry:
            experience.append(entry)
    if experience:
        result["experience"] = experience

    education: list[dict[str, Any]] = []
    for item in raw.get("education", []) if isinstance(raw.get("education"), list) else []:
        if not isinstance(item, dict):
            continue
        entry: dict[str, Any] = {}
        for field in ("institution", "degree", "field_of_study", "location", "start_date", "end_date"):
            value = _text(item.get(field), 255)
            if value:
                entry[field] = value
        degree, field_of_study = _split_education_qualification(
            entry.get("degree"),
            entry.get("field_of_study"),
        )
        if degree:
            entry["degree"] = degree
        if field_of_study:
            entry["field_of_study"] = field_of_study
        highlights = _list_of_text(item.get("highlights"), 20)
        if highlights:
            entry["highlights"] = highlights
        if entry:
            education.append(entry)
    if education:
        result["education"] = education

    projects: list[dict[str, Any]] = []
    for item in raw.get("projects", []) if isinstance(raw.get("projects"), list) else []:
        if not isinstance(item, dict):
            continue
        entry: dict[str, Any] = {}
        for field in ("name", "url", "start_date", "end_date"):
            value = _text(item.get(field), 255 if field == "name" else 2048)
            if value:
                entry[field] = value
        description = _bullet_values(item.get("description") or item.get("items"))
        if description:
            entry["description"] = description
        technologies = _skill_values(item.get("technologies"))
        if technologies:
            entry["technologies"] = technologies
        if entry:
            projects.append(entry)
    if projects:
        result["projects"] = projects

    skills: list[dict[str, Any]] = []
    raw_skills = raw.get("skills")
    if isinstance(raw_skills, list):
        for item in raw_skills:
            if not isinstance(item, dict):
                continue
            values = _skill_values(item.get("skills"))
            if values:
                skills.append({"type": _text(item.get("type"), 100) or "Other", "skills": values})
    elif isinstance(raw_skills, dict):
        for key, label in (("technical", "Technical"), ("tools", "Tools"), ("other", "Other")):
            values = _skill_values(raw_skills.get(key))
            if values:
                skills.append({"type": label, "skills": values})
    if skills:
        result["skills"] = skills

    certifications: list[dict[str, Any]] = []
    raw_certifications = raw.get("certifications")
    if isinstance(raw_certifications, list):
        for item in raw_certifications:
            if not isinstance(item, dict):
                continue
            nested = item.get("certifications")
            records: list[dict[str, Any]] = []
            if isinstance(nested, list):
                for cert in nested:
                    if not isinstance(cert, dict):
                        continue
                    entry: dict[str, Any] = {}
                    for field in ("name", "issuer", "issue_date", "expiry_date", "credential_url"):
                        value = _text(cert.get(field), 255 if field != "credential_url" else 2048)
                        if value:
                            entry[field] = value
                    if entry:
                        records.append(entry)
            elif isinstance(item, dict):
                entry: dict[str, Any] = {}
                for field in ("name", "issuer", "issue_date", "expiry_date", "credential_url"):
                    value = _text(item.get(field), 255 if field != "credential_url" else 2048)
                    if value:
                        entry[field] = value
                if entry:
                    records.append(entry)
            if records:
                certifications.append({
                    "type": _text(item.get("type"), 100) or "Other",
                    "certifications": records,
                })
    if certifications:
        result["certifications"] = certifications

    languages: list[dict[str, Any]] = []
    for item in raw.get("languages", []) if isinstance(raw.get("languages"), list) else []:
        if not isinstance(item, dict):
            continue
        entry: dict[str, Any] = {}
        name = _text(item.get("name"), 100)
        proficiency = _text(item.get("proficiency"), 100)
        if name:
            entry["name"] = name
        if proficiency:
            entry["proficiency"] = proficiency
        if entry:
            languages.append(entry)
    if languages:
        result["languages"] = languages

    search_terms = _list_of_text(raw.get("search_terms"), limit=8, item_limit=120)
    if search_terms:
        result["search_terms"] = search_terms

    other: list[dict[str, Any]] = []

    def add_other_item(item: Any, fallback_type: str = "Other") -> None:
        if isinstance(item, str):
            description = _bullet_values(item)
            if description:
                other.append({"type": fallback_type, "description": description})
            return
        if not isinstance(item, dict):
            return
        entry: dict[str, Any] = {}
        for field in ("type", "title", "organization", "location", "date"):
            value = _text(item.get(field), 255)
            if value:
                entry[field] = value
        if "type" not in entry:
            entry["type"] = fallback_type
        description = _bullet_values(item.get("description") or item.get("items") or item.get("details") or item.get("summary"))
        if description:
            entry["description"] = description
        if entry and set(entry.keys()) != {"type"}:
            other.append(entry)

    for item in raw.get("other", []) if isinstance(raw.get("other"), list) else []:
        add_other_item(item)

    for key, label in (
        ("volunteering", "Volunteering"),
        ("volunteer", "Volunteering"),
        ("awards", "Awards"),
        ("publications", "Publications"),
        ("interests", "Interests"),
        ("activities", "Activities"),
    ):
        value = raw.get(key)
        if isinstance(value, list):
            for item in value:
                add_other_item(item, label)
        elif value:
            add_other_item(value, label)

    unique_other: list[dict[str, Any]] = []
    for item in other:
        if not isinstance(item, dict):
            continue
        if item not in unique_other:
            unique_other.append(item)
    if unique_other:
        result["other"] = unique_other

    return result


def _prepare_resume_lines(text: str) -> list[str]:
    """Apply only lossless or high-confidence PDF noise cleanup."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"(?<=[A-Za-z]{2})-\n[ \t]*(?=[a-z])", "", normalized)
    lines: list[str] = []
    for raw_line in normalized.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"[-=_*~]{3,}", line):
            continue
        if re.fullmatch(r"(?:page\s+)?\d+\s*(?:of|/)\s*\d+", line, flags=re.IGNORECASE):
            continue
        if re.fullmatch(r"page\s+\d+", line, flags=re.IGNORECASE):
            continue
        if _COACHING_LINE_RE.match(line):
            continue
        lines.append(line)
    return lines


def _numbered_resume_text(lines: list[str]) -> str:
    return "\n".join(f"{index}|{line}" for index, line in enumerate(lines, start=1))


def _line_reference_ids(value: Any) -> list[int]:
    references: list[int] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "line_ids":
                values = item if isinstance(item, list) else []
                for raw_reference in values:
                    group = raw_reference if isinstance(raw_reference, list) else [raw_reference]
                    for reference in group:
                        if isinstance(reference, int) and not isinstance(reference, bool):
                            references.append(reference)
                        else:
                            raise _OptimizedParseRejected("AI returned an invalid resume line reference")
            else:
                references.extend(_line_reference_ids(item))
    elif isinstance(value, list):
        for item in value:
            references.extend(_line_reference_ids(item))
    return references


def _clean_referenced_line(value: str) -> str:
    value = _strip_list_marker(value)
    return re.sub(r"^(?:description|highlights?)\s*:\s*", "", value, flags=re.IGNORECASE).strip()


def _resolve_long_text_reference(value: Any, lines: list[str], *, as_list: bool) -> Any:
    if not isinstance(value, dict) or set(value) != {"line_ids"}:
        return value
    raw_groups = value.get("line_ids")
    if not isinstance(raw_groups, list):
        raise _OptimizedParseRejected("AI returned malformed resume line references")
    resolved: list[str] = []
    for raw_group in raw_groups:
        group = raw_group if isinstance(raw_group, list) else [raw_group]
        parts: list[str] = []
        for reference in group:
            if not isinstance(reference, int) or isinstance(reference, bool) or not 1 <= reference <= len(lines):
                raise _OptimizedParseRejected("AI referenced a resume line outside the supplied text")
            part = _clean_referenced_line(lines[reference - 1])
            if part:
                parts.append(part)
        if parts:
            resolved.append(" ".join(parts))
    if as_list:
        return resolved
    return "\n".join(resolved)


def _resolve_line_references(raw: Any, lines: list[str]) -> dict:
    if not isinstance(raw, dict):
        raise _OptimizedParseRejected("AI returned a non-object resume")
    result = deepcopy(raw)
    if "summary" in result:
        result["summary"] = _resolve_long_text_reference(result["summary"], lines, as_list=False)
    for section, field in (
        ("experience", "description"),
        ("projects", "description"),
        ("education", "highlights"),
        ("other", "description"),
    ):
        items = result.get(section)
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict) and field in item:
                item[field] = _resolve_long_text_reference(item[field], lines, as_list=True)
    return result


def _explicit_source_sections(lines: list[str]) -> set[str]:
    headings = {_heading_key(line) for line in lines}
    sections = {
        section
        for section, aliases in _TOP_LEVEL_SECTION_HEADINGS.items()
        if headings.intersection(aliases)
    }
    if "languages" in sections and not _extract_source_languages(lines):
        sections.remove("languages")
    return sections


def _source_section_lines(lines: list[str], section: str) -> list[tuple[int, str]]:
    aliases = _TOP_LEVEL_SECTION_HEADINGS.get(section, set())
    all_headings = set().union(*_TOP_LEVEL_SECTION_HEADINGS.values())
    active = False
    result: list[tuple[int, str]] = []
    for index, line in enumerate(lines, start=1):
        key = _heading_key(line)
        if not active:
            if key in aliases:
                active = True
            continue
        if key in all_headings:
            break
        result.append((index, line))
    return result


def _serialized_contains_source_content(content: str, serialized: str) -> bool:
    normalized = content.strip().casefold()
    if not normalized:
        return True
    if normalized in serialized:
        return True
    tags = [tag.strip().casefold() for tag in re.split(r"\s*(?:,|;|/|\||&)\s*", normalized) if tag.strip()]
    return len(tags) > 1 and all(tag in serialized for tag in tags)


def _validate_optimized_resume(raw: Any, lines: list[str]) -> None:
    if not isinstance(raw, dict):
        raise _OptimizedParseRejected("AI returned a non-object resume")
    references = set(_line_reference_ids(raw))
    if any(reference < 1 or reference > len(lines) for reference in references):
        raise _OptimizedParseRejected("AI referenced a resume line outside the supplied text")

    for section in _explicit_source_sections(lines):
        value = raw.get(section)
        if not isinstance(value, list) or not value:
            raise _OptimizedParseRejected(f"AI omitted the explicit {section} section")
        if section in {"experience", "projects", "education"}:
            dated_items = sum(
                1
                for _, line in _source_section_lines(lines, section)
                if any(_date_range_from_text(line))
            )
            if dated_items and len(value) < dated_items:
                raise _OptimizedParseRejected(f"AI omitted one or more dated {section} items")

    search_terms = raw.get("search_terms")
    if not isinstance(search_terms, list) or not 3 <= len(search_terms) <= 8:
        raise _OptimizedParseRejected("AI omitted required search terms")

    serialized = json.dumps(raw, ensure_ascii=False, separators=(",", ":")).casefold()
    for index, line in enumerate(lines, start=1):
        label_match = re.match(r"^(description|technologies)\s*:\s*(.+)$", line, flags=re.IGNORECASE)
        if not label_match:
            continue
        content = label_match.group(2).strip().casefold()
        if index in references or _serialized_contains_source_content(content, serialized):
            continue
        raise _OptimizedParseRejected(f"AI omitted labeled {label_match.group(1).lower()} content")

    for section in ("experience", "projects", "education"):
        for index, line in _source_section_lines(lines, section):
            if not _has_list_marker(line):
                continue
            content = _strip_list_marker(line)
            if index not in references and not _serialized_contains_source_content(content, serialized):
                raise _OptimizedParseRejected(f"AI omitted a {section} bullet")


def _build_optimized_messages(text: str) -> tuple[list[dict[str, str]], list[str]]:
    lines = _prepare_resume_lines(text)
    if not lines:
        raise _OptimizedParseRejected("Resume text is empty after cleanup")
    numbered_text = _numbered_resume_text(lines)
    if len(numbered_text) > 45000:
        raise _OptimizedParseRejected("Resume is too long for the optimized line protocol")
    return (
        [
            {"role": "system", "content": RESUME_COMPACT_PROMPT},
            {"role": "user", "content": "Resume lines:\n" + numbered_text},
        ],
        lines,
    )


def _build_prompt(text: str) -> str:
    return (
        RESUME_PROMPT
        + "\nRequired JSON schema (nulls are placeholders; omit missing fields):\n"
        + json.dumps(RESUME_SCHEMA, ensure_ascii=True, separators=(",", ":"))
        + "\nResume text:\n"
        + text[:45000]
    )


def _parse_resume_legacy(text: str) -> dict:
    return _complete(
        [
            {"role": "system", "content": "You are a precise resume parser. Return valid JSON only."},
            {"role": "user", "content": _build_prompt(text)},
        ],
        temperature=0,
        operation="resume_legacy",
    )


def _parse_resume_optimized(text: str) -> dict:
    messages, lines = _build_optimized_messages(text)
    raw = _complete(messages, temperature=0, operation="resume_optimized")
    _validate_optimized_resume(raw, lines)
    result = _resolve_line_references(raw, lines)
    logger.info(
        "Optimized resume parsing accepted source_chars=%s prepared_chars=%s lines=%s",
        len(text),
        sum(len(line) for line in lines),
        len(lines),
    )
    return result


def _parse_resume_with_fallback(text: str) -> dict:
    try:
        return _parse_resume_optimized(text)
    except (_OptimizedParseRejected, DeepSeekError) as exc:
        logger.info("Optimized resume parsing rejected; using legacy parser: %s", exc)
        return _parse_resume_legacy(text)


def parse_resume_text(text: str) -> dict:
    try:
        return enrich_resume_data_from_source(
            text,
            normalize_resume_data(_parse_resume_with_fallback(text)),
        )
    except DeepSeekError as exc:
        raise ResumeParseError(str(exc)) from exc


def parse_resume_text_raw(text: str) -> dict:
    try:
        return _parse_resume_with_fallback(text)
    except DeepSeekError as exc:
        raise ResumeParseError(str(exc)) from exc
