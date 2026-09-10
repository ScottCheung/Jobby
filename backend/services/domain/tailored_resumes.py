import logging
from typing import Any, Callable
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from services.domain.errors import (
    DomainError,
    TailoredResumeGenerationFailed,
    TailoredResumeGenerationInProgress,
    TailoredResumeGenerationUnavailable,
)
from services.domain.master_resumes import _default_career_profile
from services.shared.database import SessionLocal
from services.shared.deepseek import DeepSeekError
from services.shared.job_review import normalize_output_language, review_job
from services.shared.jobs import upsert_job
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


def _run_tailored_resume_generation(
    tailored_resume: TailoredResume,
    application: JobApplication,
    *,
    doc_type: str = "resume",
    mock: bool = False,
    correlation_id: str | None = None,
    output_language: str | None = None,
    resume_data: dict[str, Any] | None = None,
    reviewer: Callable[..., dict] | None = None,
) -> dict:
    output_language = normalize_output_language(
        output_language
        if output_language is not None
        else (tailored_resume.raw_ai_response or {}).get("output_language")
    )
    job = {
        "job_description": tailored_resume.job_description,
        "title": tailored_resume.job_title,
        "company": tailored_resume.company,
        "date_posted": application.last_posted_at,
        "output_language": output_language,
    }
    return (reviewer or review_job)(
        job,
        dict(resume_data if resume_data is not None else tailored_resume.source_resume_data or {}),
        doc_type=doc_type,
        mock=mock,
        correlation_id=correlation_id or str(tailored_resume.id),
        user_id=tailored_resume.user_id,
        output_language=output_language,
    )


def _persist_tailored_resume_result(
    tailored_resume: TailoredResume,
    result: dict,
    *,
    doc_type: str = "resume",
    generation_id: str | None = None,
) -> None:
    if not generation_id:
        tailored_resume.resume_data = result.get("resume_data") or {}
        tailored_resume.raw_ai_response = result.get("raw_ai_response") or {}
        if result.get("output_language"):
            tailored_resume.raw_ai_response["output_language"] = result["output_language"]
        tailored_resume.core_competencies = result.get("core_competencies") or result.get("key_qualifications") or []
        tailored_resume.key_qualifications = result.get("key_qualifications") or []
        tailored_resume.targeted_projects = result.get("targeted_projects") or []
        tailored_resume.status = "ready"
        tailored_resume.error_message = None
        return

    previous_raw_ai_response = dict(tailored_resume.raw_ai_response or {})
    if doc_type != "cover_letter":
        tailored_resume.resume_data = result.get("resume_data") or tailored_resume.resume_data
        tailored_resume.core_competencies = result.get("core_competencies") or result.get("key_qualifications") or []
        tailored_resume.key_qualifications = result.get("key_qualifications") or []
        tailored_resume.targeted_projects = result.get("targeted_projects") or []

    raw_ai_response = dict(result.get("raw_ai_response") or {})
    if result.get("output_language"):
        raw_ai_response["output_language"] = result["output_language"]
    previous_raw_ai_response.pop("generation_id", None)
    previous_raw_ai_response.pop("generation_doc_type", None)
    if previous_raw_ai_response.get("cover_letter") and not result.get("cover_letter"):
        raw_ai_response["cover_letter"] = previous_raw_ai_response["cover_letter"]
    if result.get("cover_letter"):
        raw_ai_response["cover_letter"] = result["cover_letter"]

    generated_documents = dict(previous_raw_ai_response.get("generated_documents") or {})
    if doc_type in {"resume", "both"}:
        generated_documents["resume"] = True
    if doc_type in {"cover_letter", "both"}:
        generated_documents["cover_letter"] = True
    raw_ai_response["generated_documents"] = generated_documents

    generation_ids = [
        str(gid) for gid in (previous_raw_ai_response.get("generation_ids") or []) if gid
    ]
    prev_gen_id = previous_raw_ai_response.get("generation_id")
    if prev_gen_id and str(prev_gen_id) not in generation_ids:
        generation_ids.append(str(prev_gen_id))
    if generation_id and str(generation_id) not in generation_ids:
        generation_ids.append(str(generation_id))
    raw_ai_response["generation_ids"] = generation_ids

    if generation_id:
        raw_ai_response["generation_id"] = generation_id
        raw_ai_response["generation_doc_type"] = doc_type
    tailored_resume.raw_ai_response = raw_ai_response
    tailored_resume.status = "ready"
    tailored_resume.error_message = None


def _broadcast_tailored_resume_status(
    tailored_resume: TailoredResume,
    status: str,
    detail: str | None = None,
    broadcaster: Callable[..., Any] | None = None,
) -> None:
    payload = {
        "id": str(tailored_resume.id),
        "application_id": str(tailored_resume.job_application_id),
        "status": status,
    }
    if detail:
        payload["detail"] = detail
    (broadcaster or broadcast_sync)("tailored_resume.processed", payload)


def _mark_tailored_resume_failed(
    db: Session,
    tailored_resume_id: UUID,
    detail: str,
    broadcaster: Callable[..., Any] | None = None,
) -> TailoredResume | None:
    db.rollback()
    tailored_resume = db.get(TailoredResume, tailored_resume_id)
    if not tailored_resume or tailored_resume.status != "processing":
        return tailored_resume
    tailored_resume.status = "failed"
    tailored_resume.error_message = detail
    db.commit()
    _broadcast_tailored_resume_status(tailored_resume, "failed", detail, broadcaster)
    return tailored_resume


def _generation_error(exc: Exception) -> DomainError:
    if isinstance(exc, DeepSeekError):
        return TailoredResumeGenerationUnavailable(
            "AI tailoring is temporarily unavailable. Please try again shortly."
        )
    return TailoredResumeGenerationFailed(
        str(exc) or "Tailored document generation could not be completed."
    )


def _job_key(value: str | None) -> str:
    return " ".join((value or "").casefold().split())


def _find_job_review_tailored_resume(
    db: Session,
    current_user: User,
    job: dict[str, Any],
    tailored_resume_id: UUID | str | None,
) -> TailoredResume | None:
    description = str(job.get("job_description") or "").strip()
    if tailored_resume_id:
        try:
            target_id = UUID(str(tailored_resume_id))
        except (TypeError, ValueError):
            target_id = None
        if target_id:
            target = db.get(TailoredResume, target_id)
            if target and target.user_id == current_user.id:
                same_job = (
                    _job_key(target.job_title) == _job_key(job.get("title"))
                    and _job_key(target.company) == _job_key(job.get("company"))
                    and _job_key(target.job_description) == _job_key(description)
                )
                if same_job:
                    return target

    records = db.scalars(
        select(TailoredResume)
        .where(TailoredResume.user_id == current_user.id)
        .order_by(TailoredResume.updated_at.desc())
    ).all()
    return next(
        (
            record
            for record in records
            if _job_key(record.job_title) == _job_key(job.get("title"))
            and _job_key(record.company) == _job_key(job.get("company"))
            and _job_key(record.job_description) == _job_key(description)
        ),
        None,
    )


def generate_tailored_document(
    db: Session,
    current_user: User,
    *,
    job: dict[str, Any],
    doc_type: str = "resume",
    generation_id: str | None = None,
    tailored_resume_id: UUID | str | None = None,
    mock: bool = False,
    output_language: str | None = None,
    career_profile_provider: Callable[[Session, User], JobHuntingProfile] | None = None,
    reviewer: Callable[..., dict] | None = None,
    broadcaster: Callable[..., Any] | None = None,
) -> tuple[dict, TailoredResume]:
    """Create or reuse a tailored document and run its complete generation lifecycle."""
    career_profile = (career_profile_provider or _default_career_profile)(db, current_user)
    profile_resume = dict((career_profile.extra_data or {}).get("resume_data") or {})
    generation_id = generation_id or str(uuid4())
    output_language = normalize_output_language(
        output_language if output_language is not None else job.get("output_language")
    )
    job = {**job, "output_language": output_language}
    broadcaster = broadcaster or broadcast_sync
    tailored_resume = _find_job_review_tailored_resume(
        db,
        current_user,
        job,
        tailored_resume_id,
    )

    if tailored_resume and tailored_resume.status == "processing":
        raise TailoredResumeGenerationInProgress(
            "This job already has a document generation in progress."
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
            job_title=job.get("title"),
            company=job.get("company"),
            job_description=str(job.get("job_description") or "").strip(),
            source_resume_data=profile_resume,
            resume_data={},
            raw_ai_response={
                "generation_id": generation_id,
                "generation_doc_type": doc_type,
                "output_language": output_language,
            },
            core_competencies=[],
            key_qualifications=[],
            targeted_projects=[],
            status="processing",
        )
        db.add(tailored_resume)
    else:
        application = db.get(JobApplication, tailored_resume.job_application_id)
        if not application:
            raise TailoredResumeGenerationFailed("Application not found")
        tailored_resume.status = "processing"
        tailored_resume.error_message = None
        tailored_resume.raw_ai_response = {
            **(tailored_resume.raw_ai_response or {}),
            "generation_id": generation_id,
            "generation_doc_type": doc_type,
            "output_language": output_language,
        }

    db.commit()
    db.refresh(tailored_resume)

    try:
        result = _run_tailored_resume_generation(
            tailored_resume,
            application,
            doc_type=doc_type,
            mock=mock,
            correlation_id=generation_id,
            output_language=output_language,
            resume_data=profile_resume,
            reviewer=reviewer,
        )
    except Exception as exc:
        error = _generation_error(exc)
        logger.exception("Job review failed tailored_resume_id=%s", tailored_resume.id)
        _mark_tailored_resume_failed(db, tailored_resume.id, str(error), broadcaster)
        raise error from exc

    db.refresh(tailored_resume)
    if tailored_resume.status != "processing":
        return result, tailored_resume
    _persist_tailored_resume_result(
        tailored_resume,
        result,
        doc_type=doc_type,
        generation_id=generation_id,
    )
    db.commit()
    db.refresh(tailored_resume)
    _broadcast_tailored_resume_status(tailored_resume, "ready", broadcaster=broadcaster)
    return result, tailored_resume


def _run_persisted_tailored_resume_generation(
    db: Session,
    tailored_resume: TailoredResume,
    application: JobApplication,
    *,
    mock: bool = False,
) -> None:
    result = _run_tailored_resume_generation(tailored_resume, application, mock=mock)
    db.refresh(tailored_resume)
    if tailored_resume.status != "processing":
        return
    _persist_tailored_resume_result(tailored_resume, result)
    db.commit()
    db.refresh(tailored_resume)


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
    db = SessionLocal()
    try:
        tailored_resume = db.get(TailoredResume, tailored_resume_id)
        if not tailored_resume or tailored_resume.status != "processing":
            return
        application = db.get(JobApplication, tailored_resume.job_application_id)
        if not application:
            raise RuntimeError("Application not found")
        _run_persisted_tailored_resume_generation(
            db,
            tailored_resume,
            application,
            mock=mock,
        )
        if tailored_resume.status == "ready":
            _broadcast_tailored_resume_status(tailored_resume, "ready")
    except Exception:
        logger.exception("Tailored resume generation failed tailored_resume_id=%s", tailored_resume_id)
        _mark_tailored_resume_failed(
            db,
            tailored_resume_id,
            "AI resume generation could not be completed.",
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
    tailored_resume: TailoredResume | None = None
    try:
        tailored_resume, should_generate = start_tailored_resume_generation(db, current_user, application)
        if not should_generate:
            return tailored_resume
        _run_persisted_tailored_resume_generation(
            db,
            tailored_resume,
            application,
            mock=mock,
        )
        return tailored_resume
    except Exception:
        logger.exception("Failed to create tailored resume for application_id=%s", application.id)
        if tailored_resume:
            _mark_tailored_resume_failed(
                db,
                tailored_resume.id,
                "AI resume generation could not be completed.",
            )
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
