from __future__ import annotations

from datetime import datetime, timezone
import math
import re
from dataclasses import dataclass
from typing import Any, Iterable

from services.shared.matching_dictionaries import CANONICAL_ALIAS_MAP, RECRUITMENT_STOPWORDS

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
    """Calculate recency decay multiplier D(t) with a smooth 24h plateau and 3.5-day half-life."""
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

        if any(k in text for k in ("just", "today", "hour", "hr", "刚刚", "今天", "0d")):
            diff_days = 0.2
        elif any(k in text for k in ("1 day", "24h", "1d", "1天前")):
            diff_days = 1.0
        elif any(k in text for k in ("2 days", "2d", "2天前")):
            diff_days = 2.0
        elif any(k in text for k in ("3 days", "3d", "3天前")):
            diff_days = 3.0
        elif any(k in text for k in ("4 days", "4d", "4天前")):
            diff_days = 4.0
        elif any(k in text for k in ("5 days", "5d", "5天前")):
            diff_days = 5.0
        elif any(k in text for k in ("6 days", "6d", "6天前")):
            diff_days = 6.0
        elif any(k in text for k in ("7 days", "7d", "1 week", "1w", "7天前", "1周前")):
            diff_days = 7.0
        elif any(k in text for k in ("2 weeks", "2w", "14d", "14天前", "2周前")):
            diff_days = 14.0
        elif any(k in text for k in ("week", "month", "30+", "older", "周前", "月前", "年前")):
            diff_days = 30.0
        else:
            try:
                dt = datetime.fromisoformat(text.replace("z", "+00:00"))
                now = datetime.now(timezone.utc)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                diff_days = max(0.0, (now - dt).total_seconds() / 86400.0)
            except Exception:
                return 1.00

    if diff_days <= 1.0:
        factor = 1.00 - 0.08 * diff_days
    else:
        factor = 0.92 * math.pow(2.0, -(diff_days - 1.0) / 3.5)

    return round(max(0.01, min(1.0, factor)), 4)


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

    if not job_terms:
        return MatchScore(match_score=0.0, recency_factor=1.0, priority_score=0.0, matched_terms=())

    matched = tuple(sorted(job_terms & resume_terms))
    description_denominator = min(len(job_terms), 40)
    skill_ratio = min(1.0, len(matched) / max(1, description_denominator))

    title_terms = _tokens(job_title)
    has_title = bool(title_terms) and len(resume_terms) >= 10
    title_score = (len(title_terms & resume_terms) / len(title_terms)) if has_title else skill_ratio

    recency_factor = parse_recency_score(date_posted)
    req_years = extract_required_years(job_description, job_title)

    # Stepwise Seniority Disparity Penalty
    job_seniority = _detect_seniority_level(f"{job_title} {job_description}")
    user_seniority = _detect_seniority_level(resume_raw_text)
    gap = max(0, job_seniority - user_seniority)
    seniority_penalty = 1.00 if gap == 0 else 0.85 if gap == 1 else 0.65 if gap == 2 else 0.50

    if req_years is not None and user_years_experience is not None:
        user_years = float(user_years_experience)
        if user_years >= req_years:
            exp_score = 1.0
        elif user_years >= req_years - 1.0:
            exp_score = 0.8
        else:
            exp_score = max(0.2, 1.0 - 0.3 * (req_years - user_years))

        # Weights: Skill (55%) + Title (25%) + Experience (20%)
        if has_title:
            base_score = (0.25 * title_score) + (0.55 * skill_ratio) + (0.20 * exp_score)
        else:
            base_score = (0.80 * skill_ratio) + (0.20 * exp_score)
    else:
        # Weights: Skill (70%) + Title (30%)
        if has_title:
            base_score = (0.25 * title_score) + (0.75 * skill_ratio)
        else:
            base_score = skill_ratio

    match_score = round(min(1.0, max(0.0, base_score * seniority_penalty)), 4)
    priority_score = round(min(1.0, max(0.0, match_score * recency_factor)), 4)

    calculated_exp = (exp_score * seniority_penalty) if 'exp_score' in locals() else seniority_penalty

    return MatchScore(
        match_score=match_score,
        recency_factor=recency_factor,
        priority_score=priority_score,
        matched_terms=matched,
        skill_score=round(skill_ratio, 4),
        title_score=round(title_score, 4),
        exp_score=round(calculated_exp, 4),
    )



