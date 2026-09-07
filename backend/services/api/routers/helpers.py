from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.domain.errors import InsufficientCoins
from services.domain.resume_profiles import (
    CAREER_PROFILE_SOURCE,
    CAREER_PROFILE_UPLOAD_AND_SCORE_COST,
    RESUME_EVALUATION_COST,
    RESUME_RECOVERY_AFTER,
    RESUME_UPLOAD_COST,
    dedupe_strings,
    ensure_single_default_job_hunting_profile,
    linkedin_url_from_resume_data,
    refund_resume_coins as _refund_resume_coins,
    resume_profile_name,
    spend_resume_coins as _spend_resume_coins,
)
from services.shared.models import JobHuntingProfile, User
from services.shared.settings import get_settings

settings = get_settings()


def spend_resume_coins(
    db: Session,
    current_user: User,
    amount: int,
    reason: str,
    reference_id: str,
) -> None:
    try:
        _spend_resume_coins(db, current_user, amount, reason, reference_id)
    except InsufficientCoins as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)) from exc


def refund_resume_coins(
    db: Session,
    current_user: User,
    amount: int,
    reason: str,
    reference_id: str,
) -> None:
    _refund_resume_coins(db, current_user, amount, reason, reference_id)





def apply_updates(model: object, values: dict) -> None:
    if "raw_data" in values and hasattr(model, "raw_data"):
        setattr(model, "raw_data", values["raw_data"])
    for key, value in values.items():
        if key == "raw_data":
            continue
        setattr(model, key, value)


def read_resume_upload(file: UploadFile) -> tuple[str, bytes]:
    filename = (file.filename or "resume.pdf").split("/")[-1].split("\\")[-1]
    content_type = (file.content_type or "").lower()
    if not filename.lower().endswith(".pdf") or content_type not in {"", "application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Upload a PDF resume")
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Resume file is empty")
    if len(content) > settings.resume_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Resume must be 12 MB or smaller")
    return filename, content


def normalize_job_hunting_profile_values(values: dict, existing: JobHuntingProfile | None = None) -> dict:
    normalized = dict(values)
    filters = dict(normalized.get("filters") or {})
    blacklist_rules = dict(normalized.get("blacklist_rules") or {})
    whitelist_rules = dict(normalized.get("whitelist_rules") or {})

    existing_filters = dict(existing.filters or {}) if existing else {}
    existing_blacklist_rules = dict(existing.blacklist_rules or {}) if existing else {}
    existing_whitelist_rules = dict(existing.whitelist_rules or {}) if existing else {}

    for key in ("security_clearance", "did_masters", "current_experience"):
        if key not in filters and key in blacklist_rules:
            filters[key] = blacklist_rules.pop(key)
        elif key not in filters and key in existing_blacklist_rules and key not in existing_filters:
            filters[key] = existing_blacklist_rules[key]

    if "about_company_good_words" not in whitelist_rules:
        if "about_company_good_words" in blacklist_rules:
            whitelist_rules["about_company_good_words"] = blacklist_rules.pop(
                "about_company_good_words"
            )
        elif (
            "about_company_good_words" in existing_blacklist_rules
            and "about_company_good_words" not in existing_whitelist_rules
        ):
            whitelist_rules["about_company_good_words"] = existing_blacklist_rules[
                "about_company_good_words"
            ]

    normalized["filters"] = filters
    normalized["blacklist_rules"] = blacklist_rules
    normalized["whitelist_rules"] = whitelist_rules
    return normalized
