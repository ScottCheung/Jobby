import json
import math
import re
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from services.api.dependencies import get_or_create_current_user
from services.shared.database import SessionLocal, get_db
from services.shared.deepseek import (
    DeepSeekError,
    generate_question_metadata,
    generate_reference_answer,
    sanitize_ai_output,
)
from services.shared.models import (
    Company,
    GamificationTransaction,
    InterviewCategory,
    InterviewQuestion,
    InterviewReport,
    InterviewTag,
    QuestionAnswer,
    QuestionAnswerComment,
    QuestionAnswerCommentLike,
    QuestionAnswerCommentReport,
    QuestionAnswerReaction,
    QuestionAnswerReport,
    QuestionAnswerSave,
    QuestionAnswerUnlock,
    QuestionComment,
    QuestionCommentLike,
    QuestionCommentReport,
    QuestionInterviewReportSummary,
    QuestionMetrics,
    QuestionRating,
    QuestionReaction,
    User,
    UserCollection,
    UserNotification,
    UserQuestion,
)
from services.shared.realtime import broadcast_sync
from services.shared.schemas import (
    AnswerUnlockRead,
    CommunityInterviewReportRead,
    InterviewReportBase,
    InterviewReportRead,
    InterviewQuestionRead,
    QuestionAnswerCommentCreate,
    QuestionAnswerCommentPageRead,
    QuestionAnswerCommentRead,
    QuestionAnswerCommentReportCreate,
    QuestionAnswerCommentUpdate,
    QuestionAnswerCreate,
    QuestionAnswerRead,
    QuestionAnswerReactionUpdate,
    QuestionAnswerSaveRead,
    QuestionAnswerUpdate,
    QuestionCommentCreate,
    QuestionCommentLikeRead,
    QuestionCommentPageRead,
    QuestionCommentRead,
    QuestionCommentReportCreate,
    QuestionCommentUpdate,
    QuestionCommunitySummaryRead,
    QuestionRatingUpdate,
    QuestionReactionUpdate,
    UserNotificationRead,
)
from services.shared.settings import get_settings

from .gamification import (
    _spend_coins,
    add_economy_transactions,
    get_gamification_config,
    get_or_create_gamification,
    grant_question_survey_reward,
)
from .helpers import (
    ensure_user_question_state,
    refresh_question_metrics,
    to_question_read,
)
from .questions import (
    apply_ai_question_metadata,
    sync_question_metadata_from_ai_answer,
)

router = APIRouter(tags=["Community"])

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
                user_id=current_user.id,
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
            user_id=current_user.id,
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
            company_name = report.company.strip() if report.company else "Anonymous Company"
            key = company_name.casefold()
            display, count = company_counts.get(key, (company_name, 0))
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
    if payload.seen_in_interview and payload.company:
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

    if kind == "question_feedback":
        title = f"{actor.display_name} submitted feedback on your question"
        message = f"Feedback: {excerpt}"
        action_url = f"/interview-prep/practice/{question_id}?mode=free&shuffle=0&tab=comment"
    elif kind == "question_comment":
        title = f"{actor.display_name} commented on your question"
        message = f"Comment: {excerpt}"
        action_url = f"/interview-prep/practice/{question_id}?mode=free&tab=comment"
    elif kind == "comment_reply":
        title = f"{actor.display_name} replied to your comment"
        message = f"Your comment: {parent_excerpt}\nReply: {excerpt}"
        action_url = f"/interview-prep/practice/{question_id}?mode=free&tab=comment"
    else:
        title = f"{actor.display_name} liked your comment"
        message = f"Your comment: {excerpt}"
        action_url = f"/interview-prep/practice/{question_id}?mode=free&tab=comment"

    notification = UserNotification(
        user_id=recipient_id,
        actor_user_id=actor.id,
        question_id=question_id,
        kind=kind,
        action_url=action_url,
        title=title,
        message=message,
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
    reply = aliased(QuestionComment)
    reply_count = (
        select(func.count(reply.id))
        .where(
            reply.parent_id == QuestionComment.id,
            reply.deleted_at.is_(None),
        )
        .correlate(QuestionComment)
        .scalar_subquery()
    )
    interaction_score = like_count * 2 + reply_count * 5
    age_hours = func.extract("epoch", func.now() - QuestionComment.created_at) / 3600.0
    hot_score = interaction_score / (1 + age_hours / 24.0)
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
        query.order_by(
            hot_score.desc(),
            QuestionComment.created_at.desc(),
            QuestionComment.id.desc(),
        ).limit(limit + 1)
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

    question = db.get(InterviewQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

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

    notifications: list[UserNotification] = []
    if parent and parent.user_id != current_user.id:
        n = create_comment_notification(
            db,
            recipient_id=parent.user_id,
            actor=current_user,
            question_id=question_id,
            comment_id=c.id,
            kind="comment_reply",
            comment_body=c.body,
            parent_body=parent.body,
        )
        notifications.append(n)

    # Notify question author/uploader if feedback or top-level comment (and not authored by self)
    author_id = question.submitted_by_user_id
    if author_id and author_id != current_user.id and (not parent or parent.user_id != author_id):
        notif_kind = "question_feedback" if payload.kind == "feedback" else "question_comment"
        n = create_comment_notification(
            db,
            recipient_id=author_id,
            actor=current_user,
            question_id=question_id,
            comment_id=c.id,
            kind=notif_kind,
            comment_body=c.body,
        )
        notifications.append(n)

    refresh_question_metrics(db, question_id)
    db.commit()
    db.refresh(c)

    for n in notifications:
        db.refresh(n)
        broadcast_notification(n)

    broadcast_comment_event("comment.created", question_id, c.id, actor_user_id=str(current_user.id))
    return to_comment_read(
        c,
        current_user.id,
        db,
        question_author_id=question.submitted_by_user_id,
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
