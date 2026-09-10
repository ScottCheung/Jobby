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


OUTPUT_LANGUAGE_ALIASES = {
    "en": "en",
    "en-us": "en",
    "english": "en",
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "chinese": "zh-CN",
    "simplified chinese": "zh-CN",
}


def normalize_output_language(value: Any) -> str:
    """Return one of the supported generated-document languages."""
    normalized = str(value or "").strip().casefold()
    return OUTPUT_LANGUAGE_ALIASES.get(normalized, "en")


def _output_language_label(value: str) -> str:
    return "英文" if value == "en" else "简体中文"


_OUTPUT_LANGUAGE_RULES = """
## 输出语言

要求输出语言：{language_label}（{language_code}）。

所有新生成的文字都必须使用要求的输出语言，包括 `summary`、`core_competencies`、`experience` 中的简介和条目、`projects` 中的描述，以及 `cover_letter`。不得根据系统提示、源简历或 JD 的语言推断输出语言。专有名词、公司名、产品名、技术名以及锁定的事实元数据保持原文。
"""


_RULES = """
## 事实与选择规则

候选人事实只能来自源简历；JD 只决定相关性，不能证明候选人拥有任何技能或经历。不得新增或推断未经支持的技能、技术、职责、成果、行业经验、工作年限、领导力、客户名称、团队规模、项目、证书、教育背景或量化结果。

可以改善措辞，但不得改变事实含义、技术事实、责任级别、数字、日期或指标。不得把参与描述成领导，也不得把项目经验写成工作经验。例如，React 不得变成 Angular，AWS 不得变成 Azure。

不得用合理推断补齐未明确提供的经历；合理 ≠ 有证据。例如，端到端负责不代表做过客户调研，跨职能协作不代表有客户沟通经验。JD 只能决定什么重要，不能决定候选人做过什么。

输入中的 total_work_experience 是系统根据有效日期和去重重叠任职计算的唯一权威总任职时长；仅当它能增强当前申请时才可原样使用，绝不可自行计算、四舍五入或改写。

最终简历应优先体现 JD 中最重要、且有源简历明确证据支持的能力和成果。没有源简历证据的 JD 要求不得写成候选人的经历或能力。

选择内容时按以下优先级：
事实准确性 > JD 相关性 > 证据强度 > 信息密度。

若某条经历或某个项目是重要 JD 要求最强或唯一的真实证据，应优先保留。不得因为证据来自项目就自动降权，也不得仅因为类似技术已在其他经历出现就删除。

优先保留具体成果、明确负责范围、问题解决、可靠性、性能、成本、业务或用户影响。减少重复、泛化职责和低相关实现细节。

直接根据以上规则生成最终 JSON，不要描述或输出分析过程。
"""


_SUMMARY_RULES = """
## 职业简介（summary）

生成 2–3 句、约 45–70 词的简洁职业简介，动态突出目标职业定位、最强 JD 对齐能力、相关经历和最有说服力的证据型差异化优势，以及仅在确实重要时提及的相关教育或证书。不要逐字重复经历条目。

优先顺序：目标职业定位 > 最强 JD 对齐能力 > 最有说服力的证据型差异化优势。

不要强制写工作年限；若使用 `total_work_experience`，只能原样使用提供的系统计算值。避免“结果导向”“充满热情”“勤奋”“学习能力强”等空泛表述。
"""


_CORE_COMPETENCIES_RULES = """
## 核心能力（core_competencies）

选择 4–6 个最能说明候选人适合当前 JD 的核心能力，并按 JD 中的招聘重要性排序。

每个核心能力必须：

* 对应 JD 中重要的职责或要求；
* 有 `experience` 或 `projects` 中的具体证据支持；
* 表达能力、责任范围或工程结果，而不是工具清单或单个技能名称；
* 足够具体，能体现候选人的差异化。

优先使用「能力 + 范围/结果」或「系统责任 + 工程价值」的表达方式，例如：API 设计与数据库优化、前端架构与性能优化、云部署与基础设施自动化、生产可靠性与故障排查、第三方系统集成。

避免泛化软技能、职位名称、“团队协作”等空泛短语，以及仅仅改写单个 `skills` 的能力名称。只返回核心能力短语。
"""


_SKILLS_RULES = """
## 技能（skills）

只能选择原始 `skills` 数据中已有的技能，保留完全相同的技能字符串和原始分组 `type`。不得新增、改名、合并、泛化、根据 JD 补全或以相关技术替代。

优先保留 JD 明确需要、在 `experience` 或 `projects` 中实际使用过、或能支撑核心招聘能力的技能。无足够相关技能的整个分组可以省略。
"""


_EXPERIENCE_RULES = """
## 工作经历（experience）

使用 `index` 标识源条目。只返回 `summary` 或 `bullets` 需要修改的工作经历；未返回的条目保持原样。`company`、`title`、`location` 和日期是锁定的源事实。可在每段经历内部选择、改写、合并、缩短和重排经历条目，但每一项事实都必须有源简历支持。

对于返回的工作经历，输出一条精炼的 `summary`（概括该角色在组织中的定位、交付的核心领域或主要责任，通常为 1 句话，18–25 词；若源经历已有 summary 则基于原事实与目标职位要求进行优化）。`summary` 不得重复经历条目中已经表达的成就。

按 JD 相关性和证据强度分配经历条目信息预算：

* 高相关经历：当有足够彼此不同的强证据时，通常保留 3–5 条。
* 中相关经历：通常保留 2–4 条。
* 低相关经历：通常保留 1–2 条。

整体优先控制在约 10–14 条经历条目；宁可保留更少的强条目，也不要填满配额。

这些范围是指导，不是最低配额。若额外内容重复、薄弱、泛泛或与 JD 关联很弱，应使用更少条目；绝不可为了达到目标数量而保留内容、创造证据或把一项成果拆成多条。不得超过该经历的原始条目数量，也不得输出超过源材料能够支持的独立条目。可合并密切相关的源条目，但不得强行合并无关成果。

优先选择：对主要 JD 要求的直接证据、强成果或可量化结果、有实质意义的负责范围或责任、重要问题解决、客户/业务/用户/团队影响、质量/可靠性/效率/成本/增长/交付/风险改进，以及与目标职业相关的重要专业能力。

优先删除或合并：低相关细节、泛化日常职责、同一能力的重复证据、已被更强结果覆盖的实现细节，以及脱离有意义上下文的技术罗列。

强条目通常在源材料支持时呈现「行动 + 相关背景 + 结果/影响」。数字并非必需；有价值的责任或专业能力也应保留。每段经历内最强、最相关的证据排在最前面；不得重排工作经历本身。
"""


_PROJECTS_RULES = """
## 项目（projects）

保留能为重要 JD 要求提供强证据的项目，尤其是能展示从零构建、独立负责、特定产品/领域能力或重要技术成果的项目。

每个项目通常保留 1–3 条描述；高度相关时最多 4 条。删除重复或低价值内容，不得虚构项目、技术、职责或结果。
"""


_COVER_LETTER_RULES = """
## 求职信（cover_letter）

生成 3 段、仅含正文的求职信：不得包含称谓、日期、候选人署名、“Sincerely” 或其他结语。`cover_letter` 必须使用“输出语言”规定的语言。英文控制在约 180–240 词，中文控制在约 350–450 字。

第一段说明应聘定位及最强的已证实匹配点；第二段选择 2–3 项最相关的真实技能或成果；第三段基于既有证据说明可带来的价值，并礼貌表达沟通意愿。不得在 JD 未提供信息时声称了解公司的产品、使命、文化、客户或战略；此时应以职位职责为依据使用审慎、真实的措辞。

语言应专业、具体且避免空话。使用 Markdown 的 **加粗** 标记突出每段最关键的职位、技能、成果或价值主张，每段 1–2 处，避免加粗整句或过度加粗。
"""


_RESUME_SCHEMA = """{
  "summary": "",
  "core_competencies": [],
  "skills": [{"type": "", "skills": []}],
  "experience": [{"index": 0, "summary": "<一句话的角色简介>", "bullets": []}],
  "projects": [{"index": 0, "description": [], "technologies": []}]
}"""

_COVER_LETTER_SCHEMA = """{
  "cover_letter": ""
}"""

_BOTH_SCHEMA = """{
  "summary": "",
  "core_competencies": [],
  "skills": [{"type": "", "skills": []}],
  "experience": [{"index": 0, "summary": "<一句话的角色简介>", "bullets": []}],
  "projects": [{"index": 0, "description": [], "technologies": []}],
  "cover_letter": ""
}"""


def _build_tailor_prompt(doc_type: str, output_language: str = "en") -> str:
    output_language = normalize_output_language(output_language)
    language_rules = _OUTPUT_LANGUAGE_RULES.format(
        language_label=_output_language_label(output_language),
        language_code=output_language,
    )
    if doc_type == "cover_letter":
        sections = (language_rules, _RULES, _COVER_LETTER_RULES)
        schema = _COVER_LETTER_SCHEMA
    elif doc_type == "both":
        sections = (
            language_rules,
            _RULES,
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
            language_rules,
            _RULES,
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
        "## 输出格式\n\n只返回一个符合以下 JSON 结构的对象，不要输出解释或 JSON 以外的内容：\n\n" + schema,
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
        entry_ctx: dict[str, Any] = {
            "index": index,
            "title": _text(item.get("title")),
            "company": _text(item.get("company")),
            "location": _text(item.get("location")),
            "start_date": _text(item.get("start_date")),
            "end_date": _text(item.get("end_date")),
            "bullets": [b.strip() for b in bullets if isinstance(b, str) and b.strip()],
        }
        if _text(item.get("summary")):
            entry_ctx["summary"] = _text(item.get("summary"))
        result.append(entry_ctx)
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
        summary = _text(entry.get("summary") or entry.get("role_summary"))
        if summary and not summary.startswith("<"):
            merged[index]["summary"] = summary
        bullets = entry.get("bullets", entry.get("description"))
        if isinstance(bullets, str):
            bullets = [bullets]
        if isinstance(bullets, list):
            source_bullets = _source_description(merged[index].get("description"))
            max_bullets = min(len(source_bullets), 6)
            cleaned = [item.strip() for item in bullets if isinstance(item, str) and item.strip()][:max_bullets]
            if cleaned:
                merged[index]["description"] = cleaned
        seen_indexes.add(index)
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


def _generated_prose(result: dict[str, Any], doc_type: str) -> str:
    parts: list[str] = []
    if doc_type in {"resume", "both"}:
        parts.append(_text(result.get("summary")))
        for entry in result.get("experience", []) if isinstance(result.get("experience"), list) else []:
            if isinstance(entry, dict):
                parts.append(_text(entry.get("summary")))
                parts.extend(_string_list(entry.get("bullets", entry.get("description")), 20))
        for project in result.get("projects", []) if isinstance(result.get("projects"), list) else []:
            if isinstance(project, dict):
                parts.extend(_string_list(project.get("description"), 20))
    if doc_type in {"cover_letter", "both"}:
        parts.append(_text(result.get("cover_letter")))
    return " ".join(part for part in parts if part)


def generated_prose_is_mostly_chinese(result: dict[str, Any], doc_type: str) -> bool:
    """Detect a clear Chinese-language drift in content requested in English."""
    prose = _generated_prose(result, doc_type)
    cjk_count = len(re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]", prose))
    latin_count = len(re.findall(r"[A-Za-z]", prose))
    return cjk_count >= 8 and cjk_count > latin_count


def _language_retry_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        *messages,
        {
            "role": "user",
            "content": "语言校验失败。请立即重新生成完整 JSON。所有新生成的文字必须使用要求的输出语言；只返回 JSON。",
        },
    ]


def _complete_with_language_validation(
    messages: list[dict[str, str]],
    *,
    doc_type: str,
    output_language: str,
    operation: str,
    timeout: float,
    correlation_id: str | None,
    user_id: UUID | None,
) -> dict[str, Any]:
    result = _complete(
        messages,
        temperature=0.3,
        operation=operation,
        timeout=timeout,
        correlation_id=correlation_id,
        user_id=user_id,
        reasoning_effort="low",
    )
    if output_language == "en" and generated_prose_is_mostly_chinese(result, doc_type):
        logger.warning("tailor.language_drift operation=%s; retrying once", operation)
        result = _complete(
            _language_retry_messages(messages),
            temperature=0.2,
            operation=operation,
            timeout=timeout,
            correlation_id=correlation_id,
            user_id=user_id,
            reasoning_effort="low",
        )
    return result


async def _complete_with_language_validation_async(
    messages: list[dict[str, str]],
    *,
    doc_type: str,
    output_language: str,
    operation: str,
    timeout: float,
    correlation_id: str | None,
    user_id: UUID | None,
) -> dict[str, Any]:
    result = await _complete_async(
        messages,
        temperature=0.3,
        operation=operation,
        timeout=timeout,
        correlation_id=correlation_id,
        user_id=user_id,
        reasoning_effort="low",
    )
    if output_language == "en" and generated_prose_is_mostly_chinese(result, doc_type):
        logger.warning("tailor.language_drift operation=%s; retrying once", operation)
        result = await _complete_async(
            _language_retry_messages(messages),
            temperature=0.2,
            operation=operation,
            timeout=timeout,
            correlation_id=correlation_id,
            user_id=user_id,
            reasoning_effort="low",
        )
    return result


def build_tailor_messages(job: dict, resume: dict, doc_type: str = "resume") -> list[dict[str, str]]:
    description = _text(job.get("job_description"))
    output_language = normalize_output_language(job.get("output_language"))
    basics = resume.get("basics") if isinstance(resume.get("basics"), dict) else {}
    resume_context: dict[str, Any] = {
        "skills": resume.get("skills") if isinstance(resume.get("skills"), list) else [],
        "experience": _experience_bullet_context(resume.get("experience")),
        "projects": _project_context(resume.get("projects")),
        "education": resume.get("education") if isinstance(resume.get("education"), list) else [],
        "certifications": resume.get("certifications") if isinstance(resume.get("certifications"), list) else [],
    }
    for key, value in (
        ("headline", basics.get("headline")),
        ("summary", resume.get("summary")),
        ("core_competencies", resume.get("core_competencies")),
    ):
        if value:
            resume_context[key] = value
    total_work_experience = _total_work_experience(resume.get("experience"))
    if total_work_experience:
        resume_context["total_work_experience"] = total_work_experience
    prompt = _build_tailor_prompt(doc_type, output_language)

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
                        "output_language": output_language,
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
    output_language: str | None = None,
) -> dict:
    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")
    output_language = normalize_output_language(
        output_language if output_language is not None else job.get("output_language")
    )
    generation_job = {**job, "output_language": output_language}
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
            if doc_type in ("resume", "both") and isinstance(tailored.get("experience"), list):
                mock_exp = []
                for exp in tailored["experience"]:
                    if isinstance(exp, dict):
                        e = dict(exp)
                        if not e.get("summary"):
                            e["summary"] = f"Delivered impactful solutions as {e.get('title') or 'Engineer'} at {e.get('company') or 'the company'}."
                        mock_exp.append(e)
                tailored["experience"] = mock_exp
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
            tailor_result = _complete_with_language_validation(
                build_tailor_messages(generation_job, resume, doc_type=doc_type),
                doc_type=doc_type,
                output_language=output_language,
                operation=_tailor_operation(doc_type),
                timeout=90.0,
                correlation_id=correlation_id,
                user_id=user_id,
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
        "output_language": output_language,
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
    output_language: str | None = None,
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
            output_language=output_language,
        )

    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")
    output_language = normalize_output_language(
        output_language if output_language is not None else job.get("output_language")
    )
    generation_job = {**job, "output_language": output_language}

    tailor_started_at = perf_counter()
    targeted_projects: list[dict[str, Any]] = []
    tailor_result = await _complete_with_language_validation_async(
        build_tailor_messages(generation_job, resume, doc_type=doc_type),
        doc_type=doc_type,
        output_language=output_language,
        operation=_tailor_operation(doc_type),
        timeout=90.0,
        correlation_id=correlation_id,
        user_id=user_id,
    )
    cover_letter_text = _text(tailor_result.get("cover_letter")) or None
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
        "output_language": output_language,
    }
