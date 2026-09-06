import math
import re
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, object_session, selectinload

from services.shared.models import (
    InterviewCategory,
    InterviewCollectionQuestion,
    InterviewQuestion,
    InterviewReport,
    PracticeRecord,
    QuestionAnswer,
    QuestionComment,
    QuestionMetrics,
    QuestionRating,
    QuestionReaction,
    User,
    UserCollection,
    UserQuestion,
)
from services.shared.schemas import (
    InterviewCategoryRead,
    InterviewQuestionRead,
)
from services.shared.settings import get_settings

from .gamification import get_question_recommendation_config

SUPPORTED_AUDIO_CONTENT_TYPES = {"audio/webm", "audio/ogg", "audio/mp4"}


def _read_uploaded_audio(file: UploadFile) -> tuple[bytes, str]:
    raw_content_type = (file.content_type or "audio/webm").lower()
    content_type = raw_content_type.split(";", 1)[0].strip()
    if content_type not in SUPPORTED_AUDIO_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Use a WebM, OGG, or MP4 audio recording",
        )
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(content) > get_settings().audio_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Audio recording is too large")
    return content, content_type


def calculate_question_hot_score(
    metrics: QuestionMetrics,
    config: dict[str, float],
) -> float:
    quality_signals = [
        float(value)
        for value in (
            metrics.blended_importance_score,
            metrics.blended_frequency_score,
        )
        if value is not None
    ]
    quality_score = (
        sum(quality_signals) / len(quality_signals)
        if quality_signals
        else 0.0
    )
    score = (
        config["base_score"]
        + math.log1p(metrics.view_count) * config["view_weight"]
        + math.log1p(metrics.practice_count) * config["practice_weight"]
        + math.log1p(metrics.favorite_count) * config["favorite_weight"]
        + math.log1p(metrics.upvote_count) * config["upvote_weight"]
        - math.log1p(metrics.downvote_count) * config["downvote_weight"]
        + math.log1p(metrics.seen_in_interview_count) * config["interview_weight"]
        + math.log1p(metrics.company_count) * config["company_weight"]
        + math.log1p(metrics.comment_count) * config["comment_weight"]
        + quality_score * config["quality_weight"]
    )
    return round(max(0.0, score), 4)


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
        "hot_score": float(metrics_obj.hot_score) if metrics_obj else 1.0,
        "top_companies": metrics_obj.top_companies if metrics_obj else [],
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
        "category": category_to_read(user_q.category) if user_q.category else None,
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


def clean_category_name(value: str | None) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"^\s*\d+\s*[\.\)_:-]?\s*", "", value).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return category_metadata_for_name(cleaned)["display_name"]


SYSTEM_CATEGORY_DEFINITIONS = {
    "about you": {
        "slug": "about_you",
        "display_name": "About You",
        "icon_key": "user-round",
        "sort_order": 10,
    },
    "behaviour": {
        "slug": "behaviour",
        "display_name": "Behaviour",
        "icon_key": "message-circle",
        "sort_order": 20,
    },
    "behavior": {
        "slug": "behaviour",
        "display_name": "Behaviour",
        "icon_key": "message-circle",
        "sort_order": 20,
    },
    "experience": {
        "slug": "project",
        "display_name": "Project",
        "icon_key": "briefcase-business",
        "sort_order": 30,
    },
    "project": {
        "slug": "project",
        "display_name": "Project",
        "icon_key": "briefcase-business",
        "sort_order": 30,
    },
    "role specific": {
        "slug": "role_specific",
        "display_name": "Role-specific",
        "icon_key": "gem",
        "sort_order": 40,
    },
    "company": {
        "slug": "company",
        "display_name": "Company",
        "icon_key": "building-2",
        "sort_order": 50,
    },
}


def slugify_category(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")
    return slug or "custom"


def category_metadata_for_name(value: str | None) -> dict:
    cleaned = re.sub(r"^\s*\d+\s*[\.\)_:-]?\s*", "", value or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    normalized = cleaned.casefold().replace("_", " ").replace("-", " ")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    system_definition = SYSTEM_CATEGORY_DEFINITIONS.get(normalized)
    if system_definition:
        return {**system_definition, "is_system": True}
    display_name = cleaned or "General"
    return {
        "slug": slugify_category(display_name),
        "display_name": display_name,
        "icon_key": "folder",
        "sort_order": 100,
        "is_system": False,
    }


def category_to_read(category: InterviewCategory | None) -> dict | None:
    if not category:
        return None
    return {
        "id": category.id,
        "user_id": category.user_id,
        "name": category.display_name or clean_category_name(category.name),
        "slug": category.slug,
        "display_name": category.display_name or clean_category_name(category.name),
        "icon_key": category.icon_key,
        "sort_order": category.sort_order,
        "is_system": category.is_system,
        "question_count": getattr(category, "question_count", 0),
        "created_at": category.created_at,
        "updated_at": category.updated_at,
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
        "hot_score": float(metrics_obj.hot_score) if metrics_obj else 1.0,
        "top_companies": metrics_obj.top_companies if metrics_obj else [],
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
        "category": category_to_read(question.category),
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
            "title": "Contributor Reference Answer",
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
        company_name = report.company.strip() if report.company else "Anonymous Company"
        key = company_name.casefold()
        display, count = company_counts.get(key, (company_name, 0))
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
    metrics.hot_score = calculate_question_hot_score(
        metrics,
        get_question_recommendation_config(db),
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

