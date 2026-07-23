from uuid import UUID, uuid4
import math
import random
import re
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, status, UploadFile, File, BackgroundTasks, Query
from sqlalchemy import delete, select, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload, object_session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

from services.shared.database import SessionLocal, get_db
from services.api.dependencies import get_or_create_current_user
from services.shared.settings import get_settings
from services.shared.storage import StorageError, get_object_storage
from services.shared.media import MediaError, optimize_image_to_webp
from services.shared.realtime import broadcast_sync
from services.shared.deepseek import DeepSeekError, evaluate_practice_answer, generate_question_metadata, generate_reference_answer, sanitize_ai_output
from services.shared.models import (
    User,
    UserProfile,
    PlatformAccount,
    JobHuntingProfile,
    RuntimeSettings,
    QuestionCacheEntry,
    JobApplication,
    InterviewQuestion,
    InterviewCategory,
    InterviewTag,
    QuestionTagAssociation,
    UserQuestionTagAssociation,
    PracticeRecord,
    PlanTask,
    PracticePlan,
    AudioRecord,
    UserGamification,
    UserInventoryItem,
    GamificationTransaction,
    UserDailyQuest,
    UserAchievement,
    InterviewCollection,
    InterviewCollectionQuestion,
    UserCollection,
    UserQuestion,
    CollectionContributor,
    InterviewReport,
    QuestionInterviewReportSummary,
    QuestionRating,
    QuestionReaction,
    QuestionComment,
    QuestionCommentLike,
    QuestionCommentReport,
    UserNotification,
    Company,
    GamificationConfig,
    QuestionAnswer,
    QuestionAnswerReaction,
    QuestionAnswerComment,
    QuestionAnswerCommentLike,
    QuestionAnswerCommentReport,
    QuestionAnswerSave,
    QuestionAnswerReport,
    QuestionMetrics,
    QuestionAnswerUnlock,
    PracticeEvaluation,
)
from services.shared.schemas import (
    InterviewQuestionCreate,
    InterviewQuestionUpdate,
    InterviewQuestionRead,
    InterviewCategoryBase,
    InterviewCategoryRead,
    InterviewTagBase,
    InterviewTagRead,
    InterviewCollectionRead,
    InterviewCollectionCreate,
    InterviewCollectionUpdate,
    InterviewReportBase,
    InterviewReportRead,
    QuestionCommunitySummaryRead,
    QuestionRatingUpdate,
    QuestionReactionUpdate,
    QuestionAnswerCreate,
    QuestionAnswerRead,
    QuestionAnswerReactionUpdate,
    QuestionAnswerUpdate,
    QuestionAnswerCommentCreate,
    QuestionAnswerCommentUpdate,
    QuestionAnswerCommentReportCreate,
    QuestionAnswerCommentRead,
    QuestionAnswerCommentPageRead,
    QuestionAnswerSaveRead,
    QuestionMetricsRead,
    QuestionCommentCreate,
    QuestionCommentLikeRead,
    QuestionCommentReportCreate,
    QuestionDiscussionMergeRead,
    QuestionDuplicateCandidateRead,
    QuestionDuplicateGroupRead,
    QuestionCommentRead,
    QuestionCommentPageRead,
    CommunityInterviewReportRead,
    UserNotificationRead,
    PracticeRecordCreate,
    PracticeRecordRead,
    PracticeRecordUpdate,
    PracticePlanBase,
    PracticePlanRead,
    PlanTaskBase,
    PlanTaskRead,
    PlanTaskUpdate,
    DailySummarySchema,
    HeatmapDataSchema,
    GamificationTransactionRead,
    DailyQuestRead,
    AchievementRead,
    GamificationConfigRead,
    GamificationConfigUpdate,
    QuestionCommentRead,
    QuestionCommentPageRead,
    QuestionCommentCreate,
    QuestionCommentUpdate,
    QuestionCommentReportCreate,
    AnswerUnlockRead,
    PracticeEvaluationRead,
)

class WelcomeBonusResponse(BaseModel):
    awarded: bool
    coins_earned: int

router = APIRouter(prefix="/api/interview", tags=["Interview Practice"])

# --- Constants & Configs ---
QUESTION_SET_CREATOR_REVENUE_SHARE = 0.3
DEFAULT_COLLECTION_SEEDS = [
    {
        "title": "Jobby Essentials",
        "slug": "jobby-essentials",
        "description": "Essential questions for general job hunt prep.",
        "collection_type": "official",
        "theme": "About You",
        "price_coins": 0,
        "questions": [
            {
                "title": "Tell me about yourself.",
                "answer_objective": "Pitch your experience and match the role.",
            },
            {
                "title": "Why do you want this job?",
                "answer_objective": "Show product understanding and motivation.",
            },
            {
                "title": "Describe a tough problem you solved.",
                "answer_objective": "Use context, action, and result.",
            },
        ],
    },
    {
        "title": "Behavioral Signals",
        "slug": "behavioral-signals",
        "description": "Common behavioral prompts and stories.",
        "collection_type": "official",
        "theme": "Behaviour",
        "price_coins": 0,
        "questions": [
            {
                "title": "Tell me about a time you disagreed with a teammate.",
                "answer_objective": "Focus on communication, empathy, and resolution.",
            },
            {
                "title": "Tell me about a failure and what you learned.",
                "answer_objective": "Own the mistake and show the lesson.",
            },
        ],
    },
    {
        "title": "Community Favorites",
        "slug": "community-favorites",
        "description": "A small community-style collection to demonstrate the flow.",
        "collection_type": "community",
        "theme": "Experience",
        "price_coins": 25,
        "questions": [
            {
                "title": "How do you prioritize when everything is urgent?",
                "answer_objective": "Explain tradeoffs, communication, and focus.",
            },
            {
                "title": "What are your strengths as a builder?",
                "answer_objective": "Use evidence and outcomes.",
            },
        ],
    },
]

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
}


# --- Helper Functions ---
def get_system_user(db: Session) -> User:
    preferred = db.scalar(
        select(User).where(User.email == get_settings().default_admin_email)
    )
    if preferred:
        return preferred
    return db.scalar(
        select(User).where(User.role == "admin").order_by(User.created_at.asc())
    )


def ensure_collection_seeds(db: Session) -> None:
    existing = db.scalar(select(func.count(InterviewCollection.id))) or 0
    if existing:
        seeds_by_slug = {seed["slug"]: seed for seed in DEFAULT_COLLECTION_SEEDS}
        seeded_collections = db.scalars(
            select(InterviewCollection).where(InterviewCollection.slug.in_(seeds_by_slug.keys()))
        ).all()
        for collection in seeded_collections:
            seed = seeds_by_slug.get(collection.slug)
            if seed and not collection.theme:
                collection.theme = seed.get("theme")
        return
    creator = get_system_user(db)
    if not creator:
        return
    for seed in DEFAULT_COLLECTION_SEEDS:
        collection = InterviewCollection(
            title=seed["title"],
            slug=seed["slug"],
            description=seed["description"],
            collection_type=seed["collection_type"],
            theme=seed.get("theme"),
            price_coins=seed["price_coins"],
            creator_user_id=creator.id,
            status="published",
            last_updated_at=datetime.now(timezone.utc),
        )
        db.add(collection)
        db.flush()
        db.add(CollectionContributor(collection_id=collection.id, user_id=creator.id, contribution_count=len(seed["questions"]), rank=1))
        for index, question_seed in enumerate(seed["questions"]):
            question = InterviewQuestion(
                submitted_by_user_id=creator.id,
                title=question_seed["title"],
                answer_objective=question_seed.get("answer_objective"),
                frequency="High" if index == 0 else "Medium",
                importance_score=5 if index == 0 else 4,
            )
            db.add(question)
            db.flush()
            db.add(InterviewCollectionQuestion(collection_id=collection.id, question_id=question.id, sort_order=index, is_approved=True))
            db.add(UserQuestion(user_id=creator.id, question_id=question.id, is_saved=True, saved_at=datetime.now(timezone.utc)))
    db.commit()


def collection_question_count(db: Session, collection_id: UUID) -> int:
    return db.scalar(
        select(func.count(InterviewCollectionQuestion.id)).where(
            InterviewCollectionQuestion.collection_id == collection_id,
            InterviewCollectionQuestion.is_approved.is_(True),
        )
    ) or 0


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
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_submitted_week":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= week_start,
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_submitted_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_manual_submitted_today":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= today_start,
                JobApplication.application_type == "manual",
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_manual_submitted_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.application_type == "manual",
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_auto_submitted_today":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.date_applied >= today_start,
                JobApplication.application_type == "auto",
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
            )
        ) or 0
    elif key == "applications_auto_submitted_total":
        return db.scalar(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.user_id == user.id,
                JobApplication.application_type == "auto",
                JobApplication.status.not_in(["processing", "interrupted", "skipped", "cancelled"])
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


def ensure_question_display_number(db: Session, q: InterviewQuestion) -> int | None:
    if not q or not db:
        return getattr(q, "display_number", None) if q else None
    if getattr(q, "display_number", None) is not None:
        return q.display_number
    try:
        max_num = db.scalar(select(func.max(InterviewQuestion.display_number))) or 0
        q.display_number = max_num + 1
        db.flush()
        return q.display_number
    except Exception:
        return getattr(q, "display_number", None)


def active_collection_ids_by_question(
    db: Session,
    user_id: UUID,
    question_ids: list[UUID],
) -> dict[UUID, list[UUID]]:
    """Return active subscribed playlist ids for each requested question."""
    if not question_ids:
        return {}
    rows = db.execute(
        select(InterviewCollectionQuestion.question_id, InterviewCollectionQuestion.collection_id)
        .join(UserCollection, UserCollection.collection_id == InterviewCollectionQuestion.collection_id)
        .where(
            UserCollection.user_id == user_id,
            UserCollection.removed_at.is_(None),
            InterviewCollectionQuestion.question_id.in_(question_ids),
            InterviewCollectionQuestion.is_approved.is_(True),
        )
    ).all()
    result: dict[UUID, list[UUID]] = {}
    for question_id, collection_id in rows:
        result.setdefault(question_id, []).append(collection_id)
    return result


def to_question_read(
    user_q: UserQuestion,
    current_user: User | None = None,
    collection_ids: list[UUID] | None = None,
) -> dict:
    q = user_q.question
    db_session = object_session(user_q)
    disp_num = getattr(q, "display_number", None)
    if disp_num is None and db_session and q:
        disp_num = ensure_question_display_number(db_session, q)

    can_edit = False
    if current_user and q:
        can_edit = bool(q.submitted_by_user_id == current_user.id or getattr(current_user, "role", None) == "admin")
    elif q and user_q:
        can_edit = bool(q.submitted_by_user_id == user_q.user_id)

    if collection_ids is None:
        collection_ids = active_collection_ids_by_question(
            db_session,
            user_q.user_id,
            [q.id],
        ).get(q.id, []) if db_session and q else []

    metrics_obj = getattr(q, "metrics", None)
    metrics_dict = {
        "view_count": metrics_obj.view_count if metrics_obj else 0,
        "favorite_count": metrics_obj.favorite_count if metrics_obj else 0,
        "upvote_count": metrics_obj.upvote_count if metrics_obj else 0,
        "downvote_count": metrics_obj.downvote_count if metrics_obj else 0,
        "seen_in_interview_count": metrics_obj.seen_in_interview_count if metrics_obj else 0,
        "comment_count": getattr(metrics_obj, "comment_count", 0) if metrics_obj else 0,
        "practice_count": metrics_obj.practice_count if metrics_obj else 0,
    }

    return {
        "id": q.id,
        "submitted_by_user_id": q.submitted_by_user_id,
        "contributor_name": q.submitted_by.display_name if q.submitted_by else None,
        "can_edit": can_edit,
        "category_id": user_q.category_id,
        "title": q.title,
        "display_number": disp_num,
        "normalized_title": q.normalized_title,
        "difficulty": getattr(q, "difficulty", None),
        "estimated_duration_seconds": getattr(q, "estimated_duration_seconds", 120) or 120,
        "frequency": user_q.frequency,
        "importance_score": user_q.importance_score,
        "is_favorited": user_q.is_favorited,
        "author_frequency": q.author_frequency or q.frequency,
        "author_importance_score": q.author_importance_score or q.importance_score,
        "ai_metadata": q.ai_metadata,
        "answer_objective": q.answer_objective,
        "sample_answer": q.sample_answer,
        "my_answer": user_q.my_answer,
        "improvement_notes": user_q.improvement_notes,
        "collection_ids": collection_ids,
        "is_saved": user_q.is_saved,
        "created_at": user_q.created_at,
        "updated_at": user_q.updated_at,
        "metrics": metrics_dict,
        "category": {
            "id": user_q.category.id,
            "user_id": user_q.category.user_id,
            "name": user_q.category.name,
            "created_at": user_q.category.created_at,
            "updated_at": user_q.category.updated_at,
        } if user_q.category else None,
        "tags": [
            {
                "id": t.id,
                "user_id": t.user_id,
                "name": t.name,
                "created_at": t.created_at,
                "updated_at": t.updated_at,
            } for t in user_q.tags
        ],
        "companies": [
            {
                "id": company.id,
                "name": company.name,
                "logo_url": company.logo_url,
                "created_at": company.created_at,
                "updated_at": company.updated_at,
            }
            for company in (q.companies or [])
        ],
    }


def to_public_question_read(question: InterviewQuestion, current_user: User) -> dict:
    """Public-catalog response without exposing another user's private state."""
    user_state = None
    session = object_session(question)
    if session:
        user_state = session.scalar(
            select(UserQuestion)
            .options(joinedload(UserQuestion.category), selectinload(UserQuestion.tags))
            .where(UserQuestion.user_id == current_user.id, UserQuestion.question_id == question.id)
        )
    if user_state:
        return to_question_read(user_state, current_user)
    metrics_obj = getattr(question, "metrics", None)
    metrics_dict = {
        "view_count": metrics_obj.view_count if metrics_obj else 0,
        "favorite_count": metrics_obj.favorite_count if metrics_obj else 0,
        "upvote_count": metrics_obj.upvote_count if metrics_obj else 0,
        "downvote_count": metrics_obj.downvote_count if metrics_obj else 0,
        "seen_in_interview_count": metrics_obj.seen_in_interview_count if metrics_obj else 0,
        "comment_count": getattr(metrics_obj, "comment_count", 0) if metrics_obj else 0,
        "practice_count": metrics_obj.practice_count if metrics_obj else 0,
    }

    return {
        "id": question.id,
        "submitted_by_user_id": question.submitted_by_user_id,
        "contributor_name": question.submitted_by.display_name if question.submitted_by else None,
        "can_edit": question.submitted_by_user_id == current_user.id or current_user.role == "admin",
        "category_id": question.category_id,
        "title": question.title,
        "display_number": question.display_number,
        "normalized_title": question.normalized_title,
        "difficulty": question.difficulty,
        "estimated_duration_seconds": question.estimated_duration_seconds or 120,
        "frequency": question.frequency,
        "importance_score": question.importance_score,
        "is_favorited": False,
        "author_frequency": question.author_frequency or question.frequency,
        "author_importance_score": question.author_importance_score or question.importance_score,
        "ai_metadata": question.ai_metadata,
        "answer_objective": question.answer_objective,
        "sample_answer": question.sample_answer,
        "my_answer": None,
        "improvement_notes": None,
        "collection_ids": [],
        "is_saved": False,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
        "metrics": metrics_dict,
        "category": question.category,
        "tags": question.tags,
        "companies": question.companies,
    }


def normalize_question_title(title: str) -> str:
    """Return a stable, human-safe lookup key without using an AI model."""
    normalized = re.sub(r"[^\w\s]", " ", title.casefold(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", normalized).strip()


def dedupe_public_questions(
    questions: list[InterviewQuestion],
    current_user: User,
    db: Session,
    limit: int,
) -> list[InterviewQuestion]:
    """Collapse duplicate prompts for public catalog surfaces."""
    if not questions:
        return []

    question_ids = [question.id for question in questions]
    saved_question_ids = set(
        db.scalars(
            select(UserQuestion.question_id).where(
                UserQuestion.user_id == current_user.id,
                UserQuestion.question_id.in_(question_ids),
                UserQuestion.is_saved.is_(True),
            )
        ).all()
    )

    deduped: dict[str, InterviewQuestion] = {}
    for question in questions:
        key = question.normalized_title or normalize_question_title(question.title)
        if not key:
            key = str(question.id)

        existing = deduped.get(key)
        if existing is None:
            deduped[key] = question
        elif question.id in saved_question_ids and existing.id not in saved_question_ids:
            deduped[key] = question

    return list(deduped.values())[:limit]


def _frequency_label_to_score(value: str | None) -> float | None:
    if not value:
        return None
    normalized = value.strip().lower()
    mapping = {
        "low": 1.0,
        "easy": 1.0,
        "medium": 3.0,
        "high": 5.0,
        "hard": 5.0,
    }
    return mapping.get(normalized)


def _community_weight(rating_count: int) -> float:
    return min(0.8, (rating_count / 50.0) * 0.8)


def sync_question_answers(db: Session, question: InterviewQuestion) -> None:
    existing_answers = db.scalars(
        select(QuestionAnswer).where(
            QuestionAnswer.question_id == question.id,
            QuestionAnswer.source == "author",
        )
    ).all()
    legacy_answers = {
        answer.metadata_.get("legacy_field"): answer
        for answer in existing_answers
        if answer.metadata_.get("legacy_field")
    }
    desired = {
        "answer_objective": {
            "answer_type": "reference",
            "title": "Author Reference Answer",
            "body": (question.answer_objective or "").strip(),
        },
        "sample_answer": {
            "answer_type": "reference",
            "title": "Legacy Sample Answer",
            "body": (question.sample_answer or "").strip(),
        },
    }

    for legacy_field, config in desired.items():
        existing = legacy_answers.get(legacy_field)
        body = config["body"]
        if not body:
            if existing:
                db.delete(existing)
            continue
        if existing:
            existing.answer_type = config["answer_type"]
            existing.title = config["title"]
            existing.body = body
            existing.status = "published"
        else:
            db.add(
                QuestionAnswer(
                    question_id=question.id,
                    author_user_id=question.submitted_by_user_id,
                    source="author",
                    answer_type=config["answer_type"],
                    status="published",
                    title=config["title"],
                    body=body,
                    metadata_={"legacy_field": legacy_field},
                )
            )


def refresh_question_metrics(db: Session, question_id: UUID) -> QuestionMetrics:
    question = db.get(InterviewQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    metrics = db.get(QuestionMetrics, question_id)
    if metrics is None:
        metrics = QuestionMetrics(question_id=question_id)
        db.add(metrics)

    user_state_stats = db.execute(
        select(
            func.coalesce(func.sum(UserQuestion.view_count), 0),
            func.count(UserQuestion.id).filter(UserQuestion.view_count > 0),
            func.coalesce(func.sum(UserQuestion.practice_count), 0),
            func.count(UserQuestion.id).filter(UserQuestion.practice_count > 0),
            func.coalesce(func.sum(UserQuestion.total_practice_seconds), 0),
            func.count(UserQuestion.id).filter(UserQuestion.is_favorited.is_(True)),
        ).where(
            UserQuestion.question_id == question_id,
        )
    ).one()
    practice_record_stats = db.execute(
        select(
            func.count(PracticeRecord.id),
            func.coalesce(func.sum(PracticeRecord.duration_seconds), 0),
        ).where(PracticeRecord.question_id == question_id)
    ).one()
    rating_stats = db.execute(
        select(
            func.avg(QuestionRating.frequency_rating),
            func.avg(QuestionRating.importance_rating),
            func.avg(QuestionRating.difficulty_rating),
            func.count(QuestionRating.id),
        ).where(QuestionRating.question_id == question_id)
    ).one()
    upvote_count = db.scalar(
        select(func.count(QuestionReaction.id)).where(
            QuestionReaction.question_id == question_id,
            QuestionReaction.value == "up",
        )
    ) or 0
    downvote_count = db.scalar(
        select(func.count(QuestionReaction.id)).where(
            QuestionReaction.question_id == question_id,
            QuestionReaction.value == "down",
        )
    ) or 0
    reports = db.scalars(
        select(InterviewReport).where(
            InterviewReport.question_id == question_id,
            InterviewReport.seen_in_interview.is_(True),
        )
    ).all()
    company_counts: dict[str, tuple[str, int]] = {}
    for report in reports:
        if not report.company or not report.company.strip():
            continue
        key = report.company.strip().casefold()
        display, count = company_counts.get(key, (report.company.strip(), 0))
        company_counts[key] = (display, count + 1)
    top_companies = [
        {"name": display, "count": count}
        for display, count in sorted(
            company_counts.values(),
            key=lambda item: (-item[1], item[0].casefold()),
        )[:5]
    ]
    seen_count = len(reports)
    company_count = len(company_counts)
    comment_count = db.scalar(
        select(func.count(QuestionComment.id)).where(
            QuestionComment.question_id == question_id,
            QuestionComment.deleted_at.is_(None),
        )
    ) or 0

    rating_count = int(rating_stats[3] or 0)
    community_weight = _community_weight(rating_count)
    author_frequency_score = _frequency_label_to_score(
        question.author_frequency or question.frequency
    )
    author_importance_score = (
        float(question.author_importance_score)
        if question.author_importance_score is not None
        else float(question.importance_score)
        if question.importance_score is not None
        else None
    )
    community_frequency = (
        float(rating_stats[0]) if rating_stats[0] is not None else None
    )
    community_importance = (
        float(rating_stats[1]) if rating_stats[1] is not None else None
    )
    metrics.view_count = int(user_state_stats[0] or 0)
    metrics.unique_viewer_count = int(user_state_stats[1] or 0)
    metrics.practice_count = int(practice_record_stats[0] or user_state_stats[2] or 0)
    metrics.unique_practicer_count = int(user_state_stats[3] or 0)
    metrics.total_practice_seconds = int(
        practice_record_stats[1] or user_state_stats[4] or 0
    )
    metrics.average_practice_seconds = (
        int(metrics.total_practice_seconds / metrics.practice_count)
        if metrics.practice_count
        else None
    )
    metrics.favorite_count = int(user_state_stats[5] or 0)
    metrics.upvote_count = upvote_count
    metrics.downvote_count = downvote_count
    metrics.seen_in_interview_count = seen_count
    metrics.company_count = company_count
    metrics.comment_count = comment_count
    metrics.rating_count = rating_count
    metrics.frequency_average = round(community_frequency, 2) if community_frequency is not None else None
    metrics.importance_average = round(community_importance, 2) if community_importance is not None else None
    metrics.difficulty_average = round(float(rating_stats[2]), 2) if rating_stats[2] is not None else None
    metrics.top_companies = top_companies
    metrics.blended_frequency_score = (
        round(
            author_frequency_score * (1 - community_weight)
            + community_frequency * community_weight,
            2,
        )
        if author_frequency_score is not None and community_frequency is not None
        else author_frequency_score
    )
    metrics.blended_importance_score = (
        round(
            author_importance_score * (1 - community_weight)
            + community_importance * community_weight,
            2,
        )
        if author_importance_score is not None and community_importance is not None
        else author_importance_score
    )
    metrics.last_aggregated_at = datetime.now(timezone.utc)
    return metrics


def ensure_user_question_state(
    db: Session,
    current_user: User,
    question: InterviewQuestion,
    *,
    is_saved: bool = False,
) -> UserQuestion:
    existing = db.scalar(
        select(UserQuestion).where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.question_id == question.id,
        )
    )
    if existing:
        if is_saved and not existing.is_saved:
            existing.is_saved = True
            existing.saved_at = datetime.now(timezone.utc)
        return existing
    user_q = UserQuestion(
        user_id=current_user.id,
        question_id=question.id,
        is_saved=is_saved,
        saved_at=datetime.now(timezone.utc) if is_saved else None,
        category_id=question.category_id,
        frequency=question.author_frequency or question.frequency,
        importance_score=question.author_importance_score or question.importance_score,
        my_answer=question.my_answer,
        improvement_notes=question.improvement_notes,
    )
    db.add(user_q)
    return user_q


def library_question_ids_query(current_user: User):
    """Questions available in a private Library: saved questions plus playlists."""
    subscribed_question_ids = (
        select(InterviewCollectionQuestion.question_id)
        .join(UserCollection, UserCollection.collection_id == InterviewCollectionQuestion.collection_id)
        .join(InterviewQuestion, InterviewQuestion.id == InterviewCollectionQuestion.question_id)
        .where(
            UserCollection.user_id == current_user.id,
            UserCollection.removed_at.is_(None),
            InterviewCollectionQuestion.is_approved.is_(True),
            InterviewQuestion.status == "published",
        )
    )
    return subscribed_question_ids


def question_to_collection_summary(db: Session, collection: InterviewCollection, current_user: User) -> dict:
    library_adds = db.scalar(
        select(func.count(UserCollection.id)).where(
            UserCollection.collection_id == collection.id,
            UserCollection.removed_at.is_(None)
        )
    ) or 0
    question_count = db.scalar(
        select(func.count(InterviewCollectionQuestion.id)).where(
            InterviewCollectionQuestion.collection_id == collection.id,
            InterviewCollectionQuestion.is_approved.is_(True)
        )
    ) or 0
    sample_questions = db.scalars(
        select(InterviewQuestion.title)
        .join(InterviewCollectionQuestion, InterviewCollectionQuestion.question_id == InterviewQuestion.id)
        .where(
            InterviewCollectionQuestion.collection_id == collection.id,
            InterviewCollectionQuestion.is_approved.is_(True)
        )
        .order_by(InterviewCollectionQuestion.sort_order.asc())
        .limit(3)
    ).all()
    sample_questions = list(sample_questions)
    creator_name = "System"
    if collection.creator_user_id:
        creator = db.get(User, collection.creator_user_id)
        if creator:
            creator_name = creator.email.split("@")[0]
    contributor_count = db.scalar(
        select(func.count(CollectionContributor.id)).where(
            CollectionContributor.collection_id == collection.id
        )
    ) or 0
    subscription = db.scalar(
        select(UserCollection).where(
            UserCollection.user_id == current_user.id,
            UserCollection.collection_id == collection.id
        )
    )
    # A subscribed collection is a live playlist. Its questions are available
    # without creating per-user copies or assigning a single source collection.
    is_in_library = subscription is not None and subscription.removed_at is None
    user_active_question_count = question_count if is_in_library else 0
    missing_question_count = 0 if is_in_library else question_count
    if question_count == 0:
        library_status = "empty"
    elif subscription is None or subscription.removed_at is not None or user_active_question_count == 0:
        library_status = "not_added"
    elif missing_question_count > 0:
        library_status = "partial"
    else:
        library_status = "complete"
    is_owned = collection.creator_user_id == current_user.id
    is_purchased = subscription is not None and subscription.is_purchased
    can_purchase = not is_purchased and collection.price_coins > 0
    free_label = "Free" if collection.price_coins == 0 else None
    
    q_ids = db.scalars(
        select(InterviewCollectionQuestion.question_id)
        .where(
            InterviewCollectionQuestion.collection_id == collection.id,
            InterviewCollectionQuestion.is_approved.is_(True)
        )
    ).all()
    question_ids = [qid for qid in q_ids]

    return {
        "id": collection.id,
        "title": collection.title,
        "slug": collection.slug,
        "description": collection.description,
        "cover_url": collection.cover_url,
        "cover_storage_key": collection.cover_storage_key,
        "collection_type": collection.collection_type,
        "theme": collection.theme,
        "price_coins": collection.price_coins,
        "status": collection.status,
        "creator_user_id": collection.creator_user_id,
        "last_updated_at": collection.last_updated_at,
        "library_adds": library_adds,
        "question_count": question_count,
        "user_active_question_count": user_active_question_count,
        "missing_question_count": missing_question_count,
        "library_status": library_status,
        "sample_questions": sample_questions,
        "creator_name": creator_name,
        "contributor_count": contributor_count,
        "is_owned": is_owned,
        "is_in_library": is_in_library,
        "is_purchased": is_purchased,
        "can_purchase": can_purchase,
        "free_label": free_label,
        "question_ids": question_ids
    }


def get_collection_questions(db: Session, collection_id: UUID) -> list[InterviewCollectionQuestion]:
    return db.scalars(
        select(InterviewCollectionQuestion)
        .options(joinedload(InterviewCollectionQuestion.question))
        .where(
            InterviewCollectionQuestion.collection_id == collection_id,
            InterviewCollectionQuestion.is_approved.is_(True)
        )
        .order_by(InterviewCollectionQuestion.sort_order.asc())
    ).all()


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


router = APIRouter(prefix="/api/interview", tags=["Interview Practice"])

# Categories
@router.get("/categories", response_model=list[InterviewCategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    categories = db.scalars(select(InterviewCategory).where(InterviewCategory.user_id == current_user.id)).all()
    if not categories:
        default_categories = [
            "About You",
            "Experience",
            "Behaviour",
            "Role-specific",
            "Leadership",
            "Company",
        ]
        for name in default_categories:
            cat = InterviewCategory(user_id=current_user.id, name=name)
            db.add(cat)
        db.commit()
        categories = db.scalars(select(InterviewCategory).where(InterviewCategory.user_id == current_user.id)).all()
    return categories

@router.post("/categories", response_model=InterviewCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: InterviewCategoryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    category = InterviewCategory(user_id=current_user.id, name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

# Tags
@router.get("/tags", response_model=list[InterviewTagRead])
def list_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    tags = db.scalars(select(InterviewTag).where(InterviewTag.user_id == current_user.id)).all()
    return tags

@router.post("/tags", response_model=InterviewTagRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: InterviewTagBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    tag = InterviewTag(user_id=current_user.id, name=payload.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag

def apply_ai_question_metadata(
    db: Session,
    question: InterviewQuestion,
    current_user: User,
    metadata: dict,
) -> None:
    """Use AI analysis as the canonical question-level metadata."""
    metadata = metadata if isinstance(metadata, dict) else {}
    existing_metadata = question.ai_metadata if isinstance(question.ai_metadata, dict) else {}
    raw_tags = metadata.get("tags", existing_metadata.get("tags", []))
    tags = [
        tag
        for tag in raw_tags
        if isinstance(tag, str) and tag.strip()
    ] if isinstance(raw_tags, list) else []
    raw_difficulty = str(
        metadata.get("difficulty", existing_metadata.get("difficulty", question.difficulty or "medium")),
    ).strip().lower()
    difficulty = raw_difficulty if raw_difficulty in {"easy", "medium", "hard"} else "medium"
    try:
        estimated_duration = max(
            30,
            min(
                300,
                int(
                    metadata.get(
                        "estimated_duration",
                        existing_metadata.get(
                            "estimated_duration",
                            question.estimated_duration_seconds or 120,
                        ),
                    ),
                ),
            ),
        )
    except (TypeError, ValueError):
        estimated_duration = 120
    try:
        importance_score = max(
            1,
            min(
                5,
                int(
                    metadata.get(
                        "importance_score",
                        existing_metadata.get("importance_score", question.importance_score or 3),
                    ),
                ),
            ),
        )
    except (TypeError, ValueError):
        importance_score = 3
    metadata = {
        "tags": tags[:3],
        "importance_score": importance_score,
        "difficulty": difficulty,
        "estimated_duration": estimated_duration,
        "generated_at": metadata.get("generated_at") or datetime.now(timezone.utc).isoformat(),
    }
    question.ai_metadata = metadata
    question.difficulty = metadata["difficulty"].title()
    question.estimated_duration_seconds = metadata["estimated_duration"]
    question.importance_score = metadata["importance_score"]
    question.author_importance_score = metadata["importance_score"]

    user_question = db.scalar(
        select(UserQuestion)
        .options(selectinload(UserQuestion.tags))
        .where(
            UserQuestion.question_id == question.id,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_question:
        return
    user_question.importance_score = metadata["importance_score"]
    if not tags:
        return

    normalized_names = list(dict.fromkeys(tag.strip()[:50] for tag in tags))
    existing_tags = db.scalars(
        select(InterviewTag).where(
            InterviewTag.user_id == current_user.id,
            func.lower(InterviewTag.name).in_([tag.lower() for tag in normalized_names]),
        )
    ).all()
    by_name = {tag.name.lower(): tag for tag in existing_tags}
    for name in normalized_names:
        tag = by_name.get(name.lower())
        if not tag:
            tag = InterviewTag(user_id=current_user.id, name=name)
            db.add(tag)
            db.flush()
            by_name[name.lower()] = tag
        if tag not in user_question.tags:
            user_question.tags.append(tag)
        if tag not in question.tags:
            question.tags.append(tag)


def sync_question_metadata_from_ai_answer(
    db: Session,
    question: InterviewQuestion,
    current_user: User,
    answer: QuestionAnswer,
) -> None:
    """Backfill question metadata from an existing AI answer when possible."""
    meta = answer.metadata_ if isinstance(answer.metadata_, dict) else {}
    content = meta.get("content") if isinstance(meta.get("content"), dict) else {}
    if not content:
        return
    metadata: dict = {}
    if isinstance(content.get("difficulty"), str):
        metadata["difficulty"] = content["difficulty"]
    if isinstance(content.get("estimated_duration"), (int, float, str)):
        metadata["estimated_duration"] = content["estimated_duration"]
    if isinstance(content.get("tags"), list):
        metadata["tags"] = content["tags"]
    if isinstance(content.get("importance_score"), (int, float, str)):
        metadata["importance_score"] = content["importance_score"]
    if metadata:
        apply_ai_question_metadata(db, question, current_user, metadata)

# Questions
@router.get("/questions", response_model=list[InterviewQuestionRead])
def list_questions(
    limit: int = Query(default=0, ge=0, le=200),
    offset: int = Query(default=0, ge=0),
    category_id: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    ensure_collection_seeds(db)
    subscribed_question_ids = list(db.scalars(library_question_ids_query(current_user)).all())
    saved_question_ids = list(db.scalars(
        select(UserQuestion.question_id)
        .join(InterviewQuestion, InterviewQuestion.id == UserQuestion.question_id)
        .where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.is_saved.is_(True),
            InterviewQuestion.status == "published",
        )
    ).all())
    visible_question_ids = list(dict.fromkeys([*saved_question_ids, *subscribed_question_ids]))

    if not visible_question_ids:
        return []

    existing_state_ids = set(db.scalars(
        select(UserQuestion.question_id)
        .where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.question_id.in_(visible_question_ids),
        )
    ).all())
    missing_state_ids = [qid for qid in visible_question_ids if qid not in existing_state_ids]
    if missing_state_ids:
        missing_questions = db.scalars(
            select(InterviewQuestion)
            .where(
                InterviewQuestion.id.in_(missing_state_ids),
                InterviewQuestion.status == "published",
            )
        ).all()
        for question in missing_questions:
            ensure_user_question_state(db, current_user, question)
        db.flush()

    query = (
        select(UserQuestion)
        .options(
            joinedload(UserQuestion.question).joinedload(InterviewQuestion.submitted_by),
            joinedload(UserQuestion.question).selectinload(InterviewQuestion.companies),
            joinedload(UserQuestion.category),
            selectinload(UserQuestion.tags),
        )
        .where(UserQuestion.user_id == current_user.id)
        .where(UserQuestion.question_id.in_(visible_question_ids))
        .join(InterviewQuestion, InterviewQuestion.id == UserQuestion.question_id)
        .where(InterviewQuestion.status == "published")
    )

    if category_id:
        if category_id == "uncategorized":
            query = query.where(UserQuestion.category_id.is_(None))
        else:
            query = query.where(UserQuestion.category_id == category_id)

    if search and search.strip():
        query = query.where(InterviewQuestion.title.ilike(f"%{search.strip()}%"))

    query = query.order_by(UserQuestion.saved_at.desc().nullslast(), UserQuestion.created_at.desc())

    if limit > 0:
        query = query.offset(offset).limit(limit)

    user_questions = db.scalars(query).all()
    collection_ids = active_collection_ids_by_question(
        db,
        current_user.id,
        [uq.question_id for uq in user_questions],
    )
    return [to_question_read(uq, current_user, collection_ids.get(uq.question_id, [])) for uq in user_questions]


@router.get("/questions/search/global", response_model=list[InterviewQuestionRead])
def search_global_questions(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    clean_query = q.strip()
    result_limit = 40 if not clean_query else 20
    stmt = (
        select(InterviewQuestion)
        .options(
            joinedload(InterviewQuestion.submitted_by),
            joinedload(InterviewQuestion.metrics),
            selectinload(InterviewQuestion.tags),
            selectinload(InterviewQuestion.companies),
        )
        .where(InterviewQuestion.status == "published")
    )
    if clean_query:
        stmt = stmt.where(InterviewQuestion.title.ilike(f"%{clean_query}%"))
    questions = db.scalars(
        stmt
        .outerjoin(QuestionMetrics, QuestionMetrics.question_id == InterviewQuestion.id)
        .order_by(
            func.coalesce(QuestionMetrics.practice_count, 0).desc(),
            func.coalesce(QuestionMetrics.favorite_count, 0).desc(),
            InterviewQuestion.created_at.desc(),
        )
        .limit(result_limit * 4)
    ).all()
    questions = dedupe_public_questions(questions, current_user, db, result_limit)
    return [to_public_question_read(question, current_user) for question in questions]


@router.get(
    "/questions/duplicates",
    response_model=list[QuestionDuplicateCandidateRead],
)
def find_duplicate_questions(
    q: str = Query(min_length=1, max_length=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    """Return a small indexed candidate set for an upload, never a table scan."""
    normalized_title = normalize_question_title(q)
    if not normalized_title:
        return []

    exact = db.scalars(
        select(InterviewQuestion)
        .options(joinedload(InterviewQuestion.submitted_by))
        .where(InterviewQuestion.normalized_title == normalized_title)
        .order_by(InterviewQuestion.created_at.asc())
        .limit(5)
    ).all()
    exact_ids = {question.id for question in exact}

    similar = db.scalars(
        select(InterviewQuestion)
        .options(joinedload(InterviewQuestion.submitted_by))
        .where(InterviewQuestion.normalized_title.op("%")(normalized_title))
        .where(InterviewQuestion.id.not_in(exact_ids) if exact_ids else True)
        .order_by(func.similarity(InterviewQuestion.normalized_title, normalized_title).desc())
        .limit(5)
    ).all()

    return [
        {
            "id": question.id,
            "title": question.title,
            "owner_name": question.submitted_by.display_name if question.submitted_by else "Unknown",
            "created_at": question.created_at,
            "match_type": "exact" if question.id in exact_ids else "similar",
        }
        for question in [*exact, *similar]
    ]

@router.post("/questions", response_model=InterviewQuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: InterviewQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    title_stripped = payload.title.strip()
    normalized_title = normalize_question_title(title_stripped)
    existing_user_q = db.scalar(
        select(UserQuestion)
        .join(InterviewQuestion)
        .where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.is_saved.is_(True),
            func.lower(InterviewQuestion.title) == func.lower(title_stripped)
        )
    )
    if existing_user_q:
        return to_question_read(existing_user_q)

    data = payload.model_dump(exclude={"tags", "collection_ids", "is_saved"})
    data["title"] = title_stripped
    data["normalized_title"] = normalized_title
    
    user_fields = {
        "category_id": data.pop("category_id", None),
        "frequency": data.pop("frequency", None),
        "importance_score": data.pop("importance_score", None),
        "my_answer": data.pop("my_answer", None),
        "improvement_notes": data.pop("improvement_notes", None),
    }
    data["frequency"] = user_fields["frequency"]
    data["importance_score"] = user_fields["importance_score"]
    data["author_frequency"] = user_fields["frequency"]
    data["author_importance_score"] = user_fields["importance_score"]
    
    question = InterviewQuestion(submitted_by_user_id=current_user.id, **data)
    db.add(question)
    db.flush()
    sync_question_answers(db, question)
    
    user_q = UserQuestion(
        user_id=current_user.id,
        question_id=question.id,
        is_saved=True,
        saved_at=datetime.now(timezone.utc),
        **user_fields
    )
    
    if payload.tags:
        tags = db.scalars(select(InterviewTag).where(InterviewTag.id.in_(payload.tags), InterviewTag.user_id == current_user.id)).all()
        user_q.tags = list(tags)
        
    db.add(user_q)
    
    db.commit()
    db.refresh(user_q)
    return to_question_read(user_q)

@router.post("/questions/batch", response_model=list[InterviewQuestionRead], status_code=status.HTTP_201_CREATED)
def batch_create_questions(
    payload: list[InterviewQuestionCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    created_user_questions = []
    
    # 1. Deduplicate within payload (case-insensitive) and strip titles
    seen_titles_in_payload = set()
    unique_payload = []
    for q_payload in payload:
        title_stripped = q_payload.title.strip()
        title_lower = normalize_question_title(title_stripped)
        if title_lower not in seen_titles_in_payload:
            seen_titles_in_payload.add(title_lower)
            unique_payload.append((title_stripped, title_lower, q_payload))
            
    if not unique_payload:
        return []

    # 2. Check which titles already exist in database for this user (case-insensitive)
    existing_user_questions = db.scalars(
        select(UserQuestion)
        .join(InterviewQuestion)
        .where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.is_saved.is_(True),
            InterviewQuestion.normalized_title.in_([item[1] for item in unique_payload])
        )
    ).all()
    existing_titles_lower = {uq.question.normalized_title for uq in existing_user_questions}
    
    # 3. Filter to keep only the ones that do not exist yet
    to_create = []
    all_tag_ids = set()
    for title_stripped, title_lower, q_payload in unique_payload:
        if title_lower not in existing_titles_lower:
            to_create.append((title_stripped, q_payload))
            if q_payload.tags:
                all_tag_ids.update(q_payload.tags)
                
    if not to_create:
        return []
            
    tags_by_id = {}
    if all_tag_ids:
        tags = db.scalars(
            select(InterviewTag)
            .where(InterviewTag.id.in_(list(all_tag_ids)), InterviewTag.user_id == current_user.id)
        ).all()
        tags_by_id = {tag.id: tag for tag in tags}
        
    uq_question_map = {}
    for title_stripped, q_payload in to_create:
        data = q_payload.model_dump(exclude={"tags", "collection_ids", "is_saved"})
        data["title"] = title_stripped
        data["normalized_title"] = normalize_question_title(title_stripped)
        
        user_fields = {
            "category_id": data.pop("category_id", None),
            "frequency": data.pop("frequency", None),
            "importance_score": data.pop("importance_score", None),
            "my_answer": data.pop("my_answer", None),
            "improvement_notes": data.pop("improvement_notes", None),
        }
        data["frequency"] = user_fields["frequency"]
        data["importance_score"] = user_fields["importance_score"]
        data["author_frequency"] = user_fields["frequency"]
        data["author_importance_score"] = user_fields["importance_score"]
        
        question = InterviewQuestion(submitted_by_user_id=current_user.id, **data)
        db.add(question)
        db.flush()
        sync_question_answers(db, question)
        
        user_q = UserQuestion(
            user_id=current_user.id,
            question=question,
            is_saved=True,
            saved_at=datetime.now(timezone.utc),
            **user_fields
        )
        if q_payload.tags:
            user_q.tags = [tags_by_id[t_id] for t_id in q_payload.tags if t_id in tags_by_id]
        db.add(user_q)
        created_user_questions.append(user_q)
        uq_question_map[user_q] = question
        
    db.commit()
    for uq in created_user_questions:
        db.refresh(uq)
            
    return [to_question_read(uq) for uq in created_user_questions]

@router.get("/questions/{question_id}", response_model=InterviewQuestionRead)
def get_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    target_uuid: UUID | None = None
    target_number: int | None = None

    clean_id = question_id.strip()
    if clean_id.lower().startswith("q") and clean_id[1:].isdigit():
        target_number = int(clean_id[1:])
    elif clean_id.isdigit():
        target_number = int(clean_id)
    else:
        try:
            target_uuid = UUID(clean_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid question identifier")

    if target_number is not None:
        q_obj = db.scalar(select(InterviewQuestion).where(InterviewQuestion.display_number == target_number))
        if not q_obj:
            raise HTTPException(status_code=404, detail="Question not found")
        target_uuid = q_obj.id

    user_q = db.scalar(
        select(UserQuestion)
        .options(
            joinedload(UserQuestion.question),
            joinedload(UserQuestion.category),
            selectinload(UserQuestion.tags)
        )
        .where(
            UserQuestion.question_id == target_uuid,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_q:
        q = db.scalar(
            select(InterviewQuestion).where(
                InterviewQuestion.id == target_uuid,
                InterviewQuestion.status == "published",
            )
        )
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        user_q = ensure_user_question_state(db, current_user, q)
        db.flush()
        db.refresh(user_q)
    elif user_q.question.status != "published" and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Question not found")
    now = datetime.now(timezone.utc)
    # A development refresh or a quick revisit should not inflate the view count.
    if user_q.last_viewed_at is None or now - user_q.last_viewed_at >= timedelta(minutes=10):
        user_q.view_count += 1
    if user_q.first_viewed_at is None:
        user_q.first_viewed_at = now
    user_q.last_viewed_at = now
    refresh_question_metrics(db, target_uuid)
    db.commit()
    return to_question_read(user_q)

@router.put("/questions/{question_id}", response_model=InterviewQuestionRead)
def update_question(
    question_id: UUID,
    payload: InterviewQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    user_q = db.scalar(
        select(UserQuestion)
        .options(
            joinedload(UserQuestion.question),
            joinedload(UserQuestion.category),
            selectinload(UserQuestion.tags)
        )
        .where(
            UserQuestion.question_id == question_id,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    update_data = payload.model_dump(exclude_unset=True, exclude={"tags"})
    
    author_fields = {"title", "answer_objective", "sample_answer", "difficulty", "estimated_duration_seconds"}
    requested_author_updates = author_fields.intersection(update_data.keys())
    if requested_author_updates and user_q.question.submitted_by_user_id != current_user.id and getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Only the contributor can edit public question details.")

    progress_fields = {"my_answer", "improvement_notes", "category_id", "frequency", "importance_score"}
    for key in progress_fields:
        if key in update_data:
            setattr(user_q, key, update_data[key])
            
    if user_q.question.submitted_by_user_id == current_user.id or getattr(current_user, "role", None) == "admin":
        for key in author_fields:
            if key in update_data:
                setattr(user_q.question, key, update_data[key])
        if "frequency" in update_data:
            user_q.question.frequency = update_data["frequency"]
            user_q.question.author_frequency = update_data["frequency"]
        if "importance_score" in update_data:
            user_q.question.importance_score = update_data["importance_score"]
            user_q.question.author_importance_score = update_data["importance_score"]
        sync_question_answers(db, user_q.question)
        
    if payload.tags is not None:
        if not payload.tags:
            user_q.tags = []
        else:
            tags = db.scalars(select(InterviewTag).where(InterviewTag.id.in_(payload.tags), InterviewTag.user_id == current_user.id)).all()
            user_q.tags = list(tags)
            
    db.commit()
    db.refresh(user_q)
    return to_question_read(user_q)

@router.post("/questions/{question_id}/save", response_model=InterviewQuestionRead)
def save_question_to_library(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = db.scalar(
        select(InterviewQuestion).where(
            InterviewQuestion.id == question_id,
            InterviewQuestion.status == "published",
        )
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    user_question = ensure_user_question_state(db, current_user, question, is_saved=True)
    db.commit()
    db.refresh(user_question)
    return to_question_read(user_question, current_user)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_saved_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    user_q = db.scalar(
        select(UserQuestion)
        .options(joinedload(UserQuestion.question))
        .where(
            UserQuestion.question_id == question_id,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    user_q.is_saved = False
    user_q.saved_at = None
        
    db.commit()


@router.post("/questions/{question_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
def archive_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = db.scalar(
        select(InterviewQuestion).where(InterviewQuestion.id == question_id)
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if question.submitted_by_user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the contributor or an admin can archive this question",
        )

    archive_stmt = select(InterviewQuestion).where(InterviewQuestion.id == question.id)
    if question.normalized_title:
        archive_stmt = select(InterviewQuestion).where(
            InterviewQuestion.submitted_by_user_id == question.submitted_by_user_id,
            InterviewQuestion.normalized_title == question.normalized_title,
        )
    questions_to_archive = db.scalars(archive_stmt).all()
    question_ids_to_archive = [item.id for item in questions_to_archive]
    for item in questions_to_archive:
        item.status = "archived"
    user_questions = db.scalars(
        select(UserQuestion).where(UserQuestion.question_id.in_(question_ids_to_archive))
    ).all()
    for user_question in user_questions:
        user_question.is_saved = False
        user_question.saved_at = None
    db.commit()

# Practice Records
@router.get("/practice-records", response_model=list[PracticeRecordRead])
def list_practice_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    records = db.scalars(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.audio_records))
        .where(PracticeRecord.user_id == current_user.id)
        .order_by(PracticeRecord.created_at.desc())
    ).all()
    return records

@router.post("/practice-records", response_model=PracticeRecordRead, status_code=status.HTTP_201_CREATED)
def create_practice_record(
    payload: PracticeRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    from datetime import datetime, timezone, timedelta
    
    user_q = db.scalar(
        select(UserQuestion).where(
            UserQuestion.question_id == payload.question_id,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    record = PracticeRecord(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    now = datetime.now(timezone.utc)
    user_q.practice_count += 1
    if user_q.first_practiced_at is None:
        user_q.first_practiced_at = payload.submitted_at or now
    user_q.last_practiced_at = payload.submitted_at or now
    duration_seconds = payload.duration_seconds
    if (
        duration_seconds is None
        and payload.started_at is not None
        and payload.submitted_at is not None
    ):
        duration_seconds = max(
            0,
            int((payload.submitted_at - payload.started_at).total_seconds()),
        )
        record.duration_seconds = duration_seconds
    if duration_seconds:
        user_q.total_practice_seconds += duration_seconds
    
    # --- Auto-Complete Plan Task ---
    pending_task = db.scalar(
        select(PlanTask)
        .join(PracticePlan)
        .where(
            PracticePlan.user_id == current_user.id,
            PlanTask.question_id == payload.question_id,
            PlanTask.status == "pending"
        )
        .order_by(PlanTask.scheduled_date.asc())
        .limit(1)
    )
    if pending_task:
        pending_task.status = "completed"

    # --- Gamification Logic ---
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not gamification:
        gamification = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(gamification)
        
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if this question was already practiced today to prevent duplicate rewards
    already_practiced_today = db.scalar(
        select(func.count(PracticeRecord.id))
        .where(
            PracticeRecord.user_id == current_user.id,
            PracticeRecord.question_id == payload.question_id,
            PracticeRecord.date >= today_start,
            PracticeRecord.id != record.id
        )
    ) > 0
    
    last_practice = gamification.last_practice_date
    
    xp_gained = 0
    coins_gained = 0
    loot_boxes_gained = 0
    is_streak_extended = False
    
    if not already_practiced_today:
        config_obj = get_gamification_config(db)
        reward_events = config_obj.config.get("reward_events", [])
        
        # Load practice completed rewards
        practice_event = next((ev for ev in reward_events if ev.get("event_key") == "practice_completed" and ev.get("enabled")), None)
        if practice_event:
            xp_gained = practice_event.get("xp", 10)
            coins_gained = practice_event.get("coins", 2)
            loot_boxes_gained = practice_event.get("loot_boxes", 0)
        else:
            xp_gained = 10
            coins_gained = 2
            loot_boxes_gained = 0
            
        # Update streak days
        if not last_practice:
            gamification.streak_days = 1
            is_streak_extended = True
        else:
            last_date = last_practice.date()
            today_date = now.date()
            
            diff = (today_date - last_date).days
            if diff == 1:
                gamification.streak_days += 1
                is_streak_extended = True
            elif diff > 1:
                streak_cards = get_item_quantity(db, current_user.id, "streak_card")
                if streak_cards > 0:
                    if modify_user_inventory_item(db, current_user.id, "streak_card", -1) is not None:
                        gamification.streak_days += 1
                        is_streak_extended = True
                        db.add(GamificationTransaction(
                            user_id=current_user.id,
                            amount=0,
                            currency="item",
                            reason="Streak saved by Streak Saver Card!"
                        ))
                    else:
                        gamification.streak_days = 1
                        is_streak_extended = True
                else:
                    gamification.streak_days = 1
                    is_streak_extended = True
                
        # Check 2X XP Booster status
        double_xp_active = False
        if gamification.active_boosters and gamification.active_boosters.get("double_xp_until"):
            try:
                until = parse_datetime_to_utc(gamification.active_boosters["double_xp_until"])
                if until > now:
                    double_xp_active = True
            except Exception:
                pass
        if double_xp_active:
            xp_gained *= 2

        # If streak milestone reached, add streak bonus
        streak_xp_bonus = 0
        streak_coin_bonus = 0
        streak_loot_box_bonus = 0
        
        if is_streak_extended and gamification.streak_days % 7 == 0:
            streak_event = next((ev for ev in reward_events if ev.get("event_key") == "streak_bonus_7" and ev.get("enabled")), None)
            if streak_event:
                streak_xp_bonus = streak_event.get("xp", 500)
                streak_coin_bonus = streak_event.get("coins", 0)
                streak_loot_box_bonus = streak_event.get("loot_boxes", 0)
            else:
                streak_xp_bonus = 500
                
        # Apply inflation budget caps on XP and Coins
        total_xp_gain = xp_gained + streak_xp_bonus
        total_coin_gain = coins_gained + streak_coin_bonus
        
        capped_xp_gain, capped_coin_gain = enforce_daily_limits(db, current_user, total_xp_gain, total_coin_gain, config_obj.config)
        
        # Log basic practice transactions if earned after cap
        if capped_xp_gain > 0:
            db.add(GamificationTransaction(
                user_id=current_user.id,
                amount=capped_xp_gain,
                currency="xp",
                reason="Practice Completed" if streak_xp_bonus == 0 else f"Practice Completed & {gamification.streak_days}-Day Streak Bonus",
                reference_id=str(record.id)
            ))
        if capped_coin_gain > 0:
            db.add(GamificationTransaction(
                user_id=current_user.id,
                amount=capped_coin_gain,
                currency="coin",
                reason="Practice Completed" if streak_coin_bonus == 0 else f"Practice Completed & {gamification.streak_days}-Day Streak Bonus",
                reference_id=str(record.id)
            ))
            
        gamification.last_practice_date = now
        gamification.xp += capped_xp_gain
        gamification.coins += capped_coin_gain
        total_boxes = loot_boxes_gained + streak_loot_box_bonus
        if total_boxes > 0:
            modify_user_inventory_item(db, current_user.id, "loot_box", total_boxes)
        
        # Recalculate level
        new_level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
        gamification.level = new_level
        
        # Output actual gains after caps for the schema response
        xp_gained = capped_xp_gain
        coins_gained = capped_coin_gain
        
    # --- Dynamic Update of Daily Quests & Badge Catalog ---
    update_user_daily_quests(db, current_user)
    evaluate_badges(db, current_user)
    
    db.commit()
    db.refresh(record)
    
    # Inject gamification update into the response record explicitly using a dict
    from services.shared.schemas import PracticeRecordRead
    record_dict = PracticeRecordRead.model_validate(record).model_dump()
    record_dict["gamification_update"] = {
        "xp_gained": xp_gained,
        "coins_gained": coins_gained,
        "new_streak": gamification.streak_days,
        "new_level": gamification.level,
        "is_streak_extended": is_streak_extended
    }
    refresh_question_metrics(db, payload.question_id)
    db.commit()
    
    return record_dict


@router.put("/practice-records/{record_id}", response_model=PracticeRecordRead)
def update_practice_record(
    record_id: UUID,
    payload: PracticeRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.audio_records))
        .where(
            PracticeRecord.id == record_id,
            PracticeRecord.user_id == current_user.id,
        )
    )
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


def _practice_answer_text(record: PracticeRecord) -> str:
    raw = (record.my_answer or "").strip()
    if not raw:
        return ""
    if raw.startswith("["):
        try:
            import json
            segments = json.loads(raw)
            if isinstance(segments, list):
                return " ".join(str(segment.get("text", "")).strip() for segment in segments if isinstance(segment, dict)).strip()
        except (ValueError, TypeError):
            pass
    return raw


@router.get("/practice-records/{record_id}/evaluations", response_model=list[PracticeEvaluationRead])
def list_practice_evaluations(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    return db.scalars(
        select(PracticeEvaluation)
        .where(PracticeEvaluation.practice_record_id == record_id, PracticeEvaluation.user_id == current_user.id)
        .order_by(PracticeEvaluation.created_at.desc())
    ).all()


@router.post("/practice-records/{record_id}/evaluations", response_model=PracticeEvaluationRead, status_code=status.HTTP_201_CREATED)
def create_practice_evaluation(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(select(PracticeRecord).where(PracticeRecord.id == record_id, PracticeRecord.user_id == current_user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")
    answer_text = _practice_answer_text(record)
    if not answer_text:
        raise HTTPException(status_code=400, detail="Add or confirm a transcript before requesting AI feedback")
    question = db.get(InterviewQuestion, record.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    try:
        result = evaluate_practice_answer(question.title, answer_text)
    except DeepSeekError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    ai_config = get_gamification_config(db).config.get("ai", {})
    cost = max(0, int(ai_config.get("practice_evaluation_cost", 5)))
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if gamification and gamification.active_boosters and gamification.active_boosters.get("vip_until"):
        try:
            vip_until = parse_datetime_to_utc(gamification.active_boosters["vip_until"])
            if vip_until > datetime.now(timezone.utc):
                cost = 0
        except Exception:
            pass
    transaction = _spend_coins(db, current_user, cost, "VIP Member AI evaluation" if cost == 0 else "AI practice evaluation", str(record.id))
    evaluation = PracticeEvaluation(
        practice_record_id=record.id,
        user_id=current_user.id,
        status="completed",
        provider="deepseek",
        model=get_settings().deepseek_model,
        prompt_version="evaluation-v3",
        answer_text=answer_text,
        overall_score=result["overall_score"],
        result=result,
        coins_spent=cost,
        transaction_id=transaction.id if transaction else None,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation

@router.post("/practice-records/{record_id}/audio", status_code=status.HTTP_201_CREATED)
def upload_practice_audio(
    record_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(select(PracticeRecord).where(PracticeRecord.id == record_id, PracticeRecord.user_id == current_user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")

    raw_content_type = (file.content_type or "audio/webm").lower()
    content_type = raw_content_type.split(";", 1)[0].strip()
    if content_type not in {"audio/webm", "audio/ogg", "audio/mp4"}:
        raise HTTPException(status_code=400, detail="Use a WebM, OGG, or MP4 audio recording")
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(content) > get_settings().audio_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Audio recording is too large")

    extension = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "mp4",
    }[content_type]
    key = f"practice-audio/{current_user.id}/{record_id}/{uuid4()}.{extension}"
    try:
        url_path = get_object_storage().upload(key, content, content_type)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    audio_rec = AudioRecord(
        practice_record_id=record_id,
        url_path=url_path,
        storage_key=key,
    )
    db.add(audio_rec)
    db.commit()
    db.refresh(audio_rec)
    
    return {"id": str(audio_rec.id), "url_path": url_path}

@router.delete("/practice-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_practice_record(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(select(PracticeRecord).where(PracticeRecord.id == record_id, PracticeRecord.user_id == current_user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")
        
    for audio in record.audio_records:
        if audio.storage_key:
            try:
                get_object_storage().delete(audio.storage_key)
            except StorageError:
                pass
        else:
            import os
            filename = audio.url_path.split("/")[-1]
            file_path = os.path.join("/app/storage/audio", filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass
                
    db.delete(record)
    db.commit()


# Practice Plans
@router.get("/plans", response_model=list[PracticePlanRead])
def list_practice_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plans = db.scalars(
        select(PracticePlan)
        .where(PracticePlan.user_id == current_user.id)
        .order_by(PracticePlan.created_at.desc())
    ).all()
    return plans

@router.post("/plans", response_model=PracticePlanRead, status_code=status.HTTP_201_CREATED)
def create_practice_plan(
    payload: PracticePlanBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = PracticePlan(user_id=current_user.id, **payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/plans/{plan_id}/tasks", response_model=list[PlanTaskRead])
def list_plan_tasks(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    tasks = db.scalars(
        select(PlanTask)
        .where(PlanTask.plan_id == plan_id)
        .order_by(PlanTask.scheduled_date.asc())
    ).all()
    return tasks

@router.post("/plans/{plan_id}/tasks", response_model=PlanTaskRead, status_code=status.HTTP_201_CREATED)
def create_plan_task(
    plan_id: UUID,
    payload: PlanTaskBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    task = PlanTask(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_practice_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()


@router.put("/plans/{plan_id}/tasks/{task_id}", response_model=PlanTaskRead)
def update_plan_task(
    plan_id: UUID,
    task_id: UUID,
    payload: PlanTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    task = db.scalar(select(PlanTask).where(PlanTask.id == task_id, PlanTask.plan_id == plan_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


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


# Gamification Endpoints
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


import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

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


# --- Welcome Bonus ---
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


# --- Gamification Admin Config ---
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


# --- Collections Endpoints ---
@router.get("/collections", response_model=list[InterviewCollectionRead])
def list_collections(
    kind: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    ensure_collection_seeds(db)
    user_sub = select(UserCollection.collection_id).where(
        UserCollection.user_id == current_user.id,
        UserCollection.removed_at.is_(None)
    )
    query = select(InterviewCollection).where(
        or_(
            InterviewCollection.status == "published",
            InterviewCollection.id.in_(user_sub)
        )
    )
    if kind in {"official", "community"}:
        query = query.where(InterviewCollection.collection_type == kind)
    collections = db.scalars(query.order_by(InterviewCollection.updated_at.desc())).all()
    summaries = [question_to_collection_summary(db, collection, current_user) for collection in collections]
    if kind == "purchased":
        return [summary for summary in summaries if summary["is_purchased"]]
    return summaries


@router.get("/collections/me/created", response_model=list[InterviewCollectionRead])
def list_my_created_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    collections = db.scalars(
        select(InterviewCollection)
        .where(
            InterviewCollection.creator_user_id == current_user.id
        )
        .order_by(InterviewCollection.updated_at.desc())
    ).all()
    return [question_to_collection_summary(db, collection, current_user) for collection in collections]


@router.post("/collections", response_model=InterviewCollectionRead, status_code=status.HTTP_201_CREATED)
def create_custom_collection(
    payload: InterviewCollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    # Generate unique slug
    base_slug = re.sub(r'[^a-z0-9]+', '-', payload.title.lower().strip())
    slug = f"{base_slug}-{str(uuid4())[:8]}"
    
    collection = InterviewCollection(
        title=payload.title,
        slug=slug,
        description=payload.description,
        theme=payload.theme,
        collection_type="community",
        price_coins=payload.price_coins,
        creator_user_id=current_user.id,
        status=payload.status,
        last_updated_at=datetime.now(timezone.utc),
    )
    db.add(collection)
    db.flush()
    
    # Add contributor
    db.add(CollectionContributor(
        collection_id=collection.id,
        user_id=current_user.id,
        contribution_count=len(payload.question_ids),
        rank=1
    ))
    
    # Link questions
    for index, q_id in enumerate(payload.question_ids):
        db.add(InterviewCollectionQuestion(
            collection_id=collection.id,
            question_id=q_id,
            sort_order=index,
            is_approved=True
        ))
        
    # Automatically subscribe the creator to their own collection
    db.add(UserCollection(
        user_id=current_user.id,
        collection_id=collection.id,
        is_purchased=True,
        added_at=datetime.now(timezone.utc),
    ))
        
    db.commit()
    return question_to_collection_summary(db, collection, current_user)


def delete_collection_cover_asset(collection: InterviewCollection) -> None:
    if not collection.cover_storage_key:
        collection.cover_url = None
        return
    storage = get_object_storage()
    storage.delete(collection.cover_storage_key)
    collection.cover_storage_key = None
    collection.cover_url = None


@router.post("/collections/{collection_id}/cover", response_model=InterviewCollectionRead)
def upload_collection_cover(
    collection_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    collection = db.get(InterviewCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.creator_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own collection cover")

    content_type = (file.content_type or "").lower()
    extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    extension = extensions.get(content_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Use a PNG, JPEG, WebP, or GIF image")
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Image file is empty")
    settings = get_settings()
    if len(content) > settings.image_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Image must be 12 MB or smaller")
    try:
        content = optimize_image_to_webp(
            content,
            max_edge=settings.image_max_edge,
            quality=settings.image_webp_quality,
        )
    except MediaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    key = f"collection-covers/{collection.id}/cover.webp"
    try:
        storage = get_object_storage()
        public_url = storage.upload(key, content, "image/webp")
        if collection.cover_storage_key and collection.cover_storage_key != key:
            try:
                storage.delete(collection.cover_storage_key)
            except StorageError:
                pass
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    collection.cover_storage_key = key
    collection.cover_url = public_url
    collection.last_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(collection)
    return question_to_collection_summary(db, collection, current_user)


@router.put("/collections/{collection_id}", response_model=InterviewCollectionRead)
def update_custom_collection(
    collection_id: UUID,
    payload: InterviewCollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    collection = db.scalar(select(InterviewCollection).where(InterviewCollection.id == collection_id))
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    # Check authorization: user can only edit their own collection
    if collection.creator_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own collections")
        
    if payload.title is not None:
        collection.title = payload.title
        base_slug = re.sub(r'[^a-z0-9]+', '-', payload.title.lower().strip())
        collection.slug = f"{base_slug}-{str(uuid4())[:8]}"
    if payload.description is not None:
        collection.description = payload.description
    if payload.theme is not None:
        collection.theme = payload.theme
    if payload.price_coins is not None:
        collection.price_coins = payload.price_coins
    if payload.status is not None:
        if payload.status == "archived" and collection.status != "archived":
            try:
                delete_collection_cover_asset(collection)
            except StorageError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
        collection.status = payload.status
        
    if payload.question_ids is not None:
        # Delete existing links
        db.execute(delete(InterviewCollectionQuestion).where(InterviewCollectionQuestion.collection_id == collection.id))
        
        # Link new questions
        for index, q_id in enumerate(payload.question_ids):
            db.add(InterviewCollectionQuestion(
                collection_id=collection.id,
                question_id=q_id,
                sort_order=index,
                is_approved=True
            ))
            
        # Update contributor count
        contrib = db.scalar(
            select(CollectionContributor).where(
                CollectionContributor.collection_id == collection.id,
                CollectionContributor.user_id == current_user.id
            )
        )
        if contrib:
            contrib.contribution_count = len(payload.question_ids)
        else:
            db.add(CollectionContributor(
                collection_id=collection.id,
                user_id=current_user.id,
                contribution_count=len(payload.question_ids),
                rank=1
            ))
            
    collection.last_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(collection)
    return question_to_collection_summary(db, collection, current_user)


@router.delete("/collections/{collection_id}")
def delete_custom_collection(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    collection = db.scalar(select(InterviewCollection).where(InterviewCollection.id == collection_id))
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    # Check authorization
    if collection.creator_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own collections")
        
    # Count other active subscribers
    subscribers_count = db.scalar(
        select(func.count(UserCollection.id))
        .where(
            UserCollection.collection_id == collection.id,
            UserCollection.user_id != current_user.id,
            UserCollection.removed_at.is_(None)
        )
    ) or 0

    if subscribers_count > 0:
        # Other users are actively using this collection. Soft-delete it by archiving.
        try:
            delete_collection_cover_asset(collection)
        except StorageError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        collection.status = "archived"
        now = datetime.now(timezone.utc)
        collection.last_updated_at = now
        
        # Remove it from creator's own library
        subscription = db.scalar(
            select(UserCollection).where(
                UserCollection.user_id == current_user.id,
                UserCollection.collection_id == collection.id,
                UserCollection.removed_at.is_(None)
            )
        )
        if subscription:
            subscription.removed_at = now
            
        db.commit()
        return {"message": "Collection has subscribers and was archived instead of deleted"}
    else:
        # No other active subscribers. Hard-delete it completely.
        try:
            delete_collection_cover_asset(collection)
        except StorageError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        db.delete(collection)
        db.commit()
        return {"message": "Collection deleted permanently"}


@router.get("/collections/{collection_id}", response_model=InterviewCollectionRead)
def get_collection_detail(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    ensure_collection_seeds(db)
    user_sub = select(UserCollection.collection_id).where(
        UserCollection.collection_id == collection_id,
        UserCollection.user_id == current_user.id,
        UserCollection.removed_at.is_(None)
    )
    collection = db.scalar(
        select(InterviewCollection).where(
            InterviewCollection.id == collection_id,
            or_(
                InterviewCollection.status != "archived",
                InterviewCollection.creator_user_id == current_user.id,
                InterviewCollection.id.in_(user_sub)
            )
        )
    )
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    if collection.status == "draft" and collection.creator_user_id != current_user.id:
        # Check if they own it (already in library)
        subscription = db.scalar(
            select(UserCollection).where(
                UserCollection.user_id == current_user.id,
                UserCollection.collection_id == collection_id,
                UserCollection.removed_at.is_(None)
            )
        )
        if not subscription:
            raise HTTPException(status_code=403, detail="This collection is unpublished")

    return question_to_collection_summary(db, collection, current_user)


@router.post("/collections/{collection_id}/add")
def add_collection_to_library(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    ensure_collection_seeds(db)
    collection = db.scalar(select(InterviewCollection).where(InterviewCollection.id == collection_id))
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    subscription = db.scalar(
        select(UserCollection).where(
            UserCollection.user_id == current_user.id,
            UserCollection.collection_id == collection_id,
        )
    )
    if collection.status != "published" and not (
        subscription and subscription.is_purchased
    ):
        raise HTTPException(status_code=404, detail="Collection not found")

    question_count = collection_question_count(db, collection_id)
    gamification = get_or_create_gamification(db, current_user)
    created_subscription = False
    if not subscription:
        created_subscription = True
        if collection.price_coins > 0:
            if gamification.coins < collection.price_coins:
                raise HTTPException(status_code=400, detail="Not enough coins")
            gamification.coins -= collection.price_coins
            add_economy_transactions(
                db,
                current_user,
                xp_delta=0,
                coin_delta=-collection.price_coins,
                loot_box_delta=0,
                reason=f"Purchased collection: {collection.title}",
                reference_id=f"collection_purchase:{collection.id}",
            )
            if (
                collection.creator_user_id
                and collection.creator_user_id != current_user.id
                and collection.collection_type != "official"
            ):
                creator = db.get(User, collection.creator_user_id)
                if creator:
                    creator_share = int(collection.price_coins * QUESTION_SET_CREATOR_REVENUE_SHARE)
                    if creator_share > 0:
                        creator_wallet = get_or_create_gamification(db, creator)
                        creator_wallet.coins += creator_share
                        add_economy_transactions(
                            db,
                            creator,
                            xp_delta=0,
                            coin_delta=creator_share,
                            loot_box_delta=0,
                            reason=f"Creator reward: {collection.title}",
                            reference_id=f"collection_creator_reward:{collection.id}:{current_user.id}",
                        )
        subscription = UserCollection(
            user_id=current_user.id,
            collection_id=collection.id,
            is_purchased=True,
            purchased_at=datetime.now(timezone.utc) if collection.price_coins > 0 else None,
        )
        db.add(subscription)
    elif subscription.removed_at is None:
        return {
            "message": "Collection already subscribed",
            "questions_added": 0,
            "purchased": bool(subscription.is_purchased),
        }
    subscription.added_at = datetime.now(timezone.utc)
    subscription.removed_at = None
    subscription.is_purchased = subscription.is_purchased or collection.price_coins <= 0
    if created_subscription:
        collection.downloads += 1
    collection.last_updated_at = datetime.now(timezone.utc)
    db.commit()
    message = "Collection subscribed"
    return {
        "message": message,
        "questions_added": question_count,
        "purchased": bool(subscription.is_purchased),
    }


@router.delete("/collections/{collection_id}/remove")
def remove_collection_from_library(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    subscription = db.scalar(
        select(UserCollection).where(
            UserCollection.user_id == current_user.id,
            UserCollection.collection_id == collection_id,
            UserCollection.removed_at.is_(None),
        )
    )
    if not subscription:
        raise HTTPException(status_code=404, detail="Collection not found in library")
    now = datetime.now(timezone.utc)
    subscription.removed_at = now
    db.commit()
    return {"message": "Collection removed"}


# --- Question Community Endpoints ---
def require_community_question(db: Session, question_id: UUID, current_user: User) -> InterviewQuestion:
    question = db.scalar(
        select(InterviewQuestion).where(
            InterviewQuestion.id == question_id,
            InterviewQuestion.status == "published",
        )
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    ensure_user_question_state(db, current_user, question)
    return question


def serialize_question_answer(
    db: Session,
    answer: QuestionAnswer,
    current_user: User,
) -> dict:
    ai_config = get_gamification_config(db).config.get("ai", {})
    is_ai_answer = answer.source == "ai"
    existing_unlock = None
    spent_on_question = 0
    if is_ai_answer:
        existing_unlock = db.scalar(
            select(QuestionAnswerUnlock).where(
                QuestionAnswerUnlock.answer_id == answer.id,
                QuestionAnswerUnlock.user_id == current_user.id,
            )
        )
        spent_on_question = db.scalar(
            select(func.coalesce(func.sum(QuestionAnswerUnlock.coins_spent), 0))
            .join(QuestionAnswer, QuestionAnswer.id == QuestionAnswerUnlock.answer_id)
            .where(
                QuestionAnswerUnlock.user_id == current_user.id,
                QuestionAnswer.question_id == answer.question_id,
            )
        ) or 0
    unlock_cost = max(0, int(ai_config.get("answer_unlock_cost", 5)))
    question_cap = max(0, int(ai_config.get("answer_unlock_question_cap", 5)))
    remaining_cost = max(0, question_cap - int(spent_on_question)) if is_ai_answer else 0
    effective_unlock_cost = min(unlock_cost, remaining_cost) if is_ai_answer else 0
    has_unlocked_question = bool(existing_unlock) or (spent_on_question >= question_cap and question_cap > 0)
    is_locked = bool(
        is_ai_answer
        and not has_unlocked_question
        and answer.author_user_id != current_user.id
        and current_user.role != "admin"
    )
    reaction_counts = db.execute(
        select(
            func.count(QuestionAnswerReaction.id),
            func.count(QuestionAnswerReaction.id).filter(
                QuestionAnswerReaction.value == "up"
            ),
            func.count(QuestionAnswerReaction.id).filter(
                QuestionAnswerReaction.value == "down"
            ),
        ).where(QuestionAnswerReaction.answer_id == answer.id)
    ).one()
    user_reaction = db.scalar(
        select(QuestionAnswerReaction.value).where(
            QuestionAnswerReaction.answer_id == answer.id,
            QuestionAnswerReaction.user_id == current_user.id,
        )
    )
    comment_count = db.scalar(
        select(func.count())
        .select_from(QuestionAnswerComment)
        .where(
            QuestionAnswerComment.answer_id == answer.id,
            QuestionAnswerComment.deleted_at.is_(None),
        )
    ) or 0
    is_saved = bool(
        db.scalar(
            select(QuestionAnswerSave).where(
                QuestionAnswerSave.answer_id == answer.id,
                QuestionAnswerSave.user_id == current_user.id,
            )
        )
    )
    is_reported = bool(
        db.scalar(
            select(QuestionAnswerReport).where(
                QuestionAnswerReport.answer_id == answer.id,
                QuestionAnswerReport.user_id == current_user.id,
            )
        )
    )
    author = db.get(User, answer.author_user_id) if answer.author_user_id else None
    question = db.get(InterviewQuestion, answer.question_id)
    meta = dict(answer.metadata_ or {})
    if is_ai_answer and "content" not in meta:
        try:
            parsed_content = json.loads(answer.body) if answer.body else {}
            if isinstance(parsed_content, dict) and "sections" in parsed_content:
                meta["content"] = parsed_content
        except Exception:
            pass

    structured_content = meta.get("content") if (is_ai_answer and not is_locked) else None

    # For AI answers, return a lean, high-performance payload without heavy social SQL joins
    if is_ai_answer:
        return {
            "id": answer.id,
            "question_id": answer.question_id,
            "author_user_id": answer.author_user_id,
            "source": answer.source,
            "answer_type": answer.answer_type,
            "status": answer.status,
            "title": answer.title,
            "body": None if is_locked else sanitize_ai_output(answer.body),
            "structured_content": sanitize_ai_output(structured_content),
            "metadata_": sanitize_ai_output(meta),
            "is_recommended": answer.is_recommended,
            "is_locked": is_locked,
            "unlock_cost": effective_unlock_cost,
            "question_unlock_remaining_cost": remaining_cost,
            "created_at": answer.created_at,
            "updated_at": answer.updated_at,
        }

    return {
        "id": answer.id,
        "question_id": answer.question_id,
        "author_user_id": answer.author_user_id,
        "source": answer.source,
        "answer_type": answer.answer_type,
        "status": answer.status,
        "title": answer.title,
        "body": None if is_locked else sanitize_ai_output(answer.body),
        "structured_content": sanitize_ai_output(structured_content),
        "metadata_": sanitize_ai_output(meta),
        "is_recommended": answer.is_recommended,
        "recommended_by_user_id": answer.recommended_by_user_id,
        "recommended_at": answer.recommended_at,
        "created_at": answer.created_at,
        "updated_at": answer.updated_at,
        "reaction_count": reaction_counts[0] or 0,
        "upvote_count": reaction_counts[1] or 0,
        "downvote_count": reaction_counts[2] or 0,
        "user_reaction": user_reaction,
        "comment_count": comment_count,
        "is_saved": is_saved,
        "is_reported": is_reported,
        "is_author": answer.author_user_id == current_user.id,
        "can_manage": current_user.role == "admin"
        or answer.author_user_id == current_user.id
        or (question is not None and question.submitted_by_user_id == current_user.id),
        "author_name": author.display_name if author else None,
        "author_avatar_url": author.avatar_url if author else None,
        "author_badge": comment_author_badge(
            author,
            question.submitted_by_user_id if question else None,
        ),
        "is_locked": is_locked,
        "unlock_cost": effective_unlock_cost,
        "question_unlock_remaining_cost": remaining_cost,
    }


def create_answer_notification(
    db: Session,
    *,
    recipient_id: UUID,
    actor: User,
    question_id: UUID,
    answer_id: UUID,
    kind: str,
    answer_body: str,
    comment_id: UUID | None = None,
    comment_body: str | None = None,
    parent_body: str | None = None,
) -> UserNotification:
    answer_excerpt = " ".join(answer_body.split())[:180]
    comment_excerpt = " ".join((comment_body or "").split())[:180]
    parent_excerpt = " ".join((parent_body or "").split())[:120]
    question = db.get(InterviewQuestion, question_id)
    if kind == "answer_reply":
        title = f"{actor.display_name} replied to your answer"
        message = f"Your answer: {answer_excerpt}\nReply: {comment_excerpt}"
    elif kind == "answer_comment_reply":
        title = f"{actor.display_name} replied to your reply"
        message = f"Your reply: {parent_excerpt}\nReply: {comment_excerpt}"
    elif kind == "answer_comment_like":
        title = f"{actor.display_name} liked your reply"
        message = f"Your reply: {comment_excerpt}"
    else:
        title = f"{actor.display_name} liked your answer"
        message = f"Your answer: {answer_excerpt}"
    notification = UserNotification(
        user_id=recipient_id,
        actor_user_id=actor.id,
        question_id=question_id,
        kind=kind,
        action_url=f"/interview-prep/practice/{question_id}?mode=free&tab=comment",
        title=title,
        message=message,
        metadata_={
            "answer_id": str(answer_id),
            "comment_id": str(comment_id) if comment_id else None,
            "actor_name": actor.display_name,
            "actor_avatar_url": actor.avatar_url,
            "actor_badge": comment_author_badge(
                actor,
                question.submitted_by_user_id if question else None,
            ),
            "answer_body": answer_excerpt,
            "comment_body": comment_excerpt,
            "parent_body": parent_excerpt,
            "question_title": question.title if question else "",
        },
    )
    db.add(notification)
    return notification


def broadcast_answer_event(
    event_type: str,
    question_id: UUID,
    answer_id: UUID,
    **payload,
) -> None:
    broadcast_sync(
        event_type,
        {"question_id": str(question_id), "answer_id": str(answer_id), **payload},
    )


def to_answer_comment_read(
    c: QuestionAnswerComment,
    current_user_id=None,
    db=None,
    include_replies: bool = False,
    question_author_id=None,
) -> QuestionAnswerCommentRead:
    is_liked = False
    like_count = 0
    is_reported = False
    if db:
        like_count = db.scalar(
            select(func.count())
            .select_from(QuestionAnswerCommentLike)
            .where(QuestionAnswerCommentLike.comment_id == c.id)
        ) or 0
        if current_user_id:
            is_liked = bool(
                db.scalar(
                    select(QuestionAnswerCommentLike).where(
                        QuestionAnswerCommentLike.comment_id == c.id,
                        QuestionAnswerCommentLike.user_id == current_user_id,
                    )
                )
            )
            is_reported = bool(
                db.scalar(
                    select(QuestionAnswerCommentReport).where(
                        QuestionAnswerCommentReport.comment_id == c.id,
                        QuestionAnswerCommentReport.user_id == current_user_id,
                    )
                )
            )

    replies = []
    if db and include_replies:
        children = db.scalars(
            select(QuestionAnswerComment)
            .where(
                QuestionAnswerComment.parent_id == c.id,
                QuestionAnswerComment.deleted_at.is_(None),
            )
            .order_by(QuestionAnswerComment.created_at.asc())
        ).all()
        replies = [
            to_answer_comment_read(
                child,
                current_user_id,
                db,
                include_replies=True,
                question_author_id=question_author_id,
            )
            for child in children
        ]

    return QuestionAnswerCommentRead(
        id=c.id,
        answer_id=c.answer_id,
        parent_id=c.parent_id,
        body=c.body,
        author_name=c.user.display_name if c.user else "Unknown",
        author_avatar_url=c.user.avatar_url if c.user else None,
        author_badge=comment_author_badge(c.user, question_author_id),
        is_author=(c.user_id == current_user_id) if current_user_id else False,
        like_count=like_count,
        is_liked=is_liked,
        is_reported=is_reported,
        reply_count=len(replies),
        created_at=c.created_at,
        updated_at=c.updated_at,
        replies=replies,
    )


@router.get("/questions/{question_id}/answers", response_model=list[QuestionAnswerRead])
def list_question_answers(
    question_id: UUID,
    answer_type: str | None = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    require_community_question(db, question_id, current_user)
    query = select(QuestionAnswer).where(
        QuestionAnswer.question_id == question_id,
        QuestionAnswer.deleted_at.is_(None),
        or_(
            QuestionAnswer.status == "published",
            QuestionAnswer.author_user_id == current_user.id,
        ),
    )
    if answer_type:
        query = query.where(QuestionAnswer.answer_type == answer_type)
    if not include_archived:
        query = query.where(QuestionAnswer.status != "archived")
    answers = db.scalars(
        query.order_by(
            QuestionAnswer.is_recommended.desc(),
            QuestionAnswer.created_at.desc(),
        )
    ).all()
    return [serialize_question_answer(db, answer, current_user) for answer in answers]


@router.post("/questions/{question_id}/answers", response_model=QuestionAnswerRead, status_code=status.HTTP_201_CREATED)
def create_question_answer(
    question_id: UUID,
    payload: QuestionAnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = require_community_question(db, question_id, current_user)
    requested_source = payload.source if payload.source in {"author", "community"} else "community"
    if requested_source == "author":
        if current_user.id != question.submitted_by_user_id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only the question author can post an author answer")
        final_source = "author"
    else:
        final_source = "community"

    answer = QuestionAnswer(
        question_id=question.id,
        author_user_id=current_user.id,
        source=final_source,
        answer_type=payload.answer_type,
        status=payload.status,
        title=payload.title,
        body=payload.body.strip(),
        metadata_=payload.metadata,
        is_recommended=payload.is_recommended,
        recommended_by_user_id=current_user.id if payload.is_recommended else None,
        recommended_at=datetime.now(timezone.utc) if payload.is_recommended else None,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return serialize_question_answer(db, answer, current_user)


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


def ensure_ai_answer_unlocked(
    db: Session,
    answer: QuestionAnswer,
    current_user: User,
) -> QuestionAnswerUnlock:
    unlock = db.scalar(
        select(QuestionAnswerUnlock).where(
            QuestionAnswerUnlock.answer_id == answer.id,
            QuestionAnswerUnlock.user_id == current_user.id,
        )
    )
    if unlock:
        return unlock

    ai_config = get_gamification_config(db).config.get("ai", {})
    base_cost = max(0, int(ai_config.get("answer_unlock_cost", 5)))
    cap = max(0, int(ai_config.get("answer_unlock_question_cap", 5)))
    spent = db.scalar(
        select(func.coalesce(func.sum(QuestionAnswerUnlock.coins_spent), 0))
        .join(QuestionAnswer, QuestionAnswer.id == QuestionAnswerUnlock.answer_id)
        .where(
            QuestionAnswerUnlock.user_id == current_user.id,
            QuestionAnswer.question_id == answer.question_id,
        )
    ) or 0
    amount = min(base_cost, max(0, cap - int(spent)))
    transaction = _spend_coins(
        db,
        current_user,
        amount,
        "Unlock AI reference answer",
        str(answer.id),
    )
    unlock = QuestionAnswerUnlock(
        answer_id=answer.id,
        user_id=current_user.id,
        coins_spent=amount,
        transaction_id=transaction.id if transaction else None,
    )
    db.add(unlock)
    return unlock


MAX_AI_REFERENCE_ANSWERS = 3


@router.post("/questions/{question_id}/ai-metadata", response_model=InterviewQuestionRead)
def generate_ai_question_metadata(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    require_community_question(db, question_id, current_user)
    question = db.scalar(
        select(InterviewQuestion)
        .options(selectinload(InterviewQuestion.category), selectinload(InterviewQuestion.tags))
        .where(InterviewQuestion.id == question_id)
        .with_for_update()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if question.ai_metadata:
        apply_ai_question_metadata(db, question, current_user, question.ai_metadata)
        db.commit()
    else:
        try:
            metadata = generate_question_metadata(
                question.title,
                question.category.name if question.category else None,
            )
        except DeepSeekError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        apply_ai_question_metadata(db, question, current_user, metadata)
        db.commit()

    user_question = db.scalar(
        select(UserQuestion)
        .options(
            joinedload(UserQuestion.question).joinedload(InterviewQuestion.submitted_by),
            joinedload(UserQuestion.question).selectinload(InterviewQuestion.companies),
            joinedload(UserQuestion.category),
            selectinload(UserQuestion.tags),
        )
        .where(
            UserQuestion.question_id == question_id,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_question:
        question = require_community_question(db, question_id, current_user)
        db.flush()
        user_question = db.scalar(
            select(UserQuestion)
            .options(
                joinedload(UserQuestion.question).joinedload(InterviewQuestion.submitted_by),
                joinedload(UserQuestion.question).selectinload(InterviewQuestion.companies),
                joinedload(UserQuestion.category),
                selectinload(UserQuestion.tags),
            )
            .where(
                UserQuestion.question_id == question.id,
                UserQuestion.user_id == current_user.id,
            )
        )
    return to_question_read(user_question, current_user)


@router.post("/questions/{question_id}/ai-answers", response_model=QuestionAnswerRead, status_code=status.HTTP_201_CREATED)
def create_ai_reference_answer(
    question_id: UUID,
    response: Response,
    regenerate: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    require_community_question(db, question_id, current_user)
    question = db.scalar(
        select(InterviewQuestion)
        .options(selectinload(InterviewQuestion.category), selectinload(InterviewQuestion.tags))
        .where(InterviewQuestion.id == question_id)
        .with_for_update()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if not regenerate:
        existing_answer = db.scalar(
            select(QuestionAnswer)
            .where(
                QuestionAnswer.question_id == question.id,
                QuestionAnswer.source == "ai",
                QuestionAnswer.answer_type == "reference",
                QuestionAnswer.status == "published",
                QuestionAnswer.deleted_at.is_(None),
            )
            .order_by(QuestionAnswer.created_at.desc())
        )
        if existing_answer:
            ensure_ai_answer_unlocked(db, existing_answer, current_user)
            sync_question_metadata_from_ai_answer(db, question, current_user, existing_answer)
            db.commit()
            db.refresh(existing_answer)
            response.status_code = status.HTTP_200_OK
            return serialize_question_answer(db, existing_answer, current_user)

    answer_count = db.scalar(
        select(func.count()).select_from(QuestionAnswer).where(
            QuestionAnswer.question_id == question.id,
            QuestionAnswer.source == "ai",
            QuestionAnswer.answer_type == "reference",
            QuestionAnswer.status == "published",
            QuestionAnswer.deleted_at.is_(None),
        )
    ) or 0
    if int(answer_count) >= MAX_AI_REFERENCE_ANSWERS:
        raise HTTPException(
            status_code=409,
            detail=f"This question already has the maximum of {MAX_AI_REFERENCE_ANSWERS} AI answers",
        )

    try:
        generated = generate_reference_answer(
            question.title,
            question.category.name if question.category else None,
            include_question_metadata=True,
        )
    except DeepSeekError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    answer = QuestionAnswer(
        question_id=question.id,
        author_user_id=None,
        source="ai",
        answer_type="reference",
        status="published",
        title=generated["title"],
        body=generated["body"],
        metadata_={
            "provider": "deepseek",
            "model": get_settings().deepseek_model,
            "prompt_version": "reference-v3-with-question-metadata",
            "content": generated["content"],
        },
    )
    db.add(answer)
    apply_ai_question_metadata(
        db,
        question,
        current_user,
        generated["question_metadata"],
    )
    db.flush()
    ensure_ai_answer_unlocked(db, answer, current_user)
    db.commit()
    db.refresh(answer)
    return serialize_question_answer(db, answer, current_user)


@router.put("/answers/{answer_id}/unlock", response_model=AnswerUnlockRead)
def unlock_ai_answer(
    answer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.get(QuestionAnswer, answer_id)
    if not answer or answer.deleted_at or answer.source != "ai":
        raise HTTPException(status_code=404, detail="AI answer not found")
    question = require_community_question(db, answer.question_id, current_user)
    unlock = ensure_ai_answer_unlocked(db, answer, current_user)
    sync_question_metadata_from_ai_answer(db, question, current_user, answer)
    db.commit()
    wallet = get_or_create_gamification(db, current_user)
    return AnswerUnlockRead(answer=serialize_question_answer(db, answer, current_user), coins_spent=unlock.coins_spent, remaining_coins=wallet.coins)


@router.put("/answers/{answer_id}", response_model=QuestionAnswerRead)
def update_question_answer(
    answer_id: UUID,
    payload: QuestionAnswerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    question = require_community_question(db, answer.question_id, current_user)
    is_question_author = current_user.id == question.submitted_by_user_id or current_user.role == "admin"
    is_answer_author = answer.author_user_id == current_user.id

    if not is_answer_author and not is_question_author:
        raise HTTPException(status_code=403, detail="You cannot edit this answer")

    update_data = payload.model_dump(exclude_unset=True)
    if not is_answer_author and current_user.role != "admin":
        non_recommendation_fields = set(update_data.keys()) - {"is_recommended"}
        if non_recommendation_fields:
            raise HTTPException(status_code=403, detail="Only the answer author can edit content")

    for key, value in update_data.items():
        if key == "metadata":
            answer.metadata_ = value or {}
        elif key == "is_recommended":
            answer.is_recommended = bool(value)
            answer.recommended_by_user_id = current_user.id if value else None
            answer.recommended_at = datetime.now(timezone.utc) if value else None
        elif value is not None:
            setattr(answer, key, value)

    if answer.source == "author":
        legacy_field = answer.metadata_.get("legacy_field")
        if legacy_field in {"answer_objective", "sample_answer"}:
            setattr(
                question,
                legacy_field,
                answer.body if answer.status != "archived" else None,
            )

    db.commit()
    db.refresh(answer)
    return serialize_question_answer(db, answer, current_user)


@router.put("/answers/{answer_id}/reaction", response_model=QuestionAnswerRead)
def update_question_answer_reaction(
    answer_id: UUID,
    payload: QuestionAnswerReactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    if payload.value not in {"up", "down", None}:
        raise HTTPException(status_code=400, detail="Reaction must be up, down, or empty")

    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    require_community_question(db, answer.question_id, current_user)
    reaction = db.scalar(
        select(QuestionAnswerReaction).where(
            QuestionAnswerReaction.answer_id == answer_id,
            QuestionAnswerReaction.user_id == current_user.id,
        )
    )
    if payload.value is None:
        if reaction:
            db.delete(reaction)
        notification = None
    elif reaction:
        reaction.value = payload.value
        notification = None
    else:
        db.add(
            QuestionAnswerReaction(
                answer_id=answer_id,
                user_id=current_user.id,
                value=payload.value,
            )
        )
        notification = None
        if (
            payload.value == "up"
            and answer.author_user_id
            and answer.author_user_id != current_user.id
        ):
            existing_notification = db.scalar(
                select(UserNotification).where(
                    UserNotification.user_id == answer.author_user_id,
                    UserNotification.actor_user_id == current_user.id,
                    UserNotification.kind == "answer_like",
                    UserNotification.metadata_["answer_id"].astext == str(answer_id),
                )
            )
            if not existing_notification:
                notification = create_answer_notification(
                    db,
                    recipient_id=answer.author_user_id,
                    actor=current_user,
                    question_id=answer.question_id,
                    answer_id=answer.id,
                    kind="answer_like",
                    answer_body=answer.body,
                )
    db.commit()
    if notification:
        db.refresh(notification)
        broadcast_notification(notification)
    db.refresh(answer)
    broadcast_answer_event(
        "answer.reaction_updated",
        answer.question_id,
        answer.id,
        actor_user_id=str(current_user.id),
    )
    return serialize_question_answer(db, answer, current_user)


@router.put("/answers/{answer_id}/save", response_model=QuestionAnswerSaveRead)
def toggle_question_answer_save(
    answer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    require_community_question(db, answer.question_id, current_user)
    saved = db.scalar(
        select(QuestionAnswerSave).where(
            QuestionAnswerSave.answer_id == answer_id,
            QuestionAnswerSave.user_id == current_user.id,
        )
    )
    if saved:
        db.delete(saved)
        next_saved = False
    else:
        db.add(QuestionAnswerSave(answer_id=answer_id, user_id=current_user.id))
        next_saved = True
    db.commit()
    return {"saved": next_saved}


@router.post("/answers/{answer_id}/report")
def report_question_answer(
    answer_id: UUID,
    payload: QuestionAnswerCommentReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    require_community_question(db, answer.question_id, current_user)
    existing = db.scalar(
        select(QuestionAnswerReport).where(
            QuestionAnswerReport.answer_id == answer_id,
            QuestionAnswerReport.user_id == current_user.id,
        )
    )
    if not existing:
        db.add(
            QuestionAnswerReport(
                answer_id=answer_id,
                user_id=current_user.id,
                reason=payload.reason,
            )
        )
        db.commit()
    return {"status": "reported"}


@router.get("/answers/{answer_id}/comments", response_model=QuestionAnswerCommentPageRead)
def list_question_answer_comments(
    answer_id: UUID,
    before: datetime | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    question = require_community_question(db, answer.question_id, current_user)
    like_count = (
        select(func.count(QuestionAnswerCommentLike.id))
        .where(QuestionAnswerCommentLike.comment_id == QuestionAnswerComment.id)
        .correlate(QuestionAnswerComment)
        .scalar_subquery()
    )
    query = select(QuestionAnswerComment).where(
        QuestionAnswerComment.answer_id == answer_id,
        QuestionAnswerComment.parent_id.is_(None),
        QuestionAnswerComment.deleted_at.is_(None),
    )
    if before:
        query = query.where(QuestionAnswerComment.created_at < before)
    rows = db.scalars(
        query.order_by(like_count.desc(), QuestionAnswerComment.created_at.desc()).limit(limit + 1)
    ).all()
    has_more = len(rows) > limit
    comments = rows[:limit]
    return QuestionAnswerCommentPageRead(
        items=[
            to_answer_comment_read(
                comment,
                current_user.id,
                db,
                include_replies=True,
                question_author_id=question.submitted_by_user_id,
            )
            for comment in comments
        ],
        next_cursor=comments[-1].created_at if has_more and comments else None,
        answer_id=answer_id,
    )


@router.post("/answers/{answer_id}/comments", response_model=QuestionAnswerCommentRead, status_code=status.HTTP_201_CREATED)
def create_question_answer_comment(
    answer_id: UUID,
    payload: QuestionAnswerCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    question = require_community_question(db, answer.question_id, current_user)
    parent = None
    if payload.parent_id:
        parent = db.scalar(
            select(QuestionAnswerComment).where(
                QuestionAnswerComment.id == payload.parent_id,
                QuestionAnswerComment.answer_id == answer_id,
                QuestionAnswerComment.deleted_at.is_(None),
            )
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent reply not found")
    comment = QuestionAnswerComment(
        answer_id=answer_id,
        user_id=current_user.id,
        parent_id=payload.parent_id,
        body=payload.body.strip(),
    )
    db.add(comment)
    db.flush()
    notification = None
    if parent and parent.user_id != current_user.id:
        notification = create_answer_notification(
            db,
            recipient_id=parent.user_id,
            actor=current_user,
            question_id=answer.question_id,
            answer_id=answer.id,
            comment_id=comment.id,
            kind="answer_comment_reply",
            answer_body=answer.body,
            comment_body=comment.body,
            parent_body=parent.body,
        )
    elif answer.author_user_id and answer.author_user_id != current_user.id:
        notification = create_answer_notification(
            db,
            recipient_id=answer.author_user_id,
            actor=current_user,
            question_id=answer.question_id,
            answer_id=answer.id,
            comment_id=comment.id,
            kind="answer_reply",
            answer_body=answer.body,
            comment_body=comment.body,
        )
    db.commit()
    db.refresh(comment)
    if notification:
        db.refresh(notification)
        broadcast_notification(notification)
    broadcast_answer_event(
        "answer.comment_created",
        answer.question_id,
        answer.id,
        comment_id=str(comment.id),
        actor_user_id=str(current_user.id),
    )
    return to_answer_comment_read(
        comment,
        current_user.id,
        db,
        question_author_id=question.submitted_by_user_id,
    )


@router.put("/answers/{answer_id}/comments/{comment_id}", response_model=QuestionAnswerCommentRead)
def update_question_answer_comment(
    answer_id: UUID,
    comment_id: UUID,
    payload: QuestionAnswerCommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    comment = db.scalar(
        select(QuestionAnswerComment).where(
            QuestionAnswerComment.id == comment_id,
            QuestionAnswerComment.answer_id == answer_id,
            QuestionAnswerComment.user_id == current_user.id,
            QuestionAnswerComment.deleted_at.is_(None),
        )
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Reply not found")
    answer = db.get(QuestionAnswer, answer_id)
    question = require_community_question(db, answer.question_id, current_user)
    comment.body = payload.body.strip()
    db.commit()
    db.refresh(comment)
    broadcast_answer_event(
        "answer.comment_updated",
        answer.question_id,
        answer.id,
        comment_id=str(comment.id),
    )
    return to_answer_comment_read(
        comment,
        current_user.id,
        db,
        question_author_id=question.submitted_by_user_id,
    )


@router.delete("/answers/{answer_id}/comments/{comment_id}")
def delete_question_answer_comment(
    answer_id: UUID,
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    comment = db.scalar(
        select(QuestionAnswerComment).where(
            QuestionAnswerComment.id == comment_id,
            QuestionAnswerComment.answer_id == answer_id,
            QuestionAnswerComment.user_id == current_user.id,
            QuestionAnswerComment.deleted_at.is_(None),
        )
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Reply not found")
    answer = db.get(QuestionAnswer, answer_id)
    question = require_community_question(db, answer.question_id, current_user)
    comment.deleted_at = func.now()
    db.commit()
    broadcast_answer_event(
        "answer.comment_deleted",
        question.id,
        answer.id,
        comment_id=str(comment_id),
    )
    return {"status": "ok"}


@router.put("/answers/{answer_id}/comments/{comment_id}/like")
def like_question_answer_comment(
    answer_id: UUID,
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    require_community_question(db, answer.question_id, current_user)
    comment = db.scalar(
        select(QuestionAnswerComment).where(
            QuestionAnswerComment.id == comment_id,
            QuestionAnswerComment.answer_id == answer_id,
            QuestionAnswerComment.deleted_at.is_(None),
        )
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Reply not found")
    like = db.scalar(
        select(QuestionAnswerCommentLike).where(
            QuestionAnswerCommentLike.comment_id == comment_id,
            QuestionAnswerCommentLike.user_id == current_user.id,
        )
    )
    if like:
        db.delete(like)
        liked = False
        notification = None
    else:
        db.add(
            QuestionAnswerCommentLike(
                comment_id=comment_id,
                user_id=current_user.id,
            )
        )
        liked = True
        notification = None
        if comment.user_id != current_user.id:
            existing_notification = db.scalar(
                select(UserNotification).where(
                    UserNotification.user_id == comment.user_id,
                    UserNotification.actor_user_id == current_user.id,
                    UserNotification.kind == "answer_comment_like",
                    UserNotification.metadata_["comment_id"].astext == str(comment_id),
                )
            )
            if not existing_notification:
                notification = create_answer_notification(
                    db,
                    recipient_id=comment.user_id,
                    actor=current_user,
                    question_id=answer.question_id,
                    answer_id=answer.id,
                    comment_id=comment.id,
                    kind="answer_comment_like",
                    answer_body=answer.body,
                    comment_body=comment.body,
                )
    db.commit()
    if notification:
        db.refresh(notification)
        broadcast_notification(notification)
    like_count = db.scalar(
        select(func.count())
        .select_from(QuestionAnswerCommentLike)
        .where(QuestionAnswerCommentLike.comment_id == comment_id)
    ) or 0
    broadcast_answer_event(
        "answer.comment_reaction_updated",
        answer.question_id,
        answer.id,
        comment_id=str(comment.id),
        like_count=like_count,
    )
    return {"liked": liked, "like_count": like_count}


@router.post("/answers/{answer_id}/comments/{comment_id}/report")
def report_question_answer_comment(
    answer_id: UUID,
    comment_id: UUID,
    payload: QuestionAnswerCommentReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    answer = db.scalar(
        select(QuestionAnswer).where(
            QuestionAnswer.id == answer_id,
            QuestionAnswer.deleted_at.is_(None),
        )
    )
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    require_community_question(db, answer.question_id, current_user)
    existing = db.scalar(
        select(QuestionAnswerCommentReport).where(
            QuestionAnswerCommentReport.comment_id == comment_id,
            QuestionAnswerCommentReport.user_id == current_user.id,
        )
    )
    if not existing:
        db.add(
            QuestionAnswerCommentReport(
                comment_id=comment_id,
                user_id=current_user.id,
                reason=payload.reason,
            )
        )
        db.commit()
    return {"status": "reported"}


def community_summary(db: Session, question_id: UUID, current_user: User) -> dict:
    metrics = refresh_question_metrics(db, question_id)
    user_rating = db.scalar(
        select(QuestionRating).where(
            QuestionRating.question_id == question_id,
            QuestionRating.user_id == current_user.id,
        )
    )
    reaction = db.scalar(
        select(QuestionReaction.value).where(
            QuestionReaction.question_id == question_id,
            QuestionReaction.user_id == current_user.id,
        )
    )
    return {
        "frequency_average": round(float(metrics.frequency_average), 1) if metrics.frequency_average is not None else None,
        "importance_average": round(float(metrics.importance_average), 1) if metrics.importance_average is not None else None,
        "difficulty_average": round(float(metrics.difficulty_average), 1) if metrics.difficulty_average is not None else None,
        "rating_count": metrics.rating_count,
        "view_count": metrics.view_count,
        "unique_viewer_count": metrics.unique_viewer_count,
        "practice_count": metrics.practice_count,
        "unique_practicer_count": metrics.unique_practicer_count,
        "total_practice_seconds": metrics.total_practice_seconds,
        "average_practice_seconds": metrics.average_practice_seconds,
        "favorite_count": metrics.favorite_count,
        "is_favorited": bool(
            db.scalar(
                select(UserQuestion.is_favorited).where(
                    UserQuestion.question_id == question_id,
                    UserQuestion.user_id == current_user.id,
                )
            )
        ),
        "upvote_count": metrics.upvote_count,
        "downvote_count": metrics.downvote_count,
        "seen_in_interview_count": metrics.seen_in_interview_count,
        "company_count": metrics.company_count,
        "comment_count": getattr(metrics, "comment_count", 0),
        "blended_importance_score": round(float(metrics.blended_importance_score), 1) if metrics.blended_importance_score is not None else None,
        "blended_frequency_score": round(float(metrics.blended_frequency_score), 1) if metrics.blended_frequency_score is not None else None,
        "top_companies": metrics.top_companies,
        "user_frequency_rating": user_rating.frequency_rating if user_rating else None,
        "user_importance_rating": user_rating.importance_rating if user_rating else None,
        "user_difficulty_rating": user_rating.difficulty_rating if user_rating else None,
        "user_reaction": reaction,
    }


@router.get("/questions/{question_id}/community", response_model=QuestionCommunitySummaryRead)
def get_question_community_summary(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    require_community_question(db, question_id, current_user)
    return community_summary(db, question_id, current_user)


@router.put(
    "/questions/{question_id}/favorite",
    response_model=QuestionCommunitySummaryRead,
)
def toggle_question_favorite(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = require_community_question(db, question_id, current_user)
    user_question = ensure_user_question_state(db, current_user, question)
    user_question.is_favorited = not user_question.is_favorited
    db.flush()
    summary = community_summary(db, question_id, current_user)
    db.commit()
    return summary


@router.put("/questions/{question_id}/community/rating", response_model=QuestionCommunitySummaryRead)
def update_question_community_rating(
    question_id: UUID,
    payload: QuestionRatingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    require_community_question(db, question_id, current_user)
    rating = db.scalar(select(QuestionRating).where(QuestionRating.question_id == question_id, QuestionRating.user_id == current_user.id))
    survey_bonus_xp = 0
    survey_bonus_coins = 0
    if (
        payload.frequency_rating is None
        and payload.importance_rating is None
        and payload.difficulty_rating is None
    ):
        if rating:
            db.delete(rating)
            rating = None
    elif rating:
        rating.frequency_rating = payload.frequency_rating
        rating.importance_rating = payload.importance_rating
        rating.difficulty_rating = payload.difficulty_rating
    else:
        rating = QuestionRating(
            question_id=question_id,
            user_id=current_user.id,
            frequency_rating=payload.frequency_rating,
            importance_rating=payload.importance_rating,
            difficulty_rating=payload.difficulty_rating,
        )
        db.add(rating)
    if rating:
        survey_bonus_xp, survey_bonus_coins = grant_question_survey_reward(db, current_user, question_id, rating)
    refresh_question_metrics(db, question_id)
    db.commit()
    summary = community_summary(db, question_id, current_user)
    summary["survey_bonus_xp"] = survey_bonus_xp
    summary["survey_bonus_coins"] = survey_bonus_coins
    return summary


@router.put("/questions/{question_id}/community/reaction", response_model=QuestionCommunitySummaryRead)
def update_question_community_reaction(
    question_id: UUID,
    payload: QuestionReactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    if payload.value not in {"up", "down", None}:
        raise HTTPException(status_code=400, detail="Reaction must be up or down")
    require_community_question(db, question_id, current_user)
    reaction = db.scalar(select(QuestionReaction).where(QuestionReaction.question_id == question_id, QuestionReaction.user_id == current_user.id))
    if payload.value is None:
        if reaction:
            db.delete(reaction)
    elif reaction:
        reaction.value = payload.value
    else:
        db.add(QuestionReaction(question_id=question_id, user_id=current_user.id, value=payload.value))
    refresh_question_metrics(db, question_id)
    db.commit()
    return community_summary(db, question_id, current_user)


def require_community_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage question discussions")


@router.get("/questions/{question_id}/community/reports", response_model=list[CommunityInterviewReportRead])
def list_community_interview_reports(question_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    require_community_question(db, question_id, current_user)
    reports = db.scalars(select(InterviewReport).where(InterviewReport.question_id == question_id, InterviewReport.seen_in_interview.is_(True)).order_by(InterviewReport.happened_at.desc()).limit(30)).all()
    results = []
    for r in reports:
        item = CommunityInterviewReportRead.model_validate(r)
        if r.raw_data and isinstance(r.raw_data, dict) and r.raw_data.get("location"):
            item.location = str(r.raw_data["location"])
        results.append(item)
    return results

@router.get("/community/notifications", response_model=list[UserNotificationRead])
def list_community_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    return list_notifications(db, current_user)

@router.post("/community/notifications/read")
def mark_community_notifications_read(db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    return mark_all_notifications_read(db, current_user)


@router.get("/notifications", response_model=list[UserNotificationRead])
def list_notifications(
    unread_only: bool = True,
    limit: int | None = Query(default=None, ge=1, le=100),
    before: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    query = select(UserNotification).where(UserNotification.user_id == current_user.id)
    if unread_only:
        query = query.where(UserNotification.read_at.is_(None))
    if before:
        query = query.where(UserNotification.created_at < before)
    query = query.order_by(UserNotification.created_at.desc())
    if limit:
        query = query.limit(limit)
    return db.scalars(query).all()


@router.post("/notifications/read")
def mark_all_notifications_read(db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    now = datetime.now(timezone.utc)
    for notification in db.scalars(select(UserNotification).where(UserNotification.user_id == current_user.id, UserNotification.read_at.is_(None))).all(): notification.read_at = now
    db.commit()
    return {"message": "Notifications marked as read"}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    notification = db.scalar(
        select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == current_user.id,
        )
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Notification marked as read"}


# --- Reports Endpoints ---
@router.get("/reports", response_model=list[InterviewReportRead])
def list_interview_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    reports = db.scalars(
        select(InterviewReport)
        .where(InterviewReport.user_id == current_user.id)
        .order_by(InterviewReport.created_at.desc())
    ).all()
    return reports


def async_update_question_summary(question_id: UUID):
    db = SessionLocal()
    try:
        reports = db.scalars(
            select(InterviewReport).where(
                InterviewReport.question_id == question_id,
                InterviewReport.seen_in_interview.is_(True),
            )
        ).all()
        company_counts: dict[str, tuple[str, int]] = {}
        for report in reports:
            if not report.company or not report.company.strip():
                continue
            key = report.company.strip().casefold()
            display, count = company_counts.get(key, (report.company.strip(), 0))
            company_counts[key] = (display, count + 1)
        top_companies = [
            {"name": display, "count": count}
            for display, count in sorted(company_counts.values(), key=lambda item: (-item[1], item[0].casefold()))[:5]
        ]
        summary = db.get(QuestionInterviewReportSummary, question_id)
        if summary is None:
            summary = QuestionInterviewReportSummary(question_id=question_id)
            db.add(summary)
        summary.report_count = len(reports)
        summary.company_count = len(company_counts)
        summary.top_companies = top_companies
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@router.post("/reports", response_model=InterviewReportRead, status_code=status.HTTP_201_CREATED)
def create_interview_report(
    payload: InterviewReportBase,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = require_community_question(db, payload.question_id, current_user)
    user_q = ensure_user_question_state(db, current_user, question)
    report = InterviewReport(
        user_id=current_user.id,
        question_id=payload.question_id,
        company=payload.company,
        role=payload.role,
        seen_in_interview=payload.seen_in_interview,
        happened_at=payload.happened_at or datetime.now(timezone.utc),
        notes=payload.notes,
        raw_data=payload.raw_data,
    )
    db.add(report)
    
    # Handle Company linking
    if payload.company:
        company_name_lower = payload.company.strip().lower()
        # Ensure first letter is capitalized for visual display if creating new
        display_name = payload.company.strip()
        
        company = db.scalar(select(Company).where(func.lower(Company.name) == company_name_lower))
        if not company:
            # Clean name for clearbit (remove spaces, etc)
            clean_domain = re.sub(r'[^a-zA-Z0-9]', '', company_name_lower) + ".com"
            logo_url = f"https://logo.clearbit.com/{clean_domain}"
            company = Company(name=display_name, logo_url=logo_url)
            db.add(company)
            db.flush() # flush to get company id
            
        # Get the question to update its companies
        question = db.scalar(select(InterviewQuestion).where(InterviewQuestion.id == payload.question_id))
        if question and company not in question.companies:
            question.companies.append(company)
    refresh_question_metrics(db, payload.question_id)
    db.commit()
    db.refresh(report)
    
    # Schedule background task to update question summary asynchronously
    background_tasks.add_task(async_update_question_summary, payload.question_id)
    
    return report

# Comments
def create_comment_notification(
    db: Session,
    *,
    recipient_id: UUID,
    actor: User,
    question_id: UUID,
    comment_id: UUID,
    kind: str,
    comment_body: str,
    parent_body: str | None = None,
) -> UserNotification:
    excerpt = " ".join(comment_body.split())[:180]
    parent_excerpt = " ".join((parent_body or "").split())[:120]
    question = db.get(InterviewQuestion, question_id)
    notification = UserNotification(
        user_id=recipient_id,
        actor_user_id=actor.id,
        question_id=question_id,
        kind=kind,
        action_url=f"/interview-prep/practice/{question_id}?mode=free&tab=comment",
        title=(f"{actor.display_name} replied to your comment" if kind == "comment_reply" else f"{actor.display_name} liked your comment"),
        message=(
            f"Your comment: {parent_excerpt}\nReply: {excerpt}"
            if kind == "comment_reply"
            else f"Your comment: {excerpt}"
        ),
        metadata_={
            "comment_id": str(comment_id),
            "actor_name": actor.display_name,
            "actor_avatar_url": actor.avatar_url,
            "actor_badge": comment_author_badge(
                actor,
                question.submitted_by_user_id if question else None,
            ),
            "comment_body": excerpt,
            "parent_body": parent_excerpt,
            "question_title": question.title if question else "",
        },
    )
    db.add(notification)
    return notification


def broadcast_comment_event(
    event_type: str,
    question_id: UUID,
    comment_id: UUID,
    **payload,
) -> None:
    broadcast_sync(
        event_type,
        {"question_id": str(question_id), "comment_id": str(comment_id), **payload},
    )


def broadcast_notification(notification: UserNotification) -> None:
    broadcast_sync(
        "notification.created",
        {
            "user_id": str(notification.user_id),
            "notification": UserNotificationRead.model_validate(notification).model_dump(mode="json"),
        },
    )


def comment_author_badge(user: User | None, question_author_id=None) -> str | None:
    if not user:
        return None
    if user.role == "admin":
        return "Admin"
    if user.community_badge:
        return user.community_badge
    if question_author_id and user.id == question_author_id:
        return "Author"
    return None


def to_comment_read(
    c: QuestionComment,
    current_user_id=None,
    db=None,
    include_replies: bool = False,
    question_author_id=None,
) -> QuestionCommentRead:
    is_liked = False
    like_count = 0
    if db:
        like_count = db.scalar(select(func.count()).select_from(QuestionCommentLike).where(QuestionCommentLike.comment_id == c.id)) or 0
        if current_user_id:
            is_liked = bool(db.scalar(select(QuestionCommentLike).where(QuestionCommentLike.comment_id == c.id, QuestionCommentLike.user_id == current_user_id)))
            
    replies = []
    if db and include_replies:
        children = db.scalars(
            select(QuestionComment)
            .where(
                QuestionComment.parent_id == c.id,
                QuestionComment.deleted_at.is_(None),
            )
            .order_by(QuestionComment.created_at.asc())
        ).all()
        replies = [
            to_comment_read(
                child,
                current_user_id,
                db,
                include_replies=True,
                question_author_id=question_author_id,
            )
            for child in children
        ]

    return QuestionCommentRead(
        id=c.id,
        question_id=c.question_id,
        parent_id=c.parent_id,
        kind=c.kind,
        body=c.body,
        author_name=c.user.display_name if c.user else "Unknown",
        author_avatar_url=c.user.avatar_url if c.user else None,
        author_badge=comment_author_badge(c.user, question_author_id),
        is_author=(c.user_id == current_user_id) if current_user_id else False,
        like_count=like_count,
        is_liked=is_liked,
        is_reported=False,
        reply_count=len(replies),
        created_at=c.created_at,
        updated_at=c.updated_at,
        replies=replies,
    )

@router.get("/questions/{question_id}/comments", response_model=QuestionCommentPageRead)
def list_comments(
    question_id: UUID,
    kind: str | None = None,
    before: datetime | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    like_count = (
        select(func.count(QuestionCommentLike.id))
        .where(QuestionCommentLike.comment_id == QuestionComment.id)
        .correlate(QuestionComment)
        .scalar_subquery()
    )
    query = select(QuestionComment).where(
        QuestionComment.question_id == question_id,
        QuestionComment.parent_id.is_(None),
        QuestionComment.deleted_at.is_(None),
    )
    if kind:
        query = query.where(QuestionComment.kind == kind)
    if before:
        query = query.where(QuestionComment.created_at < before)

    rows = db.scalars(
        query.order_by(like_count.desc(), QuestionComment.created_at.desc()).limit(limit + 1)
    ).all()
    question = db.get(InterviewQuestion, question_id)
    has_more = len(rows) > limit
    comments = rows[:limit]
    return QuestionCommentPageRead(
        items=[
            to_comment_read(
                c,
                current_user.id,
                db,
                include_replies=True,
                question_author_id=question.submitted_by_user_id if question else None,
            )
            for c in comments
        ],
        next_cursor=comments[-1].created_at if has_more and comments else None,
        question_id=question_id
    )

@router.post("/questions/{question_id}/comments", response_model=QuestionCommentRead)
def create_comment(question_id: UUID, payload: QuestionCommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    parent = None
    if payload.parent_id:
        parent = db.scalar(
            select(QuestionComment).where(
                QuestionComment.id == payload.parent_id,
                QuestionComment.question_id == question_id,
                QuestionComment.deleted_at.is_(None),
            )
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    c = QuestionComment(
        question_id=question_id,
        user_id=current_user.id,
        parent_id=payload.parent_id,
        kind=payload.kind,
        body=payload.body,
        is_anonymous=False
    )
    db.add(c)
    db.flush()
    notification = None
    if parent and parent.user_id != current_user.id:
        notification = create_comment_notification(
            db,
            recipient_id=parent.user_id,
            actor=current_user,
            question_id=question_id,
            comment_id=c.id,
            kind="comment_reply",
            comment_body=c.body,
            parent_body=parent.body,
        )
    refresh_question_metrics(db, question_id)
    db.commit()
    db.refresh(c)
    if notification:
        db.refresh(notification)
        broadcast_notification(notification)
    broadcast_comment_event("comment.created", question_id, c.id, actor_user_id=str(current_user.id))
    question = db.get(InterviewQuestion, question_id)
    return to_comment_read(
        c,
        current_user.id,
        db,
        question_author_id=question.submitted_by_user_id if question else None,
    )

@router.put("/questions/{question_id}/comments/{comment_id}", response_model=QuestionCommentRead)
def update_comment(question_id: UUID, comment_id: UUID, payload: QuestionCommentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    c = db.scalar(select(QuestionComment).where(QuestionComment.id == comment_id, QuestionComment.user_id == current_user.id))
    if not c:
        raise HTTPException(status_code=404)
    c.body = payload.body
    db.commit()
    db.refresh(c)
    broadcast_comment_event("comment.updated", question_id, c.id)
    question = db.get(InterviewQuestion, question_id)
    return to_comment_read(
        c,
        current_user.id,
        db,
        question_author_id=question.submitted_by_user_id if question else None,
    )

@router.delete("/questions/{question_id}/comments/{comment_id}")
def delete_comment(question_id: UUID, comment_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    c = db.scalar(select(QuestionComment).where(QuestionComment.id == comment_id, QuestionComment.user_id == current_user.id))
    if not c:
        raise HTTPException(status_code=404)
    c.deleted_at = func.now()
    refresh_question_metrics(db, question_id)
    db.commit()
    broadcast_comment_event("comment.deleted", question_id, comment_id)
    return {"status": "ok"}

@router.put("/questions/{question_id}/comments/{comment_id}/like")
def like_comment(question_id: UUID, comment_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    comment = db.scalar(
        select(QuestionComment).where(
            QuestionComment.id == comment_id,
            QuestionComment.question_id == question_id,
            QuestionComment.deleted_at.is_(None),
        )
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    like = db.scalar(select(QuestionCommentLike).where(QuestionCommentLike.comment_id == comment_id, QuestionCommentLike.user_id == current_user.id))
    if like:
        db.delete(like)
        liked = False
    else:
        db.add(QuestionCommentLike(comment_id=comment_id, user_id=current_user.id))
        liked = True
    notification = None
    if liked and comment.user_id != current_user.id:
        existing_notification = db.scalar(
            select(UserNotification).where(
                UserNotification.user_id == comment.user_id,
                UserNotification.actor_user_id == current_user.id,
                UserNotification.kind == "comment_like",
                UserNotification.metadata_["comment_id"].astext == str(comment_id),
            )
        )
        if not existing_notification:
            notification = create_comment_notification(
                db,
                recipient_id=comment.user_id,
                actor=current_user,
                question_id=question_id,
                comment_id=comment_id,
                kind="comment_like",
                comment_body=comment.body,
            )
    db.commit()
    if notification:
        db.refresh(notification)
        broadcast_notification(notification)
    like_count = db.scalar(select(func.count()).select_from(QuestionCommentLike).where(QuestionCommentLike.comment_id == comment_id))
    broadcast_comment_event(
        "comment.reaction_updated",
        question_id,
        comment_id,
        like_count=like_count,
    )
    return {"liked": liked, "like_count": like_count}

@router.post("/questions/{question_id}/comments/{comment_id}/report")
def report_comment(question_id: UUID, comment_id: UUID, payload: QuestionCommentReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)):
    rep = QuestionCommentReport(comment_id=comment_id, user_id=current_user.id, reason=payload.reason)
    db.add(rep)
    db.commit()
    return {"status": "reported"}


@router.get("/questions/{question_id}/comments/{comment_id}/replies", response_model=QuestionCommentPageRead)
def list_replies(
    question_id: UUID,
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    comments = db.scalars(
        select(QuestionComment)
        .where(QuestionComment.question_id == question_id, QuestionComment.parent_id == comment_id, QuestionComment.deleted_at == None)
        .order_by(QuestionComment.created_at.asc())
    ).all()
    question = db.get(InterviewQuestion, question_id)
    return QuestionCommentPageRead(
        items=[
            to_comment_read(
                c,
                current_user.id,
                db,
                include_replies=True,
                question_author_id=question.submitted_by_user_id if question else None,
            )
            for c in comments
        ],
        question_id=question_id
    )


# --- User Favorites & Activity Endpoints (Paginated) ---

@router.get("/user/favorites/counts")
def get_user_favorites_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    favorited_questions_count = db.scalar(
        select(func.count(UserQuestion.id)).where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.is_favorited.is_(True),
        )
    ) or 0

    my_comments_count = db.scalar(
        select(func.count(QuestionComment.id)).where(
            QuestionComment.user_id == current_user.id,
            QuestionComment.deleted_at.is_(None),
        )
    ) or 0

    liked_comments_count = db.scalar(
        select(func.count(QuestionCommentLike.id)).where(
            QuestionCommentLike.user_id == current_user.id,
        )
    ) or 0

    saved_answers_count = db.scalar(
        select(func.count(QuestionAnswerSave.id)).where(
            QuestionAnswerSave.user_id == current_user.id,
        )
    ) or 0

    saved_collections_count = db.scalar(
        select(func.count(UserCollection.id)).where(
            UserCollection.user_id == current_user.id,
            UserCollection.removed_at.is_(None),
        )
    ) or 0

    return {
        "favorited_questions": favorited_questions_count,
        "my_comments": my_comments_count,
        "liked_comments": liked_comments_count,
        "saved_answers": saved_answers_count,
        "saved_collections": saved_collections_count,
        "total": favorited_questions_count + my_comments_count + liked_comments_count + saved_answers_count + saved_collections_count,
    }


@router.get("/user/favorites/questions")
def get_user_favorited_questions(
    limit: int = Query(default=15, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    query = (
        select(UserQuestion)
        .options(
            joinedload(UserQuestion.question),
            joinedload(UserQuestion.category),
            selectinload(UserQuestion.tags),
        )
        .where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.is_favorited.is_(True),
        )
        .order_by(UserQuestion.updated_at.desc())
    )
    
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    rows = db.scalars(query.offset(offset).limit(limit + 1)).all()
    has_more = len(rows) > limit
    items = rows[:limit]

    return {
        "items": [to_question_read(uq) for uq in items],
        "total": total,
        "has_more": has_more,
        "next_offset": offset + limit if has_more else None,
    }


@router.get("/user/favorites/comments")
def get_user_favorited_comments(
    kind: str = Query(default="all"),
    limit: int = Query(default=15, ge=1, le=50),
    before: datetime | None = None,
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    items = []
    
    if kind == "mine":
        query = select(QuestionComment).where(
            QuestionComment.user_id == current_user.id,
            QuestionComment.deleted_at.is_(None),
        )
        if before:
            query = query.where(QuestionComment.created_at < before)
        query = query.order_by(QuestionComment.created_at.desc())
        
        rows = db.scalars(query.offset(offset).limit(limit + 1)).all()
        has_more = len(rows) > limit
        comments_list = rows[:limit]

        q_ids = list(set([c.question_id for c in comments_list if c.question_id]))
        q_map = {}
        if q_ids:
            for q in db.scalars(select(InterviewQuestion).where(InterviewQuestion.id.in_(q_ids))).all():
                q_map[q.id] = q.title

        items = [
            {
                "id": str(c.id),
                "question_id": str(c.question_id),
                "question_title": q_map.get(c.question_id, "Untitled Question"),
                "body": c.body,
                "kind": c.kind,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "is_author": True,
            }
            for c in comments_list
        ]
        next_cursor = comments_list[-1].created_at.isoformat() if has_more and comments_list and comments_list[-1].created_at else None

    elif kind == "liked":
        query = select(QuestionCommentLike).where(QuestionCommentLike.user_id == current_user.id)
        if before:
            query = query.where(QuestionCommentLike.created_at < before)
        query = query.order_by(QuestionCommentLike.created_at.desc())

        likes = db.scalars(query.offset(offset).limit(limit + 1)).all()
        has_more = len(likes) > limit
        like_items = likes[:limit]
        
        c_ids = [l.comment_id for l in like_items]
        if c_ids:
            comments_map = {
                c.id: c
                for c in db.scalars(
                    select(QuestionComment)
                    .options(joinedload(QuestionComment.user))
                    .where(QuestionComment.id.in_(c_ids), QuestionComment.deleted_at.is_(None))
                ).all()
            }
            q_ids = list(set([c.question_id for c in comments_map.values() if c.question_id]))
            q_map = {}
            if q_ids:
                for q in db.scalars(select(InterviewQuestion).where(InterviewQuestion.id.in_(q_ids))).all():
                    q_map[q.id] = q.title

            for l in like_items:
                c = comments_map.get(l.comment_id)
                if c:
                    items.append({
                        "id": str(c.id),
                        "question_id": str(c.question_id),
                        "question_title": q_map.get(c.question_id, "Untitled Question"),
                        "body": c.body,
                        "kind": c.kind,
                        "author_name": c.user.display_name if c.user else "Unknown",
                        "created_at": c.created_at.isoformat() if c.created_at else None,
                        "is_author": c.user_id == current_user.id,
                    })

        next_cursor = like_items[-1].created_at.isoformat() if has_more and like_items and like_items[-1].created_at else None

    else:
        my_comments = db.scalars(
            select(QuestionComment)
            .where(QuestionComment.user_id == current_user.id, QuestionComment.deleted_at.is_(None))
            .order_by(QuestionComment.created_at.desc())
            .limit(limit + offset + 10)
        ).all()
        
        liked_likes = db.scalars(
            select(QuestionCommentLike)
            .where(QuestionCommentLike.user_id == current_user.id)
            .order_by(QuestionCommentLike.created_at.desc())
            .limit(limit + offset + 10)
        ).all()

        all_entries = []
        q_ids_set = set()

        for c in my_comments:
            all_entries.append({
                "id": str(c.id),
                "question_id": str(c.question_id),
                "body": c.body,
                "kind": c.kind,
                "created_at_dt": c.created_at,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "is_author": True,
                "author_name": "Me",
            })
            if c.question_id:
                q_ids_set.add(c.question_id)

        liked_c_ids = [l.comment_id for l in liked_likes]
        if liked_c_ids:
            c_map = {
                c.id: c
                for c in db.scalars(
                    select(QuestionComment)
                    .options(joinedload(QuestionComment.user))
                    .where(QuestionComment.id.in_(liked_c_ids), QuestionComment.deleted_at.is_(None))
                ).all()
            }
            for l in liked_likes:
                c = c_map.get(l.comment_id)
                if c and c.user_id != current_user.id:
                    all_entries.append({
                        "id": str(c.id),
                        "question_id": str(c.question_id),
                        "body": c.body,
                        "kind": c.kind,
                        "created_at_dt": l.created_at,
                        "created_at": l.created_at.isoformat() if l.created_at else None,
                        "is_author": False,
                        "author_name": c.user.display_name if c.user else "Unknown",
                    })
                    if c.question_id:
                        q_ids_set.add(c.question_id)

        all_entries.sort(key=lambda x: x["created_at_dt"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        
        q_map = {}
        if q_ids_set:
            for q in db.scalars(select(InterviewQuestion).where(InterviewQuestion.id.in_(list(q_ids_set)))).all():
                q_map[q.id] = q.title

        paged_entries = all_entries[offset:offset + limit + 1]
        has_more = len(paged_entries) > limit
        final_list = paged_entries[:limit]

        for item in final_list:
            item["question_title"] = q_map.get(UUID(item["question_id"]), "Untitled Question")
            item.pop("created_at_dt", None)

        items = final_list
        next_cursor = None

    return {
        "items": items,
        "has_more": has_more,
        "next_offset": offset + limit if has_more else None,
        "next_cursor": next_cursor,
    }


@router.get("/user/favorites/answers")
def get_user_saved_answers(
    limit: int = Query(default=15, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    query = (
        select(QuestionAnswerSave)
        .where(QuestionAnswerSave.user_id == current_user.id)
        .order_by(QuestionAnswerSave.created_at.desc())
    )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset(offset).limit(limit + 1)).all()
    has_more = len(rows) > limit
    saves = rows[:limit]

    answer_ids = [s.answer_id for s in saves]
    items = []
    if answer_ids:
        answers_map = {
            a.id: a
            for a in db.scalars(
                select(QuestionAnswer)
                .options(joinedload(QuestionAnswer.question), joinedload(QuestionAnswer.author))
                .where(QuestionAnswer.id.in_(answer_ids), QuestionAnswer.deleted_at.is_(None))
            ).all()
        }

        for s in saves:
            a = answers_map.get(s.answer_id)
            if a:
                items.append({
                    "id": str(a.id),
                    "question_id": str(a.question_id),
                    "question_title": a.question.title if a.question else "Untitled Question",
                    "title": a.title,
                    "body": a.body,
                    "answer_type": a.answer_type,
                    "author_name": a.author.display_name if a.author else ("AI Reference" if a.source == "ai" else "Unknown"),
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                })

    return {
        "items": items,
        "total": total,
        "has_more": has_more,
        "next_offset": offset + limit if has_more else None,
    }


@router.get("/user/favorites/collections")
def get_user_saved_collections(
    limit: int = Query(default=15, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    query = (
        select(UserCollection)
        .options(joinedload(UserCollection.collection))
        .where(
            UserCollection.user_id == current_user.id,
            UserCollection.removed_at.is_(None),
        )
        .order_by(UserCollection.added_at.desc())
    )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset(offset).limit(limit + 1)).all()
    has_more = len(rows) > limit
    user_cols = rows[:limit]

    items = [
        {
            "id": str(uc.collection.id),
            "title": uc.collection.title,
            "description": uc.collection.description,
            "cover_url": uc.collection.cover_url,
            "price_coins": uc.collection.price_coins,
            "is_purchased": uc.is_purchased,
            "added_at": uc.added_at.isoformat() if uc.added_at else None,
        }
        for uc in user_cols
        if uc.collection
    ]

    return {
        "items": items,
        "total": total,
        "has_more": has_more,
        "next_offset": offset + limit if has_more else None,
    }
