import re
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from services.shared.autofill_memory import fallback_mapping_scenes, platform_mapping_scene
from services.shared.autofill_profile import (
    PROFILE_PREFERENCES_KEY,
    core_profile_rows,
    core_profile_values,
    decrypt_profile_value,
    default_core_value_transform,
    delete_core_profile_value,
    encrypt_profile_value,
    ensure_identity_core_values,
    extract_semantic_features,
    form_control_fingerprint,
    match_mapping_rule,
    normalize_alias,
    normalize_scene,
    suggested_custom_core_key,
    transformed_core_value,
    upsert_core_profile_value,
)
from services.shared.models import (
    FieldMappingRule,
    FormTempChange,
    JobHuntingProfile,
    QuestionCacheEntry,
    User,
    UserCoreProfile,
)
from services.shared.schemas import (
    ApplicationFormInstructionsRequest,
    FormAutofillInstructionsRequest,
    FormAutofillInstructionsResponse,
)
from services.shared.time_utils import utc_now

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
        return "identity.email"
    if any(term in norm for term in ["phone", "mobile", "contact number", "telephone", "电话", "手机", "联系电话"]):
        return "identity.phone"
    if any(term in norm for term in ["day rate", "daily rate", "per day", "aud/day", "期望日薪"]):
        return "compensation.desired_day_rate"
    # This is not the same question as ordinary work authorization. A
    # candidate who may work only with sponsorship is authorized to work, but
    # must answer "No" to "without sponsorship". Keep the polarity in the
    # intent so it cannot be lost during option mapping.
    if (
        any(term in norm for term in ["authorized to work", "right to work", "work rights", "eligible to work"])
        and any(term in norm for term in ["without sponsorship", "without visa sponsorship", "no sponsorship"])
    ):
        return "employment.work_authorization_without_sponsorship"
    category = _autofill_answer_category(label)
    return {
        "location": "employment.current_location",
        "office_attendance": "employment.office_attendance",
        "salary": "compensation.desired_base_salary",
        "day_rate": "compensation.desired_day_rate",
        "current_salary": "compensation.current_salary",
        "citizenship": "employment.citizenship",
        "visa_status": "employment.visa_status",
        "visa_type": "employment.visa_type",
        "visa_sponsorship": "employment.visa_sponsorship",
        "work_authorization": "employment.work_authorization",
        "security_clearance": "employment.security_clearance",
        "police_check_consent": "employment.police_check_consent",
        "wwcc_status": "employment.wwcc_status",
        "drivers_license": "employment.drivers_license",
        "work_restrictions": "employment.work_restrictions",
        "experience": "experience.years",
        "relocation": "employment.relocation",
        "date_available": "employment.date_available",
        "notice_period": "employment.notice_period",
        "sms_opt_in": "consent.sms",
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
    """Classify a field from its clean label, then conservative machine hints.

    The DOM label remains authoritative. ATS identifiers are only a fallback
    when the label itself cannot be classified, which avoids an opaque id
    overriding a human-readable question.
    """
    intent = _autofill_intent_key(str(getattr(field, "label", "") or ""))
    if intent:
        return intent
    if platform not in _ATS_PLATFORMS:
        return None
    for hint in (getattr(field, "name", None), getattr(field, "id", None)):
        normalized_hint = str(hint or "").replace("_", " ").replace("-", " ")
        intent = _autofill_intent_key(normalized_hint)
        if intent:
            return intent
    return None


def _inverse_sponsorship_answer(value: str | None) -> str | None:
    """Return the answer to an explicit *without sponsorship* question."""
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


def _canonical_autofill_intent_key(value: str) -> str:
    raw = str(value or "").strip()
    normalized = normalize_alias(raw)
    if normalized in {
        "title",
        "salutation",
        "prefix",
        "honorific",
        "name prefix",
        "identity title",
        "identity salutation",
        "identity prefix",
        "learned title",
        "learned salutation",
        "custom title",
    }:
        return "identity.title"
    return raw


def _compatible_form_field_types(left: str, right: str) -> bool:
    """Allow safe reuse between equivalent text and choice controls."""
    if left == right:
        return True
    text_like = {"text", "textarea", "number"}
    choice_like = {"select", "radio"}
    return (left in text_like and right in text_like) or (left in choice_like and right in choice_like)


def _field_semantic_features(field: Any) -> list[str]:
    explicit = list(getattr(field, "semantic_features", None) or [])
    return explicit or extract_semantic_features(field.label, getattr(field, "name", None) or "", getattr(field, "id", None) or "")


def _match_form_mapping_rule(
    db: Session,
    *,
    user_id: UUID,
    field: Any,
    platform: str,
    scene: str,
    semantic_features: list[str],
) -> Any | None:
    """Prefer a user correction for this ATS, then reuse generic memory."""
    for mapping_scene in fallback_mapping_scenes(platform, scene):
        match = match_mapping_rule(
            db,
            user_id=user_id,
            alias=field.label,
            scene=mapping_scene,
            semantic_features=semantic_features,
            field_type=field.type,
        )
        if match:
            return match
    return None


def _is_single_consent_checkbox(field: Any) -> bool:
    """A required, single checkbox that records acceptance of site terms."""
    if str(getattr(field, "type", "")).casefold() != "checkbox":
        return False
    label = normalize_alias(
        " ".join(
            str(value or "")
            for value in (
                getattr(field, "label", ""),
                getattr(field, "name", ""),
                getattr(field, "id", ""),
            )
        )
    )
    return bool(
        getattr(field, "required", False)
        and re.search(r"(?:privacy|consent|terms|conditions|have read|agree|acknowledge|accept)", label)
    )


def _is_privacy_or_terms_checkbox(field: Any) -> bool:
    label = normalize_alias(
        " ".join(
            str(val) for val in (
                getattr(field, "label", ""),
                getattr(field, "name", ""),
                getattr(field, "id", ""),
            ) if val
        )
    )
    return bool(
        str(getattr(field, "type", "")).casefold() == "checkbox"
        and re.search(r"(?:privacy|consent|terms|conditions|have read|agree|acknowledge|accept)", label)
    )


def _is_phone_country_field(field: Any) -> bool:
    """Identify controls that represent phone country dialing codes across ATS forms."""
    field_id = str(getattr(field, "id", None) or "").strip().casefold()
    field_name = str(getattr(field, "name", None) or "").strip().casefold()
    field_key = str(getattr(field, "key", None) or "").strip().casefold()
    field_label = normalize_alias(str(getattr(field, "label", None) or ""))

    if field_id == "country" and str(getattr(field, "type", None) or "").strip().casefold() == "select":
        return True

    exact_labels = {
        "phone country",
        "phone country code",
        "country code",
        "phone code",
        "dial code",
        "phone dial code",
        "calling code",
        "country region code",
        "dialing code",
    }
    if field_label in exact_labels or any(term in field_label for term in ("phone country", "country code", "phone dial code")):
        return True

    keywords = ("phone_country", "country_code", "phone_code", "dial_code", "calling_code", "country_dial", "phonecountry", "countrycode")
    for identifier in (field_id, field_name, field_key):
        if identifier and any(kw in identifier for kw in keywords):
            return True

    return False


# Keep this deliberately small and explicit. The form country selector only
# needs a stable answer; the phone itself remains the user's source value.
_PHONE_COUNTRY_CODES: dict[str, tuple[str, str]] = {
    "AU": ("Australia", "+61"),
    "NZ": ("New Zealand", "+64"),
    "GB": ("United Kingdom", "+44"),
    "US": ("United States", "+1"),
    "CA": ("Canada", "+1"),
    "CN": ("China", "+86"),
    "IN": ("India", "+91"),
    "SG": ("Singapore", "+65"),
    "HK": ("Hong Kong", "+852"),
    "MY": ("Malaysia", "+60"),
    "PH": ("Philippines", "+63"),
    "ZA": ("South Africa", "+27"),
    "DE": ("Germany", "+49"),
    "FR": ("France", "+33"),
}


def _phone_country_code(phone: str | None, fallback_country: str | None = None) -> str | None:
    """Infer an ISO country from an international or common local number."""
    raw = str(phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        international = f"+{digits}"
        for code, (_, dial) in sorted(_PHONE_COUNTRY_CODES.items(), key=lambda item: -len(item[1][1])):
            if international.startswith(dial):
                return code
    if digits.startswith("00"):
        return _phone_country_code(f"+{digits[2:]}", fallback_country)
    fallback = normalize_alias(fallback_country or "")
    for code, (name, dial) in _PHONE_COUNTRY_CODES.items():
        if fallback in {normalize_alias(name), normalize_alias(code), normalize_alias(dial)}:
            return code
    # Australian mobile/geographic national numbers are unambiguous enough
    # for a useful default and cover the most common Jobby profile format.
    if re.fullmatch(r"0[23478]\d{8}", digits) or re.fullmatch(r"04\d{8}", digits):
        return "AU"
    return None


def _phone_country_value(field: Any, phone: str | None, fallback_country: str | None = None) -> str | None:
    code = _phone_country_code(phone, fallback_country)
    if not code:
        return None
    name, dial = _PHONE_COUNTRY_CODES[code]
    dial_no_plus = dial.removeprefix("+")
    candidates = {
        normalize_alias(name),
        normalize_alias(code),
        normalize_alias(dial),
        normalize_alias(dial_no_plus),
        normalize_alias(f"{name} ({dial})"),
        normalize_alias(f"{code} ({dial})"),
        normalize_alias(f"{dial} ({name})"),
        normalize_alias(f"{dial} {name}"),
        normalize_alias(f"{name} {dial}"),
    }
    for option in getattr(field, "options", None) or []:
        label = str(option.get("label") or "").strip()
        value = str(option.get("value") or "").strip()
        norm_label = normalize_alias(label)
        norm_value = normalize_alias(value)
        if not norm_label and not norm_value:
            continue

        if candidates & {norm_label, norm_value}:
            return value or label

        if any(
            candidate and (candidate in norm_label or candidate in norm_value)
            for candidate in (normalize_alias(dial), normalize_alias(name), normalize_alias(code))
            if len(candidate) >= 2
        ):
            return value or label

    # React Select implementations often use the country name as the value,
    # while native selects expose the ISO code. Prefer the visible name when
    # no options were supplied so the content driver can resolve it.
    return name


def _form_scene(payload_scene: str | None, fields: list[Any]) -> str:
    scene = normalize_scene(payload_scene)
    text = " ".join(str(field.label) for field in fields).casefold()
    password_labels = [str(field.label or "").casefold() for field in fields if str(field.type or "").casefold() == "password"]
    if any(term in text for term in ("register", "sign up", "create account")) or any(
        "new password" in label or "verify" in label or "confirm" in label
        for label in password_labels
    ):
        return "registration"
    if scene != "generic":
        return scene
    if any(term in text for term in ("visa", "immigration", "passport", "residency")):
        return "visa_application"
    return "generic"


def _sync_job_profile_core_values(
    db: Session,
    user: User,
    job_profile: JobHuntingProfile | None,
    *,
    overwrite: bool = False,
) -> None:
    if not job_profile:
        return
    extra_data = job_profile.extra_data if isinstance(job_profile.extra_data, dict) else {}
    title_value = next(
        (
            str(extra_data.get(key) or "").strip()
            for key in ("title", "salutation", "prefix", "honorific")
            if str(extra_data.get(key) or "").strip()
        ),
        None,
    )
    values = {
        "identity.title": title_value,
        "employment.current_location": job_profile.search_location,
        "employment.citizenship": job_profile.citizenship,
        "employment.visa_sponsorship": job_profile.require_visa,
        "employment.recent_employer": job_profile.recent_employer,
        "experience.years": job_profile.years_of_experience,
        "compensation.desired_base_salary": job_profile.desired_salary,
        "compensation.current_salary": job_profile.current_ctc,
        "employment.linkedin_url": job_profile.linkedin_url,
        "employment.website": job_profile.website,
        "employment.notice_period": job_profile.notice_period,
    }
    existing = core_profile_values(db, user.id)
    for key, value in values.items():
        if value is not None and str(value).strip() and (overwrite or not existing.get(key)):
            upsert_core_profile_value(db, user_id=user.id, core_field_key=key, value=str(value))
        elif overwrite and (value is None or not str(value).strip()):
            delete_core_profile_value(db, user_id=user.id, core_field_key=key)


def _match_form_field(
    db: Session,
    *,
    user_id: UUID,
    field: Any,
    scene: str,
) -> tuple[str | None, str | None, Any | None]:
    features = _field_semantic_features(field)
    match = None if _is_phone_country_field(field) else match_mapping_rule(
        db,
        user_id=user_id,
        alias=field.label,
        scene=scene,
        semantic_features=features,
        field_type=field.type,
    )
    if not match:
        return None, None, None
    values = core_profile_values(db, user_id)
    return transformed_core_value(match.rule, values), match.rule.core_field_key, match.rule


def _notice_period_candidates(raw_answer: str) -> list[str]:
    cleaned = str(raw_answer or "").strip()
    if not cleaned:
        return []
    try:
        days = int(cleaned)
    except (ValueError, TypeError):
        return [cleaned]

    candidates = [str(days), f"{days} days", f"{days} day", f"{days}d"]
    if days == 0:
        candidates.extend(["0", "immediate", "immediately", "no notice", "none", "0 days", "0 weeks", "available immediately"])
    else:
        weeks = round(days / 7)
        if weeks > 0:
            candidates.extend([f"{weeks} week", f"{weeks} weeks", f"{weeks} wks", f"{weeks} wk", f"{weeks}w", f"{weeks} week notice", f"{weeks} weeks notice"])
        months = round(days / 30)
        if months > 0:
            candidates.extend([f"{months} month", f"{months} months", f"{months} mon", f"{months}m", f"{months} month notice"])
    return candidates


def _coerce_form_value(
    raw_answer: str,
    field: Any,
    core_field_key: str | None = None,
) -> tuple[str | bool | None, str | None]:
    if field.type == "checkbox":
        if raw_answer.casefold() not in {"true", "false"}:
            return None, "Checkbox value is not boolean."
        return raw_answer.casefold() == "true", None
    if field.type in {"select", "radio"}:
        field_label = str(getattr(field, "label", "") or "")
        target_answers = [raw_answer]
        if core_field_key == "employment.notice_period" or "notice" in field_label.lower():
            target_answers.extend(_notice_period_candidates(raw_answer))
        elif core_field_key == "employment.work_authorization":
            if any(term in raw_answer.lower() for term in ["yes", "true", "full", "authorized", "citizen", "pr", "permanent", "permit", "work rights", "unrestricted"]):
                target_answers.extend(["yes", "y", "true", "1", "authorized", "eligible", "unrestricted work rights", "full working rights"])
                if "citizen" in raw_answer.lower():
                    target_answers.extend(["citizen", "australian/new zealand citizen", "australian citizen", "citizen / permanent resident"])
                elif any(term in raw_answer.lower() for term in ["pr", "permanent"]):
                    target_answers.extend(["permanent resident", "permanent", "pr holder", "citizen / permanent resident"])
                elif any(term in raw_answer.lower() for term in ["visa", "permit"]):
                    target_answers.extend(["valid visa holder", "visa holder", "visa", "temporary visa holder"])
            elif any(term in raw_answer.lower() for term in ["no", "false"]):
                target_answers.extend(["no", "n", "false", "0", "requires sponsorship", "no work rights"])
        elif core_field_key == "consent.sms" or "sms" in field_label.lower() or "text message" in field_label.lower():
            if any(term in raw_answer.lower() for term in ["no", "false", "opt out", "don't consent", "do not consent"]):
                target_answers.extend(["false", "no", "0", "no - i do not consent to receiving text messages"])
            else:
                target_answers.extend(["false", "no", "0", "no - i do not consent to receiving text messages", "true", "yes", "1", "yes - i consent to receiving text messages"])
        elif core_field_key == "employment.visa_status":
            if any(term in raw_answer.lower() for term in ["work visa", "temporary", "yes", "student", "bridging", "holder", "visa"]):
                target_answers.extend(["yes", "y", "true", "1", "temporary visa holder", "work visa", "valid visa holder", "working visa"])
            elif any(term in raw_answer.lower() for term in ["no", "false", "citizen", "pr", "permanent"]):
                target_answers.extend(["no", "n", "false", "0", "australian/new zealand citizen", "permanent resident"])
        elif core_field_key == "employment.visa_sponsorship":
            if any(term in raw_answer.lower() for term in ["no", "false", "none", "not required", "don't need", "will not require"]):
                target_answers.extend(["no", "n", "false", "0", "no sponsorship required", "will not require sponsorship"])
            elif any(term in raw_answer.lower() for term in ["yes", "true", "required", "need"]):
                target_answers.extend(["yes", "y", "true", "1", "sponsorship required"])
        elif core_field_key == "identity.pronouns" or "pronoun" in field_label.lower():
            lower_ans = raw_answer.lower()
            if any(term in lower_ans for term in ["he/him", "he / him", "male"]):
                target_answers.extend(["he/him", "he / him", "he / him / his", "he/him/his", "he", "him", "his", "male"])
            elif any(term in lower_ans for term in ["she/her", "she / her", "female"]):
                target_answers.extend(["she/her", "she / her", "she / her / hers", "she/her/hers", "she", "her", "hers", "female"])
            elif any(term in lower_ans for term in ["they/them", "they / them"]):
                target_answers.extend(["they/them", "they / them", "they / them / theirs", "they/them/theirs", "they", "them", "theirs"])
            elif any(term in lower_ans for term in ["prefer not to say", "decline", "do not wish"]):
                target_answers.extend(["prefer not to say", "decline to state", "do not wish to specify", "prefer not to specify"])

        normalized_candidates = {normalize_alias(ans) for ans in target_answers if ans}

        for option in field.options:
            option_value = str(option.get("value") or option.get("label") or "")
            normalized_value = normalize_alias(option_value)
            normalized_label = normalize_alias(option.get("label", ""))

            if not normalized_value and not normalized_label:
                continue
            if normalized_label in {"select", "choose", "please select", "-- select --"}:
                continue

            if normalized_candidates & {normalized_value, normalized_label}:
                return option_value, None

        # Conservative phrase matching for the remaining options. A single
        # shared word (for example "visa" or "other") is not evidence that
        # an option represents the user's answer, so never use it as a
        # fallback. Exact matching above still handles terse Yes/No values.
        best_option = None
        best_score = 0
        for option in field.options:
            option_value = str(option.get("value") or option.get("label") or "")
            norm_label = normalize_alias(option.get("label", ""))
            if not norm_label or norm_label in {"select", "choose", "please select", "-- select --"}:
                continue
            
            option_tokens = set(norm_label.split())
            for cand in normalized_candidates:
                cand_tokens = set(cand.split())
                if len(cand_tokens) < 2:
                    continue
                overlap = len(cand_tokens & option_tokens)
                if cand in norm_label or norm_label in cand:
                    score = 10 + overlap
                elif overlap >= 2 and overlap / len(cand_tokens) >= 0.75:
                    score = overlap
                else:
                    continue
                if score > best_score and score >= 1:
                    best_score = score
                    best_option = option_value

        if best_option is not None:
            return best_option, None

        if field.options:
            return None, "Value is not one of the available options."

    field_label = str(getattr(field, "label", "") or "")
    if core_field_key == "employment.date_available" or "available" in field_label.lower():
        label_text = f"{field_label} {getattr(field, 'placeholder', '')}".lower()
        if "mm/dd/yyyy" in label_text or "mm-dd-yyyy" in label_text:
            try:
                dt = datetime.strptime(raw_answer[:10], "%Y-%m-%d")
                return dt.strftime("%m/%d/%Y"), None
            except ValueError:
                pass
        elif "dd/mm/yyyy" in label_text or "dd-mm-yyyy" in label_text:
            try:
                dt = datetime.strptime(raw_answer[:10], "%Y-%m-%d")
                return dt.strftime("%d/%m/%Y"), None
            except ValueError:
                pass

    return raw_answer, None


# Keep these re-exports stable while endpoint code is gradually moved out of
# this legacy module. New logic lives in the small, independently testable
# modules instead of adding further responsibilities to `main.py`.
from services.shared.autofill_intents import (
    _autofill_answer_category,
    _autofill_intent_key,
    _autofill_intent_key_for_field,
    _inverse_sponsorship_answer,
)
from services.shared.form_option_mapper import coerce_form_value as _coerce_form_value


def _build_form_autofill_instructions(
    db: Session,
    *,
    payload: FormAutofillInstructionsRequest | ApplicationFormInstructionsRequest,
    current_user: User,
    platform: str,
    scene: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    instructions: list[dict[str, Any]] = []
    unanswered: list[dict[str, str]] = []
    traces: list[dict[str, Any]] = []
    if not dry_run:
        ensure_identity_core_values(db, current_user)
        job_profile = db.scalar(
            select(JobHuntingProfile)
            .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
            .order_by(JobHuntingProfile.updated_at.desc())
            .limit(1)
        )
        _sync_job_profile_core_values(db, current_user, job_profile)
        db.flush()
    values = core_profile_values(db, current_user.id)
    for field in payload.fields:
        features = _field_semantic_features(field)
        if _is_phone_country_field(field):
            value = _phone_country_value(
                field,
                values.get("identity.phone"),
                values.get("address.country"),
            )
            if value:
                instructions.append({
                    "type": "content.fill-field",
                    "commandId": str(uuid4()),
                    # `ApplicationFieldInstruction.source` is an execution
                    # channel, not an attribution field. Keep the detailed
                    # derivation in `traces`; returning it here violates the
                    # response schema and rejects the entire batch response.
                    "source": "backend",
                    "target": field.model_dump(exclude_none=True),
                    "value": value,
                })
                traces.append({
                    "key": field.key,
                    "label": field.label,
                    "intent_key": "identity.phone_country",
                    "core_field_key": "identity.phone",
                    "scene": scene,
                    "semantic_features": features,
                    "source": "phone_country_inference",
                    "status": "filled",
                    "value": value,
                })
            else:
                reason = "Could not infer the phone country from the saved phone number or address country."
                unanswered.append({"key": field.key, "label": field.label, "reason": reason})
                traces.append({"key": field.key, "label": field.label, "intent_key": "identity.phone_country", "core_field_key": "identity.phone", "scene": scene, "semantic_features": features, "source": "phone_country_inference", "status": "unanswered", "reason": reason})
            continue
        if field.type in {"file", "unknown"}:
            reason = "This field requires explicit user handling."
            unanswered.append({"key": field.key, "label": field.label, "reason": reason})
            traces.append({"key": field.key, "label": field.label, "intent_key": None, "core_field_key": None, "scene": scene, "semantic_features": features, "source": "none", "status": "unanswered", "reason": reason})
            continue
        if _is_single_consent_checkbox(field):
            instructions.append({
                "type": "content.fill-field",
                "commandId": str(uuid4()),
                "source": "backend",
                "target": field.model_dump(exclude_none=True),
                "value": True,
            })
            traces.append({
                "key": field.key,
                "label": field.label,
                "intent_key": "consent.acceptance",
                "core_field_key": None,
                "scene": scene,
                "semantic_features": features,
                "source": "system_rule",
                "status": "filled",
                "value": True,
            })
            continue
        match = None if _is_phone_country_field(field) else _match_form_mapping_rule(
            db,
            user_id=current_user.id,
            field=field,
            platform=platform,
            scene=scene,
            semantic_features=features,
        )
        # High-confidence canonical questions (for example TechnologyOne's
        # work-rights and work-visa questions) must not depend on a user's
        # learned mapping rows. A stale or missing row otherwise leaves an
        # otherwise answerable radio field as `None` in the side panel.
        intent_key = _autofill_intent_key_for_field(field, platform)
        core_field_key = intent_key or (match.rule.core_field_key if match else None)
        if not core_field_key:
            reason = "No mapping rule matched this alias and form scene."
            unanswered.append({"key": field.key, "label": field.label, "reason": reason})
            traces.append({"key": field.key, "label": field.label, "intent_key": None, "core_field_key": None, "scene": scene, "semantic_features": features, "source": "none", "status": "unanswered", "reason": reason})
            continue
        raw_answer = values.get(core_field_key)
        coercion_key = core_field_key
        if core_field_key == "employment.work_authorization_without_sponsorship":
            raw_answer = _inverse_sponsorship_answer(values.get("employment.visa_sponsorship"))
            coercion_key = "employment.work_authorization"
        if match and not intent_key:
            raw_answer = transformed_core_value(match.rule, values)
        elif not raw_answer and intent_key in {"identity.full_name", "identity.legal_full_name"}:
            transform = default_core_value_transform(intent_key)
            if transform.get("operation") == "join":
                source_keys = transform.get("source_keys", [])
                parts = [values.get(str(k), "").strip() for k in source_keys]
                parts = [p for p in parts if p]
                if parts:
                    raw_answer = str(transform.get("separator", " ")).join(parts)
                else:
                    raw_answer = values.get("identity.preferred_name")
        if core_field_key == "employment.work_authorization":
            if not raw_answer or not str(raw_answer).strip():
                citizenship = values.get("employment.citizenship")
                visa_type = values.get("employment.visa_type") or values.get("employment.visa_status")
                if citizenship and str(citizenship).strip():
                    raw_answer = citizenship
                elif visa_type and str(visa_type).strip():
                    raw_answer = visa_type
                elif values.get("employment.visa_sponsorship") == "Yes":
                    raw_answer = "No"
                else:
                    raw_answer = "Yes"
        elif core_field_key == "employment.visa_status":
            if not raw_answer or not str(raw_answer).strip():
                if values.get("employment.visa_sponsorship") == "Yes" or values.get("employment.visa_type") or values.get("employment.visa_status"):
                    raw_answer = "Yes"
                else:
                    raw_answer = "No"
        elif core_field_key == "employment.visa_type":
            if not raw_answer or not str(raw_answer).strip():
                v_type = values.get("employment.visa_type") or values.get("employment.visa_status")
                v_expiry = values.get("employment.visa_expiry")
                if v_type and v_expiry:
                    raw_answer = f"{v_type} (Expiry: {v_expiry})"
                elif v_type:
                    raw_answer = v_type
        if core_field_key == "employment.date_available":
            notice_value = values.get("employment.notice_period")
            if notice_value is None or not str(notice_value).strip():
                raw_answer = None
            else:
                try:
                    notice_days = max(0, int(str(notice_value).strip()))
                except (TypeError, ValueError):
                    notice_days = 0
                raw_answer = (datetime.utcnow().date() + timedelta(days=notice_days)).isoformat()
        elif core_field_key == "compensation.desired_day_rate":
            if not raw_answer or not str(raw_answer).strip():
                salary_val = values.get("compensation.desired_base_salary")
                if salary_val and str(salary_val).strip():
                    try:
                        num = float(re.sub(r"[^\d.]", "", str(salary_val)))
                        if num > 0:
                            super_multiplier = 1.115
                            working_days = 220.0
                            raw_answer = str(int(round((num * super_multiplier) / working_days)))
                    except (ValueError, TypeError):
                        pass
        elif core_field_key == "compensation.desired_base_salary":
            if not raw_answer or not str(raw_answer).strip():
                day_rate_val = values.get("compensation.desired_day_rate")
                if day_rate_val and str(day_rate_val).strip():
                    try:
                        num = float(re.sub(r"[^\d.]", "", str(day_rate_val)))
                        if num > 0:
                            super_multiplier = 1.115
                            working_days = 220.0
                            raw_answer = str(int(round((num * working_days) / super_multiplier)))
                    except (ValueError, TypeError):
                        pass
        if not raw_answer:
            reason = "The mapped core field has no saved value."
            unanswered.append({"key": field.key, "label": field.label, "reason": reason})
            traces.append({"key": field.key, "label": field.label, "intent_key": core_field_key, "core_field_key": core_field_key, "scene": scene, "semantic_features": features, "source": "core_profile", "status": "unanswered", "reason": reason})
            continue
        value, reason = _coerce_form_value(str(raw_answer), field, coercion_key)
        if reason or value is None:
            unanswered.append({"key": field.key, "label": field.label, "reason": reason or "Value could not be used in this control."})
            traces.append({"key": field.key, "label": field.label, "intent_key": core_field_key, "core_field_key": core_field_key, "scene": scene, "semantic_features": features, "source": "core_profile", "status": "unanswered", "reason": reason})
            continue
        instructions.append({
            "type": "content.fill-field",
            "commandId": str(uuid4()),
            "source": "backend",
            "target": field.model_dump(exclude_none=True),
            "value": value,
        })
        trace_value = "[redacted]" if core_field_key == "application.password" else value
        traces.append({"key": field.key, "label": field.label, "intent_key": core_field_key, "core_field_key": core_field_key, "scene": scene, "semantic_features": features, "source": "intent_classifier" if intent_key else ("user_rule" if match.rule.is_user_defined else "system_rule"), "status": "filled", "value": trace_value})
        if not dry_run and match:
            match.rule.times_used += 1
            match.rule.last_used_at = datetime.utcnow()
    if not dry_run:
        db.commit()
    return {"instructions": instructions, "unanswered_fields": unanswered, "traces": traces}

