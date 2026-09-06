import math
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, exists, func, or_, select, text, update
from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.models import (
    Company,
    InterviewCategory,
    InterviewCollectionQuestion,
    InterviewQuestion,
    InterviewTag,
    QuestionAnswer,
    QuestionMetrics,
    QuestionTagAssociation,
    User,
    UserCollection,
    UserQuestion,
    UserQuestionTagAssociation,
)
from services.shared.schemas import (
    InterviewCategoryBase,
    InterviewCategoryRead,
    InterviewQuestionCreate,
    InterviewQuestionRead,
    InterviewQuestionUpdate,
    InterviewTagBase,
    InterviewTagRead,
    PaginatedInterviewQuestionsRead,
    QuestionDuplicateGroupRead,
    QuestionDuplicateCandidateRead,
)

from .collections import ensure_collection_seeds
from .gamification import get_question_recommendation_config
from .helpers import (
    _community_weight,
    _frequency_label_to_score,
    active_collection_ids_by_question,
    calculate_question_hot_score,
    category_metadata_for_name,
    category_to_read,
    clean_category_name,
    dedupe_public_questions,
    ensure_question_display_number,
    ensure_user_question_state,
    library_question_ids_query,
    normalize_question_title,
    refresh_question_metrics,
    slugify_category,
    sync_question_answers,
    to_public_question_read,
    to_question_read,
)

router = APIRouter(tags=["Questions"])

def normalize_user_categories(db: Session, user_id: UUID) -> bool:
    categories = db.scalars(
        select(InterviewCategory).where(InterviewCategory.user_id == user_id)
    ).all()
    categories_by_name: dict[str, InterviewCategory] = {}
    changed = False

    for category in categories:
        metadata = category_metadata_for_name(category.display_name or category.name)
        if not metadata["display_name"]:
            continue
        key = metadata["slug"]
        existing = categories_by_name.get(key)
        if existing and existing.id != category.id:
            db.execute(
                update(UserQuestion)
                .where(UserQuestion.category_id == category.id)
                .values(category_id=existing.id)
            )
            db.execute(
                update(InterviewQuestion)
                .where(InterviewQuestion.category_id == category.id)
                .values(category_id=existing.id)
            )
            db.delete(category)
            changed = True
            continue

        categories_by_name[key] = category
        desired_values = {
            "name": metadata["display_name"],
            "display_name": metadata["display_name"],
            "slug": metadata["slug"],
            "icon_key": metadata["icon_key"] if metadata["is_system"] else (category.icon_key or metadata["icon_key"]),
            "sort_order": metadata["sort_order"],
            "is_system": metadata["is_system"],
        }
        for field, value in desired_values.items():
            if getattr(category, field) != value:
                setattr(category, field, value)
                changed = True

    return changed


@router.get("/categories", response_model=list[InterviewCategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    # Purge legacy Leadership category if present
    leadership_cats = db.scalars(
        select(InterviewCategory).where(
            InterviewCategory.user_id == current_user.id,
            func.lower(InterviewCategory.name).like("%leadership%"),
        )
    ).all()
    if leadership_cats:
        for cat in leadership_cats:
            db.execute(text("UPDATE user_questions SET category_id = NULL WHERE category_id = :cid").bindparams(cid=cat.id))
            db.execute(text("UPDATE interview_questions SET category_id = NULL WHERE category_id = :cid").bindparams(cid=cat.id))
            db.delete(cat)
        db.commit()

    if normalize_user_categories(db, current_user.id):
        db.commit()

    # Rename the legacy category without losing a user's assignments. If a
    # Project category already exists, merge Experience into that category.
    experience_categories = db.scalars(
        select(InterviewCategory).where(
            InterviewCategory.user_id == current_user.id,
            func.lower(InterviewCategory.name) == "experience",
        )
    ).all()
    if experience_categories:
        project_category = db.scalar(
            select(InterviewCategory).where(
                InterviewCategory.user_id == current_user.id,
                func.lower(InterviewCategory.name) == "project",
            )
        )
        if not project_category:
            metadata = category_metadata_for_name("Project")
            project_category = InterviewCategory(
                user_id=current_user.id,
                name=metadata["display_name"],
                display_name=metadata["display_name"],
                slug=metadata["slug"],
                icon_key=metadata["icon_key"],
                sort_order=metadata["sort_order"],
                is_system=metadata["is_system"],
            )
            db.add(project_category)
            db.flush()
        for category in experience_categories:
            db.execute(
                update(UserQuestion)
                .where(UserQuestion.category_id == category.id)
                .values(category_id=project_category.id)
            )
            db.execute(
                update(InterviewQuestion)
                .where(InterviewQuestion.category_id == category.id)
                .values(category_id=project_category.id)
            )
            db.delete(category)
        db.commit()

    categories = db.scalars(select(InterviewCategory).where(InterviewCategory.user_id == current_user.id)).all()
    if not categories:
        default_categories = [
            "About You",
            "Project",
            "Behaviour",
            "Role-specific",
            "Company",
        ]
        for name in default_categories:
            metadata = category_metadata_for_name(name)
            cat = InterviewCategory(
                user_id=current_user.id,
                name=metadata["display_name"],
                display_name=metadata["display_name"],
                slug=metadata["slug"],
                icon_key=metadata["icon_key"],
                sort_order=metadata["sort_order"],
                is_system=metadata["is_system"],
            )
            db.add(cat)
        db.commit()
        categories = db.scalars(select(InterviewCategory).where(InterviewCategory.user_id == current_user.id)).all()

    subscribed_ids = list(db.scalars(library_question_ids_query(current_user)).all())
    saved_ids = list(db.scalars(
        select(UserQuestion.question_id)
        .join(InterviewQuestion, InterviewQuestion.id == UserQuestion.question_id)
        .where(
            UserQuestion.user_id == current_user.id,
            UserQuestion.is_saved.is_(True),
            InterviewQuestion.status == "published",
        )
    ).all())
    visible_ids = list(dict.fromkeys([*saved_ids, *subscribed_ids]))

    counts_map = {}
    if visible_ids:
        rows = db.execute(
            select(UserQuestion.category_id, func.count(UserQuestion.id))
            .join(InterviewQuestion, InterviewQuestion.id == UserQuestion.question_id)
            .where(
                UserQuestion.user_id == current_user.id,
                UserQuestion.question_id.in_(visible_ids),
                InterviewQuestion.status == "published",
            )
            .group_by(UserQuestion.category_id)
        ).all()
        counts_map = {cat_id: count for cat_id, count in rows if cat_id is not None}

    return [
        {
            "id": cat.id,
            "user_id": cat.user_id,
            "name": cat.display_name or clean_category_name(cat.name),
            "slug": cat.slug,
            "display_name": cat.display_name or clean_category_name(cat.name),
            "icon_key": cat.icon_key,
            "sort_order": cat.sort_order,
            "is_system": cat.is_system,
            "question_count": counts_map.get(cat.id, 0),
            "created_at": cat.created_at,
            "updated_at": cat.updated_at,
        }
        for cat in sorted(categories, key=lambda item: (item.sort_order, item.display_name or item.name))
    ]


@router.post("/categories", response_model=InterviewCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: InterviewCategoryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    metadata = category_metadata_for_name(payload.name)
    category = InterviewCategory(
        user_id=current_user.id,
        name=metadata["display_name"],
        display_name=metadata["display_name"],
        slug=metadata["slug"],
        icon_key=payload.icon_key or metadata["icon_key"],
        sort_order=payload.sort_order if payload.sort_order is not None else metadata["sort_order"],
        is_system=metadata["is_system"],
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


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
    """Safely fill missing metadata and merge tags without overwriting existing edits."""
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
    raw_frequency = str(
        metadata.get(
            "frequency",
            existing_metadata.get("frequency", question.author_frequency or question.frequency or "medium"),
        ),
    ).strip().lower()
    frequency = raw_frequency.title() if raw_frequency in {"low", "medium", "high"} else "Medium"
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
        "frequency": frequency,
        "estimated_duration": estimated_duration,
        "generated_at": metadata.get("generated_at") or datetime.now(timezone.utc).isoformat(),
    }
    question.ai_metadata = metadata
    if not question.difficulty:
        question.difficulty = metadata["difficulty"].title()
    if not question.estimated_duration_seconds:
        question.estimated_duration_seconds = metadata["estimated_duration"]
    if not question.author_frequency and not question.frequency:
        question.author_frequency = metadata["frequency"]
        question.frequency = metadata["frequency"]
    if question.author_importance_score is None and question.importance_score is None:
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
    if not user_question.frequency:
        user_question.frequency = metadata["frequency"]
    if user_question.importance_score is None:
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
    if isinstance(content.get("frequency"), str):
        metadata["frequency"] = content["frequency"]
    if isinstance(content.get("estimated_duration"), (int, float, str)):
        metadata["estimated_duration"] = content["estimated_duration"]
    if isinstance(content.get("tags"), list):
        metadata["tags"] = content["tags"]
    if isinstance(content.get("importance_score"), (int, float, str)):
        metadata["importance_score"] = content["importance_score"]
    if metadata:
        apply_ai_question_metadata(db, question, current_user, metadata)


@router.get("/questions", response_model=PaginatedInterviewQuestionsRead)
def list_questions(
    limit: int = Query(default=0, ge=0, le=200),
    offset: int = Query(default=0, ge=0),
    category_id: str | None = None,
    category_ids: list[str] | None = Query(default=None),
    collection_ids: list[str] | None = Query(default=None),
    tag_ids: list[str] | None = Query(default=None),
    importance_scores: list[int] | None = Query(default=None),
    frequencies: list[str] | None = Query(default=None),
    question_ids: list[str] | None = Query(default=None),
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
        return {"items": [], "total": 0, "has_more": False, "next_offset": None}

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

    normalized_category_ids = [value for value in (category_ids or []) if value]
    if category_id and category_id not in normalized_category_ids:
        normalized_category_ids.append(category_id)

    if normalized_category_ids:
        include_uncategorized = "uncategorized" in normalized_category_ids
        concrete_category_ids = [value for value in normalized_category_ids if value != "uncategorized"]
        category_conditions = []
        if concrete_category_ids:
            category_conditions.append(UserQuestion.category_id.in_(concrete_category_ids))
        if include_uncategorized:
            category_conditions.append(UserQuestion.category_id.is_(None))
        if category_conditions:
            query = query.where(or_(*category_conditions))

    normalized_collection_ids = [value for value in (collection_ids or []) if value]
    if normalized_collection_ids:
        query = query.where(
            exists(
                select(1)
                .select_from(InterviewCollectionQuestion)
                .join(UserCollection, UserCollection.collection_id == InterviewCollectionQuestion.collection_id)
                .where(
                    InterviewCollectionQuestion.question_id == UserQuestion.question_id,
                    InterviewCollectionQuestion.collection_id.in_(normalized_collection_ids),
                    UserCollection.user_id == current_user.id,
                    UserCollection.removed_at.is_(None),
                    UserCollection.is_active.is_(True),
                )
            )
        )

    normalized_tag_ids = [value for value in (tag_ids or []) if value]
    if normalized_tag_ids:
        query = query.where(
            exists(
                select(1).where(
                    UserQuestionTagAssociation.user_question_id == UserQuestion.id,
                    UserQuestionTagAssociation.tag_id.in_(normalized_tag_ids),
                )
            )
        )

    if importance_scores:
        query = query.where(UserQuestion.importance_score.in_(importance_scores))

    normalized_frequencies = [value for value in (frequencies or []) if value]
    if normalized_frequencies:
        query = query.where(UserQuestion.frequency.in_(normalized_frequencies))

    normalized_question_ids = [value for value in (question_ids or []) if value]
    if normalized_question_ids:
        query = query.where(UserQuestion.question_id.in_(normalized_question_ids))

    if search and search.strip():
        query = query.where(InterviewQuestion.title.ilike(f"%{search.strip()}%"))

    # Calculate total matching count before pagination
    total_count = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0

    query = query.order_by(
        UserQuestion.saved_at.desc().nullslast(),
        UserQuestion.created_at.desc(),
        UserQuestion.id.desc(),
    )

    if limit > 0:
        query = query.offset(offset).limit(limit)

    user_questions = db.scalars(query).all()
    collection_ids = active_collection_ids_by_question(
        db,
        current_user.id,
        [uq.question_id for uq in user_questions],
    )
    items = [to_question_read(uq, current_user, collection_ids.get(uq.question_id, [])) for uq in user_questions]
    has_more = (offset + len(items)) < total_count if limit > 0 else False
    next_offset = (offset + len(items)) if has_more else None

    return {
        "items": items,
        "total": total_count,
        "has_more": has_more,
        "next_offset": next_offset,
    }


@router.get("/questions/search/global", response_model=list[InterviewQuestionRead])
def search_global_questions(
    q: str,
    sort: str = "hot",
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
    query = stmt.outerjoin(
        QuestionMetrics,
        QuestionMetrics.question_id == InterviewQuestion.id,
    )
    if sort == "newest":
        query = query.order_by(InterviewQuestion.created_at.desc())
    elif sort in {"hot", "week", "month", "season"}:
        config = get_question_recommendation_config(db)
        activity_at = func.coalesce(
            QuestionMetrics.updated_at,
            QuestionMetrics.last_aggregated_at,
            InterviewQuestion.created_at,
        )
        if sort == "week":
            window_days = config["weekly_window_days"]
            half_life_days = config["weekly_half_life_days"]
            window_start = datetime.now(timezone.utc) - timedelta(
                days=window_days,
            )
            query = query.where(
                or_(
                    InterviewQuestion.created_at >= window_start,
                    activity_at >= window_start,
                )
            )
        elif sort == "month":
            window_days = config["monthly_window_days"]
            half_life_days = config["monthly_half_life_days"]
            window_start = datetime.now(timezone.utc) - timedelta(
                days=window_days,
            )
            query = query.where(
                or_(
                    InterviewQuestion.created_at >= window_start,
                    activity_at >= window_start,
                )
            )
        elif sort == "season":
            window_days = config["seasonal_window_days"]
            half_life_days = config["seasonal_half_life_days"]
            window_start = datetime.now(timezone.utc) - timedelta(
                days=window_days,
            )
            query = query.where(
                or_(
                    InterviewQuestion.created_at >= window_start,
                    activity_at >= window_start,
                )
            )
        else:
            half_life_days = config["freshness_half_life_days"]
        age_days = func.extract(
            "epoch",
            func.now() - activity_at,
        ) / 86400.0
        ranking_score = (
            func.coalesce(QuestionMetrics.hot_score, config["base_score"])
            * func.exp(-age_days / half_life_days)
        )
        query = query.order_by(
            ranking_score.desc(),
            InterviewQuestion.created_at.desc(),
        )
    else:
        query = query.order_by(
            func.coalesce(QuestionMetrics.practice_count, 0).desc(),
            func.coalesce(QuestionMetrics.favorite_count, 0).desc(),
            InterviewQuestion.created_at.desc(),
        )
    questions = db.scalars(query.limit(result_limit * 4)).all()
    questions = dedupe_public_questions(questions, current_user, db, result_limit)
    return [to_public_question_read(question, current_user) for question in questions]


def _add_affinity(
    affinities: dict[UUID, float],
    key: UUID | None,
    weight: float,
) -> None:
    if key is not None:
        affinities[key] = affinities.get(key, 0.0) + weight


def _normalise_affinities(affinities: dict[UUID, float]) -> dict[UUID, float]:
    if not affinities:
        return {}
    maximum = max(affinities.values())
    if maximum <= 0:
        return {}
    return {key: value / maximum for key, value in affinities.items()}


def get_user_question_affinities(
    db: Session,
    current_user: User,
) -> tuple[dict[UUID, float], dict[UUID, float], dict[UUID, float]]:
    states = db.scalars(
        select(UserQuestion)
        .options(
            joinedload(UserQuestion.question)
            .joinedload(InterviewQuestion.category),
            joinedload(UserQuestion.question)
            .selectinload(InterviewQuestion.tags),
            joinedload(UserQuestion.question)
            .selectinload(InterviewQuestion.companies),
            selectinload(UserQuestion.tags),
        )
        .where(
            UserQuestion.user_id == current_user.id,
            or_(
                UserQuestion.is_saved.is_(True),
                UserQuestion.is_favorited.is_(True),
                UserQuestion.practice_count > 0,
            ),
        )
    ).all()

    category_affinities: dict[UUID, float] = {}
    tag_affinities: dict[UUID, float] = {}
    company_affinities: dict[UUID, float] = {}
    for state in states:
        question = state.question
        if not question or question.status != "published":
            continue
        signal = (
            1.0
            + math.log1p(state.practice_count) * 1.4
            + (1.5 if state.is_favorited else 0.0)
            + (0.5 if state.is_saved else 0.0)
        )
        _add_affinity(
            category_affinities,
            state.category_id or question.category_id,
            signal,
        )
        for tag in [*state.tags, *(question.tags or [])]:
            _add_affinity(tag_affinities, tag.id, signal)
        for company in question.companies or []:
            _add_affinity(company_affinities, company.id, signal)

    return (
        _normalise_affinities(category_affinities),
        _normalise_affinities(tag_affinities),
        _normalise_affinities(company_affinities),
    )


@router.get("/recommendations/for-you", response_model=list[InterviewQuestionRead])
def list_for_you_questions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    config = get_question_recommendation_config(db)
    candidate_limit = int(config["for_you_candidate_limit"])
    result_limit = int(config["for_you_result_limit"])
    category_affinities, tag_affinities, company_affinities = (
        get_user_question_affinities(db, current_user)
    )

    activity_at = func.coalesce(
        QuestionMetrics.updated_at,
        QuestionMetrics.last_aggregated_at,
        InterviewQuestion.created_at,
    )
    age_days = func.extract(
        "epoch",
        func.now() - activity_at,
    ) / 86400.0
    global_ranking_score = (
        func.coalesce(QuestionMetrics.hot_score, config["base_score"])
        * func.exp(-age_days / config["freshness_half_life_days"])
    )
    candidates = db.scalars(
        select(InterviewQuestion)
        .options(
            joinedload(InterviewQuestion.submitted_by),
            joinedload(InterviewQuestion.category),
            joinedload(InterviewQuestion.metrics),
            selectinload(InterviewQuestion.tags),
            selectinload(InterviewQuestion.companies),
        )
        .outerjoin(
            QuestionMetrics,
            QuestionMetrics.question_id == InterviewQuestion.id,
        )
        .where(
            InterviewQuestion.status == "published",
            InterviewQuestion.submitted_by_user_id != current_user.id,
        )
        .order_by(
            global_ranking_score.desc(),
            InterviewQuestion.created_at.desc(),
        )
        .limit(candidate_limit * 3)
    ).all()
    candidates = dedupe_public_questions(
        candidates,
        current_user,
        db,
        candidate_limit,
    )
    candidate_ids = [question.id for question in candidates]
    user_states = {
        state.question_id: state
        for state in db.scalars(
            select(UserQuestion)
            .options(
                joinedload(UserQuestion.question)
                .joinedload(InterviewQuestion.submitted_by),
                joinedload(UserQuestion.category),
                selectinload(UserQuestion.tags),
                joinedload(UserQuestion.question)
                .selectinload(InterviewQuestion.companies),
            )
            .where(
                UserQuestion.user_id == current_user.id,
                UserQuestion.question_id.in_(candidate_ids),
            )
        ).all()
    }

    ranked: list[tuple[float, str, InterviewQuestion, UserQuestion | None]] = []
    for question in candidates:
        state = user_states.get(question.id)
        category_match = category_affinities.get(question.category_id, 0.0)
        tag_matches = [
            tag_affinities.get(tag.id, 0.0)
            for tag in question.tags or []
        ]
        company_matches = [
            company_affinities.get(company.id, 0.0)
            for company in question.companies or []
        ]
        tag_match = max(tag_matches, default=0.0)
        company_match = max(company_matches, default=0.0)
        practice_count = state.practice_count if state else 0
        hot_score = float(question.metrics.hot_score) if question.metrics else config["base_score"]
        created_age_days = max(
            0.0,
            (datetime.now(timezone.utc) - question.created_at).total_seconds()
            / 86400.0,
        )
        freshness = math.exp(
            -created_age_days / config["for_you_freshness_half_life_days"]
        )
        score = (
            category_match * config["for_you_category_weight"]
            + tag_match * config["for_you_tag_weight"]
            + company_match * config["for_you_company_weight"]
            + (config["for_you_unseen_bonus"] if practice_count == 0 else 0.0)
            - math.log1p(practice_count) * config["for_you_practiced_penalty"]
            + math.log1p(hot_score) * config["for_you_hot_weight"]
            + freshness * config["for_you_freshness_weight"]
        )

        if category_match > 0:
            category_name = (
                question.category.display_name
                or question.category.name
                if question.category
                else "this topic"
            )
            reason = f"Because you practise {category_name}"
        elif tag_match > 0:
            matched_tag = next(
                (
                    tag.name
                    for tag in question.tags or []
                    if tag_affinities.get(tag.id, 0.0) == tag_match
                ),
                "your saved tags",
            )
            reason = f"Matches your {matched_tag} focus"
        elif company_match > 0:
            matched_company = next(
                (
                    company.name
                    for company in question.companies or []
                    if company_affinities.get(company.id, 0.0) == company_match
                ),
                "target companies",
            )
            reason = f"Relevant to {matched_company}"
        elif practice_count == 0:
            reason = "A strong next question to practise"
        else:
            reason = "Trending in the community"
        ranked.append((score, reason, question, state))

    ranked.sort(key=lambda item: item[0], reverse=True)
    responses = []
    for score, reason, question, state in ranked[:result_limit]:
        response = (
            to_question_read(state, current_user)
            if state
            else to_public_question_read(question, current_user)
        )
        response["recommendation_score"] = round(score, 3)
        response["recommendation_reason"] = reason
        responses.append(response)
    return responses


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
    refresh_question_metrics(db, question.id)
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
        refresh_question_metrics(db, question.id)
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

    refresh_question_metrics(db, question_id)
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

