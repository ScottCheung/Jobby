import logging
from typing import Any
from urllib.parse import unquote, urlsplit
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import delete, or_, select, text
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.domain.errors import ResumeAssetDataUnavailable
from services.api.routers.helpers import (
    CAREER_PROFILE_SOURCE,
    RESUME_EVALUATION_COST,
    RESUME_RECOVERY_AFTER,
    RESUME_UPLOAD_COST,
    dedupe_strings,
    ensure_single_default_job_hunting_profile,
    linkedin_url_from_resume_data,
    read_resume_upload,
    refund_resume_coins,
    resume_profile_name,
    spend_resume_coins,
)
from services.shared.autofill_profile import core_profile_values, upsert_core_profile_value
from services.shared.database import SessionLocal, get_db
from services.shared.llm_usage import get_llm_usage_breakdown, get_llm_usage_summary
from services.shared.models import (
    JobHuntingProfile,
    MasterResume,
    MasterResumeEvaluationSnapshot,
    MasterResumeVersion,
    Skill,
    TailoredResume,
    User,
    UserGamification,
    UserSkill,
)
from services.shared.realtime import broadcast_sync
from services.shared.resume_evaluator import (
    RUBRIC_VERSION,
    ResumeEvaluationError,
    evaluate_resume_data,
    resume_content_hash,
)
from services.shared.resume_parser import (
    ResumeParseError,
    enrich_resume_data_from_source,
    extract_pdf_source,
    extract_pdf_text,
    normalize_resume_data,
    parse_resume_text_raw,
)
from services.shared.schemas import (
    MasterResumeEvaluationHistoryRead,
    MasterResumeRead,
    MasterResumeUpdate,
    MasterResumeVersionRead,
    ResumeAssetRead,
    ResumeSourceRead,
    TailoredResumeRead,
)
from services.shared.settings import get_settings
from services.shared.storage import StorageError, get_object_storage
from services.shared.time_utils import parse_datetime_to_utc, utc_isoformat, utc_now

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api", tags=["resumes"])


def master_resume_response(resume: MasterResume) -> dict:
    evaluation = resume.evaluation if isinstance(resume.evaluation, dict) else {}
    evaluation_is_current = bool(
        evaluation
        and evaluation.get("source_hash") == resume_content_hash(resume.resume_data)
        and evaluation.get("rubric_version") == RUBRIC_VERSION
    )
    return {
        "id": resume.id,
        "original_filename": resume.original_filename,
        "original_url": resume.original_url,
        "resume_data": resume.resume_data,
        "content_version": resume.published_version,
        "published_version": resume.published_version,
        "draft_base_version": resume.draft_base_version,
        "has_draft_changes": resume.resume_data != resume.published_data,
        "evaluation": evaluation,
        "evaluation_is_current": evaluation_is_current,
        "published_evaluation": resume.published_evaluation or {},
        "evaluation_updated_at": resume.evaluation_updated_at,
        "published_at": resume.published_at,
        "status": resume.status,
        "confirmed_at": resume.confirmed_at,
        "created_at": resume.created_at,
        "updated_at": resume.updated_at,
    }


def tailored_resume_response(resume: TailoredResume, db: Session | None = None) -> dict:
    result = TailoredResumeRead.model_validate(resume).model_dump(mode="json")
    if not result.get("core_competencies"):
        result["core_competencies"] = result.get("key_qualifications") or []
    if (resume.raw_ai_response or {}).get("cover_letter"):
        result["cover_letter"] = resume.raw_ai_response["cover_letter"]
    if (resume.raw_ai_response or {}).get("output_language"):
        result["output_language"] = resume.raw_ai_response["output_language"]
    generation_ids = [
        str(gid) for gid in (resume.raw_ai_response or {}).get("generation_ids") or [] if gid
    ]
    current_gen_id = (resume.raw_ai_response or {}).get("generation_id")
    if current_gen_id and str(current_gen_id) not in generation_ids:
        generation_ids.append(str(current_gen_id))
    if not generation_ids:
        generation_ids = [str(resume.id)]
    breakdown = get_llm_usage_breakdown(generation_ids, db=db)
    if breakdown and breakdown.get("total"):
        result["usage"] = breakdown["total"].to_dict()
        result["usage_breakdown"] = {
            k: v.to_dict() for k, v in breakdown.items() if k != "total" and v
        }
    else:
        usage = get_llm_usage_summary(generation_ids, db=db)
        result["usage"] = usage.to_dict() if usage else None
        result["usage_breakdown"] = None
    return result



from services.domain.master_resumes import (
    _default_career_profile,
    _default_career_profile_resume,
    apply_master_resume_profile_prefill,
    canonical_resume_storage_key,
    delete_resume_profile_asset,
    process_master_resume,
    prune_resume_profiles,
    recover_master_resume,
    recommended_job_search_terms,
    repair_resume_asset_identity,
    resume_asset_master_response,
    resume_asset_profiles,
    resume_asset_response,
    resume_matches_upload,
    resume_upload_id,
    sync_job_profile_for_resume,
    sync_user_skills,
    upload_id_from_url,
)


@router.get("/master-resume", response_model=MasterResumeRead)
def read_master_resume(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No master resume yet")
    repair_resume_asset_identity(db, resume)
    if (
        resume.status == "processing"
        and resume.updated_at < utc_now() - RESUME_RECOVERY_AFTER
    ):
        resume.updated_at = utc_now()
        db.commit()
        db.refresh(resume)
        background_tasks.add_task(recover_master_resume, resume.id)
    elif db.dirty:
        db.commit()
        db.refresh(resume)
    return master_resume_response(resume)


@router.delete("/master-resume", status_code=status.HTTP_204_NO_CONTENT)
def delete_master_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No master resume yet")
    profile = db.scalar(
        select(JobHuntingProfile).where(
            JobHuntingProfile.user_id == current_user.id,
            JobHuntingProfile.resume_path == resume.original_url,
        )
    )
    try:
        if profile:
            delete_resume_profile_asset(db, profile)
        elif resume.original_storage_key:
            storage = get_object_storage()
            storage.delete(resume.original_storage_key)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.delete(resume)
    db.commit()
    return None


@router.post("/master-resume/debug/source", response_model=ResumeSourceRead)
def extract_master_resume_source(
    file: UploadFile = File(...),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    del current_user
    if not settings.resume_debug_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    filename, content = read_resume_upload(file)
    try:
        return {"original_filename": filename, **extract_pdf_source(content)}
    except ResumeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/master-resume/debug/ai", response_model=dict)
def debug_master_resume_ai(
    file: UploadFile = File(...),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    if not settings.resume_debug_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _, content = read_resume_upload(file)
    try:
        return parse_resume_text_raw(extract_pdf_text(content), user_id=current_user.id)
    except ResumeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/master-resume/upload", response_model=MasterResumeRead)
def upload_master_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    filename, content = read_resume_upload(file)
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if resume and resume.status == "processing":
        refund_resume_coins(
            db,
            current_user,
            RESUME_UPLOAD_COST,
            "Resume Profile upload refund",
            resume_upload_id(resume),
        )
    upload_id = str(uuid4())
    spend_resume_coins(
        db,
        current_user,
        RESUME_UPLOAD_COST,
        "Master resume parsing",
        upload_id,
    )
    storage_key = f"master-resumes/{current_user.id}/{upload_id}.pdf"
    try:
        public_url = get_object_storage().upload(storage_key, content, "application/pdf")
    except StorageError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    versioned_url = f"{public_url}?v={int(utc_now().timestamp())}"
    if not resume:
        resume = MasterResume(
            user_id=current_user.id,
            original_filename=filename[:255],
            original_storage_key=storage_key,
            original_url=versioned_url,
            resume_data={},
            content_version=0,
            evaluation={},
            status="processing",
        )
        db.add(resume)
    else:
        resume.original_filename = filename[:255]
        resume.original_storage_key = storage_key
        resume.original_url = versioned_url
        resume.resume_data = {}
        resume.status = "processing"
    db.commit()
    db.refresh(resume)
    background_tasks.add_task(process_master_resume, resume.id, content, upload_id)
    return master_resume_response(resume)


@router.post("/master-resume/retry", response_model=MasterResumeRead)
def retry_master_resume_parsing(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No master resume to retry")
    if resume.status != "processing":
        return master_resume_response(resume)
    resume.updated_at = utc_now()
    db.commit()
    db.refresh(resume)
    background_tasks.add_task(recover_master_resume, resume.id)
    return master_resume_response(resume)


@router.post("/master-resume/cancel", response_model=MasterResumeRead)
def cancel_master_resume_parsing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No master resume to cancel")
    if resume.status == "processing":
        upload_id = resume_upload_id(resume)
        refund_resume_coins(
            db,
            current_user,
            RESUME_UPLOAD_COST,
            "Resume Profile upload refund",
            upload_id,
        )
        if resume.published_version:
            resume.original_filename = resume.published_filename or resume.original_filename
            resume.original_storage_key = resume.published_storage_key or resume.original_storage_key
            resume.original_url = resume.published_url or resume.original_url
            resume.resume_data = resume.published_data
            resume.evaluation = resume.published_evaluation
            resume.status = "confirmed"
        else:
            resume.status = "failed"
            resume.resume_data = {}
        db.commit()
        db.refresh(resume)
        broadcast_sync(
            "career_profile.processed",
            {"resume_id": str(resume.id), "status": "failed", "detail": "Resume parsing was cancelled."},
        )
    return master_resume_response(resume)


@router.put("/master-resume", response_model=MasterResumeRead)
def update_master_resume(
    payload: MasterResumeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload a resume before editing it")
    next_resume_data = normalize_resume_data(payload.resume_data)
    resume.resume_data = next_resume_data
    resume.status = "confirmed" if resume.resume_data == resume.published_data else "draft"
    db.commit()
    db.refresh(resume)
    return master_resume_response(resume)


@router.post("/master-resume/evaluate", response_model=MasterResumeRead)
def evaluate_master_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume or not resume.resume_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload a resume before evaluating it")
    if resume.status == "processing":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resume parsing is still in progress")

    source_hash = resume_content_hash(resume.resume_data)
    if (
        isinstance(resume.evaluation, dict)
        and resume.evaluation.get("source_hash") == source_hash
        and resume.evaluation.get("rubric_version") == RUBRIC_VERSION
    ):
        return master_resume_response(resume)

    wallet = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not wallet or wallet.coins < RESUME_EVALUATION_COST:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Not enough coins")

    try:
        evaluation = evaluate_resume_data(resume.resume_data, user_id=current_user.id)
    except ResumeEvaluationError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    reference_id = f"{resume.id}:{RUBRIC_VERSION}:{source_hash[:24]}"
    spend_resume_coins(
        db,
        current_user,
        RESUME_EVALUATION_COST,
        "Master resume evaluation",
        reference_id,
    )
    evaluation["coins_spent"] = RESUME_EVALUATION_COST
    published_version = (
        resume.published_version if resume.resume_data == resume.published_data else None
    )
    evaluation["published_version"] = published_version
    evaluation["resume_version"] = published_version
    evaluation["target"] = "published" if published_version else "draft"
    resume.evaluation = evaluation
    resume.evaluation_updated_at = utc_now()
    if published_version:
        resume.published_evaluation = evaluation
        version_record = db.scalar(
            select(MasterResumeVersion).where(
                MasterResumeVersion.master_resume_id == resume.id,
                MasterResumeVersion.version == published_version,
            )
        )
        if version_record:
            version_record.evaluation = evaluation
    db.add(
        MasterResumeEvaluationSnapshot(
            master_resume_id=resume.id,
            resume_version=published_version or 0,
            published_version=published_version,
            evaluation=evaluation,
            resume_data=resume.resume_data,
            created_at=resume.evaluation_updated_at,
        )
    )
    db.commit()
    db.refresh(resume)
    return master_resume_response(resume)


@router.get(
    "/master-resume/evaluation-history",
    response_model=list[MasterResumeEvaluationHistoryRead],
)
def master_resume_evaluation_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        return []
    snapshots = list(
        db.scalars(
            select(MasterResumeEvaluationSnapshot)
            .where(MasterResumeEvaluationSnapshot.master_resume_id == resume.id)
            .order_by(MasterResumeEvaluationSnapshot.created_at.desc())
            .limit(20)
        )
    )
    current_hash = resume_content_hash(resume.resume_data)
    resume_data_by_hash = {current_hash: resume.resume_data}
    for profile in resume_asset_profiles(db, current_user):
        profile_resume_data = (profile.extra_data or {}).get("resume_data")
        if isinstance(profile_resume_data, dict) and profile_resume_data:
            resume_data_by_hash.setdefault(
                resume_content_hash(profile_resume_data),
                profile_resume_data,
            )
    return [
        {
            "id": snapshot.id,
            "resume_version": snapshot.resume_version,
            "published_version": snapshot.published_version,
            "evaluation": snapshot.evaluation,
            "resume_data": (
                snapshot.resume_data
                or resume_data_by_hash.get(snapshot.evaluation.get("source_hash"))
            ),
            "created_at": snapshot.created_at,
        }
        for snapshot in snapshots
    ]


@router.get(
    "/master-resume/versions",
    response_model=list[MasterResumeVersionRead],
)
def master_resume_versions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[MasterResumeVersion]:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        return []
    return list(
        db.scalars(
            select(MasterResumeVersion)
            .where(MasterResumeVersion.master_resume_id == resume.id)
            .order_by(MasterResumeVersion.version.desc())
        )
    )


@router.delete(
    "/master-resume/versions/{version}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_master_resume_version(
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No master resume yet")
    snapshot = db.scalar(
        select(MasterResumeVersion).where(
            MasterResumeVersion.master_resume_id == resume.id,
            MasterResumeVersion.version == version,
        )
    )
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")
    if version == resume.published_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The current published version cannot be deleted. Publish another version first.",
        )
    if resume.resume_data != resume.published_data and version == resume.draft_base_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This version is the source of your current draft. Publish or replace the draft first.",
        )
    db.execute(
        delete(MasterResumeEvaluationSnapshot).where(
            MasterResumeEvaluationSnapshot.master_resume_id == resume.id,
            or_(
                MasterResumeEvaluationSnapshot.published_version == version,
                MasterResumeEvaluationSnapshot.resume_version == version,
            ),
        )
    )
    db.delete(snapshot)
    db.commit()
    return None


@router.post(
    "/master-resume/versions/{version}/draft",
    response_model=MasterResumeRead,
)
def start_draft_from_master_resume_version(
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No master resume yet")
    snapshot = db.scalar(
        select(MasterResumeVersion).where(
            MasterResumeVersion.master_resume_id == resume.id,
            MasterResumeVersion.version == version,
        )
    )
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")
    resume.resume_data = snapshot.resume_data
    resume.original_filename = snapshot.original_filename
    resume.original_storage_key = snapshot.original_storage_key
    resume.original_url = snapshot.original_url
    resume.evaluation = snapshot.evaluation or {}
    resume.evaluation_updated_at = snapshot.published_at if snapshot.evaluation else None
    resume.draft_base_version = version
    resume.status = "confirmed" if version == resume.published_version else "draft"
    db.commit()
    db.refresh(resume)
    return master_resume_response(resume)


@router.post("/master-resume/confirm", response_model=MasterResumeRead)
def confirm_master_resume(
    payload: MasterResumeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> MasterResume:
    resume = db.scalar(
        select(MasterResume)
        .where(MasterResume.user_id == current_user.id)
        .with_for_update()
    )
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload a resume before confirming it")
    next_resume_data = normalize_resume_data(payload.resume_data)
    resume.resume_data = next_resume_data
    draft_hash = resume_content_hash(resume.resume_data)
    published_hash = resume_content_hash(resume.published_data) if resume.published_data else None
    evaluation = resume.evaluation if isinstance(resume.evaluation, dict) else {}
    current_evaluation = (
        evaluation
        if evaluation.get("source_hash") == draft_hash
        and evaluation.get("rubric_version") == RUBRIC_VERSION
        else {}
    )
    if draft_hash != published_hash:
        next_version = resume.published_version + 1
        published_at = utc_now()
        if current_evaluation:
            current_evaluation = {
                **current_evaluation,
                "published_version": next_version,
                "resume_version": next_version,
                "target": "published",
            }
            resume.evaluation = current_evaluation
            evaluated_snapshot = db.scalar(
                select(MasterResumeEvaluationSnapshot)
                .where(
                    MasterResumeEvaluationSnapshot.master_resume_id == resume.id,
                    MasterResumeEvaluationSnapshot.evaluation["source_hash"].as_string() == draft_hash,
                )
                .order_by(MasterResumeEvaluationSnapshot.created_at.desc())
                .limit(1)
            )
            if evaluated_snapshot:
                evaluated_snapshot.published_version = next_version
                evaluated_snapshot.resume_version = next_version
                evaluated_snapshot.evaluation = current_evaluation
        db.add(
            MasterResumeVersion(
                master_resume_id=resume.id,
                version=next_version,
                resume_data=resume.resume_data,
                original_filename=resume.original_filename,
                original_storage_key=resume.original_storage_key,
                original_url=resume.original_url,
                evaluation=current_evaluation,
                published_at=published_at,
            )
        )
        resume.published_version = next_version
        resume.content_version = next_version
        resume.published_data = resume.resume_data
        resume.published_filename = resume.original_filename
        resume.published_storage_key = resume.original_storage_key
        resume.published_url = resume.original_url
        resume.published_evaluation = current_evaluation
        resume.published_at = published_at
    resume.draft_base_version = resume.published_version
    apply_master_resume_profile_prefill(db, current_user, resume.resume_data, resume.original_url)
    resume.status = "confirmed"
    resume.confirmed_at = utc_now()
    sync_user_skills(db, current_user, resume.resume_data)
    profile = sync_job_profile_for_resume(
        db,
        current_user,
        resume.resume_data,
        resume.original_url,
        resume.original_filename,
        resume.original_storage_key,
        resume_upload_id(resume),
        recommended_job_search_terms({}, resume.resume_data),
        resume.published_version,
    )
    profile.extra_data = {
        **(profile.extra_data or {}),
        "resume_evaluation": resume.published_evaluation,
        "resume_evaluation_updated_at": utc_isoformat(resume.evaluation_updated_at),
    }
    db.commit()
    db.refresh(resume)
    return master_resume_response(resume)


# --- Resume Assets Endpoints ---

@router.get("/resume-assets", response_model=list[ResumeAssetRead])
def list_resume_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    return [resume_asset_response(profile) for profile in resume_asset_profiles(db, current_user)]


@router.post("/resume-assets/{profile_id}/select", response_model=MasterResumeRead)
def select_resume_asset(
    profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or not profile.resume_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    extra = dict(profile.extra_data or {})
    if (
        (not isinstance(extra.get("resume_data"), dict) or not extra.get("resume_data"))
        and resume
        and resume.original_url == profile.resume_path
        and resume.resume_data
    ):
        extra["resume_data"] = resume.resume_data
        profile.extra_data = extra
    try:
        snapshot = resume_asset_master_response(profile)
    except ResumeAssetDataUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not resume:
        resume = MasterResume(
            user_id=current_user.id,
            original_filename=snapshot["original_filename"],
            original_storage_key=str((profile.extra_data or {}).get("resume_storage_key") or ""),
            original_url=snapshot["original_url"],
            resume_data=snapshot["resume_data"],
            content_version=snapshot["content_version"],
            evaluation=snapshot["evaluation"],
            evaluation_updated_at=parse_datetime_to_utc(snapshot["evaluation_updated_at"]),
            status=snapshot["status"],
        )
        db.add(resume)
    else:
        resume.original_filename = snapshot["original_filename"]
        resume.original_storage_key = str((profile.extra_data or {}).get("resume_storage_key") or "")
        resume.original_url = snapshot["original_url"]
        resume.resume_data = snapshot["resume_data"]
        if snapshot["evaluation"]:
            resume.evaluation = snapshot["evaluation"]
            resume.evaluation_updated_at = parse_datetime_to_utc(snapshot["evaluation_updated_at"])
        matching_version = db.scalar(
            select(MasterResumeVersion).where(
                MasterResumeVersion.master_resume_id == resume.id,
                MasterResumeVersion.resume_data == snapshot["resume_data"],
            )
        )
        resume.draft_base_version = (
            matching_version.version if matching_version else resume.published_version
        )
        resume.status = (
            "confirmed" if resume.resume_data == resume.published_data else "draft"
        )
    profile.is_default = True
    ensure_single_default_job_hunting_profile(db, current_user, profile)
    db.commit()
    db.refresh(resume)
    return master_resume_response(resume)


@router.delete("/resume-assets/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume_asset(
    profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or not profile.resume_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    was_default = bool(profile.is_default)
    deleted_url = profile.resume_path
    try:
        delete_resume_profile_asset(db, profile)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if was_default:
        replacement = next(iter(resume_asset_profiles(db, current_user)), None)
        if replacement:
            replacement.is_default = True
            ensure_single_default_job_hunting_profile(db, current_user, replacement)
    resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    if resume and resume.original_url == deleted_url:
        db.delete(resume)
    db.commit()
    return None


# --- Tailored Resumes Endpoints ---

@router.get("/tailored-resumes", response_model=list[TailoredResumeRead])
def list_tailored_resumes(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    resumes = list(
        db.scalars(
            select(TailoredResume)
            .where(TailoredResume.user_id == current_user.id)
            .order_by(TailoredResume.updated_at.desc(), TailoredResume.created_at.desc())
            .limit(limit)
        )
    )
    return [tailored_resume_response(resume, db) for resume in resumes]


@router.get("/tailored-resumes/{tailored_resume_id}", response_model=TailoredResumeRead)
def read_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    tailored_resume = db.get(TailoredResume, tailored_resume_id)
    if not tailored_resume or tailored_resume.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    return tailored_resume_response(tailored_resume, db)


@router.put("/tailored-resumes/{tailored_resume_id}", response_model=TailoredResumeRead)
def update_tailored_resume(
    tailored_resume_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    tailored = db.get(TailoredResume, tailored_resume_id)
    if not tailored or tailored.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    if "resume_data" in payload and isinstance(payload["resume_data"], dict):
        tailored.resume_data = payload["resume_data"]
    if "core_competencies" in payload and isinstance(payload["core_competencies"], list):
        tailored.core_competencies = payload["core_competencies"]
    if "key_qualifications" in payload and isinstance(payload["key_qualifications"], list):
        tailored.key_qualifications = payload["key_qualifications"]
    if "targeted_projects" in payload and isinstance(payload["targeted_projects"], list):
        tailored.targeted_projects = payload["targeted_projects"]
    if "job_title" in payload and payload["job_title"] is not None:
        tailored.job_title = str(payload["job_title"])
    if "company" in payload and payload["company"] is not None:
        tailored.company = str(payload["company"])
    if "cover_letter" in payload:
        raw_ai_resp = dict(tailored.raw_ai_response or {})
        if payload["cover_letter"] is not None:
            cl_text = str(payload["cover_letter"]).strip()
            raw_ai_resp["cover_letter"] = cl_text if cl_text else None
            gen_docs = dict(raw_ai_resp.get("generated_documents") or {})
            if cl_text:
                gen_docs["cover_letter"] = True
            raw_ai_resp["generated_documents"] = gen_docs
        else:
            raw_ai_resp.pop("cover_letter", None)
        tailored.raw_ai_response = raw_ai_resp
    if "raw_ai_response" in payload and isinstance(payload["raw_ai_response"], dict):
        merged_raw_ai = dict(tailored.raw_ai_response or {})
        merged_raw_ai.update(payload["raw_ai_response"])
        tailored.raw_ai_response = merged_raw_ai
    tailored.updated_at = utc_now()
    db.commit()
    db.refresh(tailored)
    return tailored


@router.delete("/tailored-resumes/{tailored_resume_id}")
def delete_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    tailored = db.get(TailoredResume, tailored_resume_id)
    if not tailored or tailored.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    db.delete(tailored)
    db.commit()
    return {"success": True, "id": str(tailored_resume_id)}


@router.delete(
    "/tailored-resumes/{tailored_resume_id}/documents/{document_type}",
    response_model=TailoredResumeRead,
)
def delete_tailored_document(
    tailored_resume_id: UUID,
    document_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    tailored = db.get(TailoredResume, tailored_resume_id)
    if not tailored or tailored.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    if document_type not in {"resume", "cover_letter"}:
        raise HTTPException(status_code=400, detail="Unsupported document type")

    raw_ai_response = dict(tailored.raw_ai_response or {})
    generated_documents = dict(raw_ai_response.get("generated_documents") or {})
    if document_type == "resume":
        tailored.resume_data = {}
        tailored.core_competencies = []
        tailored.key_qualifications = []
        tailored.targeted_projects = []
        for key in (
            "summary",
            "core_competencies",
            "key_qualifications",
            "skills",
            "experience",
            "projects",
            "resume_data",
            "targeted_projects",
        ):
            raw_ai_response.pop(key, None)
    else:
        raw_ai_response.pop("cover_letter", None)

    generated_documents.pop(document_type, None)
    if generated_documents:
        raw_ai_response["generated_documents"] = generated_documents
    else:
        raw_ai_response["generated_documents"] = {
            "resume": False,
            "cover_letter": False,
        }
    tailored.raw_ai_response = raw_ai_response
    tailored.updated_at = utc_now()
    db.commit()
    db.refresh(tailored)
    return tailored
