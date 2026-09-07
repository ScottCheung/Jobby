from __future__ import annotations

from datetime import datetime, timezone
import math
import re
from dataclasses import dataclass
from typing import Any, Iterable

from services.shared.matching_dictionaries import (
    CANONICAL_ALIAS_MAP,
    DOMAIN_AFFINITY,
    DOMAIN_TAXONOMY,
    RECRUITMENT_STOPWORDS,
    TITLE_EQUIVALENCE_MAP,
)
from services.shared.skill_catalog import extract_jd_skills

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}")
_REQUIRED_SECTION_HEADER = re.compile(
    r"\b(?:mandatory|minimum|essential|required|key|selection|role|job|position|candidate|applicant|core)\s+"
    r"(?:requirements?|qualifications?|criteria|skills?|experience|capabilities|eligibility)\b|"
    r"\b(?:requirements?|qualifications?|eligibility|selection\s+criteria|essential\s+criteria|key\s+criteria|"
    r"what\s+(?:you(?:'ll|\s+will)?\s+need|we(?:'re|\s+are)?\s+looking\s+for)|about\s+you|who\s+you\s+are|"
    r"must[- ]haves?|skills?\s*(?:&|and)\s*experience|required)\s*[:：]?\s*$",
    re.IGNORECASE,
)
_PREFERRED_SECTION_HEADER = re.compile(
    r"\b(?:preferred|desirable|advantageous|nice\s+to\s+have|bonus|optional|good\s+to\s+have)\s*"
    r"(?:requirements?|qualifications?|criteria|skills?|experience|capabilities)?\s*[:：]?\s*$",
    re.IGNORECASE,
)
_OTHER_SECTION_HEADER = re.compile(
    r"\b(?:benefits?|perks?|about\s+(?:us|the\s+company|our\s+team)|company\s+overview|how\s+to\s+apply|"
    r"salary|remuneration|equal\s+opportunity)\s*[:：]?\s*$",
    re.IGNORECASE,
)
_REQUIRED_SKILL_LANGUAGE = re.compile(
    r"\b(?:required|mandatory|essential|must|minimum|need(?:s|ed)?|prerequisite|core)\b",
    re.IGNORECASE,
)
_PREFERRED_SKILL_LANGUAGE = re.compile(
    r"\b(?:preferred|preferable|desirable|advantageous|nice\s+to\s+have|bonus|optional|plus|beneficial|ideal)\b",
    re.IGNORECASE,
)
_INCIDENTAL_SKILL_LANGUAGE = re.compile(
    r"\b(?:about\s+us|our\s+(?:stack|technology|platform)|tech(?:nology)?\s+stack|built\s+with|powered\s+by|we\s+use)\b",
    re.IGNORECASE,
)

_STOPWORDS = frozenset(
    {
        "and", "the", "with", "for", "from", "this", "that", "you", "your",
        "are", "will", "our", "their", "have", "has", "into", "using", "use",
        "job", "role", "team", "work", "years", "year", "senior", "engineer",
        "developer", "development", "experience", "build", "building", "remote",
        "staff", "lead", "principal", "junior", "mid", "level", "position",
        "about", "skills", "required", "requirements", "responsibilities",
        "strong", "ability", "knowledge", "including", "such", "more", "apply",
    }
) | RECRUITMENT_STOPWORDS


@dataclass(frozen=True, slots=True)
class MatchScore:
    match_score: float
    recency_factor: float
    priority_score: float
    matched_terms: tuple[str, ...]
    skill_score: float = 0.0
    title_score: float = 0.0
    exp_score: float = 0.0

    @property
    def score(self) -> float:
        """Backwards compatibility alias for priority_score."""
        return self.priority_score


def _tokens(value: object) -> set[str]:
    if not isinstance(value, str):
        return set()
    value = re.sub(r"(?<=[A-Za-z])[-\u2010-\u2015](?=[A-Za-z])", " ", value)
    tokens: set[str] = set()
    for raw in _WORD_RE.findall(value):
        token = raw.casefold()
        if token in _STOPWORDS:
            continue
        token = CANONICAL_ALIAS_MAP.get(token, token)
        if token not in _STOPWORDS:
            tokens.add(token)
    return tokens


def _resume_text(values: Any) -> Iterable[str]:
    if isinstance(values, str):
        yield values
    elif isinstance(values, dict):
        for value in values.values():
            yield from _resume_text(value)
    elif isinstance(values, (list, tuple, set)):
        for value in values:
            yield from _resume_text(value)


def parse_recency_score(date_posted: str | datetime | float | None) -> float:
    """Calculate recency decay multiplier D(t) with a 24h grace window and steep 2.0-day half-life."""
    DEFAULT_UNKNOWN_RECENCY = 0.75

    if date_posted is None:
        return DEFAULT_UNKNOWN_RECENCY

    diff_days: float | None = None

    if isinstance(date_posted, (int, float)):
        try:
            date_posted = datetime.fromtimestamp(date_posted, tz=timezone.utc)
        except Exception:
            return DEFAULT_UNKNOWN_RECENCY

    if isinstance(date_posted, datetime):
        now = datetime.now(timezone.utc)
        if date_posted.tzinfo is None:
            date_posted = date_posted.replace(tzinfo=timezone.utc)
        diff_days = max(0.0, (now - date_posted).total_seconds() / 86400.0)

    if diff_days is None:
        text = str(date_posted).strip().lower()
        if not text or text in ("unknown", "null", "none", "n/a", "未知"):
            return DEFAULT_UNKNOWN_RECENCY

        # 1. Hour / minute / just now / today
        if any(k in text for k in ("just", "today", "刚刚", "今天")):
            diff_days = 0.2
        elif any(k in text for k in ("yesterday", "昨天")):
            diff_days = 1.0
        else:
            # Hours
            hr_match = re.search(r"(\d+)\s*(?:hours?|hrs?|h\b|小时前)", text)
            if hr_match:
                hrs = float(hr_match.group(1))
                diff_days = max(0.1, hrs / 24.0)
            else:
                # Minutes
                min_match = re.search(r"(\d+)\s*(?:minutes?|mins?|分钟前)", text)
                if min_match:
                    diff_days = 0.1
                else:
                    # Days (e.g. 19d, 19 days ago, 26d, 3 days ago)
                    day_match = re.search(r"(\d+)\s*(?:days?|d\b|天前|日前的?)", text)
                    if day_match:
                        diff_days = float(day_match.group(1))
                    else:
                        # Weeks (e.g. 2w, 2 weeks ago, 3w)
                        week_match = re.search(r"(\d+)\s*(?:weeks?|wks?|w\b|周前|星期前)", text)
                        if week_match:
                            diff_days = float(week_match.group(1)) * 7.0
                        else:
                            # Months (e.g. 1mo, 1 month ago, 30+ days)
                            month_match = re.search(r"(\d+)\s*(?:months?|mos?|mo\b|m\b|个月前|月前)", text)
                            if month_match:
                                diff_days = float(month_match.group(1)) * 30.0
                            elif any(k in text for k in ("30+", "older", "month", "月前", "周前")):
                                diff_days = 30.0
                            else:
                                # Years
                                year_match = re.search(r"(\d+)\s*(?:years?|yrs?|y\b|年前)", text)
                                if year_match:
                                    diff_days = float(year_match.group(1)) * 365.0
                                else:
                                    try:
                                        dt = datetime.fromisoformat(text.replace("z", "+00:00"))
                                        now = datetime.now(timezone.utc)
                                        if dt.tzinfo is None:
                                            dt = dt.replace(tzinfo=timezone.utc)
                                        diff_days = max(0.0, (now - dt).total_seconds() / 86400.0)
                                    except Exception:
                                        return DEFAULT_UNKNOWN_RECENCY

    if diff_days <= 4.0:
        factor = 1.00 - 0.04 * diff_days
    else:
        factor = 0.84 * math.pow(2.0, -(diff_days - 4.0) / 5.0)

    return round(max(0.001, min(1.0, factor)), 4)


def _detect_seniority_level(text: str) -> int:
    """Classify seniority level into integer grade 1..5."""
    lower = text.lower()
    if any(k in lower for k in ("director", "vp", "head", "chief", "executive", "cto")):
        return 5
    if any(k in lower for k in ("staff", "principal", "architect")):
        return 4
    if any(k in lower for k in ("senior", "sr.", "sr ", "lead")):
        return 3
    if any(k in lower for k in ("junior", "entry", "intern", "associate")):
        return 1
    return 2


def extract_required_years(job_description: str, job_title: str = "") -> float | None:
    """Extract required years of experience from job description or title using regex."""
    text = f"{job_title}\n{job_description}".lower()
    match = re.search(r"(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|working)?", text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    match = re.search(r"minimum\s+(?:of\s+)?(\d+)\s+(?:years?|yrs?)", text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    title_lower = job_title.lower()
    if any(term in title_lower for term in ("director", "vp", "head", "chief")):
        return 10.0
    if any(term in title_lower for term in ("principal", "staff", "architect")):
        return 7.0
    if any(term in title_lower for term in ("senior", "lead")):
        return 5.0
    if any(term in title_lower for term in ("junior", "entry", "intern", "associate")):
        return 1.0

    return None


def _normalize_title_tokens(title: str) -> set[str]:
    if not title:
        return set()
    t = title.lower()
    t = re.sub(r"\bfront\s*[-–—]?\s*end\b", "frontend", t)
    t = re.sub(r"\bback\s*[-–—]?\s*end\b", "backend", t)
    t = re.sub(r"\bfull\s*[-–—]?\s*stack\b", "fullstack", t)
    t = re.sub(r"\bdev\s*ops\b", "devops", t)

    tokens: set[str] = set()
    for raw in _WORD_RE.findall(t):
        tok = raw.casefold()
        if tok in _STOPWORDS and tok not in {"engineer", "developer", "programmer"}:
            continue
        tok = CANONICAL_ALIAS_MAP.get(tok, tok)
        tok = TITLE_EQUIVALENCE_MAP.get(tok, tok)
        if tok not in _STOPWORDS or tok in {"engineer", "developer", "programmer"}:
            tokens.add(tok)
    return tokens


def _extract_resume_title_evidence(
    resume_data: dict[str, Any] | None,
) -> tuple[list[str], list[str]]:
    """Return explicit target roles separately from historical role evidence."""
    if not resume_data:
        return [], []
    explicit_titles: list[str] = []
    historical_titles: list[str] = []

    for field in ("target_title", "title", "job_title", "role", "position"):
        val = resume_data.get(field)
        if isinstance(val, str) and val.strip():
            explicit_titles.append(val.strip())
        elif isinstance(val, (list, tuple)):
            for item in val:
                if isinstance(item, str) and item.strip():
                    explicit_titles.append(item.strip())

    search_terms = resume_data.get("search_terms") or resume_data.get("target_roles")
    if isinstance(search_terms, (list, tuple)):
        for item in search_terms:
            if isinstance(item, str) and item.strip():
                explicit_titles.append(item.strip())

    exp_list = resume_data.get("work_experience") or resume_data.get("experience") or resume_data.get("history")
    if isinstance(exp_list, (list, tuple)):
        for item in exp_list:
            if isinstance(item, dict):
                pos = item.get("position") or item.get("title") or item.get("role") or item.get("job_title")
                if isinstance(pos, str) and pos.strip():
                    historical_titles.append(pos.strip())

    summary = resume_data.get("summary") or resume_data.get("headline")
    if isinstance(summary, str) and summary.strip():
        first_line = summary.split("\n")[0].split(".")[0]
        if len(first_line) < 120:
            historical_titles.append(first_line.strip())

    return list(dict.fromkeys(explicit_titles)), list(dict.fromkeys(historical_titles))


def _extract_resume_target_titles(resume_data: dict[str, Any] | None) -> list[str]:
    """Extract explicit target titles, falling back to historical roles."""
    explicit_titles, historical_titles = _extract_resume_title_evidence(resume_data)
    return explicit_titles or historical_titles


def _detect_domains_from_text(text: str) -> set[str]:
    """Detect software and engineering domains from given text."""
    if not text:
        return set()
    t = text.lower()
    t = re.sub(r"\bfront\s*[-–—]?\s*end\b", "frontend", t)
    t = re.sub(r"\bback\s*[-–—]?\s*end\b", "backend", t)
    t = re.sub(r"\bfull\s*[-–—]?\s*stack\b", "fullstack", t)
    t = re.sub(r"\bdev\s*ops\b", "devops", t)
    t = re.sub(r"\bdata\s+scientist\b", "scientist data", t)
    t = re.sub(r"\bmachine\s+learning\b", "machine learning ai", t)

    tokens = {tok.lower() for tok in _WORD_RE.findall(t)}
    normalized = set()
    for tok in tokens:
        normalized.add(CANONICAL_ALIAS_MAP.get(tok, tok))
        normalized.add(TITLE_EQUIVALENCE_MAP.get(tok, tok))
    combined = tokens | normalized

    domains: set[str] = set()
    for domain, keywords in DOMAIN_TAXONOMY.items():
        if combined & keywords:
            domains.add(domain)
    return domains


def _calculate_domain_affinity(job_domains: set[str], user_domains: set[str]) -> float:
    """Calculate affinity score between job domain requirements and user domain history."""
    if not job_domains or not user_domains:
        return 0.50

    best_affinity = 0.20
    for jd in job_domains:
        for ud in user_domains:
            if jd == ud:
                return 1.0
            affinity = DOMAIN_AFFINITY.get((jd, ud), DOMAIN_AFFINITY.get((ud, jd), 0.20))
            if affinity > best_affinity:
                best_affinity = affinity
    return best_affinity


def calculate_title_score(
    job_title: str,
    resume_data: dict[str, Any] | None,
    resume_raw_text: str,
    skill_ratio: float,
) -> float:
    """Calculate rich differentiated title score based on domain affinity and target role tokens."""
    if not job_title or not job_title.strip():
        return skill_ratio

    title_terms = _normalize_title_tokens(job_title)
    if not title_terms:
        return 0.80 if len(resume_raw_text) > 30 else 0.50

    job_domains = _detect_domains_from_text(job_title)
    explicit_titles, historical_titles = _extract_resume_title_evidence(resume_data)
    resume_target_titles = explicit_titles or historical_titles
    target_titles_text = " ".join(resume_target_titles)

    user_domains = _detect_domains_from_text(target_titles_text)
    if not user_domains:
        summary = str((resume_data or {}).get("summary") or "")
        skills_text = " ".join(
            str(s) for s in _resume_text((resume_data or {}).get("skills"))
        )
        user_domains = _detect_domains_from_text(f"{summary} {skills_text}")

    def title_similarity(candidate_title: str) -> float:
        candidate_terms = _normalize_title_tokens(candidate_title)
        if not candidate_terms:
            return 0.0
        overlap = len(title_terms & candidate_terms) / max(1, min(len(title_terms), len(candidate_terms)))
        candidate_domains = _detect_domains_from_text(candidate_title)
        if job_domains & candidate_domains:
            return max(overlap, 0.75)
        if _calculate_domain_affinity(job_domains, candidate_domains) >= 0.75:
            return max(overlap, 0.65)
        return overlap

    if resume_target_titles:
        title_matches = [title_similarity(title) for title in resume_target_titles]
        normalized_title_similarity = max(title_matches, default=0.0)
    else:
        resume_terms = _tokens(resume_raw_text)
        normalized_title_similarity = len(title_terms & resume_terms) / len(title_terms)

    if job_domains:
        domain_affinity = _calculate_domain_affinity(job_domains, user_domains)
    elif title_terms & {"engineer", "developer", "programmer"} and user_domains:
        # A generic software title is adjacent to the candidate's target domain,
        # but it is not an exact domain match.
        domain_affinity = 0.75
    else:
        domain_affinity = 0.50 if normalized_title_similarity > 0.3 else 0.15

    raw_title_score = (0.60 * domain_affinity) + (0.40 * normalized_title_similarity)
    if domain_affinity <= 0.35 and normalized_title_similarity <= 0.1:
        raw_title_score = min(0.30, raw_title_score)

    return round(min(1.0, max(0.0, raw_title_score)), 4)


def _parse_experience_years(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().lower()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        pass

    year_match = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)", text)
    month_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:months?|mos?)", text)
    if year_match or month_match:
        years = float(year_match.group(1)) if year_match else 0.0
        months = float(month_match.group(1)) if month_match else 0.0
        return years + (months / 12.0)
    return None


def _parse_experience_month(value: object, *, end: bool = False) -> int | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text or text in {"present", "current", "now", "ongoing"}:
        if text:
            now = datetime.now(timezone.utc)
            return now.year * 12 + now.month - 1
        return None

    iso_match = re.search(r"\b(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?\b", text)
    if iso_match:
        year, month = int(iso_match.group(1)), int(iso_match.group(2))
        return year * 12 + month - 1

    year_month_match = re.search(
        r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
        r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        r"\s+(\d{4})\b",
        text,
    )
    if year_month_match:
        month_name = year_month_match.group(0).split()[0][:3]
        month = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
        }[month_name]
        return int(year_month_match.group(1)) * 12 + month - 1

    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    if year_match:
        year = int(year_match.group(1))
        return year * 12 + (11 if end else 0)
    return None


def _dated_work_experience_years(resume_data: dict[str, Any] | None) -> float | None:
    if not resume_data:
        return None
    exp_list = resume_data.get("work_experience") or resume_data.get("experience") or resume_data.get("history")
    if not isinstance(exp_list, (list, tuple)):
        return None

    intervals: list[tuple[int, int]] = []
    for item in exp_list:
        if not isinstance(item, dict):
            continue
        start = _parse_experience_month(
            item.get("start_date") or item.get("start") or item.get("from")
        )
        end_value = item.get("end_date") or item.get("end") or item.get("to")
        end = _parse_experience_month(end_value, end=True)
        if start is not None and end is not None and end >= start:
            intervals.append((start, end))

    if not intervals:
        return None

    intervals.sort()
    merged: list[list[int]] = []
    for start, end in intervals:
        if not merged or start > merged[-1][1] + 1:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    total_months = sum(end - start + 1 for start, end in merged)
    return total_months / 12.0


def _extract_user_years(
    resume_data: dict[str, Any] | None,
    user_years_experience: float | int | None,
    user_seniority: int,
) -> float:
    """Extract candidate years of experience from explicit args, fields, or seniority defaults."""
    if user_years_experience is not None:
        parsed = _parse_experience_years(user_years_experience)
        if parsed is not None:
            return parsed

    if resume_data:
        for field in (
            "total_work_experience",
            "years_of_experience",
            "years_experience",
            "total_years_experience",
            "experience_years",
        ):
            val = resume_data.get(field)
            if val is not None:
                parsed = _parse_experience_years(val)
                if parsed is not None:
                    return parsed

        dated_years = _dated_work_experience_years(resume_data)
        if dated_years is not None:
            return dated_years

        summary_text = f"{resume_data.get('summary', '')} {resume_data.get('headline', '')}".lower()
        match = re.search(r"(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|working)?", summary_text)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass

    return 0.0


def _skill_context_weight(description: str, skill: str) -> float:
    """Classify one extracted skill using nearby JD section/language cues."""
    if not description:
        return 0.70

    skill_pattern = re.compile(
        rf"(?<![a-zA-Z0-9]){re.escape(skill.strip())}(?![a-zA-Z0-9])",
        re.IGNORECASE,
    )
    section = "none"
    observed_weights: list[float] = []
    for raw_line in description.replace("\r", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        clean_line = re.sub(r"^[•\-*–—\d+.)\s]+", "", line).strip()
        is_bullet = bool(re.match(r"^[•\-*–—\d+.)]", line))
        if not is_bullet and len(clean_line) <= 80:
            if _PREFERRED_SECTION_HEADER.search(clean_line):
                section = "preferred"
                continue
            if _REQUIRED_SECTION_HEADER.search(clean_line):
                section = "required"
                continue
            if _OTHER_SECTION_HEADER.search(clean_line):
                section = "other"
                continue
        if not skill_pattern.search(clean_line):
            continue

        is_preferred = section == "preferred" or _PREFERRED_SKILL_LANGUAGE.search(clean_line)
        is_explicitly_not_required = bool(
            re.search(r"\b(?:not|without)\s+(?:required|mandatory|essential)\b", clean_line, re.IGNORECASE)
        )
        if is_preferred or is_explicitly_not_required:
            observed_weights.append(0.35)
        elif section == "required" or _REQUIRED_SKILL_LANGUAGE.search(clean_line):
            observed_weights.append(1.00)
        elif section == "other" or _INCIDENTAL_SKILL_LANGUAGE.search(clean_line):
            observed_weights.append(0.15)
        else:
            observed_weights.append(0.70)
    return max(observed_weights, default=0.70)


def calculate_experience_score(
    job_description: str,
    job_title: str,
    resume_data: dict[str, Any] | None,
    resume_raw_text: str,
    user_years_experience: float | int | None = None,
) -> tuple[float, float]:
    """Calculate experience score and seniority penalty."""
    req_years = extract_required_years(job_description, job_title)

    job_seniority = _detect_seniority_level(f"{job_title} {job_description}")
    user_seniority = _detect_seniority_level(resume_raw_text)
    gap = max(0, job_seniority - user_seniority)
    seniority_penalty = 1.00 if gap == 0 else 0.85 if gap == 1 else 0.65 if gap == 2 else 0.50

    user_years = _extract_user_years(resume_data, user_years_experience, user_seniority)

    if req_years is not None:
        diff = user_years - req_years
        if 0.0 <= diff <= 2.0:
            # Golden sweet spot: 0.94 - 1.00
            score = 1.00 - 0.03 * diff
        elif 2.0 < diff <= 5.0:
            # Highly experienced / slight overqualification: 0.82 - 0.94
            score = 0.94 - 0.04 * (diff - 2.0)
        elif diff > 5.0:
            # Overqualified: 0.70 - 0.82
            score = max(0.68, 0.82 - 0.02 * (diff - 5.0))
        elif -1.0 <= diff < 0.0:
            # Slightly underqualified (-1 year): 0.75 - 0.90
            score = 0.75 + 0.15 * (1.0 + diff)
        elif -3.0 <= diff < -1.0:
            # Underqualified (-2 to -3 years): 0.45 - 0.75
            score = 0.45 + 0.15 * (3.0 + diff)
        else:
            # Severely underqualified (-4+ years): 0.15 - 0.45
            score = max(0.15, 0.45 + 0.08 * (diff + 3.0))
    else:
        # No explicit years in JD: align by seniority tier
        if job_seniority == user_seniority:
            score = 0.85
        elif user_seniority > job_seniority:
            score = 0.80
        else:
            g = job_seniority - user_seniority
            score = 0.65 if g == 1 else 0.45 if g == 2 else 0.25

    final_exp = round(min(1.0, max(0.0, score * seniority_penalty)), 4)
    return final_exp, seniority_penalty


def score_job_match(
    job_description: str,
    resume_data: dict[str, Any] | None,
    *,
    job_title: str = "",
    date_posted: str | datetime | float | None = None,
    technologies: list[str] | tuple[str, ...] | None = None,
    user_years_experience: float | int | None = None,
    profile_skills: list[str] | tuple[str, ...] | None = None,
) -> MatchScore:
    """Score role match (Match Score) and submission priority (Priority Score)."""
    job_terms = _tokens(job_description)
    if technologies:
        for tech in technologies:
            job_terms.update(_tokens(tech))

    resume_terms: set[str] = set()
    resume_raw_text = ""
    for value in _resume_text(resume_data or {}):
        resume_terms.update(_tokens(value))
        resume_raw_text += f" {value}"
    # Skills claimed from the browser extension are scoring-only evidence.
    # Keep them out of resume_data so they can never alter the saved resume.
    for skill in profile_skills or ():
        resume_terms.update(_tokens(skill))

    if not job_terms and not technologies and not job_title:
        return MatchScore(match_score=0.0, recency_factor=parse_recency_score(date_posted), priority_score=0.0, matched_terms=())

    # 1. Build requirements from browser extraction when available. The catalog
    # is only needed when the browser did not provide any technologies.
    extracted_skills = list(technologies) if technologies else extract_jd_skills(job_description)

    # Weight each requirement according to its JD context instead of treating
    # every browser-extracted technology as equally mandatory.
    requirement_weights: dict[frozenset[str], float] = {}
    for skill in extracted_skills:
        label_tokens = _tokens(skill)
        if not label_tokens:
            continue
        key = frozenset(label_tokens)
        weight = _skill_context_weight(job_description, skill)
        requirement_weights[key] = max(weight, requirement_weights.get(key, 0.0))

    # 2. Compute skill ratio from requirement coverage
    if requirement_weights:
        matched_weight = 0.0
        total_weight = 0.0
        for label_tokens, weight in requirement_weights.items():
            total_weight += weight
            if label_tokens and label_tokens.issubset(resume_terms):
                matched_weight += weight
        skill_ratio = matched_weight / total_weight if total_weight > 0 else 0.0
    else:
        # Fallback: no catalog skills found (extremely short/vague JD)
        effective_len = len(job_terms)
        description_denominator = min(effective_len, max(6, int(effective_len * 0.25)))
        skill_ratio = min(1.0, len(job_terms & resume_terms) / max(1, description_denominator))

    # General context matched terms (backward compat for matched_terms response field)
    matched = tuple(sorted(job_terms & resume_terms))

    # 3. Differentiated Title Matching
    title_score = calculate_title_score(job_title, resume_data, resume_raw_text, skill_ratio)

    # Domain damping: only needed in fallback mode (no catalog skills found)
    # When requirement_weights exist, skill_ratio is already well-calibrated
    has_title = bool(job_title.strip())
    if has_title and not requirement_weights:
        if title_score <= 0.30:
            skill_ratio = min(skill_ratio, max(0.10, title_score * 1.2))
        elif title_score <= 0.50:
            skill_ratio = min(skill_ratio, max(0.25, title_score * 0.8 + 0.15))

    # 4. Experience & Seniority Matching
    exp_score, _ = calculate_experience_score(
        job_description, job_title, resume_data, resume_raw_text, user_years_experience
    )

    recency_factor = parse_recency_score(date_posted)

    # Match is compatibility only. Freshness is applied separately below.
    base_score = (0.60 * skill_ratio) + (0.22 * title_score) + (0.18 * exp_score)

    match_score = round(min(1.0, max(0.0, base_score)), 4)
    priority_score = round(min(1.0, max(0.0, match_score * recency_factor)), 4)

    return MatchScore(
        match_score=match_score,
        recency_factor=recency_factor,
        priority_score=priority_score,
        matched_terms=matched,
        skill_score=round(skill_ratio, 4),
        title_score=round(title_score, 4),
        exp_score=round(exp_score, 4),
    )
