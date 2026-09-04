"""Simple pasted-JD review: match score, freshness score, and tailoring."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any

from services.shared.deepseek import _complete, _complete_async



TAILOR_PROMPT = """
你是一位资深、跨行业的简历编辑专家。

根据职位描述（JD）对候选人的真实简历进行针对性优化。你的任务是筛选、合并、排序和改写，而不是创造新的经历。

不要预设候选人属于任何特定行业。首先根据 JD 判断该职位最重要的职责、能力和成功标准，再从简历中寻找最强证据。

只返回合法 JSON，不要输出解释或 Markdown：

{
"summary": "",
"core_competencies": [],
"skills": [{"type": "", "skills": []}],
"experience": [{"index": 0, "bullets": []}],
"projects": [{"name": "", "description": [], "technologies": []}]
}

---

## 核心原则

1. 识别 JD 中最重要的 4-7 个招聘信号，并优先使用简历中最强的真实证据证明它们。
2. 招聘相关性和证据强度优先于关键词数量。
3. 优先展示成果、责任范围、问题解决能力、专业能力及对客户/业务/团队的影响。
4. 不同 bullet 应尽量证明不同的重要能力，避免重复。
5. 使用目标职位自然的专业表达，但不要机械复制 JD。

所有内容必须有原始简历依据。

JD 中出现的关键词不是候选人具备该能力的证据。不得因技术相近、职责相近或职位要求而推断候选人掌握某项技能或拥有某类行业经验。例如，简历只有 React 时不得写 Angular；只有 AWS 时不得写 Azure；没有明确金融行业经历时不得写 BFSI 经验。

每段 experience 会提供 title、company、location、start_date、end_date 和 bullets。这些字段都是原始简历事实。输入中的 total_work_experience 是系统根据有效日期、去除重叠任职后计算的总任职时长；只有该时长与目标职位相关时，才可原样用于 summary。不得自行计算、四舍五入或写出任何其他年限。

严禁：

* 虚构技能、经历、职责、项目或成果；
* 虚构工作年限、公司、职位、客户或团队规模；
* 将参与描述成领导，除非原文支持；
* 将项目经验描述成正式工作经验；
* 为匹配 JD 而添加候选人没有的能力。

原简历中的数字、百分比、金额、时间和指标必须保持事实一致，不得估算或夸大。

---

## SUMMARY

生成 2-3 句简洁的职业简介。

根据 JD 选择最值得强调的：

* 职业定位；
* 核心专业能力；
* 与目标职位相关的经验年限、职业发展或行业背景（仅在 experience 的职位和日期支持时）；
* 最有说服力的成果或差异化优势。

每句话都必须有简历证据。

避免空洞表达，如 Results-driven、Passionate、Hard-working、Fast learner 等。

---

## CORE_COMPETENCIES

返回 4-7 个与 JD 最相关、且有简历证据支撑的核心能力短语，并按招聘重要性排序。

Core Competencies 应优先表达「招聘方希望候选人具备的能力、责任范围或价值创造方式」，而不是简单重新分组 Skills。

优先使用这类表达：

* End-to-End Feature Delivery
* Stakeholder Management
* Customer Acquisition
* Financial Analysis
* Process Improvement
* Automated Testing & Quality
* Project Delivery
* AI/ML Application

可以将核心能力与关键技术结合表达，例如：

Backend API Development
Cloud Infrastructure & Deployment
Performance Optimization
Distributed Systems
React/TypeScript Development
Automated Testing & Quality
Financial Analysis & Reporting
Customer Acquisition & Account Growth
Process Improvement & Operations

每项 Core Competency 应回答：

“招聘方为什么会因为候选人具备这项能力而更愿意录用他？”

具体能力必须根据当前 JD 动态判断，不得套用固定行业模板，也不得生成简历中没有证据支持的能力。

---

## SKILLS

只能从原始 skills 中选择已有技能，技能名称必须与原始 skills 中的字符串完全一致，不得新增、改名、合并、泛化或根据 JD 补全。

优先保留：

* JD 明确需要的技能；
* 在 experience / projects 中实际使用过的技能；
* 能支持核心招聘能力的技能。

删除明显低相关、重复或低价值技能。

保留原始 type，不得修改分组名称。
没有值得保留技能的分组可以省略。

---

## EXPERIENCE

必须返回每一个原始 experience.index，且每个 index 只出现一次。

不要改写并保留所有原始 bullet。
必须进行：筛选 + 合并 + 排序 + 精炼。

默认每段经历最多 3 条；原始 bullet 少于 3 条时，不得增加 bullet 数量。只有原始经历超过 6 条且每条均提供不同且强有力的 JD 证据时，最相关经历最多可保留 4 条。

如果更少的 bullet 已足够证明匹配度，不需要凑数量。

优先保留：

* 与 JD 核心要求直接相关的经历；
* 明确或可量化成果；
* Responsibility / Ownership；
* 重要问题解决；
* 效率、质量、成本、增长、风险等改善；
* 客户、用户、团队或业务影响；
* 当前职业中特别重要的专业能力。

具体评价标准必须根据 JD 决定。

优先删除或合并：

* 与 JD 相关性低的内容；
* 重复证明相同能力的 bullet；
* 低价值日常职责；
* 可以合并进更强 bullet 的细节。

不要为了展示更多技能而拆分一个完整成果，也不要把多个无关成果强行合并。

优秀 bullet 通常体现：

Action + Relevant Context + Result/Impact（如有真实证据）

没有数字但能证明重要责任或专业能力的内容也可以保留。

最强、最相关的内容排在最前面。

---

## PROJECTS

项目用于补充工作经历没有充分证明的重要招聘信号。

优先保留与 JD 高度相关、能体现重要能力或成果的内容。

删除低相关、重复或过度细节化的内容。

每个项目通常保留 4-6 条 description。

只能使用原始项目中已有的项目、技术和事实，不得虚构新项目。

---

## 最终要求

输出语言与原始简历保持一致。

最终结果应：

* 简洁、具体、自然；
* ATS-friendly；
* recruiter-friendly；
* 符合目标职业的表达方式；
* 适合约两页简历。

输出前检查：

* 每句话是否都有证据？
* 是否存在虚构或夸大？
* 是否保留了最强成果？
* 是否存在重复 bullet？
* 是否可以进一步合并或删除低价值内容？
* 是否真正针对当前 JD？

当前 JD 决定评价标准。
真实简历决定可以写什么。
招聘价值决定保留什么。
"""


COVER_LETTER_PROMPT = """你是一位资深职业顾问与求职信专家。请根据提供的职位描述(JD)和候选人的真实简历背景，为该职位定制撰写一封高说服力、专业且真诚的求职信（Cover Letter）正文内容。
只返回一个合法的 JSON 对象:
{
  "cover_letter": "求职信正文（仅包含正文段落，不要包含称谓抬头 Dear... 和落款 Sincerely...）"
}

要求：
1. 仅生成正文段落（3段，约 180 ~ 240 词）：
   - 系统会自动添加称谓（Dear Hiring Manager at [Company],）以及候选人署名落款，因此你【不要】在返回内容中包含称谓开头和署名结语，仅输出 3 个结构严谨、精炼有力的正文段落。
   - 篇幅控制：严格保持单页 A4 纸排版，字数控制在 180 ~ 240 英文单词（或 350 ~ 450 中文字），严禁冗长。
2. 结构与内容规范：
   - 第一段（动机与定位）：明确应聘岗位，精炼点明候选人核心专业背景与该职位高度契合的亮点。
   - 第二段（核心对标）：挑选 2-3 个与 JD 最相关的核心技能与量化工作成果展开，突出解决实际业务难题的能力，严禁虚构。
   - 第三段（公司认同与行动呼吁）：说明对公司业务/产品的认同与能带来的价值，礼貌表达期待进一步沟通/面试的意愿。
3. 语言真实专业：用词干练自信，紧密对标 JD 要求，杜绝空洞套话。
4. 使用 Markdown 的 **加粗** 标记突出每段最关键的职位、核心技能、量化成果或价值主张；每段 1-2 处，避免整句或过度加粗。
"""

BOTH_PROMPT = TAILOR_PROMPT + """

---

## 同时生成求职信

除上述所有简历编辑规则外，还要生成求职信。以下 JSON schema 取代前述输出 schema；只返回此合法 JSON，不要输出解释或 Markdown：

{
  "summary": "",
  "core_competencies": [],
  "skills": [{"type": "", "skills": []}],
  "experience": [{"index": 0, "bullets": []}],
  "projects": [{"name": "", "description": [], "technologies": []}],
  "cover_letter": ""
}

cover_letter 只包含 3 段正文，不包含称谓、日期、署名或结语，英文控制在 180-240 词（中文控制在 350-450 字）。

每一个技术、工作年限、项目、量化成果、客户背景及行业经验都必须能在输入简历中找到直接证据；JD 中的要求不能作为证据。不得把 React 写成 Angular、AWS 写成 Azure，或把相近经验写成候选人未证实的行业经验。

第一段说明应聘定位与最强的已证实匹配点；第二段仅选 2-3 项最相关的真实技能或成果；第三段说明候选人能带来的、由既有证据支撑的价值并表达沟通意愿。使用 Markdown 的 **加粗** 标记突出每段最关键的职位、技能、成果或价值主张，每段 1-2 处，避免整句或过度加粗。
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


def build_tailor_messages(job: dict, resume: dict, doc_type: str = "resume") -> list[dict[str, str]]:
    description = _text(job.get("job_description"))
    context = {
        "skills": resume.get("skills") if isinstance(resume.get("skills"), list) else [],
        "experience": _experience_bullet_context(resume.get("experience")),
        "projects": resume.get("projects") if isinstance(resume.get("projects"), list) else [],
    }
    total_work_experience = _total_work_experience(resume.get("experience"))
    if total_work_experience:
        context["total_work_experience"] = total_work_experience
    prompt = TAILOR_PROMPT
    if doc_type == "cover_letter":
        prompt = COVER_LETTER_PROMPT
    elif doc_type == "both":
        prompt = BOTH_PROMPT

    return [
        {"role": "system", "content": prompt},
        {"role": "user", "content": json.dumps({"job_description": description[:18000], "resume": context}, ensure_ascii=False)},
    ]


def review_job(job: dict, resume: dict, *, doc_type: str = "resume", tailor: bool = True, mock: bool = False) -> dict:
    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")
    tailored: dict[str, Any] | None = None
    key_qualifications: list[str] = []
    targeted_projects: list[dict[str, Any]] = []
    tailor_result: dict[str, Any] = {}
    cover_letter_text: str | None = None

    if tailor:
        if mock:
            # Token-saving mock mode
            mock_competencies = ["Full-Stack Engineering", "Backend Architecture", "System Design", "Agile Project Delivery"]
            tailored = dict(resume)
            if not _text(tailored.get("summary")):
                tailored["summary"] = f"Experienced candidate tailored for {job.get('title') or 'this position'}."
            key_qualifications = mock_competencies
            if doc_type in ("cover_letter", "both"):
                candidate_name = f"{_text(resume.get('basics', {}).get('first_name'))} {_text(resume.get('basics', {}).get('last_name'))}".strip() or "Candidate"
                target_role = job.get("title") or "Open Position"
                target_company = job.get("company") or "your team"
                cover_letter_text = (
                    f"Dear Hiring Team at {target_company},\n\n"
                    f"I am writing to express my strong interest in the {target_role} position. "
                    f"With my extensive experience in delivering impactful engineering solutions and solving complex technical challenges, "
                    f"I am excited about the opportunity to contribute to {target_company}.\n\n"
                    f"Throughout my career, I have consistently focused on building scalable systems, optimizing performance, and collaborating effectively with cross-functional teams. "
                    f"My technical background and proven track record make me a strong match for your key requirements.\n\n"
                    f"Thank you for considering my application. I look forward to discussing how my skills and experiences can benefit your upcoming initiatives.\n\n"
                    f"Sincerely,\n{candidate_name}"
                )
            tailor_result = {
                "mock": True,
                "note": "Generated in token-saving mock mode",
                "cover_letter": cover_letter_text,
            }
        else:
            tailor_result = _complete(
                build_tailor_messages(job, resume, doc_type=doc_type),
                temperature=0.3,
                operation="job_review_tailor",
                timeout=90.0,
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
) -> dict:
    """Cancellable async variant used by interactive resume generation."""
    if mock or not tailor:
        return review_job(job, resume, doc_type=doc_type, tailor=tailor, mock=mock)

    description = _text(job.get("job_description"))
    if not description:
        raise ValueError("A job description is required")

    tailor_result = await _complete_async(
        build_tailor_messages(job, resume, doc_type=doc_type),
        temperature=0.3,
        operation="job_review_tailor",
        timeout=90.0,
    )
    cover_letter_text = _text(tailor_result.get("cover_letter")) or None
    if doc_type == "cover_letter":
        tailored = dict(resume)
        key_qualifications = _string_list(resume.get("core_competencies") or [], 20)
        targeted_projects: list[dict[str, Any]] = []
    else:
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
        "key_qualifications": key_qualifications,
        "targeted_projects": targeted_projects,
        "cover_letter": cover_letter_text,
        "raw_ai_response": tailor_result,
    }
