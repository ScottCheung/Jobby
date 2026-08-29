from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.jobs import upsert_job
from services.shared.models import JobRecommendation, User
from services.shared.schemas import (
    JobRecommendationCreate,
    JobRecommendationRead,
    JobRecommendationUpdate,
)


router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def serialize(recommendation: JobRecommendation) -> dict:
    job = recommendation.job
    return {
        "id": recommendation.id,
        "job_id": job.external_id,
        "platform": job.platform,
        "title": job.title,
        "company": job.company,
        "work_location": job.location,
        "work_style": recommendation.work_style,
        "job_link": job.url,
        "match_score": recommendation.match_score,
        "recommendation_reason": recommendation.recommendation_reason,
        "status": recommendation.status,
        "created_at": recommendation.created_at,
        "updated_at": recommendation.updated_at,
    }


@router.get("", response_model=list[JobRecommendationRead])
def list_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    rows = list(
        db.scalars(
            select(JobRecommendation)
            .options(selectinload(JobRecommendation.job))
            .where(
                JobRecommendation.user_id == current_user.id,
                JobRecommendation.status == "recommended",
            )
            .order_by(JobRecommendation.match_score.desc(), JobRecommendation.created_at.desc())
        )
    )
    return [serialize(row) for row in rows]


@router.post("/batch", response_model=list[JobRecommendationRead], status_code=status.HTTP_201_CREATED)
def import_recommendations(
    payload: list[JobRecommendationCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    imported: list[JobRecommendation] = []
    for item in payload:
        values = item.model_dump()
        job = upsert_job(
            db,
            extracted_snapshot={
                "platform": values["platform"],
                "external_id": values["job_id"],
                "title": values["title"],
                "company": values["company"],
                "location": values["work_location"],
                "url": values["job_link"],
            },
            user_id=current_user.id,
            source="recommendations_import",
        ).job
        recommendation = db.scalar(
            select(JobRecommendation)
            .options(selectinload(JobRecommendation.job))
            .where(JobRecommendation.user_id == current_user.id, JobRecommendation.job_id == job.id)
        )
        if recommendation is None:
            recommendation = JobRecommendation(
                user_id=current_user.id,
                job=job,
                match_score=values["match_score"],
                recommendation_reason=values["recommendation_reason"],
                work_style=values["work_style"],
            )
            db.add(recommendation)
        elif recommendation.status == "recommended":
            recommendation.match_score = values["match_score"]
            recommendation.recommendation_reason = values["recommendation_reason"]
            recommendation.work_style = values["work_style"]
        imported.append(recommendation)
    db.commit()
    for row in imported:
        db.refresh(row)
        db.refresh(row.job)
    return [serialize(row) for row in imported]


@router.put("/{recommendation_id}", response_model=JobRecommendationRead)
def update_recommendation(
    recommendation_id: UUID,
    payload: JobRecommendationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    if payload.status not in {"recommended", "dismissed", "started"}:
        raise HTTPException(status_code=422, detail="Unsupported recommendation status")
    recommendation = db.scalar(
        select(JobRecommendation)
        .options(selectinload(JobRecommendation.job))
        .where(JobRecommendation.id == recommendation_id, JobRecommendation.user_id == current_user.id)
    )
    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    recommendation.status = payload.status
    db.commit()
    db.refresh(recommendation)
    return serialize(recommendation)
