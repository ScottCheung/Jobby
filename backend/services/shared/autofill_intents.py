"""Deterministic, explainable intent classification for application fields.

This module is deliberately independent of database state and external AI
providers. It is the high-confidence middle tier between cleaned browser DOM
labels and a user's saved mapping rules.
"""

from __future__ import annotations

from typing import Any


def _normalize_form_label(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _autofill_answer_category(label: str) -> str | None:
    norm = _normalize_form_label(label)
    if any(term in norm for term in ["notice period", "notice", "availability or notice", "notice period or availability", "离职状态", "离职通知期", "通知期", "离职期"]):
        return "notice_period"
    if any(term in norm for term in ["date available", "available date", "availability date", "earliest start date", "start date", "when can you start", "到岗时间", "最快到岗", "可到岗日期"]):
        return "date_available"
    if "current" in norm and any(term in norm for term in ["salary", "compensation", "remuneration", "ctc", "薪资", "目前薪资", "当前薪资"]):
        return "current_salary"
    if any(term in norm for term in ["day rate", "daily rate", "per day", "aud/day", "期望日薪", "日薪"]):
        return "day_rate"
    if any(term in norm for term in ["salary", "compensation", "remuneration", "pay expectation", "aud/year", "per year", "expected salary", "desired salary", "期望薪资", "目标薪资", "年薪"]):
        return "salary"
    if any(term in norm for term in ["visa sponsorship", "visa sponsor", "require sponsorship", "need sponsorship", "require visa", "sponsorship support", "签证赞助", "需要赞助"]):
        return "visa_sponsorship"
    if any(term in norm for term in ["citizenship", "nationality", "国籍"]):
        return "citizenship"
    if any(term in norm for term in ["details of your visa", "visa details", "details of visa", "visa type", "type of visa", "visa category", "签证类型", "签证细节"]):
        return "visa_type"
    if any(term in norm for term in ["on a work visa", "on a visa", "work visa", "working visa", "visa status", "current visa", "hold a visa", "visa holder", "签证状态", "持有签证"]):
        return "visa_status"
    if any(term in norm for term in ["work authorization", "authorized to work", "right to work", "work rights", "working rights", "full working rights", "eligible to work", "entitled to work", "legally authorized", "permission to work", "unrestricted work rights", "工作权限", "工作合法性", "合法工作"]):
        return "work_authorization"
    if any(term in norm for term in ["security clearance", "clearance status", "nv1", "nv2", "baseline clearance", "安全审查"]):
        return "security_clearance"
    if any(term in norm for term in ["police check", "background check", "criminal history", "无犯罪记录", "背景调查"]):
        return "police_check_consent"
    if any(term in norm for term in ["working with children", "wwcc", "wwc"]):
        return "wwcc_status"
    if any(term in norm for term in ["driver license", "driver's license", "driving license", "valid license", "驾照"]):
        return "drivers_license"
    if any(term in norm for term in ["work restriction", "restriction on work", "limitation on hours", "工作限制"]):
        return "work_restrictions"
    if any(term in norm for term in ["years of experience", "years experience", "experience years", "professional experience", "工作年限", "经验年限", "工作经验"]):
        # Do not reuse total years of experience for employer questions about
        # a specific product, technology, industry, or capability.
        if any(term in norm for term in [
            "ai product", "ai solution", "ai chatbot", "ai voice", "generative ai",
            "large language model", "llm", "nlp", "nlu", "retail", "e-commerce",
            "rest api", "webhook", "crm", "commercial environment", "technology engineering",
            "software engineering", "ai/ml",
        ]):
            return None
        return "experience"
    if any(term in norm for term in ["relocate", "relocation", "move for this role", "异地搬迁", "接受异地"]):
        return "relocation"
    if any(term in norm for term in ["office", "hybrid", "commute", "on-site", "onsite", "办公方式", "到岗频次"]):
        return "office_attendance"
    if any(term in norm for term in ["based", "where are you", "location", "city", "relocate", "所在城市", "当前位置", "居住地"]):
        return "location"
    if any(term in norm for term in ["text message", "sms", "text updates", "receive text"]):
        return "sms_opt_in"
    return None


def _autofill_intent_key(label: str) -> str | None:
    norm = _normalize_form_label(label)
    if norm in {"title", "salutation", "prefix", "honorific", "name prefix", "称谓", "尊称"}:
        return "identity.title"
    if "preferred name" in norm or "preferred first name" in norm or "常用名" in norm:
        return "identity.preferred_name"
    if "pronoun" in norm or "代词" in norm:
        return "identity.pronouns"
    if "legal name" in norm or "法定姓名" in norm:
        return "identity.legal_name"
    if any(term in norm for term in ["first name", "given name", "forename", "名字", "名"]):
        return "identity.first_name"
    if any(term in norm for term in ["last name", "family name", "surname", "姓氏", "姓"]):
        return "identity.last_name"
    if norm in {"name", "full name", "姓名", "全名"}:
        return "identity.full_name"
    if any(term in norm for term in ["email", "e-mail", "邮箱", "电子邮箱"]):
        if not any(
            alert_term in norm
            for alert_term in [
                "alert",
                "notification",
                "update",
                "marketing",
                "newsletter",
                "consent",
                "opt in",
                "opt-in",
                "subscribe",
                "receive",
                "send me",
                "message",
                "promot",
                "communication",
            ]
        ):
            return "identity.email"
    if any(term in norm for term in ["phone", "mobile", "contact number", "telephone", "电话", "手机", "联系电话"]):
        return "identity.phone"
    if any(term in norm for term in ["linkedin", "linked in", "领英"]):
        return "employment.linkedin_url"
    if any(term in norm for term in ["github", "git hub"]):
        return "employment.github_url"
    if any(term in norm for term in ["portfolio", "portfolio url", "作品集"]):
        return "employment.portfolio_url"
    if any(term in norm for term in ["website", "personal website", "personal site", "个人网站"]):
        return "employment.website"
    if any(term in norm for term in ["day rate", "daily rate", "per day", "aud/day", "期望日薪"]):
        return "compensation.desired_day_rate"
    if (
        any(term in norm for term in ["authorized to work", "right to work", "work rights", "eligible to work"])
        and any(term in norm for term in ["without sponsorship", "without visa sponsorship", "no sponsorship"])
    ):
        return "employment.work_authorization_without_sponsorship"
    category = _autofill_answer_category(label)
    return {
        "location": "employment.current_location", "office_attendance": "employment.office_attendance",
        "salary": "compensation.desired_base_salary", "day_rate": "compensation.desired_day_rate",
        "current_salary": "compensation.current_salary", "citizenship": "employment.citizenship",
        "visa_status": "employment.visa_status", "visa_type": "employment.visa_type",
        "visa_sponsorship": "employment.visa_sponsorship", "work_authorization": "employment.work_authorization",
        "security_clearance": "employment.security_clearance", "police_check_consent": "employment.police_check_consent",
        "wwcc_status": "employment.wwcc_status", "drivers_license": "employment.drivers_license",
        "work_restrictions": "employment.work_restrictions", "experience": "experience.years",
        "relocation": "employment.relocation", "date_available": "employment.date_available",
        "notice_period": "employment.notice_period", "sms_opt_in": "consent.sms",
    }.get(category)


_ATS_PLATFORMS = {
    "indeed",
    "glassdoor",
    "workday",
    "greenhouse",
    "lever",
    "ashby",
    "smartrecruiters",
    "taleo",
    "icims",
    "successfactors",
    "oracle",
    "workable",
    "bamboohr",
    "jora",
    "ziprecruiter",
    "adzuna",
    "wellfound",
    "dice",
    "simplyhired",
    "careerone",
    "micro1",
    "dayforce",
    "avature",
}


def _autofill_intent_key_for_field(field: Any, platform: str = "generic") -> str | None:
    """Use ATS identifiers only after the cleaned visible label did not match."""
    if isinstance(field, dict):
        field_type = str(field.get("type") or "").lower()
        label = str(field.get("label") or "")
        hints = (field.get("name"), field.get("id"))
    else:
        field_type = str(getattr(field, "type", "") or "").lower()
        label = str(getattr(field, "label", "") or "")
        hints = (getattr(field, "name", None), getattr(field, "id", None))

    intent = _autofill_intent_key(label)
    if not intent and platform in _ATS_PLATFORMS:
        for hint in hints:
            intent = _autofill_intent_key(str(hint or "").replace("_", " ").replace("-", " "))
            if intent:
                break
    if intent in {
        "identity.email",
        "identity.first_name",
        "identity.last_name",
        "identity.phone",
        "employment.linkedin_url",
        "employment.github_url",
        "employment.portfolio_url",
        "employment.website",
    }:
        if field_type in {"radio", "checkbox", "select"}:
            return None
    return intent


def _inverse_sponsorship_answer(value: str | None) -> str | None:
    """Answer an explicit *without sponsorship* question from sponsorship need."""
    normalized = _normalize_form_label(str(value or ""))
    if normalized in {"yes", "true", "1", "required", "require", "needed", "need"}:
        return "No"
    if normalized in {"no", "false", "0", "not required", "none", "not needed"}:
        return "Yes"
    if "sponsor" in normalized or "visa" in normalized:
        if any(term in normalized for term in {"not required", "not needed", "no sponsorship", "without sponsorship"}):
            return "Yes"
        if any(term in normalized for term in {"required", "require", "needed", "need"}):
            return "No"
    return None


# Public aliases
normalize_form_label = _normalize_form_label
autofill_answer_category = _autofill_answer_category
autofill_intent_key = _autofill_intent_key
autofill_intent_key_for_field = _autofill_intent_key_for_field
inverse_sponsorship_answer = _inverse_sponsorship_answer
ATS_PLATFORMS = frozenset(_ATS_PLATFORMS)

__all__ = [
    "ATS_PLATFORMS",
    "autofill_answer_category",
    "autofill_intent_key",
    "autofill_intent_key_for_field",
    "inverse_sponsorship_answer",
    "normalize_form_label",
    "_ATS_PLATFORMS",
    "_autofill_answer_category",
    "_autofill_intent_key",
    "_autofill_intent_key_for_field",
    "_inverse_sponsorship_answer",
    "_normalize_form_label",
]

