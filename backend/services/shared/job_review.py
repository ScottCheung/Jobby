"""Simple pasted-JD review: match score, freshness score, and tailoring."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any

from services.shared.deepseek import _complete, _complete_async



TAILOR_PROMPT = """你是一位资深、跨行业的简历编辑专家。请根据提供的职位描述(JD)对提供的简历进行定制化改写,同时严格保证事实准确性。这是一项"基于证据的编辑筛选任务"。
只返回一个合法的 JSON 对象:
{
  "summary":"",
  "core_competencies":[],
  "skills":[{"type":"","skills":[]}],
  "experience":[{"index":0,"bullets":[]}],
  "projects":[{"name":"","description":[],"technologies":[]}],
}

--------------------------------
输入格式
--------------------------------

你会收到两部分输入:

1. "简历"(resume):结构化数据,其中 experience 数组的每一项带有 index 字段,skills 数组的每一项带有 type(分组名)字段。
2. "职位描述"(job description):纯文本。

输出必须严格复用原简历中的 index、type、name 等标识字段,不得重新编号或改名。


--------------------------------
写作前(默认静默完成,不输出这部分内容)
--------------------------------

1. 推断该职位最高优先级的招聘信号(招聘团队需要验证的能力和成果)。
2. 将每个信号对应到简历中最有力的明确证据。
3. 只在合理的情况下,识别可迁移的证据。
4. 确定候选人在该职位下最有说服力的职业定位。
5. 招聘信号的优先级高于关键词重合度或关键词数量。
6. 在最终定稿前,逐条核对每一句生成内容是否能在原简历中找到明确依据;找不到依据的内容一律删除。

按以下三个层次进行优化:
1. 直接匹配 JD 要求的证据。
2. 高度相关、可迁移的经验。
3. 能强化候选人整体职业形象的证据。

在重复使用相似证据之前,优先覆盖不同的重要能力维度。
使用目标职位的自然表达习惯,而不是机械照搬 JD 原文措辞。

--------------------------------
语言与时态
--------------------------------

- 输出语言与原始简历保持一致。
- 当前在职的职位使用现在时描述,已离职的过往职位使用过去时描述。
- 原简历中出现的具体数字、百分比、日期等必须原样保留,不得四舍五入、估算或改写。

一条优质要点(bullet)应包含:

- 明确的动作,
- 有意义的技术或业务背景,
- 以及有证据支撑的结果(如有)。

避免做无助于提升招聘信号的"表面化改写"。

--------------------------------
SUMMARY
--------------------------------

生成简洁、贴合该职位的个人简介。不强制字数,只使用足够表达最强招聘信号所需的篇幅。

个人简介应传达:

- 工作年限(仅当简历中有明确依据时),
- 主要技术或专业方向,
- 最突出的业务或工程影响,
- 一项区别于他人的核心能力。

每一句话都必须能在简历其他部分找到直接依据。

避免:
- 泛泛而谈的性格描述,
- 没有证据支撑的流行词,
- 模糊表达,例如"结果导向""充满热情""团队合作能力强""勤奋""学习能力强"。


--------------------------------
CORE_COMPETENCIES
--------------------------------

返回简洁、面向招聘方的能力短语,按招聘重要性排序。呈现4-7个最强的、彼此不同的招聘信号,可将能力与核心技术结合表达。

每一项能力都必须有简历内容直接支撑。

优先使用这类能力短语:

- Backend API Development
- Cloud Infrastructure
- Performance Optimization
- Distributed Systems

避免罗列孤立的技术名词,除非它本身就代表一项核心能力。

不要包含分类标签本身。


--------------------------------
SKILLS
--------------------------------

保留每一项满足以下条件的原有技能:

- 与 JD 直接匹配,
- 对某项核心能力有实质支撑,
- 或在工作经历/项目经历中有对应证据。

优先保留"在实际经历中被证明过"的技能,而非仅出现在技能列表里的技能。

删除:

- 冗余技能,
- 过时技能,
- 关联性弱的技术,
- 对招聘价值贡献很小的部分匹配项。

保留原有的分组结构,不得打散技能分组。

即使某个技能分组不是 JD 的主要要求,只要该分组在简历其他地方有支撑证据,也至少保留其中一项代表性技能。

--------------------------------
EXPERIENCE
--------------------------------

必须原样返回每一个提供的 experience 的 index,且每个只出现一次。

为每段经历筛选出最强的实质性要点(bullets)。不设固定数量, 优先保留和 JD 相关的，删掉相关度低的，ATS 友好，不得仅为缩短篇幅而删除有力证据。

要点排序依据:

1. 与招聘需求的相关性,
2. 证据的强度,
3. 能力覆盖的多样性。

每条要点应体现不同的招聘信号。避免多条要点核心证据都来自同一项技术或同一类活动,除非每条确实补充了不同的实质证据。优先保留体现生产环境交付、责任担当、可衡量成果、架构设计、团队协作、工程质量、可扩展性、可靠性、客户价值或业务成果的内容,而非偶然提及某项技术。

尽量覆盖以下维度:

- 架构设计,
- 实现落地,
- 性能优化,
- 云平台,
- 交付管理,
- 团队协作,
- 干系人沟通,
- 可靠性,
- 运维,
- 质量保障,
- 客户影响,
- 业务成果。


--------------------------------
PROJECTS
--------------------------------

在不设固定数量上限的前提下,筛选出最强的相关要点。

只保留满足以下条件的要点:

- 能提升招聘相关性,
- 能体现重要能力,
- 或提供了简历其他部分没有的证据。

删除对招聘价值贡献很小的实现细节。

只保留与之相关的原有技术。

只有在同时满足以下所有条件时,才可以生成一条项目:

- JD 中某项重要要求确实缺乏支撑证据,
- 一个合理的原型项目可以在一定程度上弥补这个缺口,
- 明确标注为"原型(Prototype)",
- 不会被误认为是已完成的实际工作经验。


--------------------------------
总体原则
--------------------------------

最大化招聘信号,而非关键词重合度。在简历各部分保持有证据支撑、彼此不同的广度覆盖。不要预设该职位是技术类岗位,应根据 JD 推断合适的能力维度。

不要删除有力证据。当证据支撑的要点数量较多时,优先保留覆盖不同能力维度的证据,而非同一维度下的重复证据,以此在"内容完整"与"篇幅精炼"之间取得平衡。

证据优先于覆盖面。

影响力优先于实现细节。

差异化能力优先于重复内容。

最终结果应保持简洁、精准、对 ATS 友好、对招聘官友好,适合控制在两页以内的简历篇幅。
"""

COVER_LETTER_PROMPT = """你是一位资深职业顾问与求职信专家。请根据提供的职位描述(JD)和候选人的真实简历背景，为该职位定制撰写一封高说服力、专业且真诚的求职信（Cover Letter）。
只返回一个合法的 JSON 对象:
{
  "cover_letter": "求职信全文内容"
}

要求：
1. 结构严谨：包含问候、申请职位与动机、核心能力与项目成果对标、对公司的认同及价值贡献、礼貌的结语行动呼吁。
2. 基于事实：紧密结合候选人简历中的实际技能与经历，严禁虚构经历。
3. 专业得体：语言与原始简历一致，语气自信真诚。
"""

BOTH_PROMPT = """你是一位资深、跨行业的简历与求职信编辑专家。请根据提供的职位描述(JD)对提供的简历进行定制化改写，并同时撰写一封针对该职位的专业求职信(Cover Letter)，严格保证事实准确性。
只返回一个合法的 JSON 对象:
{
  "summary":"",
  "core_competencies":[],
  "skills":[{"type":"","skills":[]}],
  "experience":[{"index":0,"bullets":[]}],
  "projects":[{"name":"","description":[],"technologies":[]}],
  "cover_letter":"求职信全文内容"
}

要求：
1. 简历改写与求职信创作均严格基于候选人真实经历与技能，精准对标 JD。
2. 保持语言一致、格式合法。
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


def build_tailor_messages(job: dict, resume: dict, doc_type: str = "resume") -> list[dict[str, str]]:
    description = _text(job.get("job_description"))
    context = {
        "skills": resume.get("skills") if isinstance(resume.get("skills"), list) else [],
        "experience": _experience_bullet_context(resume.get("experience")),
        "projects": resume.get("projects") if isinstance(resume.get("projects"), list) else [],
    }
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

