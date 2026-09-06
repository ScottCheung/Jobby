import math
import random
import re
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.orm import Session, joinedload, selectinload

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.media import MediaError, optimize_image_to_webp
from services.shared.models import (
    CollectionContributor,
    InterviewCategory,
    InterviewCollection,
    InterviewCollectionQuestion,
    InterviewQuestion,
    InterviewTag,
    User,
    UserCollection,
    UserQuestion,
)
from services.shared.schemas import (
    InterviewCollectionCreate,
    InterviewCollectionRead,
    InterviewCollectionUpdate,
)
from services.shared.settings import get_settings
from services.shared.storage import StorageError, get_object_storage

from .gamification import add_economy_transactions, get_or_create_gamification
from .helpers import to_question_read

router = APIRouter(tags=["Collections"])

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
        "theme": "Project",
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
        "created_at": collection.created_at,
        "updated_at": collection.updated_at,
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


@router.post("/explore/visit")
def record_explore_visit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    previous_login_at = current_user.last_login_at
    current_user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return {"last_login_at": previous_login_at}


@router.get("/collections", response_model=list[InterviewCollectionRead])
def list_collections(
    kind: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    ensure_collection_seeds(db)
    legacy_theme_update = db.execute(
        update(InterviewCollection)
        .where(func.lower(InterviewCollection.theme) == "experience")
        .values(theme="Project")
    )
    if legacy_theme_update.rowcount:
        db.commit()
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

