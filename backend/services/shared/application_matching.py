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

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}")

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
    if date_posted is None:
        return 1.00

    diff_days: float | None = None

    if isinstance(date_posted, (int, float)):
        try:
            date_posted = datetime.fromtimestamp(date_posted, tz=timezone.utc)
        except Exception:
            return 1.00

    if isinstance(date_posted, datetime):
        now = datetime.now(timezone.utc)
        if date_posted.tzinfo is None:
            date_posted = date_posted.replace(tzinfo=timezone.utc)
        diff_days = max(0.0, (now - date_posted).total_seconds() / 86400.0)

    if diff_days is None:
        text = str(date_posted).strip().lower()
        if not text:
            return 1.00

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
                                        return 1.00

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
        if tok in _STOPWORDS:
            continue
        tok = CANONICAL_ALIAS_MAP.get(tok, tok)
        tok = TITLE_EQUIVALENCE_MAP.get(tok, tok)
        if tok not in _STOPWORDS:
            tokens.add(tok)
    return tokens


def _extract_resume_target_titles(resume_data: dict[str, Any] | None) -> list[str]:
    """Extract candidate target job titles, past roles, and headline terms."""
    if not resume_data:
        return []
    titles: list[str] = []

    for field in ("target_title", "title", "job_title", "role", "position"):
        val = resume_data.get(field)
        if isinstance(val, str) and val.strip():
            titles.append(val.strip())
        elif isinstance(val, (list, tuple)):
            for item in val:
                if isinstance(item, str) and item.strip():
                    titles.append(item.strip())

    search_terms = resume_data.get("search_terms") or resume_data.get("target_roles")
    if isinstance(search_terms, (list, tuple)):
        for item in search_terms:
            if isinstance(item, str) and item.strip():
                titles.append(item.strip())

    exp_list = resume_data.get("work_experience") or resume_data.get("experience") or resume_data.get("history")
    if isinstance(exp_list, (list, tuple)):
        for item in exp_list:
            if isinstance(item, dict):
                pos = item.get("position") or item.get("title") or item.get("role") or item.get("job_title")
                if isinstance(pos, str) and pos.strip():
                    titles.append(pos.strip())

    summary = resume_data.get("summary") or resume_data.get("headline")
    if isinstance(summary, str) and summary.strip():
        first_line = summary.split("\n")[0].split(".")[0]
        if len(first_line) < 120:
            titles.append(first_line.strip())

    return titles


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
    resume_target_titles = _extract_resume_target_titles(resume_data)
    target_titles_text = " ".join(resume_target_titles)

    user_domains = _detect_domains_from_text(target_titles_text)
    if not user_domains:
        summary = str((resume_data or {}).get("summary") or "")
        skills_text = " ".join(
            str(s) for s in _resume_text((resume_data or {}).get("skills"))
        )
        user_domains = _detect_domains_from_text(f"{summary} {skills_text}")

    # Direct target title tokens match
    if target_titles_text:
        user_title_terms = _normalize_title_tokens(target_titles_text)
        token_match_ratio = len(title_terms & user_title_terms) / len(title_terms)
    else:
        resume_terms = _tokens(resume_raw_text)
        token_match_ratio = (len(title_terms & resume_terms) / len(title_terms)) * 0.70

    if job_domains:
        domain_affinity = _calculate_domain_affinity(job_domains, user_domains)
    else:
        domain_affinity = 0.50 if token_match_ratio > 0.3 else 0.15

    if domain_affinity >= 0.70:
        raw_title_score = (0.70 * domain_affinity) + (0.30 * max(domain_affinity * 0.60, token_match_ratio))
    else:
        raw_title_score = (0.60 * domain_affinity) + (0.40 * token_match_ratio)

    if domain_affinity >= 0.95 and token_match_ratio >= 0.95:
        raw_title_score = 1.0
    elif domain_affinity >= 0.95:
        raw_title_score = max(0.90, raw_title_score)
    elif domain_affinity <= 0.35 and token_match_ratio <= 0.1:
        raw_title_score = min(0.30, raw_title_score)

    return round(min(1.0, max(0.0, raw_title_score)), 4)


def _extract_user_years(
    resume_data: dict[str, Any] | None,
    user_years_experience: float | int | None,
    user_seniority: int,
) -> float:
    """Extract candidate years of experience from explicit args, fields, or seniority defaults."""
    if user_years_experience is not None:
        try:
            return float(user_years_experience)
        except (ValueError, TypeError):
            pass

    if resume_data:
        for field in ("years_of_experience", "years_experience", "total_years_experience", "experience_years"):
            val = resume_data.get(field)
            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass

        summary_text = f"{resume_data.get('summary', '')} {resume_data.get('headline', '')}".lower()
        match = re.search(r"(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|working)?", summary_text)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass

        exp_list = resume_data.get("work_experience") or resume_data.get("experience") or resume_data.get("history")
        if isinstance(exp_list, (list, tuple)) and len(exp_list) > 0:
            return max(1.0, float(len(exp_list)) * 1.5)

    tier_defaults = {1: 1.0, 2: 3.0, 3: 5.5, 4: 8.0, 5: 12.0}
    return tier_defaults.get(user_seniority, 3.0)


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

    if not job_terms and not technologies and not job_title:
        return MatchScore(match_score=0.0, recency_factor=1.0, priority_score=0.0, matched_terms=())

    # 1. Tier 1: Explicit Hard Tech Stack Matching
    tech_terms: set[str] = set()
    if technologies:
        for tech in technologies:
            tech_terms.update(_tokens(tech))

    if tech_terms:
        tech_matched = len(tech_terms & resume_terms)
        tech_ratio = min(1.0, tech_matched / len(tech_terms))
    else:
        tech_ratio = None

    # 2. Tier 2: General Job Context & Domain Terms Matching
    matched = tuple(sorted(job_terms & resume_terms))
    description_denominator = min(len(job_terms), 30)
    general_ratio = min(1.0, len(matched) / max(1, description_denominator))

    if tech_ratio is not None:
        # Tiered: 80% explicit hard technologies + 20% general context
        skill_ratio = min(1.0, 0.80 * tech_ratio + 0.20 * general_ratio)
    else:
        skill_ratio = general_ratio

    # 3. Differentiated Title Matching
    title_score = calculate_title_score(job_title, resume_data, resume_raw_text, skill_ratio)

    # 4. Experience & Seniority Matching
    exp_score, _ = calculate_experience_score(
        job_description, job_title, resume_data, resume_raw_text, user_years_experience
    )

    recency_factor = parse_recency_score(date_posted)

    # Weights: Skill (55%) + Title (25%) + Experience (20%)
    has_title = bool(job_title.strip())
    if has_title:
        base_score = (0.25 * title_score) + (0.55 * skill_ratio) + (0.20 * exp_score)
    else:
        base_score = (0.75 * skill_ratio) + (0.25 * exp_score)

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




