from __future__ import annotations

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


def score_job_match(
    job_description: str,
    resume_data: dict[str, Any] | None,
    *,
    job_title: str = "",
) -> MatchScore:
    """Score role alignment without penalising normal long-form job prose.

    Job titles provide the strongest intent signal. Description overlap is
    capped at forty meaningful terms so LinkedIn boilerplate and verbose job
    ads cannot make an otherwise relevant role mathematically impossible to
    reach on the configured 0-1 threshold scale.
    """
    job_terms = _tokens(job_description)
    resume_terms: set[str] = set()
    for value in _resume_text(resume_data or {}):
        resume_terms.update(_tokens(value))
    if not job_terms:
        return MatchScore(score=0.0, matched_terms=())
    matched = tuple(sorted(job_terms & resume_terms))
    description_denominator = min(len(job_terms), 40)
    description_score = min(1.0, len(matched) / max(1, description_denominator))

    title_terms = _tokens(job_title)
    if not title_terms or len(resume_terms) < 10:
        score = description_score
    else:
        title_score = len(title_terms & resume_terms) / len(title_terms)
        score = (0.65 * title_score) + (0.35 * description_score)
    return MatchScore(score=round(min(1.0, score), 4), matched_terms=matched)
