import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from services.api.routers.resumes import _default_career_profile
from services.shared.database import SessionLocal
from services.shared.job_review import review_job
from services.shared.models import (
    JobApplication,
    JobHuntingProfile,
    MasterResume,
    TailoredResume,
    User,
)
from services.shared.realtime import broadcast_sync
from services.shared.time_utils import utc_now

logger = logging.getLogger(__name__)

def _apply_tailored_resume_result(tailored_resume: TailoredResume, result: dict) -> None:
    tailored_resume.resume_data = result.get("resume_data") or {}
    tailored_resume.raw_ai_response = result.get("raw_ai_response") or {}
    tailored_resume.core_competencies = result.get("core_competencies") or result.get("key_qualifications") or []
    tailored_resume.key_qualifications = result.get("key_qualifications") or []
    tailored_resume.targeted_projects = result.get("targeted_projects") or []
    tailored_resume.status = "ready"
    tailored_resume.error_message = None


def _run_tailored_resume_generation(
    tailored_resume: TailoredResume,
    application: JobApplication,
    *,
    mock: bool = False,
) -> dict:
    job = {
        "job_description": tailored_resume.job_description,
        "title": tailored_resume.job_title,
        "company": tailored_resume.company,
        "date_posted": application.last_posted_at,
    }
    return review_job(
        job,
        dict(tailored_resume.source_resume_data or {}),
        mock=mock,
        correlation_id=str(tailored_resume.id),
    )


def start_tailored_resume_generation(
    db: Session,
    current_user: User,
    application: JobApplication,
) -> tuple[TailoredResume, bool]:
    """Persist a generation before work starts and report whether it should be scheduled."""
    existing = db.scalar(
        select(TailoredResume)
        .where(TailoredResume.job_application_id == application.id)
        .with_for_update()
    )
    if existing:
        if existing.status == "failed":
            existing.status = "processing"
            existing.error_message = None
            existing.updated_at = utc_now()
            db.commit()
            db.refresh(existing)
            return existing, True
        return existing, False

    career_profile = _default_career_profile(db, current_user)
    description = str(application.job_description or "").strip() or f"Application for {application.title or 'Role'} at {application.company or 'Company'}"
    tailored_resume = TailoredResume(
        user_id=current_user.id,
        career_profile_id=career_profile.id,
        job_application_id=application.id,
        job_title=application.title,
        company=application.company,
        job_description=description,
        source_resume_data=dict((career_profile.extra_data or {}).get("resume_data") or {}),
        resume_data={},
        raw_ai_response={},
        core_competencies=[],
        key_qualifications=[],
        targeted_projects=[],
        status="processing",
    )
    db.add(tailored_resume)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        concurrent = db.scalar(
            select(TailoredResume).where(TailoredResume.job_application_id == application.id)
        )
        if concurrent:
            return concurrent, False
        raise
    db.refresh(tailored_resume)
    return tailored_resume, True


def process_tailored_resume(tailored_resume_id: UUID, *, mock: bool = False) -> None:
    """Complete a persisted tailored resume generation outside the request lifecycle."""
    session_factory = SessionLocal
    db = session_factory()
    try:
        tailored_resume = db.get(TailoredResume, tailored_resume_id)
        if not tailored_resume or tailored_resume.status != "processing":
            return
        application = db.get(JobApplication, tailored_resume.job_application_id)
        if not application:
            raise RuntimeError("Application not found")

        generator = _run_tailored_resume_generation
        result = generator(tailored_resume, application, mock=mock)
        db.refresh(tailored_resume)
        if tailored_resume.status != "processing":
            return
        _apply_tailored_resume_result(tailored_resume, result)
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
    except Exception:
        logger.exception("Tailored resume generation failed tailored_resume_id=%s", tailored_resume_id)
        db.rollback()
        tailored_resume = db.get(TailoredResume, tailored_resume_id)
        if tailored_resume and tailored_resume.status == "processing":
            tailored_resume.status = "failed"
            tailored_resume.error_message = "AI resume generation could not be completed."
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
    finally:
        db.close()


def create_tailored_resume_for_application(
    db: Session,
    current_user: User,
    application: JobApplication,
    *,
    mock: bool = False,
) -> TailoredResume | None:
    """Synchronously generate for worker flows that require the result immediately."""
    try:
        tailored_resume, should_generate = start_tailored_resume_generation(db, current_user, application)
        if not should_generate:
            return tailored_resume
        result = _run_tailored_resume_generation(tailored_resume, application, mock=mock)
        _apply_tailored_resume_result(tailored_resume, result)
        db.commit()
        db.refresh(tailored_resume)
        return tailored_resume
    except Exception:
        logger.exception("Failed to create tailored resume for application_id=%s", application.id)
        db.rollback()
        tailored_resume = db.scalar(
            select(TailoredResume).where(TailoredResume.job_application_id == application.id)
        )
        if tailored_resume and tailored_resume.status == "processing":
            tailored_resume.status = "failed"
            tailored_resume.error_message = "AI resume generation could not be completed."
            db.commit()
        return None




def _get_user_active_resume_data(db: Session, current_user: User) -> dict[str, Any] | None:
    job_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.updated_at.desc())
        .limit(1)
    )
    if job_profile and isinstance(job_profile.extra_data, dict):
        resume_data = job_profile.extra_data.get("resume_data")
        if isinstance(resume_data, dict) and resume_data:
            return resume_data

    any_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id)
        .order_by(JobHuntingProfile.updated_at.desc())
        .limit(1)
    )
    if any_profile and isinstance(any_profile.extra_data, dict):
        resume_data = any_profile.extra_data.get("resume_data")
        if isinstance(resume_data, dict) and resume_data:
            return resume_data

    master_resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if master_resume and isinstance(master_resume.resume_data, dict) and master_resume.resume_data:
        return master_resume.resume_data

    return None
