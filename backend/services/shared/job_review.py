"""Simple pasted-JD review: match score, freshness score, and tailoring."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any

from services.shared.deepseek import _complete



TAILOR_PROMPT = """You are a senior, domain-neutral resume editor. Tailor the supplied resume to the supplied job description while preserving factual accuracy. This is an evidence-led editorial selection task, not keyword substitution, invention, or a full-resume paraphrase.

Return one valid JSON object only, with no Markdown, explanation, or extra keys:

{
  "summary":"",
  "core_competencies":[],
  "skills":[{"type":"","skills":[]}],
  "experience":[{"index":0,"bullets":[]}],
  "projects":[{"name":"","description":[],"technologies":[]}],
  "targeted_projects":[]
}

Before writing, silently:

1. Infer the role's highest-priority hiring signals (the capabilities and outcomes a hiring team needs to verify).
2. Map each signal to the strongest explicit resume evidence.
3. Identify clearly transferable evidence only when it is genuinely supported.
4. Determine the candidate's strongest professional identity for this role.
5. Prioritize hiring signal over keyword overlap or keyword count.

Optimize in three layers:

1. Direct evidence for JD requirements.
2. Closely related transferable experience.
3. Evidence that strengthens the candidate's overall professional profile.

Favor breadth across important capability dimensions before repeating similar evidence.

Never:

- Invent responsibilities, technologies, metrics, achievements, leadership, or business impact.
- Infer completed work from recommendations, prototypes, plans, coursework, or experiments.
- Upgrade familiarity into production experience.
- Introduce technologies that do not appear in the resume.
- Rewrite accomplishments into stronger claims than the evidence supports.
- Turn a JD requirement into candidate experience merely because it appears in the JD.

Use the natural vocabulary of the target role instead of mechanically copying JD wording.

A strong bullet should contain:

- a clear action,
- meaningful technical or business context,
- and a supported outcome whenever available.

Avoid cosmetic rewrites that do not improve hiring signal.

--------------------------------
SUMMARY
--------------------------------

Generate a concise, role-specific summary. Do not force a word count; use only as much space as needed to communicate the strongest supported hiring signals.

The summary should communicate:

- years of experience (if explicitly supported),
- primary technical or professional focus,
- strongest business or engineering impact,
- one distinguishing capability.

Every statement must be directly supported elsewhere in the resume.

Avoid:

- generic personality traits,
- buzzwords without evidence,
- vague statements such as
  "results-driven",
  "passionate",
  "team player",
  "hardworking",
  "fast learner".

Do not imitate or lightly edit an existing summary.

--------------------------------
CORE COMPETENCIES
--------------------------------

Return concise recruiter-facing capability phrases ordered by hiring importance. Do not target an arbitrary count. Use the space needed to represent the strongest distinct hiring signals, combining capability and core technology where useful (for example, “C#/.NET & ASP.NET Core Development” or “AWS Cloud & Serverless Architecture”).

Each qualification must be directly supported by resume evidence.

Prefer capability phrases such as:

- Backend API Development
- Cloud Infrastructure
- Performance Optimization
- Distributed Systems

Avoid isolated technologies unless they represent a core capability.

Do not include category labels.

--------------------------------
SKILLS
--------------------------------

Retain every supplied skill that:

- directly matches the JD,
- materially supports a core capability,
- or reinforces evidence shown in work experience or projects.

Prefer skills demonstrated through actual experience over skills appearing only in the skill list.

Remove:

- redundant skills,
- obsolete skills,
- weakly related technologies,
- partial matches that contribute little hiring value.

Keep the original grouped structure.

Never flatten skill groups.

Keep at least one representative skill from every original group that is supported elsewhere in the resume, even if that group is not a primary JD requirement.

--------------------------------
EXPERIENCE
--------------------------------

Return every supplied experience index exactly once.

Select the strongest available substantive bullets for every supplied experience index. Do not target an arbitrary bullet count or remove strong evidence solely to make the resume shorter.

Order bullets by:

1. hiring relevance,
2. strength of evidence,
3. diversity of capability.

Each selected bullet should contribute a different hiring signal. Avoid multiple bullets whose primary evidence is the same technology or activity unless each adds meaningful new evidence. Prefer production delivery, ownership, measurable impact, architecture, collaboration, engineering quality, scalability, reliability, and customer or business outcomes over incidental technology mentions.

Maximize coverage across areas such as:

- architecture,
- implementation,
- optimization,
- cloud,
- delivery,
- collaboration,
- stakeholder communication,
- reliability,
- operations,
- quality,
- customer impact,
- business outcomes.

Do not remove measurable achievements merely because they are less keyword-aligned.

--------------------------------
PROJECTS
--------------------------------

Return every supplied project using its original name.

Select the strongest relevant bullets without an arbitrary count limit.

Retain only bullets that:

- strengthen hiring relevance,
- demonstrate important capabilities,
- or provide evidence unavailable elsewhere.

Remove implementation details that add little hiring value.

Retain only relevant supplied technologies.

--------------------------------
TARGETED_PROJECTS
--------------------------------

Return [] by default.

targeted_projects: default to [] unless the criteria below are met.

Create at most one item only when ALL of the following are true:

- an important JD requirement is genuinely unsupported,
- a realistic prototype could reasonably bridge that gap,
- it is explicitly labeled as "Prototype",
- it cannot be mistaken for completed work.

Never fabricate production experience.

--------------------------------
GENERAL PRINCIPLES
--------------------------------

Maximize hiring signal, not keyword overlap. Preserve distinct, evidence-backed breadth across the resume. Do not assume the role is technical: infer appropriate capability dimensions from the JD. do not assume the role is technical; infer appropriate capability dimensions from the JD. Do not remove strong evidence merely to satisfy an arbitrary count; do not remove strong evidence merely to satisfy an arbitrary count, page, or word target. do not shorten it to meet an arbitrary page or word target. Keep the result concise enough for a practical resume, but let the evidence determine the amount of content. Do not target an arbitrary count.

Prefer evidence over coverage.

Prefer impact over implementation detail.

Prefer distinct capabilities over repetition.

Keep the result concise, selective, ATS-friendly, recruiter-friendly, and suitable for a two-page resume.
"""


def _text(value: Any) -> str:
    return str(value or "").strip()


def _string_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:limit]


def _dict_list(value: Any, limit: int) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)][:limit]


def _normalized_skill_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9+#.]", "", str(value).lower())


def _normalize_skill_groups(original: Any, generated: Any) -> list[dict[str, Any]]:
    source_groups = _dict_list(original, 50)
    if not source_groups:
        return []
    requested: list[str] = []
    requested_types: set[str] = set()
    if isinstance(generated, list):
        for item in generated:
            if isinstance(item, str):
                requested.append(item)
            elif isinstance(item, dict) and isinstance(item.get("skills"), list):
                group_type = _text(item.get("type")).lower()
                if group_type:
                    requested_types.add(group_type)
                requested.extend(skill for skill in item["skills"] if isinstance(skill, str))
    requested_names = [_normalized_skill_name(item) for item in requested]
    groups: list[dict[str, Any]] = []
    for group in source_groups:
        skills = [skill.strip() for skill in group.get("skills", []) if isinstance(skill, str) and skill.strip()]
        selected = [
            skill for skill in skills
            if any(
                _normalized_skill_name(skill) == item
                or (len(_normalized_skill_name(skill)) > 2 and (_normalized_skill_name(skill) in item or item in _normalized_skill_name(skill)))
                for item in requested_names
            )
        ]
        if selected:
            groups.append({"type": _text(group.get("type")) or "Skills", "skills": list(dict.fromkeys(selected))})

    # Keep one or two representative items from omitted source groups. This
    # preserves professional breadth without restoring the entire source list.
    represented_types = {_text(group.get("type")).lower() for group in groups}
    for source_group in source_groups:
        group_type = _text(source_group.get("type")) or "Skills"
        if group_type.lower() in represented_types:
            continue
        source_skills = [skill.strip() for skill in source_group.get("skills", []) if isinstance(skill, str) and skill.strip()]
        if source_skills:
            groups.append({"type": group_type, "skills": source_skills[:2]})
    if groups or requested:
        return groups
    return [
        {"type": _text(group.get("type")) or "Skills", "skills": [skill.strip() for skill in group.get("skills", []) if isinstance(skill, str) and skill.strip()]}
        for group in source_groups if isinstance(group.get("skills"), list)
    ]


def _experience_bullet_context(value: Any) -> list[dict[str, Any]]:
    """Expose only indexed bullets; employer facts never enter the prompt."""
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        bullets = item.get("description")
        if not isinstance(bullets, list):
            bullets = [bullets] if isinstance(bullets, str) else []
        result.append({"index": index, "bullets": [b.strip() for b in bullets if isinstance(b, str) and b.strip()]})
    return result


def _merge_experience_bullets(original: Any, generated: Any) -> list[dict[str, Any]]:
    """Apply AI bullets to original entries while retaining locked metadata."""
    if not isinstance(original, list):
        return []
    merged = [dict(item) for item in original if isinstance(item, dict)]
    if not isinstance(generated, list):
        return merged
    for entry in generated:
        if not isinstance(entry, dict):
            continue
        try:
            index = int(entry.get("index"))
        except (TypeError, ValueError):
            continue
        if index < 0 or index >= len(merged):
            continue
        bullets = entry.get("bullets", entry.get("description"))
        if isinstance(bullets, str):
            bullets = [bullets]
        if isinstance(bullets, list):
            cleaned = [item.strip() for item in bullets if isinstance(item, str) and item.strip()]
            if cleaned:
                merged[index]["description"] = cleaned
    return merged


def _freshness(posted_at: str | None) -> tuple[float, str]:
    if not posted_at:
        return 0.8, "发布时间未知，使用保守衰减"
    try:
        value = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
        age = max(0, (datetime.now(timezone.utc) - value.astimezone(timezone.utc)).days)
    except (TypeError, ValueError):
        match = re.search(r"(\d+)\s*(day|week|month)", posted_at.lower())
        if not match:
            return 0.8, "发布时间无法标准化"
        amount = int(match.group(1))
        age = amount * ({"day": 1, "week": 7, "month": 30}[match.group(2)])
    if age <= 1:
        return 1.0, "1 天内发布"
    if age <= 3:
        return 0.95, f"约 {age} 天前发布"
    if age <= 7:
        return 0.85, f"约 {age} 天前发布"
    if age <= 14:
        return 0.70, f"约 {age} 天前发布"
    if age <= 30:
        return 0.50, f"约 {age} 天前发布"
    return 0.25, f"约 {age} 天前发布"


def build_tailor_messages(job: dict, resume: dict) -> list[dict[str, str]]:
    description = _text(job.get("job_description"))
    context = {
        "skills": resume.get("skills") if isinstance(resume.get("skills"), list) else [],
        "experience": _experience_bullet_context(resume.get("experience")),
        "projects": resume.get("projects") if isinstance(resume.get("projects"), list) else [],
    }
    return [
        {"role": "system", "content": TAILOR_PROMPT},
        {"role": "user", "content": json.dumps({"job_description": description[:18000], "resume": context}, ensure_ascii=False)},
    ]


def review_job(job: dict, resume: dict, *, tailor: bool = True, mock: bool = False) -> dict:
    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")
    tailored: dict[str, Any] | None = None
    key_qualifications: list[str] = []
    targeted_projects: list[dict[str, Any]] = []
    tailor_result: dict[str, Any] = {}
    if tailor:
        if mock:
            # Token-saving mock mode: return candidate's original resume_data as base with mock competencies
            mock_competencies = ["Full-Stack Engineering", "Backend Architecture", "System Design", "Agile Project Delivery"]
            tailored = dict(resume)
            if not _text(tailored.get("summary")):
                tailored["summary"] = f"Experienced candidate tailored for {job.get('title') or 'this position'}."
            key_qualifications = mock_competencies
            tailor_result = {"mock": True, "note": "Generated in token-saving mock mode"}
        else:
            tailor_result = _complete(
                build_tailor_messages(job, resume),
                temperature=0.3,
                operation="job_review_tailor",
                timeout=90.0,
            )
            # The model only edits the targeted sections. Preserve the candidate's
            # identity and record sections so the preview remains a complete resume.
            tailored = {
                **{key: value for key, value in resume.items() if key not in {"summary", "skills", "experience", "projects"}},
                "summary": _text(tailor_result.get("summary")),
                "core_competencies": _string_list(tailor_result.get("core_competencies") or tailor_result.get("key_qualifications") or tailor_result.get("match_skills"), 20),
                "skills": _normalize_skill_groups(resume.get("skills"), tailor_result.get("skills")),
                "experience": _merge_experience_bullets(resume.get("experience"), tailor_result.get("experience")),
                "projects": tailor_result.get("projects") if isinstance(tailor_result.get("projects"), list) else [],
            }
            key_qualifications = _string_list(tailor_result.get("core_competencies") or tailor_result.get("key_qualifications") or tailor_result.get("match_skills"), 20)
            targeted_projects = _dict_list(tailor_result.get("targeted_projects"), 8)
    return {
        "resume_data": tailored,
        "core_competencies": key_qualifications,
        # Compatibility for clients and records created before the rename.
        "key_qualifications": key_qualifications,
        "targeted_projects": targeted_projects,
        "raw_ai_response": tailor_result,
    }

