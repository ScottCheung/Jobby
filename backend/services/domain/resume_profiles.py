from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from services.domain.errors import InsufficientCoins
from services.shared.models import (
    GamificationTransaction,
    JobHuntingProfile,
    User,
    UserGamification,
)
from services.shared.time_utils import utc_now

RESUME_PARSE_COST = 5
RESUME_EVALUATION_COST = 10
RESUME_UPLOAD_COST = RESUME_PARSE_COST
CAREER_PROFILE_UPLOAD_AND_SCORE_COST = RESUME_UPLOAD_COST + RESUME_EVALUATION_COST
RESUME_RECOVERY_AFTER = timedelta(minutes=2)
CAREER_PROFILE_SOURCE = "career_profile"


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
        raise InsufficientCoins("Not enough coins")
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
