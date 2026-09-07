import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.api.routers.resumes import (
    _default_career_profile,
    _default_career_profile_resume,
    tailored_resume_response,
)
from services.shared.database import get_db
from services.shared.deepseek import DeepSeekError
from services.shared.job_review import build_tailor_messages, review_job
from services.shared.jobs import upsert_job
from services.shared.models import JobApplication, TailoredResume, User
from services.shared.realtime import broadcast_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-review", tags=["job_review"])


@router.post("/preview")
def preview_job_review(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    description = str(payload.get("job_description") or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="A job description is required")
    doc_type = str(payload.get("doc_type") or "resume").strip().lower()
    resume = _default_career_profile_resume(db, current_user)
    job = {"job_description": description}
    return {"messages": build_tailor_messages(job, resume, doc_type=doc_type)}


@router.post("")
def review_job_from_jd(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    """Evaluate pasted, already-captured JD text without creating an application."""
    description = str(payload.get("job_description") or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="A job description is required")
    career_profile = _default_career_profile(db, current_user)
    profile_resume = dict((career_profile.extra_data or {}).get("resume_data") or {})
    doc_type = str(payload.get("doc_type") or "resume").strip().lower()
    job = {
        "job_description": description,
        "title": str(payload.get("title") or "").strip() or None,
        "company": str(payload.get("company") or "").strip() or None,
        "last_posted_at": payload.get("last_posted_at"),
    }
    mock = bool(payload.get("mock"))
    generation_id = str(payload.get("generation_id") or uuid4())

    def _job_key(value: str | None) -> str:
        return " ".join((value or "").casefold().split())

    tailored_resume = None
    if payload.get("tailored_resume_id"):
        try:
            target_id = UUID(str(payload["tailored_resume_id"]))
            target = db.get(TailoredResume, target_id)
            if target and target.user_id == current_user.id:
                tailored_resume = target
        except Exception:
            tailored_resume = None

    if tailored_resume is None:
        existing_records = db.scalars(
            select(TailoredResume)
            .where(TailoredResume.user_id == current_user.id)
            .order_by(TailoredResume.updated_at.desc())
        ).all()
        tailored_resume = next(
            (
                record
                for record in existing_records
                if _job_key(record.job_title) == _job_key(job["title"])
                and _job_key(record.company) == _job_key(job["company"])
                and _job_key(record.job_description) == _job_key(description)
            ),
            None,
        )

    if tailored_resume and tailored_resume.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This job already has a document generation in progress.",
        )

    if tailored_resume is None:
        job_record = upsert_job(
            db,
            extracted_snapshot=job,
            user_id=current_user.id,
            source="job_review",
        ).job
        application = JobApplication(
            user_id=current_user.id,
            job=job_record,
            status="draft",
            raw_data={"pipeline_stage": "draft", "created_from": "job_review"},
        )
        db.add(application)
        db.flush()
        tailored_resume = TailoredResume(
            user_id=current_user.id,
            career_profile_id=career_profile.id,
            job_application_id=application.id,
            job_title=job["title"],
            company=job["company"],
            job_description=description,
            source_resume_data=profile_resume,
            resume_data={},
            raw_ai_response={
                "generation_id": generation_id,
                "generation_doc_type": doc_type,
            },
            core_competencies=[],
            key_qualifications=[],
            targeted_projects=[],
            status="processing",
        )
        db.add(tailored_resume)
    else:
        tailored_resume.status = "processing"
        tailored_resume.error_message = None
        tailored_resume.raw_ai_response = {
            **(tailored_resume.raw_ai_response or {}),
            "generation_id": generation_id,
            "generation_doc_type": doc_type,
        }
    db.commit()
    db.refresh(tailored_resume)

    try:
        result = review_job(
            job,
            profile_resume,
            doc_type=doc_type,
            mock=mock,
            correlation_id=generation_id,
        )
    except DeepSeekError as exc:
        logger.exception("Job review failed for pasted JD")
        db.rollback()
        tailored_resume = db.get(TailoredResume, tailored_resume.id)
        if tailored_resume and tailored_resume.status == "processing":
            tailored_resume.status = "failed"
            tailored_resume.error_message = "AI tailoring is temporarily unavailable. Please try again shortly."
            db.commit()
            broadcast_sync(
                "tailored_resume.processed",
                {
                    "id": str(tailored_resume.id),
                    "application_id": str(tailored_resume.job_application_id),
                    "status": "failed",
                    "detail": tailored_resume.error_message,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI tailoring is temporarily unavailable. Please try again shortly.",
        ) from exc
    except Exception as exc:
        logger.exception("Job review failed for pasted JD")
        db.rollback()
        tailored_resume = db.get(TailoredResume, tailored_resume.id)
        if tailored_resume and tailored_resume.status == "processing":
            tailored_resume.status = "failed"
            tailored_resume.error_message = "Tailored document generation could not be completed."
            db.commit()
            broadcast_sync(
                "tailored_resume.processed",
                {
                    "id": str(tailored_resume.id),
                    "application_id": str(tailored_resume.job_application_id),
                    "status": "failed",
                    "detail": tailored_resume.error_message,
                },
            )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    if doc_type != "cover_letter":
        tailored_resume.resume_data = result.get("resume_data") or tailored_resume.resume_data
        tailored_resume.core_competencies = result.get("core_competencies") or result.get("key_qualifications") or []
        tailored_resume.key_qualifications = result.get("key_qualifications") or []
        tailored_resume.targeted_projects = result.get("targeted_projects") or []

    raw_ai_resp = dict(result.get("raw_ai_response") or {})
    previous_raw_ai_resp = dict(tailored_resume.raw_ai_response or {})
    previous_raw_ai_resp.pop("generation_id", None)
    previous_raw_ai_resp.pop("generation_doc_type", None)
    if previous_raw_ai_resp.get("cover_letter") and not result.get("cover_letter"):
        raw_ai_resp["cover_letter"] = previous_raw_ai_resp["cover_letter"]
    if result.get("cover_letter"):
        raw_ai_resp["cover_letter"] = result.get("cover_letter")
    generated_documents = dict(previous_raw_ai_resp.get("generated_documents") or {})
    if doc_type in {"resume", "both"}:
        generated_documents["resume"] = True
    if doc_type in {"cover_letter", "both"}:
        generated_documents["cover_letter"] = True
    raw_ai_resp["generated_documents"] = generated_documents
    tailored_resume.raw_ai_response = raw_ai_resp
    tailored_resume.status = "ready"
    tailored_resume.error_message = None
    db.commit()
    db.refresh(tailored_resume)
    broadcast_sync(
        "tailored_resume.processed",
        {
            "id": str(tailored_resume.id),
            "application_id": str(tailored_resume.job_application_id),
            "status": "ready",
        },
    )
    tailored_dict = tailored_resume_response(tailored_resume)
    combined_cover_letter = raw_ai_resp.get("cover_letter")
    if combined_cover_letter:
        tailored_dict["cover_letter"] = combined_cover_letter
        result["cover_letter"] = combined_cover_letter
    result["tailored_resume"] = tailored_dict
    return result
