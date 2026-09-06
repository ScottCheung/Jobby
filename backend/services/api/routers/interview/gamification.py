import math
import random
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.models import (
    GamificationConfig,
    GamificationTransaction,
    InterviewCollection,
    InterviewQuestion,
    JobApplication,
    PlanTask,
    PracticePlan,
    PracticeRecord,
    QuestionRating,
    User,
    UserAchievement,
    UserDailyQuest,
    UserGamification,
    UserInventoryItem,
    UserNotification,
    UserQuestion,
)
from services.shared.schemas import (
    AchievementRead,
    DailyQuestRead,
    DailySummarySchema,
    GamificationConfigRead,
    GamificationConfigUpdate,
    GamificationTransactionRead,
    HeatmapDataSchema,
)
from services.shared.settings import get_settings
from services.shared.time_utils import ensure_utc_datetime, parse_datetime_to_utc

router = APIRouter(tags=["Gamification"])

class WelcomeBonusResponse(BaseModel):
    awarded: bool
    coins_earned: int


DEFAULT_GAMIFICATION_CONFIG = {
    "daily_selection_count": 3,
    "weekly_selection_count": 5,
    "daily_quest_pool": [
        {"id": "practice_1", "title": "First Steps", "description": "Practice 1 question today", "metric_key": "practice_count", "target_value": 1, "category": "daily", "enabled": True, "visible": True, "reward_xp": 20, "reward_coins": 5, "reward_loot_boxes": 0},
        {"id": "practice_3", "title": "Consistent Effort", "description": "Practice 3 questions today", "metric_key": "practice_count", "target_value": 3, "category": "daily", "enabled": True, "visible": True, "reward_xp": 50, "reward_coins": 15, "reward_loot_boxes": 1},
        {"id": "high_confidence", "title": "Confident", "description": "Rate a practice 4 or 5 stars", "metric_key": "high_confidence_count", "target_value": 1, "category": "daily", "enabled": True, "visible": True, "reward_xp": 30, "reward_coins": 10, "reward_loot_boxes": 0}
    ],
    "weekly_quest_pool": [],
    "badges": [],
    "reward_events": [
        {"event_key": "practice_completed", "label": "Practice Question Completed", "xp": 10, "coins": 2, "loot_boxes": 0, "enabled": True, "application_origin": "any"},
        {"event_key": "question_survey_completed", "label": "Question Survey Completed", "xp": 5, "coins": 2, "loot_boxes": 0, "enabled": True, "application_origin": "any"},
        {"event_key": "streak_bonus_7", "label": "7-Day Streak Bonus", "xp": 500, "coins": 0, "loot_boxes": 0, "enabled": True, "application_origin": "any"},
        {"event_key": "daily_checkin", "label": "Daily Check-in", "xp": 50, "coins": 0, "loot_boxes": 1, "enabled": True, "application_origin": "any"},
        {"event_key": "application_submitted_manual", "label": "Manual Job Application Submitted", "xp": 15, "coins": 0, "loot_boxes": 0, "enabled": True, "application_origin": "manual"},
        {"event_key": "application_submitted_auto", "label": "Auto Apply Submission", "xp": 12, "coins": 2, "loot_boxes": 0, "enabled": True, "application_origin": "auto"},
        {"event_key": "application_skipped_auto", "label": "Auto Apply Skip", "xp": 1, "coins": 0, "loot_boxes": 0, "enabled": True, "application_origin": "auto"},
        {"event_key": "application_interrupted_auto", "label": "Auto Apply Needs Review", "xp": 0, "coins": -1, "loot_boxes": 0, "enabled": True, "application_origin": "auto"},
        {"event_key": "application_offer_received", "label": "Offer Reached", "xp": 250, "coins": 50, "loot_boxes": 2, "enabled": True, "application_origin": "any"},
    ],
    "spend_events": [
        {"event_key": "loot_box_open", "label": "Open Loot Box", "xp": 0, "coins": 0, "loot_boxes": -1, "enabled": True, "application_origin": "any"},
        {"event_key": "auto_apply_processed", "label": "Auto Apply Processing Cost", "xp": 0, "coins": -1, "loot_boxes": 0, "enabled": False, "application_origin": "auto"}
    ],
    "ai": {
        "answer_unlock_cost": 5,
        "answer_unlock_question_cap": 5,
        "practice_evaluation_cost": 5,
    },
    "max_daily_xp_gain": 500,
    "max_daily_coin_gain": 100,
    "welcome_bonus_coins": 100,
    "welcome_bonus_xp": 50,
    "welcome_bonus_loot_boxes": 1,
    "celebration_config": None,
    "question_recommendations": {
        "base_score": 1.0,
        "view_weight": 0.08,
        "practice_weight": 1.2,
        "favorite_weight": 1.6,
        "upvote_weight": 1.3,
        "downvote_weight": 1.5,
        "interview_weight": 3.0,
        "company_weight": 1.2,
        "comment_weight": 0.35,
        "quality_weight": 2.0,
        "freshness_half_life_days": 45,
        "weekly_window_days": 7,
        "weekly_half_life_days": 4,
        "monthly_window_days": 30,
        "monthly_half_life_days": 16,
        "seasonal_window_days": 90,
        "seasonal_half_life_days": 45,
        "for_you_candidate_limit": 160,
        "for_you_result_limit": 40,
        "for_you_category_weight": 4.0,
        "for_you_tag_weight": 2.5,
        "for_you_company_weight": 2.0,
        "for_you_unseen_bonus": 2.0,
        "for_you_practiced_penalty": 1.4,
        "for_you_hot_weight": 0.8,
        "for_you_freshness_weight": 0.6,
        "for_you_freshness_half_life_days": 30,
    },
}


def get_user_inventory_dict(db: Session, user_id: UUID) -> dict[str, int]:
    items = db.scalars(
        select(UserInventoryItem).where(UserInventoryItem.user_id == user_id)
    ).all()
    return {item.item_key: item.quantity for item in items if item.quantity > 0}


def modify_user_inventory_item(db: Session, user_id: UUID, item_key: str, quantity_delta: int) -> int | None:
    item = db.scalar(
        select(UserInventoryItem).where(
            UserInventoryItem.user_id == user_id,
            UserInventoryItem.item_key == item_key,
        ).with_for_update()
    )
    if not item:
        if quantity_delta <= 0:
            return None
        item = UserInventoryItem(user_id=user_id, item_key=item_key, quantity=quantity_delta)
        db.add(item)
        db.flush()
        return item.quantity

    new_qty = item.quantity + quantity_delta
    if new_qty < 0:
        return None
    item.quantity = new_qty
    db.flush()
    return new_qty


def get_item_quantity(db: Session, user_id: UUID, item_key: str) -> int:
    item = db.scalar(
        select(UserInventoryItem).where(
            UserInventoryItem.user_id == user_id,
            UserInventoryItem.item_key == item_key,
        )
    )
    return item.quantity if item else 0


def get_or_create_gamification(db: Session, user: User) -> UserGamification:
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == user.id))
    if not gamification:
        # Initial balances are granted only through the configurable welcome bonus.
        gamification = UserGamification(user_id=user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(gamification)
        db.flush()
    return gamification


def get_gamification_config(db: Session) -> GamificationConfig:
    config_obj = db.scalar(select(GamificationConfig).where(GamificationConfig.scope == "global"))
    if not config_obj:
        config_obj = GamificationConfig(scope="global", config=DEFAULT_GAMIFICATION_CONFIG)
        db.add(config_obj)
        db.commit()
        db.refresh(config_obj)
    else:
        # Merge default settings if they are missing in the saved config to prevent KeyErrors
        changed = False
        # Create a copy to prevent in-place mutation issues in sqlalchemy
        current_config = dict(config_obj.config)
        for k, v in DEFAULT_GAMIFICATION_CONFIG.items():
            if k not in current_config:
                current_config[k] = v
                changed = True
        # Older installations may predate newly supported product events.
        # Keep existing values intact while making every built-in action editable.
        for collection_key in ("reward_events", "spend_events"):
            defaults = DEFAULT_GAMIFICATION_CONFIG[collection_key]
            entries = list(current_config.get(collection_key, []))
            existing_keys = {entry.get("event_key") for entry in entries}
            for default_entry in defaults:
                if default_entry["event_key"] not in existing_keys:
                    entries.append(dict(default_entry))
                    changed = True
            current_config[collection_key] = entries
        if changed:
            from sqlalchemy.orm.attributes import flag_modified
            config_obj.config = current_config
            flag_modified(config_obj, "config")
            db.commit()
            db.refresh(config_obj)
    return config_obj


def get_question_recommendation_config(db: Session) -> dict[str, float]:
    defaults = DEFAULT_GAMIFICATION_CONFIG["question_recommendations"]
    configured = get_gamification_config(db).config.get(
        "question_recommendations",
        {},
    )
    return {
        key: float(configured.get(key, value))
        for key, value in defaults.items()
    }


def add_economy_transactions(
    db: Session,
    user: User,
    xp_delta: int,
    coin_delta: int,
    loot_box_delta: int,
    reason: str,
    reference_id: str | None = None
) -> None:
    if xp_delta != 0:
        db.add(GamificationTransaction(
            user_id=user.id,
            amount=xp_delta,
            currency="xp",
            reason=reason,
            reference_id=reference_id
        ))
    if coin_delta != 0:
        db.add(GamificationTransaction(
            user_id=user.id,
            amount=coin_delta,
            currency="coin",
            reason=reason,
            reference_id=reference_id
        ))
    if loot_box_delta != 0:
        db.add(GamificationTransaction(
            user_id=user.id,
            amount=loot_box_delta,
            currency="item",
            reason=reason,
            reference_id=reference_id
        ))


def enforce_daily_limits(db: Session, user: User, xp_gain: int, coin_gain: int, config: dict) -> tuple[int, int]:
    max_daily_xp = config.get("max_daily_xp_gain", 500)
    max_daily_coin = config.get("max_daily_coin_gain", 100)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Query XP earned today
    xp_earned_today = db.scalar(
        select(func.sum(GamificationTransaction.amount))
        .where(
            GamificationTransaction.user_id == user.id,
            GamificationTransaction.currency == "xp",
            GamificationTransaction.amount > 0,
            GamificationTransaction.created_at >= today_start
        )
    ) or 0

    # Query Coins earned today
    coins_earned_today = db.scalar(
        select(func.sum(GamificationTransaction.amount))
        .where(
            GamificationTransaction.user_id == user.id,
            GamificationTransaction.currency == "coin",
            GamificationTransaction.amount > 0,
            GamificationTransaction.created_at >= today_start
        )
    ) or 0

    # Enforce XP cap
    if xp_earned_today >= max_daily_xp:
        xp_gain = 0
    elif xp_earned_today + xp_gain > max_daily_xp:
        xp_gain = max(0, max_daily_xp - xp_earned_today)

    # Enforce Coin cap
    if coins_earned_today >= max_daily_coin:
        coin_gain = 0
    elif coins_earned_today + coin_gain > max_daily_coin:
        coin_gain = max(0, max_daily_coin - coins_earned_today)

    return xp_gain, coin_gain


def grant_question_survey_reward(db: Session, user: User, question_id: UUID, rating: QuestionRating) -> tuple[int, int]:
    if rating.survey_reward_granted:
        return 0, 0
    if rating.importance_rating is None or rating.difficulty_rating is None:
        return 0, 0

    config_obj = get_gamification_config(db)
    reward_events = config_obj.config.get("reward_events", [])
    survey_event = next(
        (
            ev
            for ev in reward_events
            if ev.get("event_key") == "question_survey_completed" and ev.get("enabled")
        ),
        None,
    )
    xp_gain = survey_event.get("xp", 5) if survey_event else 5
    coin_gain = survey_event.get("coins", 2) if survey_event else 2

    xp_gain, coin_gain = enforce_daily_limits(db, user, xp_gain, coin_gain, config_obj.config)

    gamification = get_or_create_gamification(db, user)
    if xp_gain > 0:
        db.add(
            GamificationTransaction(
                user_id=user.id,
                amount=xp_gain,
                currency="xp",
                reason="Question Survey Completed",
                reference_id=str(question_id),
            )
        )
    if coin_gain > 0:
        db.add(
            GamificationTransaction(
                user_id=user.id,
                amount=coin_gain,
                currency="coin",
                reason="Question Survey Completed",
                reference_id=str(question_id),
            )
        )

    gamification.xp += xp_gain
    gamification.coins += coin_gain
    gamification.level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
    rating.survey_reward_granted = True
    return xp_gain, coin_gain


def get_user_metric_value(db: Session, user: User, metric_key: str) -> int:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())  # Monday start

    gamification = get_or_create_gamification(db, user)
    key = metric_key.strip().lower()

    if key in {"practice_completed_today", "practice_count"}:
        return db.scalar(
            select(func.count(PracticeRecord.id))
            .where(PracticeRecord.user_id == user.id, PracticeRecord.date >= today_start)
        ) or 0
    elif key == "practice_completed_week":
        return db.scalar(
            select(func.count(PracticeRecord.id))
            .where(PracticeRecord.user_id == user.id, PracticeRecord.date >= week_start)
        ) or 0
    elif key in {"practice_completed_total", "practice_completed_total_count"}:
        return db.scalar(
            select(func.count(PracticeRecord.id))
            .where(PracticeRecord.user_id == user.id)
        ) or 0
    elif key in {"practice_high_confidence_today", "high_confidence_count"}:
        return db.scalar(
            select(func.count(PracticeRecord.id))
            .where(PracticeRecord.user_id == user.id, PracticeRecord.date >= today_start, PracticeRecord.confidence_score >= 4)
        ) or 0
    elif key == "practice_high_confidence_total":
        return db.scalar(
            select(func.count(PracticeRecord.id))
            .where(PracticeRecord.user_id == user.id, PracticeRecord.confidence_score >= 4)
        ) or 0
    elif key in {"practice_streak_days", "streak_days", "current_streak"}:
        return gamification.streak_days
    elif key == "applications_submitted_today":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= today_start,
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_submitted_week":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= week_start,
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_submitted_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_manual_submitted_today":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= today_start,
                JobApplication.application_type == "manual",
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_manual_submitted_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.application_type == "manual",
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_auto_submitted_today":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= today_start,
                JobApplication.application_type == "auto",
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_auto_submitted_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.application_type == "auto",
                JobApplication.status.not_in(["draft", "processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_auto_skipped_today":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.status_updated_at >= today_start,
                JobApplication.application_type == "auto",
                JobApplication.status == "skipped"
            )
        ) or 0
    elif key == "applications_auto_skipped_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.application_type == "auto",
                JobApplication.status == "skipped"
            )
        ) or 0
    elif key == "applications_offer_today":
        from sqlalchemy import cast, Date
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                cast(JobApplication.status_updated_at, Date) == today_start.date(),
                JobApplication.status == "offer"
            )
        ) or 0
    elif key == "applications_offer_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.status == "offer"
            )
        ) or 0
    elif key == "coins_balance":
        return gamification.coins
    elif key == "loot_boxes_balance":
        return get_item_quantity(db, user.id, "loot_box")

    return 0


def evaluate_badges(db: Session, user: User) -> None:
    now = datetime.now(timezone.utc)
    config_obj = get_gamification_config(db)
    badges_config = config_obj.config.get("badges", [])

    for badge in badges_config:
        if not badge.get("enabled", True):
            continue

        badge_id = badge["badge_id"]
        badge_name = badge["badge_name"]
        description = badge["description"]
        metric_key = badge["metric_key"]
        target_value = badge["target_value"]

        # Check if already unlocked
        exists = db.scalar(
            select(UserAchievement)
            .where(UserAchievement.user_id == user.id, UserAchievement.badge_id == badge_id)
            .limit(1)
        )
        if exists:
            continue

        # Get user's metric value dynamically
        val = get_user_metric_value(db, user, metric_key)
        if val >= target_value:
            db.add(UserAchievement(
                user_id=user.id,
                badge_id=badge_id,
                badge_name=badge_name,
                description=description,
                unlocked_at=now
            ))


def update_user_daily_quests(db: Session, user: User) -> None:
    now = datetime.now(timezone.utc)
    quests = db.scalars(
        select(UserDailyQuest)
        .where(
            UserDailyQuest.user_id == user.id,
            func.date(UserDailyQuest.quest_date) == now.date()
        )
    ).all()

    config_obj = get_gamification_config(db)
    all_quests = config_obj.config.get("daily_quest_pool", []) + config_obj.config.get("weekly_quest_pool", [])
    templates_by_id = {q["id"]: q for q in all_quests}

    for q in quests:
        template = templates_by_id.get(q.quest_type)
        if not template:
            # Fallback for default quests
            if q.quest_type in {"practice_1", "practice_3"}:
                metric_key = "practice_count"
            elif q.quest_type == "high_confidence":
                metric_key = "high_confidence_count"
            else:
                continue
        else:
            metric_key = template.get("metric_key")

        val = get_user_metric_value(db, user, metric_key)
        q.current_value = min(q.target_value, val)


def application_gamification_snapshot(application) -> dict | None:
    if not application:
        return None
    return {
        "status": application.status,
        "pipeline_stage": application.pipeline_stage,
    }


def apply_application_gamification_events(
    db: Session,
    user: User,
    application,
    previous_snapshot: dict | None,
    timestamp: datetime
) -> None:
    is_auto = False
    if application.application_type == "auto" or (application.raw_data and application.raw_data.get("application_type") == "auto"):
        is_auto = True
        
    prev_status = previous_snapshot.get("status") if previous_snapshot else None
    prev_stage = previous_snapshot.get("pipeline_stage") if previous_snapshot else None
    
    curr_status = application.status
    curr_stage = application.pipeline_stage
    
    gamification = get_or_create_gamification(db, user)
    
    config_obj = get_gamification_config(db)
    reward_events = config_obj.config.get("reward_events", [])
    events_by_key = {ev["event_key"]: ev for ev in reward_events if ev.get("enabled")}
    
    def award_event(event_key: str, reason: str):
        ev = events_by_key.get(event_key)
        if not ev:
            return
        required_origin = ev.get("application_origin", "any")
        current_origin = "auto" if is_auto else "manual"
        if required_origin not in {"any", current_origin}:
            return
        xp_gain = ev.get("xp", 0)
        coin_gain = ev.get("coins", 0)
        loot_box_gain = ev.get("loot_boxes", 0)
        
        gamification.xp += xp_gain
        gamification.coins += coin_gain
        if loot_box_gain > 0:
            modify_user_inventory_item(db, user.id, "loot_box", loot_box_gain)
        
        if xp_gain != 0 or coin_gain != 0 or loot_box_gain != 0:
            add_economy_transactions(
                db,
                user,
                xp_delta=xp_gain,
                coin_delta=coin_gain,
                loot_box_delta=loot_box_gain,
                reason=reason,
                reference_id=f"app_event:{application.id}:{event_key}"
            )
            
    is_submitted_now = curr_status not in {"processing", "interrupted", "skipped", "cancelled"}
    was_submitted_before = prev_status not in {"processing", "interrupted", "skipped", "cancelled"} if prev_status else False
    
    if is_submitted_now and not was_submitted_before:
        if is_auto:
            award_event("application_submitted_auto", f"Auto apply submitted: {application.company}")
        else:
            award_event("application_submitted_manual", f"Manual application submitted: {application.company}")
            
    if curr_status == "skipped" and prev_status != "skipped":
        if is_auto:
            award_event("application_skipped_auto", f"Auto apply skipped: {application.company}")
            
    if curr_status == "interrupted" and prev_status != "interrupted":
        if is_auto:
            award_event("application_interrupted_auto", f"Auto apply needs review: {application.company}")
            
    if curr_stage == "offer" and prev_stage != "offer":
        award_event("application_offer_received", f"Offer received from {application.company}!")

    evaluate_badges(db, user)


REWARD_POOL_ITEMS = [
    {
        "type": "loot_box",
        "name": "Mystic Loot Box",
        "badge": "🧰 Mystery Loot Box",
        "icon": "/loot-box.png",
    },
    {
        "type": "gold_coins",
        "name": "100 Gold Coins",
        "badge": "🪙 +100 Gold Coins",
        "icon": "/gold-coin.png",
    },
    {
        "type": "streak_card",
        "name": "Streak Saver Card",
        "badge": "🔥 Streak Saver",
        "icon": "/streak-card.png",
    },
    {
        "type": "double_xp",
        "name": "2X XP Booster Card",
        "badge": "⚡ 2X XP Booster",
        "icon": "/double-xp-card.png",
    },
    {
        "type": "vip_days",
        "name": "3-Day VIP Pass",
        "badge": "👑 3-Day VIP Pass",
        "icon": "/vip-card.png",
    },
]


def get_stage_reward_backend(day_num: int, plan_id: str = "default") -> dict:
    hash_val = day_num * 37
    for char in plan_id:
        hash_val = ((hash_val << 5) - hash_val + ord(char)) & 0xFFFFFFFF
        if hash_val & 0x80000000:
            hash_val = -((~hash_val + 1) & 0xFFFFFFFF)
    index = abs(hash_val) % len(REWARD_POOL_ITEMS)
    return REWARD_POOL_ITEMS[index]


@router.post("/plans/{plan_id}/stages/{day_num}/claim-reward")
def claim_stage_reward(
    plan_id: UUID,
    day_num: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    claimed_days = list(plan.claimed_stage_days or [])
    if day_num in claimed_days:
        raise HTTPException(status_code=400, detail="Reward for this stage has already been claimed")

    tasks = db.scalars(
        select(PlanTask)
        .where(PlanTask.plan_id == plan_id)
        .order_by(PlanTask.scheduled_date.asc())
    ).all()
    
    if not tasks:
        raise HTTPException(status_code=400, detail="No tasks found in plan")
        
    dates = []
    for t in tasks:
        ds = t.scheduled_date.date().isoformat()
        if ds not in dates:
            dates.append(ds)
            
    if day_num <= 0:
        raise HTTPException(status_code=400, detail="Invalid stage day number")
        
    stage_tasks = []
    if day_num <= len(dates):
        target_date_str = dates[day_num - 1]
        stage_tasks = [t for t in tasks if t.scheduled_date.date().isoformat() == target_date_str]
        
    if not stage_tasks or any(t.status != "completed" for t in stage_tasks):
        raise HTTPException(status_code=400, detail="All quests in this stage must be completed before claiming reward")

    gamification = get_or_create_gamification(db, current_user)
    if gamification.active_boosters is None:
        gamification.active_boosters = {}

    reward = get_stage_reward_backend(day_num, str(plan.id))
    reward_type = reward["type"]
    
    msg = f"Stage Day {day_num} Reward: {reward['name']}"
    
    if reward_type == "gold_coins":
        gamification.coins += 100
        db.add(GamificationTransaction(
            user_id=current_user.id,
            amount=100,
            currency="coin",
            reason=msg
        ))
    else:
        # All non-coin rewards (loot_box, streak_card, double_xp, vip_days)
        # go into user_inventory_items table
        modify_user_inventory_item(db, current_user.id, reward_type, 1)
        db.add(GamificationTransaction(
            user_id=current_user.id,
            amount=1,
            currency="item",
            reason=msg
        ))

    claimed_days.append(day_num)
    plan.claimed_stage_days = claimed_days
    db.commit()
    db.refresh(plan)
    db.refresh(gamification)
    inv_dict = get_user_inventory_dict(db, current_user.id)
    
    return {
        "message": "Stage reward claimed successfully",
        "reward": reward,
        "claimed_stage_days": plan.claimed_stage_days,
        "gamification": {
            "coins": gamification.coins,
            "xp": gamification.xp,
            "level": gamification.level,
            "loot_boxes": inv_dict.get("loot_box", 0),
            "inventory": inv_dict,
            "active_boosters": gamification.active_boosters,
        }
    }


class UseItemPayload(BaseModel):
    item_type: str


@router.get("/gamification/inventory")
def get_user_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    gamification = get_or_create_gamification(db, current_user)
    inv_dict = get_user_inventory_dict(db, current_user.id)
    return {
        "coins": gamification.coins,
        "xp": gamification.xp,
        "level": gamification.level,
        "loot_boxes": inv_dict.get("loot_box", 0),
        "inventory": inv_dict,
        "active_boosters": gamification.active_boosters or {},
    }


@router.post("/gamification/inventory/use")
def use_inventory_item(
    payload: UseItemPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    gamification = get_or_create_gamification(db, current_user)
    boosters = dict(gamification.active_boosters or {})
    now = datetime.now(timezone.utc)
    item_type = payload.item_type
    
    count = get_item_quantity(db, current_user.id, item_type)
    if count <= 0:
        raise HTTPException(status_code=400, detail=f"No {item_type} items available in inventory")
    
    if item_type == "loot_box":
        return open_lootbox(db, current_user)

    if item_type == "streak_card":
        return {
            "message": "Streak Saver cards are passive. They automatically protect your streak if you miss a practice day.",
            "inventory": get_user_inventory_dict(db, current_user.id),
            "active_boosters": gamification.active_boosters
        }

    if modify_user_inventory_item(db, current_user.id, item_type, -1) is None:
        raise HTTPException(status_code=400, detail=f"No {item_type} items available in inventory")
    
    if item_type == "double_xp":
        exp = now + timedelta(hours=24)
        boosters["double_xp_until"] = exp.isoformat()
        gamification.active_boosters = boosters
        db.add(GamificationTransaction(
            user_id=current_user.id,
            amount=1,
            currency="booster",
            reason="Activated 2X XP Booster Card (24 hours)"
        ))
        db.commit()
        return {
            "message": "Activated 2X XP Booster for 24 hours!",
            "inventory": get_user_inventory_dict(db, current_user.id),
            "active_boosters": gamification.active_boosters
        }
    elif item_type == "vip_days":
        current_until_str = boosters.get("vip_until")
        start_time = now
        if current_until_str:
            try:
                curr_until = parse_datetime_to_utc(current_until_str)
                if curr_until > now:
                    start_time = curr_until
            except Exception:
                pass
        exp = start_time + timedelta(days=3)
        boosters["vip_until"] = exp.isoformat()
        gamification.active_boosters = boosters
        db.add(GamificationTransaction(
            user_id=current_user.id,
            amount=3,
            currency="vip_days",
            reason="Activated 3-Day VIP Pass"
        ))
        db.commit()
        return {
            "message": "Activated 3-Day VIP Pass!",
            "inventory": get_user_inventory_dict(db, current_user.id),
            "active_boosters": gamification.active_boosters
        }
    else:
        raise HTTPException(status_code=400, detail="Unknown item type")


@router.get("/gamification/summary", response_model=DailySummarySchema)
def get_daily_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    from datetime import datetime, timezone
    
    gamification = get_or_create_gamification(db, current_user)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get today's practice records
    todays_records = db.scalars(
        select(PracticeRecord)
        .where(
            PracticeRecord.user_id == current_user.id,
            PracticeRecord.date >= today_start
        )
    ).all()
    
    completed_questions = len(list(todays_records))
    
    new_questions = 0
    review_questions = 0
    
    total_speaking_time = 0
    best_score = -1
    best_answer_title = None
    
    # Calculate real XP and Coins gained today from transaction ledger
    xp_gained_today = db.scalar(
        select(func.sum(GamificationTransaction.amount))
        .where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.currency == "xp",
            GamificationTransaction.amount > 0,
            GamificationTransaction.created_at >= today_start
        )
    ) or 0
    
    coins_gained_today = db.scalar(
        select(func.sum(GamificationTransaction.amount))
        .where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.currency == "coin",
            GamificationTransaction.amount > 0,
            GamificationTransaction.created_at >= today_start
        )
    ) or 0
    
    for record in todays_records:
        prior_practice = db.scalar(
            select(func.count(PracticeRecord.id))
            .where(
                PracticeRecord.user_id == current_user.id,
                PracticeRecord.question_id == record.question_id,
                PracticeRecord.date < today_start
            )
        )
        if prior_practice > 0:
            review_questions += 1
        else:
            new_questions += 1
            
        for audio in record.audio_records:
            if audio.duration:
                total_speaking_time += audio.duration
                
        if record.confidence_score is not None and record.confidence_score > best_score:
            best_score = record.confidence_score
            if record.question:
                best_answer_title = record.question.title

    next_level_xp = ((gamification.level if gamification else 1) ** 2) * 100
    
    has_checked_in_today = False
    if gamification and gamification.last_checkin_date:
        if gamification.last_checkin_date.date() == now.date():
            has_checked_in_today = True

    # Load daily caps from config
    config_obj = get_gamification_config(db)
    max_daily_xp_gain = config_obj.config.get("max_daily_xp_gain", 500)
    max_daily_coin_gain = config_obj.config.get("max_daily_coin_gain", 100)

    inv_dict = get_user_inventory_dict(db, current_user.id)

    return {
        "completed_questions": completed_questions,
        "new_questions": new_questions,
        "review_questions": review_questions,
        "total_speaking_time_seconds": total_speaking_time,
        "best_answer_title": best_answer_title,
        "current_streak": gamification.streak_days if gamification else 0,
        "xp_gained_today": xp_gained_today,
        "coins_gained_today": coins_gained_today,
        "level": gamification.level if gamification else 1,
        "total_xp": gamification.xp if gamification else 0,
        "next_level_xp": next_level_xp,
        "loot_boxes": inv_dict.get("loot_box", 0),
        "has_checked_in_today": has_checked_in_today,
        "total_coins": gamification.coins if gamification else 0,
        "max_daily_xp_gain": max_daily_xp_gain,
        "max_daily_coin_gain": max_daily_coin_gain,
        "inventory": inv_dict,
        "active_boosters": gamification.active_boosters if gamification else {},
    }


@router.get("/gamification/heatmap", response_model=HeatmapDataSchema)
def get_gamification_heatmap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    from sqlalchemy import cast, Date
    
    results = db.execute(
        select(cast(PracticeRecord.date, Date).label("date"), func.count(PracticeRecord.id).label("count"))
        .where(PracticeRecord.user_id == current_user.id)
        .group_by(cast(PracticeRecord.date, Date))
    ).all()
    
    entries = [{"date": r.date.isoformat(), "count": r.count} for r in results]
    
    return {"entries": entries}


@router.get("/gamification/transactions", response_model=list[GamificationTransactionRead])
def get_gamification_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    transactions = db.scalars(
        select(GamificationTransaction)
        .where(GamificationTransaction.user_id == current_user.id)
        .order_by(GamificationTransaction.created_at.desc())
    ).all()
    return transactions


class LootBoxResponse(BaseModel):
    coins_won: int
    new_balance: int


@router.post("/gamification/checkin")
def daily_checkin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    gamification = get_or_create_gamification(db, current_user)
        
    now = datetime.now(timezone.utc)
    # Check if already checked in today
    if gamification.last_checkin_date and gamification.last_checkin_date.date() == now.date():
        raise HTTPException(status_code=400, detail="Already checked in today")
    
    # Load checkin reward from config
    config_obj = get_gamification_config(db)
    reward_events = config_obj.config.get("reward_events", [])
    checkin_event = next((ev for ev in reward_events if ev.get("event_key") == "daily_checkin" and ev.get("enabled")), None)
    
    xp_earned = checkin_event.get("xp", 50) if checkin_event else 50
    coins_earned = checkin_event.get("coins", 0) if checkin_event else 0
    loot_boxes_earned = checkin_event.get("loot_boxes", 1) if checkin_event else 1
    
    # Apply daily caps on XP and Coins
    xp_earned, coins_earned = enforce_daily_limits(db, current_user, xp_earned, coins_earned, config_obj.config)
    
    # Award rewards
    gamification.last_checkin_date = now
    gamification.xp += xp_earned
    gamification.coins += coins_earned
    if loot_boxes_earned > 0:
        modify_user_inventory_item(db, current_user.id, "loot_box", loot_boxes_earned)
    
    # Recalculate level
    new_level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
    gamification.level = new_level
    
    # Log transactions
    add_economy_transactions(db, current_user, xp_earned, coins_earned, loot_boxes_earned, "Daily Check-in Bonus")
    db.commit()
    
    return {"message": "Checked in successfully", "xp_earned": xp_earned, "coins_earned": coins_earned, "loot_boxes_earned": loot_boxes_earned}


@router.post("/gamification/lootbox/open", response_model=LootBoxResponse)
def open_lootbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    gamification = get_or_create_gamification(db, current_user)
    config_obj = get_gamification_config(db)
    spend_events = config_obj.config.get("spend_events", [])
    loot_box_event = next(
        (event for event in spend_events if event.get("event_key") == "loot_box_open" and event.get("enabled")),
        None,
    )
    loot_box_cost = max(0, -int(loot_box_event.get("loot_boxes", -1))) if loot_box_event else 1

    if loot_box_cost > 0 and modify_user_inventory_item(db, current_user.id, "loot_box", -loot_box_cost) is None:
        raise HTTPException(status_code=400, detail="No loot boxes available")
    
    coins_won = random.randint(10, 50)
    gamification.coins += coins_won
    
    tx_coin = GamificationTransaction(
        user_id=current_user.id,
        amount=coins_won,
        currency="coin",
        reason="Opened Loot Box"
    )
    db.add(tx_coin)
    if loot_box_cost:
        add_economy_transactions(
            db,
            current_user,
            xp_delta=0,
            coin_delta=0,
            loot_box_delta=-loot_box_cost,
            reason="Opened Loot Box",
        )
    db.commit()
    
    return LootBoxResponse(coins_won=coins_won, new_balance=gamification.coins)


@router.get("/gamification/quests", response_model=list[DailyQuestRead])
def get_daily_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # Get today's quests
    quests = db.scalars(
        select(UserDailyQuest)
        .where(UserDailyQuest.user_id == current_user.id)
        .where(func.date(UserDailyQuest.quest_date) == today)
    ).all()
    
    if not quests:
        # Load quest pool from config
        config_obj = get_gamification_config(db)
        quest_pool = config_obj.config.get("daily_quest_pool", [])
        selection_count = config_obj.config.get("daily_selection_count", 3)
        
        # Filter enabled quests
        enabled_quests = [
            quest
            for quest in quest_pool
            if quest.get("enabled", True) and quest.get("visible", True)
        ]
        
        # Select quests (use all if fewer than selection_count)
        import random as _random
        selected = _random.sample(enabled_quests, min(selection_count, len(enabled_quests))) if enabled_quests else []
        
        quests = []
        for template in selected:
            quest = UserDailyQuest(
                user_id=current_user.id,
                quest_date=now,
                quest_type=template["id"],
                title=template["title"],
                description=template["description"],
                target_value=template["target_value"],
            )
            db.add(quest)
            quests.append(quest)
        db.commit()
        for q in quests:
            db.refresh(q)
    
    # Update quest progress dynamically
    update_user_daily_quests(db, current_user)
    db.commit()
    for q in quests:
        db.refresh(q)
            
    return quests


@router.post("/gamification/quests/{quest_id}/claim")
def claim_quest(
    quest_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    quest = db.scalar(select(UserDailyQuest).where(UserDailyQuest.id == quest_id, UserDailyQuest.user_id == current_user.id))
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
        
    if quest.is_claimed:
        raise HTTPException(status_code=400, detail="Quest already claimed")
        
    if quest.current_value < quest.target_value:
        raise HTTPException(status_code=400, detail="Quest not completed yet")
        
    quest.is_claimed = True
    gamification = get_or_create_gamification(db, current_user)
    
    # Look up rewards dynamically from quest pool config
    config_obj = get_gamification_config(db)
    all_quests = config_obj.config.get("daily_quest_pool", []) + config_obj.config.get("weekly_quest_pool", [])
    template = next((q for q in all_quests if q["id"] == quest.quest_type), None)
    
    if template:
        xp_earned = template.get("reward_xp", 0)
        coins_earned = template.get("reward_coins", 0)
        loot_boxes_earned = template.get("reward_loot_boxes", 0)
    else:
        # Fallback for legacy quest types
        if quest.quest_type == "practice_1":
            xp_earned, coins_earned, loot_boxes_earned = 20, 5, 0
        elif quest.quest_type == "practice_3":
            xp_earned, coins_earned, loot_boxes_earned = 50, 15, 1
        elif quest.quest_type == "high_confidence":
            xp_earned, coins_earned, loot_boxes_earned = 30, 10, 0
        else:
            xp_earned, coins_earned, loot_boxes_earned = 0, 0, 0
    
    # Apply daily caps
    xp_earned, coins_earned = enforce_daily_limits(db, current_user, xp_earned, coins_earned, config_obj.config)
    
    gamification.xp += xp_earned
    gamification.coins += coins_earned
    if loot_boxes_earned > 0:
        modify_user_inventory_item(db, current_user.id, "loot_box", loot_boxes_earned)
    
    # Recalculate level
    new_level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
    gamification.level = new_level
    
    add_economy_transactions(db, current_user, xp_earned, coins_earned, loot_boxes_earned, f"Quest claimed: {quest.title}")
        
    db.commit()
    return {
        "message": "Quest claimed successfully",
        "xp_earned": xp_earned,
        "coins_earned": coins_earned,
        "loot_boxes_earned": loot_boxes_earned
    }


@router.get("/gamification/achievements", response_model=list[AchievementRead])
def get_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    achievements = db.scalars(
        select(UserAchievement)
        .where(UserAchievement.user_id == current_user.id)
        .order_by(UserAchievement.unlocked_at.desc())
    ).all()
    return achievements


@router.post("/gamification/reset")
def reset_account_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    settings = get_settings()
    if current_user.email.lower() in ("scott5443003@gmail.com", settings.default_admin_email.lower()):
        raise HTTPException(status_code=403, detail="Protected admin account cannot be reset")

    # Delete custom collections created by the user (since creator_user_id is SET NULL on delete user)
    db.execute(delete(InterviewCollection).where(InterviewCollection.creator_user_id == current_user.id))

    # Delete the user record itself. All other user-related tables (JobApplication, PlatformAccount,
    # PracticePlan, PracticeRecord, UserGamification, etc.) have ondelete="CASCADE" foreign keys 
    # referencing users.id, so they will be deleted automatically.
    db.execute(delete(User).where(User.id == current_user.id))

    db.commit()
    return {"message": "Account data reset successfully"}


@router.post("/gamification/welcome")
def claim_welcome_bonus(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    existing = db.scalar(
        select(GamificationTransaction).where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.reason == "Welcome Bonus"
        )
    )
    if existing:
        return {"awarded": False, "coins_earned": 0, "xp_earned": 0, "loot_boxes_earned": 0}
        
    gamification = get_or_create_gamification(db, current_user)
    
    # Load welcome bonus from config
    config_obj = get_gamification_config(db)
    coins_earned = config_obj.config.get("welcome_bonus_coins", 100)
    xp_earned = config_obj.config.get("welcome_bonus_xp", 50)
    loot_boxes_earned = config_obj.config.get("welcome_bonus_loot_boxes", 1)
    
    gamification.coins += coins_earned
    gamification.xp += xp_earned
    if loot_boxes_earned > 0:
        modify_user_inventory_item(db, current_user.id, "loot_box", loot_boxes_earned)
    
    # Recalculate level
    new_level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
    gamification.level = new_level
    
    add_economy_transactions(db, current_user, xp_earned, coins_earned, loot_boxes_earned, "Welcome Bonus", "welcome_bonus")
    db.commit()
    
    return {"awarded": True, "coins_earned": coins_earned, "xp_earned": xp_earned, "loot_boxes_earned": loot_boxes_earned}


@router.get("/gamification/admin-config", response_model=GamificationConfigRead)
def get_gamification_admin_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    return get_gamification_config(db)


@router.put("/gamification/admin-config", response_model=GamificationConfigRead)
def update_gamification_admin_config(
    payload: GamificationConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update gamification configuration")
    config_obj = get_gamification_config(db)
    config_obj.config = payload.config
    config_obj.updated_by_user_id = current_user.id
    db.commit()
    db.refresh(config_obj)
    return config_obj


def _spend_coins(db: Session, user: User, amount: int, reason: str, reference_id: str) -> GamificationTransaction | None:
    if amount <= 0:
        return None
    wallet = get_or_create_gamification(db, user)
    if wallet.coins < amount:
        raise HTTPException(status_code=402, detail="Not enough coins")
    wallet.coins -= amount
    transaction = GamificationTransaction(
        user_id=user.id,
        amount=-amount,
        currency="coin",
        reason=reason,
        reference_id=reference_id,
    )
    db.add(transaction)
    db.flush()
    return transaction

