from __future__ import annotations

from datetime import datetime, timezone
import re
from dataclasses import dataclass
from typing import Any, Iterable


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
)


@dataclass(frozen=True, slots=True)
class MatchScore:
    score: float
    matched_terms: tuple[str, ...]


def _tokens(value: object) -> set[str]:
    if not isinstance(value, str):
        return set()
    value = re.sub(r"(?<=[A-Za-z])[-\u2010-\u2015](?=[A-Za-z])", " ", value)
    return {
        token.casefold()
        for token in _WORD_RE.findall(value)
        if token.casefold() not in _STOPWORDS
    }


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
    """Calculate daily recency decay multiplier D(t):
    
    - 1 day (<24h / today): 1.00 (100% of base match)
    - 2 days: 0.90 (90%)
    - 3 days: 0.80 (80%)
    - 4 days: 0.70 (70%)
    - 5 days: 0.60 (60%)
    - 6 days: 0.50 (50%)
    - 7 days: 0.40 (40%)
    - > 7 days (older / weeks / months): 0.25 (25%)
    - Unknown / None: 1.00 (default)
    """
    if date_posted is None:
        return 1.00

    if isinstance(date_posted, (int, float)):
        try:
            date_posted = datetime.fromtimestamp(date_posted, tz=timezone.utc)
        except Exception:
            return 1.00

    if isinstance(date_posted, datetime):
        now = datetime.now(timezone.utc)
        if date_posted.tzinfo is None:
            date_posted = date_posted.replace(tzinfo=timezone.utc)
        diff_days = (now - date_posted).total_seconds() / 86400.0
        if diff_days <= 1:
            return 1.00
        elif diff_days <= 2:
            return 0.90
        elif diff_days <= 3:
            return 0.80
        elif diff_days <= 4:
            return 0.70
        elif diff_days <= 5:
            return 0.60
        elif diff_days <= 6:
            return 0.50
        elif diff_days <= 7:
            return 0.40
        else:
            return 0.25

    text = str(date_posted).strip().lower()
    if not text:
        return 1.00

    if any(k in text for k in ("just", "today", "hour", "hr", "1 day", "24h", "刚刚", "今天")):
        return 1.00
    elif any(k in text for k in ("2 days", "2d", "2天前", "2 天前")):
        return 0.90
    elif any(k in text for k in ("3 days", "3d", "3天前", "3 天前")):
        return 0.80
    elif any(k in text for k in ("4 days", "4d", "4天前", "4 天前")):
        return 0.70
    elif any(k in text for k in ("5 days", "5d", "5天前", "5 天前")):
        return 0.60
    elif any(k in text for k in ("6 days", "6d", "6天前", "6 天前")):
        return 0.50
    elif any(k in text for k in ("7 days", "7d", "1 week", "1w", "7天前", "7 天前", "1周前", "1 周前")):
        return 0.40
    elif any(k in text for k in ("week", "month", "30+", "older", "days", "周前", "月前", "个月前", "年前")):
        return 0.25

    # Try ISO date parse
    try:
        dt = datetime.fromisoformat(text.replace("z", "+00:00"))
        return parse_recency_score(dt)
    except Exception:
        pass

    return 1.00


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
    if any(term in title_lower for term in ("senior", "lead", "principal", "staff")):
        return 5.0
    if any(term in title_lower for term in ("junior", "entry", "intern", "associate")):
        return 1.0

    return None


def score_job_match(
    job_description: str,
    resume_data: dict[str, Any] | None,
    *,
    job_title: str = "",
    date_posted: str | datetime | float | None = None,
    technologies: list[str] | tuple[str, ...] | None = None,
    user_years_experience: float | int | None = None,
) -> MatchScore:
    """Score role alignment considering title, skills, experience requirements, and multiplicative recency decay."""
    job_terms = _tokens(job_description)
    if technologies:
        for tech in technologies:
            job_terms.update(_tokens(tech))

    resume_terms: set[str] = set()
    for value in _resume_text(resume_data or {}):
        resume_terms.update(_tokens(value))

    if not job_terms:
        return MatchScore(score=0.0, matched_terms=())

    matched = tuple(sorted(job_terms & resume_terms))
    description_denominator = min(len(job_terms), 40)
    skill_ratio = min(1.0, len(matched) / max(1, description_denominator))

    title_terms = _tokens(job_title)
    has_title = bool(title_terms) and len(resume_terms) >= 10
    title_score = (len(title_terms & resume_terms) / len(title_terms)) if has_title else skill_ratio

    recency_factor = parse_recency_score(date_posted)
    req_years = extract_required_years(job_description, job_title)

    if req_years is not None and user_years_experience is not None:
        user_years = float(user_years_experience)
        if user_years >= req_years:
            exp_score = 1.0
        elif user_years >= req_years - 1.0:
            exp_score = 0.8
        else:
            exp_score = max(0.2, 1.0 - 0.3 * (req_years - user_years))

        # Base match: Title (50%) + Skill (30%) + Experience (20%)
        if has_title:
            base_score = (0.50 * title_score) + (0.30 * skill_ratio) + (0.20 * exp_score)
        else:
            base_score = (0.75 * skill_ratio) + (0.25 * exp_score)
    else:
        # Base match: Title (60%) + Skill (40%)
        if has_title:
            base_score = (0.60 * title_score) + (0.40 * skill_ratio)
        else:
            base_score = skill_ratio

    final_score = base_score * recency_factor
    final_score = round(min(1.0, max(0.0, final_score)), 4)
    return MatchScore(score=final_score, matched_terms=matched)

