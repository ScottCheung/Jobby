from datetime import timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.models import (
    GamificationTransaction,
    JobHuntingProfile,
    User,
    UserGamification,
)
from services.shared.settings import get_settings
from services.shared.time_utils import utc_now

settings = get_settings()

RESUME_PARSE_COST = 5
RESUME_EVALUATION_COST = 10
RESUME_UPLOAD_COST = RESUME_PARSE_COST
CAREER_PROFILE_UPLOAD_AND_SCORE_COST = RESUME_UPLOAD_COST + RESUME_EVALUATION_COST
RESUME_RECOVERY_AFTER = timedelta(minutes=2)
CAREER_PROFILE_SOURCE = "career_profile"





def apply_updates(model: object, values: dict) -> None:
    if "raw_data" in values and hasattr(model, "raw_data"):
        setattr(model, "raw_data", values["raw_data"])
    for key, value in values.items():
        if key == "raw_data":
            continue
        setattr(model, key, value)


def spend_resume_coins(
    db: Session,
    current_user: User,
    amount: int,
    reason: str,
    reference_id: str,
) -> None:
    existing = db.scalar(
        select(GamificationTransaction.id).where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.currency == "coin",
            GamificationTransaction.amount == -amount,
            GamificationTransaction.reason == reason,
            GamificationTransaction.reference_id == reference_id,
        )
    )
    if existing:
        return
    wallet = db.scalar(
        select(UserGamification)
        .where(UserGamification.user_id == current_user.id)
        .with_for_update()
    )
    if not wallet:
        wallet = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(wallet)
        db.flush()
    if wallet.coins < amount:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Not enough coins")
    wallet.coins -= amount
    db.add(GamificationTransaction(
        user_id=current_user.id,
        amount=-amount,
        currency="coin",
        reason=reason,
        reference_id=reference_id,
    ))


def refund_resume_coins(
    db: Session,
    current_user: User,
    amount: int,
    reason: str,
    reference_id: str,
) -> None:
    existing = db.scalar(
        select(GamificationTransaction.id).where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.currency == "coin",
            GamificationTransaction.amount == amount,
            GamificationTransaction.reason == reason,
            GamificationTransaction.reference_id == reference_id,
        )
    )
    if existing:
        return
    wallet = db.scalar(
        select(UserGamification)
        .where(UserGamification.user_id == current_user.id)
        .with_for_update()
    )
    if not wallet:
        wallet = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(wallet)
        db.flush()
    wallet.coins += amount
    db.add(GamificationTransaction(
        user_id=current_user.id,
        amount=amount,
        currency="coin",
        reason=reason,
        reference_id=reference_id,
    ))


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


def linkedin_url_from_resume_data(resume_data: dict) -> str | None:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    value = basics.get("linkedin_id") or basics.get("linkedin_url")
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    value = value.replace("www.linkedin.com/in/", "").replace("linkedin.com/in/", "").strip("/ ")
    return f"https://www.linkedin.com/in/{value}" if value else None


def dedupe_strings(items: list[Any]) -> list[str]:
    result: list[str] = []
    for item in items:
        if not isinstance(item, str):
            continue
        value = item.strip()
        if value and value not in result:
            result.append(value)
    return result


def resume_profile_name(filename: str, resume_data: dict) -> str:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    headline = basics.get("headline") if isinstance(basics.get("headline"), str) else ""
    clean_filename = filename.rsplit(".", 1)[0].strip() or "Resume"
    label = headline.strip() or clean_filename
    return f"{label[:180]} Profile"


def ensure_single_default_job_hunting_profile(
    db: Session,
    current_user: User,
    selected_profile: JobHuntingProfile,
) -> None:
    profiles = list(
        db.scalars(
            select(JobHuntingProfile).where(JobHuntingProfile.user_id == current_user.id)
        )
    )
    for profile in profiles:
        should_be_default = profile.id == selected_profile.id
        if bool(profile.is_default) == should_be_default:
            continue
        profile.is_default = should_be_default


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
