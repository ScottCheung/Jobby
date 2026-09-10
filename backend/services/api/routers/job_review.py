from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.api.routers.resumes import tailored_resume_response
from services.domain.errors import (
    CareerProfileNotReady,
    TailoredResumeGenerationFailed,
    TailoredResumeGenerationInProgress,
    TailoredResumeGenerationUnavailable,
)
from services.domain.master_resumes import _default_career_profile, _default_career_profile_resume
from services.domain.tailored_resumes import generate_tailored_document
from services.shared.database import get_db
from services.shared.job_review import (
    build_tailor_messages,
    normalize_output_language,
    review_job,
)
from services.shared.models import User
from services.shared.realtime import broadcast_sync

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
    output_language = normalize_output_language(payload.get("output_language"))
    try:
        resume = _default_career_profile_resume(db, current_user)
    except CareerProfileNotReady as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    job = {"job_description": description, "output_language": output_language}
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
    doc_type = str(payload.get("doc_type") or "resume").strip().lower()
    output_language = normalize_output_language(payload.get("output_language"))
    job = {
        "job_description": description,
        "title": str(payload.get("title") or "").strip() or None,
        "company": str(payload.get("company") or "").strip() or None,
        "last_posted_at": payload.get("last_posted_at"),
        "output_language": output_language,
    }
    try:
        result, tailored_resume = generate_tailored_document(
            db,
            current_user,
            job=job,
            doc_type=doc_type,
            output_language=output_language,
            generation_id=str(payload.get("generation_id") or uuid4()),
            tailored_resume_id=payload.get("tailored_resume_id"),
            mock=bool(payload.get("mock")),
            career_profile_provider=_default_career_profile,
            reviewer=review_job,
            broadcaster=broadcast_sync,
        )
    except CareerProfileNotReady as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except TailoredResumeGenerationInProgress as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TailoredResumeGenerationUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except TailoredResumeGenerationFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    tailored_dict = tailored_resume_response(tailored_resume, db)
    combined_cover_letter = (tailored_resume.raw_ai_response or {}).get("cover_letter")
    if combined_cover_letter:
        tailored_dict["cover_letter"] = combined_cover_letter
        result["cover_letter"] = combined_cover_letter
    if tailored_dict.get("resume_data"):
        result["resume_data"] = tailored_dict["resume_data"]
    if tailored_dict.get("core_competencies"):
        result["core_competencies"] = tailored_dict["core_competencies"]
    if tailored_dict.get("key_qualifications"):
        result["key_qualifications"] = tailored_dict["key_qualifications"]
    if tailored_dict.get("targeted_projects"):
        result["targeted_projects"] = tailored_dict["targeted_projects"]
    if tailored_dict.get("raw_ai_response"):
        result["raw_ai_response"] = tailored_dict["raw_ai_response"]
    result["tailored_resume"] = tailored_dict
    return result
