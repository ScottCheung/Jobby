"""Compact, independent AI evaluation for structured master resumes."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from services.shared.deepseek import DeepSeekError, _complete


class ResumeEvaluationError(ValueError):
    pass


RUBRIC_VERSION = "career_profile_v1"
DIMENSION_WEIGHTS = {
    "factual_completeness": 25,
    "experience_quality": 45,
    "skill_evidence": 20,
    "information_density": 10,
}

RESUME_EVALUATION_PROMPT = """Evaluate the supplied structured data as a reusable master resume, not a job-specific resume. Return compact JSON only.
Return exactly {"evaluation":[{"type":"experience_quality","score":0,"overview":"","suggestions":[]},{"type":"skill_evidence","score":0,"overview":"","suggestions":[]},{"type":"information_density","score":0,"overview":"","suggestions":[]}]} in this order.
All text must be English. Scores are integers 0-100. Each overview is one specific sentence, at most 22 words. A true boolean *_present means that fact exists even though its private value was withheld; never claim it is missing or ask to add its value. Do not invent facts or numbers.
Suggestions must address a material weakness, not seek perfection: score >=85 => []; score 70-84 => at most one; lower => at most two. Each is at most 18 words.
Rubric:
- experience_quality: descriptions state concrete actions, scope/context, and credible outcomes; reward quantification only when naturally present; penalize vague responsibility language.
- skill_evidence: core role-specific skills have experience/project evidence. Do not score skill breadth. Common tools need not all appear in bullets. Any suggestion must name the unsupported skill.
- information_density: enough detail for reuse without repetitive, vague, or excessively long text. A master resume may be longer than two pages.
Judge only the supplied data. JSON only."""


def resume_content_hash(resume_data: dict) -> str:
    serialized = json.dumps(resume_data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _strings(value: Any, *, limit: int, item_limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value[:limit]:
        if not isinstance(item, str):
            continue
        text = item.strip()[:item_limit]
        if text:
            result.append(text)
    return result


def _evaluation_input(resume_data: dict) -> dict:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    experience = resume_data.get("experience") if isinstance(resume_data.get("experience"), list) else []
    projects = resume_data.get("projects") if isinstance(resume_data.get("projects"), list) else []
    education = resume_data.get("education") if isinstance(resume_data.get("education"), list) else []
    skill_groups = resume_data.get("skills") if isinstance(resume_data.get("skills"), list) else []

    skills: list[str] = []
    for group in skill_groups:
        if not isinstance(group, dict):
            continue
        for skill in _strings(group.get("skills"), limit=50, item_limit=100):
            if skill not in skills:
                skills.append(skill)

    compact_experience = []
    for item in experience[:15]:
        if not isinstance(item, dict):
            continue
        compact_experience.append({
            "title": str(item.get("title") or "")[:160],
            "company_present": bool(item.get("company")),
            "location_present": bool(item.get("location")),
            "start_date_present": bool(item.get("start_date")),
            "end_date_present": bool(item.get("end_date")),
            "description": _strings(item.get("description"), limit=8, item_limit=500),
            "technologies": _strings(item.get("technologies"), limit=30, item_limit=100),
        })

    compact_projects = []
    for item in projects[:10]:
        if not isinstance(item, dict):
            continue
        compact_projects.append({
            "name_present": bool(item.get("name")),
            "description": _strings(item.get("description"), limit=6, item_limit=500),
            "technologies": _strings(item.get("technologies"), limit=30, item_limit=100),
        })

    compact_education = []
    for item in education[:10]:
        if not isinstance(item, dict):
            continue
        compact_education.append({
            "institution_present": bool(item.get("institution")),
            "degree_present": bool(item.get("degree")),
            "field_of_study_present": bool(item.get("field_of_study")),
            "start_date_present": bool(item.get("start_date")),
            "end_date_present": bool(item.get("end_date")),
            "highlights": _strings(item.get("highlights"), limit=5, item_limit=300),
        })

    return {
        "signals": {
            "has_name": bool(basics.get("first_name") or basics.get("last_name")),
            "has_contact": bool(basics.get("email") or basics.get("phone")),
            "has_summary": bool(resume_data.get("summary")),
            "experience_count": len(experience),
            "project_count": len(projects),
            "education_count": len(education),
            "skill_count": len(skills),
        },
        "experience": compact_experience,
        "projects": compact_projects,
        "education": compact_education,
        "skills": skills[:100],
    }


def _clean_text(value: Any, limit: int) -> str:
    return str(value).strip()[:limit] if isinstance(value, str) else ""


def _factual_completeness(resume_data: dict) -> dict[str, Any]:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    experience = [item for item in resume_data.get("experience", []) if isinstance(item, dict)]
    education = [item for item in resume_data.get("education", []) if isinstance(item, dict)]
    projects = [item for item in resume_data.get("projects", []) if isinstance(item, dict)]
    skills = [item for item in resume_data.get("skills", []) if isinstance(item, dict)]

    score = 100
    gaps: list[str] = []
    suggestions: list[str] = []
    if not (basics.get("first_name") or basics.get("last_name")):
        score -= 10
        gaps.append("name")
        suggestions.append("Add your name to the contact section.")
    if not (basics.get("email") or basics.get("phone")):
        score -= 10
        gaps.append("contact details")
        suggestions.append("Add an email address or phone number.")
    if not experience and not projects:
        score -= 25
        gaps.append("career evidence")
        suggestions.append("Add at least one work experience or project entry.")
    if not education:
        score -= 10
        gaps.append("education")
        suggestions.append("Add your education history.")
    if not any(_strings(group.get("skills"), limit=100, item_limit=100) for group in skills):
        score -= 10
        gaps.append("skills")
        suggestions.append("Add a structured skills section.")

    if experience:
        present = sum(
            bool(item.get(field))
            for item in experience
            for field in ("company", "title", "start_date", "end_date", "description")
        )
        missing_ratio = 1 - present / (len(experience) * 5)
        score -= round(missing_ratio * 25)
        if missing_ratio > 0:
            gaps.append("some experience fields")
            suggestions.append("Complete missing employer, role, date, or description fields in work experience.")

    if education:
        present = sum(
            bool(item.get(field))
            for item in education
            for field in ("institution", "degree", "field_of_study")
        )
        missing_ratio = 1 - present / (len(education) * 3)
        score -= round(missing_ratio * 10)
        if missing_ratio > 0:
            gaps.append("some education fields")
            suggestions.append("Separate each education entry into institution, degree, and field of study.")

    score = max(0, min(100, score))
    if score >= 95:
        overview = "Core identity, contact, experience, education, and skill facts are complete and traceable."
    else:
        overview = f"Core facts are present, with gaps in {', '.join(dict.fromkeys(gaps))}."
    return {
        "type": "factual_completeness",
        "score": score,
        "overview": overview,
        "suggestions": [] if score >= 85 else list(dict.fromkeys(suggestions))[:1 if score >= 70 else 2],
    }


def normalize_resume_evaluation(raw: Any, resume_data: dict | None = None) -> dict:
    raw_items = raw.get("evaluation") if isinstance(raw, dict) else None
    if not isinstance(raw_items, list):
        raise ResumeEvaluationError("AI returned an invalid resume evaluation")
    indexed = {
        item.get("type"): item
        for item in raw_items
        if isinstance(item, dict) and isinstance(item.get("type"), str)
    }
    evaluation: list[dict[str, Any]] = []
    for dimension_type in DIMENSION_WEIGHTS:
        if dimension_type == "factual_completeness" and resume_data is not None:
            evaluation.append(_factual_completeness(resume_data))
            continue
        item = indexed.get(dimension_type)
        if not isinstance(item, dict):
            raise ResumeEvaluationError(f"AI omitted the {dimension_type} evaluation")
        try:
            score = int(item.get("score"))
        except (TypeError, ValueError) as exc:
            raise ResumeEvaluationError(f"AI returned an invalid {dimension_type} score") from exc
        if not 0 <= score <= 100:
            raise ResumeEvaluationError(f"AI returned an out-of-range {dimension_type} score")
        overview = _clean_text(item.get("overview"), 300)
        if not overview:
            raise ResumeEvaluationError(f"AI omitted the {dimension_type} overview")
        suggestion_limit = 0 if score >= 85 else 1 if score >= 70 else 2
        suggestions = _strings(item.get("suggestions"), limit=suggestion_limit, item_limit=240)
        if dimension_type == "skill_evidence" and resume_data is not None:
            listed_skills = {
                skill.casefold()
                for group in resume_data.get("skills", [])
                if isinstance(group, dict)
                for skill in _strings(group.get("skills"), limit=100, item_limit=100)
            }
            suggestions = [
                suggestion
                for suggestion in suggestions
                if any(skill in suggestion.casefold() for skill in listed_skills)
            ]
        evaluation.append({
            "type": dimension_type,
            "score": score,
            "overview": overview,
            "suggestions": suggestions,
        })

    overall_score = round(sum(item["score"] * DIMENSION_WEIGHTS[item["type"]] for item in evaluation) / 100)
    return {
        "rubric_version": RUBRIC_VERSION,
        "overall_score": overall_score,
        "evaluation": evaluation,
    }


def evaluate_resume_data(resume_data: dict) -> dict:
    if not isinstance(resume_data, dict) or not resume_data:
        raise ResumeEvaluationError("Resume data is required for evaluation")
    compact_input = json.dumps(_evaluation_input(resume_data), ensure_ascii=False, separators=(",", ":"))
    try:
        raw = _complete(
            [
                {"role": "system", "content": RESUME_EVALUATION_PROMPT},
                {"role": "user", "content": compact_input},
            ],
            temperature=0,
            operation="resume_evaluation",
        )
    except DeepSeekError as exc:
        raise ResumeEvaluationError(str(exc)) from exc
    result = normalize_resume_evaluation(raw, resume_data)
    result["source_hash"] = resume_content_hash(resume_data)
    return result
