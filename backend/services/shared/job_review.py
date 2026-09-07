"""Simple pasted-JD review: match score, freshness score, and tailoring."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import re
from time import perf_counter
from typing import Any
from uuid import UUID

from services.shared.deepseek import _complete, _complete_async


logger = logging.getLogger(__name__)


def _tailor_operation(doc_type: str) -> str:
    if doc_type == "both":
        return "resume_and_cover_letter"
    return "cover_letter" if doc_type == "cover_letter" else "resume_tailor"



_EVIDENCE_POLICY = """
## EVIDENCE POLICY

候选人事实只能来自源简历；JD 只决定相关性，不能证明候选人拥有任何技能或经历。不得新增或推断未经支持的技能、技术、职责、成果、行业经验、工作年限、领导力、客户名称、团队规模、项目、证书、教育背景或量化结果。

可以改善措辞，但不得改变事实含义、技术事实、责任级别、数字、日期或指标。不得把参与描述成领导，也不得把项目经验写成工作经验。例如，React 不得变成 Angular，AWS 不得变成 Azure。

不得用“合理推断”补齐候选人没有明确提供的经历；合理 ≠ 有证据。end-to-end ownership 不代表做过 customer discovery；requirements to production 不代表做过 customer interviews；cross-functional collaboration 不代表有 customer communication experience；使用某项技术不代表拥有更广泛的行业或领域经验。JD 中出现的职责不能自动转化为候选人已经做过的职责：JD 只能决定什么重要，不能决定候选人做过什么。

输入中的 total_work_experience 是系统根据有效日期和去重重叠任职计算的唯一权威总任职时长；仅当它能增强当前申请时才可原样使用，绝不可自行计算、四舍五入或改写。
"""


_SELECTION_STRATEGY = """
## SELECTION STRATEGY

生成最终 JSON 前，先在内部完成 JD Evidence Coverage Check：找出 JD 最重要的 4–7 个招聘信号；对每个信号只从源简历寻找明确证据；没有证据的要求视为 unmatched，不得写进候选人经历；有强证据的重要信号应尽量在最终简历中体现。删除任何 bullet 或 project 前，先检查它是否是某个重要 JD 要求的最强或唯一证据。不要只选择“整体看起来不错”的内容，优先保证高优先级 JD 信号已有的真实证据被覆盖。

不得因为证据来自 Project 就自动降权；应根据与 JD 的直接相关性和证据强度排序。若某个 Project 是重要 JD 要求最强或唯一的证据，应优先保留；不得仅因为类似技术已经出现在工作经历中就删除该 Project。优先级为：事实准确性 > JD 相关性 > 证据强度 > 信息密度 > 节省篇幅。

优先展示成果、责任范围、问题解决能力和对客户、业务、用户或团队的影响。让不同 bullet 尽量证明不同的重要能力，使用自然的目标职业表达，避免机械堆砌 JD 关键词。所有输出与原始简历语言保持一致。
"""


_SUMMARY_RULES = """
## SUMMARY

生成 2–3 句简洁的职业简介，动态突出目标职业定位、最强 JD 对齐能力、相关经历、最有说服力的证据型差异化优势，以及仅在确实重要时提及的相关教育或证书。

不要强制写工作年限；若使用 total_work_experience，只能原样使用提供的系统计算值。避免 Results-driven、Passionate、Hard-working、Fast learner 等空泛表述。
"""


_CORE_COMPETENCIES_RULES = """
## CORE COMPETENCIES

返回约 4–7 个按招聘重要性排序、且均有源简历直接证据的核心能力短语。它们应表达招聘层面的能力、责任范围或价值创造方式，而非简单重复或重组 Skills。具体能力必须由当前 JD 决定，不得套用固定行业模板。
"""


_SKILLS_RULES = """
## SKILLS

只能选择原始 structured skills 中已有的技能，保留完全相同的技能字符串和原始分组 type。不得新增、改名、合并、泛化、根据 JD 补全或以相关技术替代。

优先保留 JD 明确需要、在 experience 或 projects 中实际使用过、或能支撑核心招聘能力的技能。无足够相关技能的整个分组可以省略。
"""


_EXPERIENCE_RULES = """
## EXPERIENCE

每个源 experience 都必须仍在最终简历中出现。index 用于标识源条目；company、title、location 和日期是锁定的源事实。可在每段经历内部选择、改写、合并、缩短和重排 bullets，但每一项事实都必须有源简历支持。

按 JD 相关性和证据强度分配 bullet 信息预算：

* 高相关经历：当有足够彼此不同的强证据时，通常保留 5–6 条。
* 中相关经历：通常保留 4–5 条。
* 低相关经历：通常保留 3–4 条。

这些范围是指导，不是最低配额。若额外内容重复、薄弱、泛泛或与 JD 关联很弱，应使用更少 bullets；绝不可为了达到目标数量而保留内容、创造证据或把一项成果拆成多条。不得超过该经历的原始 bullet 数量，也不得输出超过源材料能够支持的独立 bullets。可合并密切相关的源 bullets，但不得强行合并无关成果。

优先选择：对主要 JD 要求的直接证据、强成果或可量化结果、有实质意义的 ownership 或责任、重要问题解决、客户/业务/用户/团队影响、质量/可靠性/效率/成本/增长/交付/风险改进，以及与目标职业相关的重要专业能力。

优先删除或合并：低相关细节、泛化日常职责、同一能力的重复证据、已被更强结果覆盖的实现细节，以及脱离有意义上下文的技术罗列。

强 bullet 通常在源材料支持时呈现「行动 + 相关背景 + 结果/影响」。数字并非必需；有价值的责任或专业能力也应保留。每段经历内最强、最相关的证据排在最前面；不得重排工作经历本身。
"""


_PROJECTS_RULES = """
## PROJECTS

不得因为证据来自 Project 就自动降权；应根据与 JD 的直接相关性和证据强度排序。项目可补充或提供工作经历也涉及的重要 JD 证据；若项目是某项关键要求最直接、最强或唯一的证据，应优先保留，不得仅因类似技术已出现在工作经历中而删除。优先选择高度相关、能展示从零构建、开源或 side project、特定产品、领域或技术能力、重要技术、专业能力或成果的项目。

每个项目通常保留 1–3 条 description；高度相关项目在每条都提供不同强证据时最多可保留 4 条。项目内容重复工作经历或招聘价值有限时，应使用更少 bullets。不得虚构项目、技术、职责或结果，也不要求保留最低项目数量。
"""


_COVER_LETTER_RULES = """
## COVER LETTER

生成 3 段、仅含正文的求职信：不得包含称谓、日期、候选人署名、Sincerely 或其他结语。英文控制在约 180–240 词，中文控制在约 350–450 字。

第一段说明应聘定位及最强的已证实匹配点；第二段选择 2–3 项最相关的真实技能或成果；第三段基于既有证据说明可带来的价值，并礼貌表达沟通意愿。不得在 JD 未提供信息时声称了解公司的产品、使命、文化、客户或战略；此时应以职位职责为依据使用审慎、真实的措辞。

语言应专业、具体且避免空话。使用 Markdown 的 **加粗** 标记突出每段最关键的职位、技能、成果或价值主张，每段 1–2 处，避免加粗整句或过度加粗。
"""


_RESUME_SCHEMA = """{
  "summary": "",
  "core_competencies": [],
  "skills": [{"type": "", "skills": []}],
  "experience": [{"index": 0, "bullets": []}],
  "projects": [{"index": 0, "description": [], "technologies": []}]
}"""

_COVER_LETTER_SCHEMA = """{
  "cover_letter": ""
}"""

_BOTH_SCHEMA = """{
  "summary": "",
  "core_competencies": [],
  "skills": [{"type": "", "skills": []}],
  "experience": [{"index": 0, "bullets": []}],
  "projects": [{"index": 0, "description": [], "technologies": []}],
  "cover_letter": ""
}"""


def _build_tailor_prompt(doc_type: str) -> str:
    if doc_type == "cover_letter":
        sections = (_EVIDENCE_POLICY, _SELECTION_STRATEGY, _COVER_LETTER_RULES)
        schema = _COVER_LETTER_SCHEMA
    elif doc_type == "both":
        sections = (
            _EVIDENCE_POLICY,
            _SELECTION_STRATEGY,
            _SUMMARY_RULES,
            _CORE_COMPETENCIES_RULES,
            _SKILLS_RULES,
            _EXPERIENCE_RULES,
            _PROJECTS_RULES,
            _COVER_LETTER_RULES,
        )
        schema = _BOTH_SCHEMA
    else:
        sections = (
            _EVIDENCE_POLICY,
            _SELECTION_STRATEGY,
            _SUMMARY_RULES,
            _CORE_COMPETENCIES_RULES,
            _SKILLS_RULES,
            _EXPERIENCE_RULES,
            _PROJECTS_RULES,
        )
        schema = _RESUME_SCHEMA
    return "\n\n".join((
        "你是一位资深、跨行业的简历编辑专家。根据 JD 对候选人的真实简历进行针对性优化：筛选、合并、排序和改写，而不是创造经历。不要预设候选人属于任何特定行业。",
        *sections,
        "## OUTPUT CONTRACT\n\n只返回符合以下 schema 的合法 JSON，不要输出解释或 JSON 以外的内容：\n\n" + schema,
    ))


TAILOR_PROMPT = _build_tailor_prompt("resume")
COVER_LETTER_PROMPT = _build_tailor_prompt("cover_letter")
BOTH_PROMPT = _build_tailor_prompt("both")


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
    return re.sub(r"[^a-z0-9+#]", "", str(value).lower())


def _normalize_skill_groups(original: Any, generated: Any) -> list[dict[str, Any]]:
    source_groups = _dict_list(original, 50)
    if not source_groups and isinstance(original, list) and all(isinstance(skill, str) for skill in original):
        source_groups = [{"type": "Skills", "skills": original}]
    if not source_groups:
        return []
    fallback = [
        {
            "type": _text(group.get("type")) or "Skills",
            "skills": [
                skill.strip()
                for skill in group.get("skills", [])
                if isinstance(skill, str) and skill.strip()
            ],
        }
        for group in source_groups
        if isinstance(group.get("skills"), list)
    ]
    if not isinstance(generated, list):
        return fallback
    if not generated:
        return []

    source_by_name: dict[str, tuple[str, str]] = {}
    for group in source_groups:
        group_type = _text(group.get("type")) or "Skills"
        for skill in group.get("skills", []) if isinstance(group.get("skills"), list) else []:
            if isinstance(skill, str) and skill.strip():
                source_by_name.setdefault(_normalized_skill_name(skill), (group_type, skill.strip()))

    requested: list[str] = []
    has_valid_shape = False
    has_explicit_empty_selection = False
    for item in generated:
        if isinstance(item, str) and item.strip():
            has_valid_shape = True
            requested.append(item)
        elif isinstance(item, dict) and isinstance(item.get("skills"), list):
            has_valid_shape = True
            if not item["skills"]:
                has_explicit_empty_selection = True
            requested.extend(skill for skill in item["skills"] if isinstance(skill, str) and skill.strip())

    if not has_valid_shape:
        return fallback

    groups: list[dict[str, Any]] = []
    group_positions: dict[str, int] = {}
    for requested_skill in requested:
        source = source_by_name.get(_normalized_skill_name(requested_skill))
        if not source:
            continue
        group_type, source_spelling = source
        position = group_positions.get(group_type)
        if position is None:
            position = len(groups)
            group_positions[group_type] = position
            groups.append({"type": group_type, "skills": []})
        if source_spelling not in groups[position]["skills"]:
            groups[position]["skills"].append(source_spelling)

    if groups:
        return groups
    if requested or has_explicit_empty_selection:
        return []
    return fallback


def _experience_bullet_context(value: Any) -> list[dict[str, Any]]:
    """Expose complete factual work-history context while retaining an output index."""
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        bullets = item.get("description")
        if not isinstance(bullets, list):
            bullets = [bullets] if isinstance(bullets, str) else []
        result.append({
            "index": index,
            "title": _text(item.get("title")),
            "company": _text(item.get("company")),
            "location": _text(item.get("location")),
            "start_date": _text(item.get("start_date")),
            "end_date": _text(item.get("end_date")),
            "bullets": [b.strip() for b in bullets if isinstance(b, str) and b.strip()],
        })
    return result


def _project_context(value: Any) -> list[dict[str, Any]]:
    """Expose complete project facts while retaining an internal source index."""
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        description = item.get("description")
        if isinstance(description, str):
            description = [description]
        elif not isinstance(description, list):
            description = []
        technologies = item.get("technologies")
        if not isinstance(technologies, list):
            technologies = []
        result.append({
            "index": index,
            "name": _text(item.get("name")),
            "url": _text(item.get("url")),
            "start_date": _text(item.get("start_date")),
            "end_date": _text(item.get("end_date")),
            "description": [text.strip() for text in description if isinstance(text, str) and text.strip()],
            "technologies": [technology.strip() for technology in technologies if isinstance(technology, str) and technology.strip()],
        })
    return result


def _source_description(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return []


def _tailored_summary(original: Any, generated: Any) -> str:
    if isinstance(generated, str) and generated.strip():
        return generated.strip()
    return _text(original)


def _tailored_core_competencies(original: dict[str, Any], generated: dict[str, Any]) -> list[str]:
    for key in ("core_competencies", "key_qualifications", "match_skills"):
        value = generated.get(key)
        if isinstance(value, list):
            selected = _string_list(value, 7)
            if selected:
                return selected
    source = original.get("core_competencies") or original.get("key_qualifications") or []
    return _string_list(source, 7)


def _normalize_projects(original: Any, generated: Any) -> list[dict[str, Any]]:
    """Apply indexed project edits while preserving source metadata and facts."""
    source_projects = [dict(item) for item in original if isinstance(item, dict)] if isinstance(original, list) else []
    if not isinstance(generated, list):
        return source_projects
    if not generated:
        return []
    if not all(isinstance(item, dict) for item in generated):
        return source_projects
    if any("index" not in item for item in generated):
        return source_projects

    normalized: list[dict[str, Any]] = []
    seen_indexes: set[int] = set()
    for entry in generated:
        try:
            index = int(entry.get("index"))
        except (TypeError, ValueError):
            return source_projects
        if index < 0 or index >= len(source_projects) or index in seen_indexes:
            continue
        seen_indexes.add(index)
        source = source_projects[index]
        project = {key: value for key, value in source.items() if key != "index"}

        if isinstance(entry.get("description"), list):
            project["description"] = [
                item.strip()
                for item in entry["description"]
                if isinstance(item, str) and item.strip()
            ][:4]

        if isinstance(entry.get("technologies"), list):
            source_technologies = _source_description(source.get("technologies"))
            source_by_name = {
                _normalized_skill_name(technology): technology
                for technology in source_technologies
            }
            project["technologies"] = list(dict.fromkeys(
                source_by_name[_normalized_skill_name(technology)]
                for technology in entry["technologies"]
                if isinstance(technology, str)
                and _normalized_skill_name(technology) in source_by_name
            ))

        normalized.append(project)
    return normalized


def _month_index(value: Any, *, end_date: bool = False) -> int | None:
    text = _text(value).lower()
    if not text:
        return None
    if text in {"present", "current", "now", "至今", "目前"}:
        now = datetime.now(timezone.utc)
        return now.year * 12 + now.month - 1
    for date_format in ("%B %Y", "%b %Y", "%Y-%m", "%Y/%m", "%m/%Y"):
        try:
            parsed = datetime.strptime(text.title() if "%B" in date_format or "%b" in date_format else text, date_format)
            return parsed.year * 12 + parsed.month - 1
        except ValueError:
            continue
    year_match = re.fullmatch(r"(19|20)\d{2}", text)
    if year_match:
        return int(text) * 12 + (11 if end_date else 0)
    return None


def _total_work_experience(experience: Any) -> str | None:
    """Return the union of dated employment months without double-counting overlaps."""
    if not isinstance(experience, list):
        return None
    periods: list[tuple[int, int]] = []
    for item in experience:
        if not isinstance(item, dict):
            continue
        start = _month_index(item.get("start_date"))
        end = _month_index(item.get("end_date"), end_date=True)
        if start is not None and end is not None and end >= start:
            periods.append((start, end))
    if not periods:
        return None
    merged: list[list[int]] = []
    for start, end in sorted(periods):
        if not merged or start > merged[-1][1] + 1:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    months = sum(end - start + 1 for start, end in merged)
    years, remaining_months = divmod(months, 12)
    parts = ([f"{years} year" if years == 1 else f"{years} years"] if years else [])
    if remaining_months:
        parts.append(f"{remaining_months} month" if remaining_months == 1 else f"{remaining_months} months")
    return " ".join(parts) or "0 months"


def _merge_experience_bullets(original: Any, generated: Any) -> list[dict[str, Any]]:
    """Apply AI bullets to original entries while retaining locked metadata."""
    if not isinstance(original, list):
        return []
    merged = [dict(item) for item in original if isinstance(item, dict)]
    if not isinstance(generated, list):
        return merged
    seen_indexes: set[int] = set()
    for entry in generated:
        if not isinstance(entry, dict):
            continue
        try:
            index = int(entry.get("index"))
        except (TypeError, ValueError):
            continue
        if index < 0 or index >= len(merged) or index in seen_indexes:
            continue
        bullets = entry.get("bullets", entry.get("description"))
        if isinstance(bullets, str):
            bullets = [bullets]
        if isinstance(bullets, list):
            source_bullets = _source_description(merged[index].get("description"))
            max_bullets = min(len(source_bullets), 6)
            cleaned = [item.strip() for item in bullets if isinstance(item, str) and item.strip()][:max_bullets]
            if cleaned:
                seen_indexes.add(index)
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


def build_tailor_messages(job: dict, resume: dict, doc_type: str = "resume") -> list[dict[str, str]]:
    description = _text(job.get("job_description"))
    resume_context: dict[str, Any] = {
        "skills": resume.get("skills") if isinstance(resume.get("skills"), list) else [],
        "experience": _experience_bullet_context(resume.get("experience")),
        "projects": _project_context(resume.get("projects")),
        "education": resume.get("education") if isinstance(resume.get("education"), list) else [],
        "certifications": resume.get("certifications") if isinstance(resume.get("certifications"), list) else [],
    }
    total_work_experience = _total_work_experience(resume.get("experience"))
    if total_work_experience:
        resume_context["total_work_experience"] = total_work_experience
    prompt = _build_tailor_prompt(doc_type)

    return [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "job": {
                        "title": _text(job.get("title")),
                        "company": _text(job.get("company")),
                        "job_description": description[:18000],
                    },
                    "resume": resume_context,
                },
                ensure_ascii=False,
            ),
        },
    ]


def review_job(
    job: dict,
    resume: dict,
    *,
    doc_type: str = "resume",
    tailor: bool = True,
    mock: bool = False,
    correlation_id: str | None = None,
    user_id: UUID | None = None,
) -> dict:
    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")
    tailored: dict[str, Any] | None = None
    key_qualifications: list[str] = []
    targeted_projects: list[dict[str, Any]] = []
    tailor_result: dict[str, Any] = {}
    cover_letter_text: str | None = None
    tailor_started_at: float | None = None

    if tailor:
        if mock:
            # Token-saving mock mode
            mock_competencies = ["Full-Stack Engineering", "Backend Architecture", "System Design", "Agile Project Delivery"]
            tailored = dict(resume)
            if not _text(tailored.get("summary")):
                tailored["summary"] = f"Experienced candidate tailored for {job.get('title') or 'this position'}."
            key_qualifications = mock_competencies
            if doc_type in ("cover_letter", "both"):
                target_role = job.get("title") or "Open Position"
                target_company = job.get("company") or "your team"
                cover_letter_text = (
                    f"I am writing to express my strong interest in the {target_role} position. "
                    f"With my extensive experience in delivering impactful engineering solutions and solving complex technical challenges, "
                    f"I am excited about the opportunity to contribute to {target_company}.\n\n"
                    f"Throughout my career, I have consistently focused on building scalable systems, optimizing performance, and collaborating effectively with cross-functional teams. "
                    f"My technical background and proven track record make me a strong match for your key requirements.\n\n"
                    f"I welcome the opportunity to discuss how my skills and experiences can benefit your upcoming initiatives."
                )
            tailor_result = {
                "mock": True,
                "note": "Generated in token-saving mock mode",
                "cover_letter": cover_letter_text,
            }
        else:
            tailor_started_at = perf_counter()
            tailor_result = _complete(
                build_tailor_messages(job, resume, doc_type=doc_type),
                temperature=0.3,
                operation=_tailor_operation(doc_type),
                timeout=90.0,
                correlation_id=correlation_id,
                user_id=user_id,
                reasoning_effort="low",
            )
            cover_letter_text = _text(tailor_result.get("cover_letter")) or None
            # The model only edits the targeted sections. Preserve the candidate's
            # identity and record sections so the preview remains a complete resume.
            if doc_type == "cover_letter":
                tailored = dict(resume)
                key_qualifications = _string_list(resume.get("core_competencies") or [], 20)
            else:
                tailored = {
                    **{key: value for key, value in resume.items() if key not in {"summary", "skills", "experience", "projects"}},
                    "summary": _tailored_summary(resume.get("summary"), tailor_result.get("summary")),
                    "core_competencies": _tailored_core_competencies(resume, tailor_result),
                    "skills": _normalize_skill_groups(resume.get("skills"), tailor_result.get("skills")),
                    "experience": _merge_experience_bullets(resume.get("experience"), tailor_result.get("experience")),
                    "projects": _normalize_projects(resume.get("projects"), tailor_result.get("projects")),
                }
                key_qualifications = _tailored_core_competencies(resume, tailor_result)
                targeted_projects = _dict_list(tailor_result.get("targeted_projects"), 8)

    if tailor_started_at is not None:
        logger.info(
            "tailor.timing correlation_id=%s tailor_total_duration_ms=%s",
            correlation_id,
            round((perf_counter() - tailor_started_at) * 1000),
        )

    return {
        "resume_data": tailored,
        "core_competencies": key_qualifications,
        # Compatibility for clients and records created before the rename.
        "key_qualifications": key_qualifications,
        "targeted_projects": targeted_projects,
        "cover_letter": cover_letter_text,
        "raw_ai_response": tailor_result,
    }


async def review_job_async(
    job: dict,
    resume: dict,
    *,
    doc_type: str = "resume",
    tailor: bool = True,
    mock: bool = False,
    correlation_id: str | None = None,
    user_id: UUID | None = None,
) -> dict:
    """Cancellable async variant used by interactive resume generation."""
    if mock or not tailor:
        return review_job(
            job,
            resume,
            doc_type=doc_type,
            tailor=tailor,
            mock=mock,
            correlation_id=correlation_id,
            user_id=user_id,
        )

    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")

    tailor_started_at = perf_counter()
    tailor_result = await _complete_async(
        build_tailor_messages(job, resume, doc_type=doc_type),
        temperature=0.3,
        operation=_tailor_operation(doc_type),
        timeout=90.0,
        correlation_id=correlation_id,
        user_id=user_id,
        reasoning_effort="low",
    )
    cover_letter_text = _text(tailor_result.get("cover_letter")) or None
    if doc_type == "cover_letter":
        tailored = dict(resume)
        key_qualifications = _string_list(resume.get("core_competencies") or [], 20)
        targeted_projects: list[dict[str, Any]] = []
    else:
        tailored = {
            **{key: value for key, value in resume.items() if key not in {"summary", "skills", "experience", "projects"}},
            "summary": _tailored_summary(resume.get("summary"), tailor_result.get("summary")),
            "core_competencies": _tailored_core_competencies(resume, tailor_result),
            "skills": _normalize_skill_groups(resume.get("skills"), tailor_result.get("skills")),
            "experience": _merge_experience_bullets(resume.get("experience"), tailor_result.get("experience")),
            "projects": _normalize_projects(resume.get("projects"), tailor_result.get("projects")),
        }
        key_qualifications = _tailored_core_competencies(resume, tailor_result)
        targeted_projects = _dict_list(tailor_result.get("targeted_projects"), 8)

    logger.info(
        "tailor.timing correlation_id=%s tailor_total_duration_ms=%s",
        correlation_id,
        round((perf_counter() - tailor_started_at) * 1000),
    )

    return {
        "resume_data": tailored,
        "core_competencies": key_qualifications,
        "key_qualifications": key_qualifications,
        "targeted_projects": targeted_projects,
        "cover_letter": cover_letter_text,
        "raw_ai_response": tailor_result,
    }
