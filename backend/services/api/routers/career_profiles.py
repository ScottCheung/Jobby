import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.api.routers.helpers import (
    CAREER_PROFILE_SOURCE,
    CAREER_PROFILE_UPLOAD_AND_SCORE_COST,
    RESUME_EVALUATION_COST,
    apply_updates,
    dedupe_strings,
    ensure_single_default_job_hunting_profile,
    linkedin_url_from_resume_data,
    normalize_job_hunting_profile_values,
    read_resume_upload,
    refund_resume_coins,
    resume_profile_name,
    spend_resume_coins,
)
from services.shared.database import SessionLocal, get_db
from services.shared.models import (
    CareerProfileScoreSnapshot,
    JobHuntingProfile,
    User,
    UserGamification,
)
from services.shared.realtime import broadcast_sync
from services.shared.resume_evaluator import (
    RUBRIC_VERSION,
    ResumeEvaluationError,
    evaluate_resume_data,
    resume_content_hash,
)
from services.shared.resume_parser import (
    enrich_resume_data_from_source,
    extract_pdf_text,
    normalize_resume_data,
    parse_resume_text_raw,
)
from services.shared.schemas import (
    CareerProfileRead,
    CareerProfileScoreHistoryRead,
    JobHuntingProfileBase,
    JobHuntingProfileRead,
)
from services.shared.storage import StorageError, get_object_storage
from services.shared.time_utils import utc_isoformat, utc_now

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/career-profiles", tags=["career_profiles"])


def career_profile_score_table_exists(db: Session) -> bool:
    return inspect(db.get_bind()).has_table(CareerProfileScoreSnapshot.__tablename__)


def score_history_entry(evaluation: dict, resume_data: dict, created_at: Any) -> dict:
    return {
        "id": str(uuid4()),
        "evaluation": evaluation,
        "resume_data": resume_data,
        "created_at": utc_isoformat(created_at),
    }


def career_profile_response(profile: JobHuntingProfile) -> dict:
    extra = dict(profile.extra_data or {})
    resume_data = extra.get("resume_data") if isinstance(extra.get("resume_data"), dict) else {}
    evaluation = extra.get("resume_evaluation") if isinstance(extra.get("resume_evaluation"), dict) else {}
    response = JobHuntingProfileRead.model_validate(profile).model_dump(mode="json")
    response.update(
        {
            "original_filename": extra.get("resume_filename"),
            "original_url": profile.resume_path or extra.get("resume_url"),
            "resume_data": resume_data,
            "status": str(extra.get("resume_status") or "ready"),
            "latest_evaluation": evaluation,
            "evaluation_is_current": bool(
                resume_data
                and evaluation.get("source_hash") == resume_content_hash(resume_data)
                and evaluation.get("rubric_version") == RUBRIC_VERSION
            ),
            "evaluation_updated_at": extra.get("resume_evaluation_updated_at"),
        }
    )
    return response


def career_profiles_for_user(db: Session, current_user: User) -> list[JobHuntingProfile]:
    return list(
        db.scalars(
            select(JobHuntingProfile)
            .where(JobHuntingProfile.user_id == current_user.id)
            .where(JobHuntingProfile.extra_data["resume_source"].as_string() == CAREER_PROFILE_SOURCE)
            .order_by(JobHuntingProfile.is_default.desc(), JobHuntingProfile.updated_at.desc())
        )
    )


def recommended_job_search_terms(raw_resume: dict, resume_data: dict) -> list[str]:
    raw_terms = raw_resume.get("search_terms") if isinstance(raw_resume, dict) else None
    if isinstance(raw_terms, list):
        model_terms = [item.strip() for item in raw_terms if isinstance(item, str) and item.strip()]
        if model_terms:
            return list(dict.fromkeys(model_terms))[:8]

    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    experience = resume_data.get("experience") if isinstance(resume_data.get("experience"), list) else []
    source = " ".join(
        str(value)
        for value in [basics.get("headline", ""), *[item.get("title", "") for item in experience if isinstance(item, dict)]]
    ).lower()
    skills = " ".join(
        skill.lower()
        for group in resume_data.get("skills", []) if isinstance(group, dict)
        for skill in group.get("skills", []) if isinstance(skill, str)
    )
    terms = [item.get("title", "").strip() for item in experience if isinstance(item, dict) and isinstance(item.get("title"), str)]
    if "full-stack" in source or ("react" in skills and ("fastapi" in skills or ".net" in skills)):
        terms.append("Full-Stack Developer")
    if "react" in skills or "next.js" in skills:
        terms.append("Frontend Developer")
    if "fastapi" in skills or ".net" in skills or "node.js" in skills:
        terms.append("Backend Developer")
    terms.append("Software Engineer")
    return list(dict.fromkeys(term for term in terms if term))[:8]


def process_career_profile(profile_id: UUID, content: bytes) -> None:
    db = SessionLocal()
    try:
        profile = db.get(JobHuntingProfile, profile_id)
        if not profile:
            return
        extra = dict(profile.extra_data or {})
        if extra.get("resume_status") != "processing":
            return
        source_text = extract_pdf_text(content)
        parsed = parse_resume_text_raw(source_text, user_id=profile.user_id)
        resume_data = enrich_resume_data_from_source(source_text, normalize_resume_data(parsed))
        profile.name = resume_profile_name(str(extra.get("resume_filename") or "Resume.pdf"), resume_data)
        profile.search_terms = dedupe_strings(recommended_job_search_terms(parsed, resume_data))[:10]
        profile.linkedin_url = linkedin_url_from_resume_data(resume_data)
        basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
        profile.website = basics.get("website") or basics.get("portfolio_url")
        profile.linkedin_headline = basics.get("headline")
        profile.linkedin_summary = resume_data.get("summary")
        evaluation: dict[str, Any] = {}
        scored_at = utc_now()
        try:
            evaluation = evaluate_resume_data(resume_data, user_id=profile.user_id)
            evaluation["coins_spent"] = RESUME_EVALUATION_COST
            if career_profile_score_table_exists(db):
                db.add(CareerProfileScoreSnapshot(career_profile_id=profile.id, evaluation=evaluation, resume_data=resume_data))
        except ResumeEvaluationError:
            logger.exception("Initial Resume Profile scoring failed profile_id=%s", profile.id)
            current_user = db.get(User, profile.user_id)
            if current_user:
                refund_resume_coins(
                    db,
                    current_user,
                    RESUME_EVALUATION_COST,
                    "Resume Profile initial score refund",
                    str(extra.get("resume_upload_id") or profile.id),
                )
        profile.extra_data = {
            **extra,
            "resume_data": resume_data,
            "resume_status": "ready",
            "resume_content_version": 1,
            "resume_evaluation": evaluation,
            "resume_evaluation_updated_at": utc_isoformat(scored_at) if evaluation else None,
            "score_history": ([*(extra.get("score_history") or []), score_history_entry(evaluation, resume_data, scored_at)] if evaluation else (extra.get("score_history") or []))[-20:],
        }
        db.commit()
        broadcast_sync("career_profile.processed", {"profile_id": str(profile.id), "status": "ready"})
    except Exception as exc:
        db.rollback()
        profile = db.get(JobHuntingProfile, profile_id)
        if profile:
            profile.extra_data = {**(profile.extra_data or {}), "resume_status": "failed"}
            db.commit()
        logger.exception("Resume Profile parsing failed profile_id=%s", profile_id)
        broadcast_sync("career_profile.processed", {"profile_id": str(profile_id), "status": "failed", "detail": str(exc)})
    finally:
        db.close()


@router.get("", response_model=list[CareerProfileRead])
def list_career_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    return [career_profile_response(profile) for profile in career_profiles_for_user(db, current_user)]


@router.get("/{profile_id}", response_model=CareerProfileRead)
def read_career_profile(
    profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    return career_profile_response(profile)


@router.post("/upload", response_model=CareerProfileRead, status_code=status.HTTP_201_CREATED)
def upload_career_profile(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    filename, content = read_resume_upload(file)
    upload_id = str(uuid4())
    spend_resume_coins(
        db,
        current_user,
        CAREER_PROFILE_UPLOAD_AND_SCORE_COST,
        "Resume Profile upload and initial score",
        upload_id,
    )
    storage_key = f"career-profiles/{current_user.id}/{upload_id}.pdf"
    try:
        public_url = get_object_storage().upload(storage_key, content, "application/pdf")
    except StorageError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    profile = JobHuntingProfile(
        user_id=current_user.id,
        name=f"{filename.rsplit('.', 1)[0]} Profile"[:180],
        platform="linkedin", search_terms=[], filters={}, blacklist_rules={}, whitelist_rules={},
        resume_path=f"{public_url}?v={int(utc_now().timestamp())}",
        is_default=not career_profiles_for_user(db, current_user),
        extra_data={
            "resume_source": CAREER_PROFILE_SOURCE,
            "resume_filename": filename[:255],
            "resume_url": f"{public_url}?v={int(utc_now().timestamp())}",
            "resume_storage_key": storage_key,
            "resume_upload_id": upload_id,
            "resume_status": "processing",
            "resume_data": {},
            "resume_content_version": 0,
        },
    )
    db.add(profile)
    db.flush()
    if profile.is_default:
        ensure_single_default_job_hunting_profile(db, current_user, profile)
    db.commit()
    db.refresh(profile)
    background_tasks.add_task(process_career_profile, profile.id, content)
    return career_profile_response(profile)


@router.put("/{profile_id}", response_model=CareerProfileRead)
def update_career_profile(
    profile_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    allowed = set(JobHuntingProfileBase.model_fields) - {"is_default"}
    profile_values = {key: value for key, value in payload.items() if key in allowed}
    if profile_values:
        apply_updates(profile, normalize_job_hunting_profile_values(profile_values, profile))
    if isinstance(payload.get("resume_data"), dict):
        profile.extra_data = {
            **(profile.extra_data or {}),
            "resume_data": normalize_resume_data(payload["resume_data"]),
            "resume_content_version": int((profile.extra_data or {}).get("resume_content_version") or 0) + 1,
            "resume_status": "ready",
        }
    db.commit()
    db.refresh(profile)
    return career_profile_response(profile)


@router.post("/{profile_id}/primary", response_model=CareerProfileRead)
def set_primary_career_profile(profile_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    ensure_single_default_job_hunting_profile(db, current_user, profile)
    db.commit()
    db.refresh(profile)
    return career_profile_response(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_career_profile(profile_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)) -> None:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    storage_key = str((profile.extra_data or {}).get("resume_storage_key") or "")
    if storage_key:
        get_object_storage().delete(storage_key)
    was_primary = profile.is_default
    db.delete(profile)
    db.commit()
    if was_primary:
        remaining = career_profiles_for_user(db, current_user)
        if remaining:
            ensure_single_default_job_hunting_profile(db, current_user, remaining[0])
            db.commit()


@router.post("/{profile_id}/evaluate", response_model=CareerProfileRead)
def evaluate_career_profile(profile_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    extra = dict(profile.extra_data or {})
    resume_data = extra.get("resume_data")
    if extra.get("resume_status") == "processing":
        raise HTTPException(status_code=409, detail="Resume parsing is still in progress")
    if not isinstance(resume_data, dict) or not resume_data:
        raise HTTPException(status_code=409, detail="No parsed resume data is available")
    source_hash = resume_content_hash(resume_data)
    current = extra.get("resume_evaluation") if isinstance(extra.get("resume_evaluation"), dict) else {}
    if current.get("source_hash") == source_hash and current.get("rubric_version") == RUBRIC_VERSION:
        return career_profile_response(profile)
    wallet = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not wallet or wallet.coins < RESUME_EVALUATION_COST:
        raise HTTPException(status_code=402, detail="Not enough coins")
    try:
        evaluation = evaluate_resume_data(resume_data, user_id=current_user.id)
    except ResumeEvaluationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    spend_resume_coins(db, current_user, RESUME_EVALUATION_COST, "Resume Profile score", f"{profile.id}:{RUBRIC_VERSION}:{source_hash[:24]}")
    evaluation["coins_spent"] = RESUME_EVALUATION_COST
    profile.extra_data = {**extra, "resume_evaluation": evaluation, "resume_evaluation_updated_at": utc_isoformat(utc_now())}
    scored_at = utc_now()
    history = [*(extra.get("score_history") or []), score_history_entry(evaluation, resume_data, scored_at)][-20:]
    profile.extra_data = {**profile.extra_data, "score_history": history}
    if career_profile_score_table_exists(db):
        db.add(CareerProfileScoreSnapshot(career_profile_id=profile.id, evaluation=evaluation, resume_data=resume_data))
    db.commit()
    db.refresh(profile)
    return career_profile_response(profile)


@router.get("/{profile_id}/score-history", response_model=list[CareerProfileScoreHistoryRead])
def career_profile_score_history(profile_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)) -> list[dict]:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    if career_profile_score_table_exists(db):
        snapshots = list(db.scalars(select(CareerProfileScoreSnapshot).where(CareerProfileScoreSnapshot.career_profile_id == profile.id).order_by(CareerProfileScoreSnapshot.created_at.desc())))
        if snapshots:
            return [
                {"id": snapshot.id, "evaluation": snapshot.evaluation, "resume_data": snapshot.resume_data, "created_at": snapshot.created_at}
                for snapshot in snapshots
            ]
    extra = profile.extra_data or {}
    history = extra.get("score_history") if isinstance(extra.get("score_history"), list) else []
    if history:
        return list(reversed(history))
    latest = extra.get("resume_evaluation")
    resume_data = extra.get("resume_data")
    if isinstance(latest, dict) and latest and isinstance(resume_data, dict) and resume_data:
        evaluated_at = extra.get("resume_evaluation_updated_at") or profile.updated_at
        return [{"id": uuid4(), "evaluation": latest, "resume_data": resume_data, "created_at": evaluated_at}]
    return []
