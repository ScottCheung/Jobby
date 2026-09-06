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
from services.api.routers.helpers import (
    CAREER_PROFILE_SOURCE,
    RESUME_EVALUATION_COST,
    RESUME_RECOVERY_AFTER,
    RESUME_UPLOAD_COST,
    dedupe_strings,
    ensure_single_default_job_hunting_profile,
    get_main_override,
    linkedin_url_from_resume_data,
    read_resume_upload,
    refund_resume_coins,
    resume_profile_name,
    spend_resume_coins,
)
from services.shared.autofill_profile import core_profile_values, upsert_core_profile_value
from services.shared.database import SessionLocal, get_db
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


def tailored_resume_response(resume: TailoredResume) -> dict:
    result = TailoredResumeRead.model_validate(resume).model_dump(mode="json")
    if not result.get("core_competencies"):
        result["core_competencies"] = result.get("key_qualifications") or []
    if (resume.raw_ai_response or {}).get("cover_letter"):
        result["cover_letter"] = resume.raw_ai_response["cover_letter"]
    return result


def _default_career_profile(db: Session, current_user: User) -> JobHuntingProfile:
    profile = db.scalar(
        select(JobHuntingProfile)
        .where(
            JobHuntingProfile.user_id == current_user.id,
            JobHuntingProfile.is_default.is_(True),
            JobHuntingProfile.extra_data["resume_source"].as_string() == CAREER_PROFILE_SOURCE,
        )
    )
    resume = (profile.extra_data or {}).get("resume_data") if profile else None
    if not isinstance(resume, dict) or not resume:
        raise HTTPException(status_code=400, detail="Select a ready Resume Profile first")
    return profile


def _default_career_profile_resume(db: Session, current_user: User) -> dict:
    return dict((_default_career_profile(db, current_user).extra_data or {}).get("resume_data") or {})


def upload_id_from_url(url: str) -> str | None:
    filename = unquote(urlsplit(url).path).rsplit("/", 1)[-1]
    if not filename.lower().endswith(".pdf"):
        return None
    value = filename[:-4]
    try:
        UUID(value)
    except ValueError:
        return None
    return value


def resume_upload_id(resume: MasterResume) -> str:
    """Prefer the public asset URL when repairing legacy mismatched metadata."""
    return upload_id_from_url(resume.original_url) or resume.original_storage_key.rsplit("/", 1)[-1].removesuffix(".pdf")


def canonical_resume_storage_key(resume: MasterResume) -> str:
    upload_id = resume_upload_id(resume)
    prefix = resume.original_storage_key.rsplit("/", 1)[0]
    return f"{prefix}/{upload_id}.pdf" if prefix else f"{upload_id}.pdf"


def repair_resume_asset_identity(db: Session, resume: MasterResume) -> None:
    storage_key = canonical_resume_storage_key(resume)
    upload_id = resume_upload_id(resume)
    if resume.original_storage_key != storage_key:
        resume.original_storage_key = storage_key
    profile = db.scalar(
        select(JobHuntingProfile).where(
            JobHuntingProfile.user_id == resume.user_id,
            JobHuntingProfile.resume_path == resume.original_url,
        )
    )
    if not profile:
        return
    extra = dict(profile.extra_data or {})
    if (
        extra.get("resume_upload_id") != upload_id
        or extra.get("resume_storage_key") != storage_key
    ):
        profile.extra_data = {
            **extra,
            "resume_upload_id": upload_id,
            "resume_storage_key": storage_key,
        }


def resume_matches_upload(resume: MasterResume, upload_id: str) -> bool:
    return resume_upload_id(resume) == upload_id


def resume_asset_profiles(db: Session, current_user: User) -> list[JobHuntingProfile]:
    return list(
        db.scalars(
            select(JobHuntingProfile)
            .where(
                JobHuntingProfile.user_id == current_user.id,
                JobHuntingProfile.resume_path.is_not(None),
            )
            .order_by(JobHuntingProfile.updated_at.desc(), JobHuntingProfile.created_at.desc())
        )
    )


def resume_asset_response(profile: JobHuntingProfile) -> dict:
    extra = profile.extra_data or {}
    filename = str(extra.get("resume_filename") or "").strip()
    url = str(profile.resume_path or extra.get("resume_url") or "").strip()
    if not filename:
        filename = url.rsplit("/", 1)[-1].split("?", 1)[0] or "Resume.pdf"
    return {
        "profile_id": profile.id,
        "filename": filename,
        "url": url,
        "is_default": profile.is_default,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def resume_asset_master_response(profile: JobHuntingProfile) -> dict:
    extra = profile.extra_data or {}
    resume_data = extra.get("resume_data")
    if not isinstance(resume_data, dict) or not resume_data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This older resume version has no saved parsed data. Re-upload it to restore an editable version.",
        )
    asset = resume_asset_response(profile)
    return {
        "id": profile.id,
        "original_filename": asset["filename"],
        "original_url": asset["url"],
        "resume_data": resume_data,
        "content_version": max(1, int(extra.get("resume_content_version") or 1)),
        "evaluation": extra.get("resume_evaluation") if isinstance(extra.get("resume_evaluation"), dict) else {},
        "evaluation_updated_at": extra.get("resume_evaluation_updated_at"),
        "status": str(extra.get("resume_status") or "review"),
        "confirmed_at": extra.get("resume_confirmed_at"),
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def delete_resume_profile_asset(db: Session, profile: JobHuntingProfile) -> None:
    storage_key = str((profile.extra_data or {}).get("resume_storage_key") or "").strip()
    if storage_key:
        get_object_storage().delete(storage_key)
    db.delete(profile)


def prune_resume_profiles(db: Session, current_user: User, keep_profile: JobHuntingProfile | None = None, limit: int = 3) -> None:
    profiles = resume_asset_profiles(db, current_user)
    protected_id = keep_profile.id if keep_profile else None
    overflow = [profile for profile in profiles if profile.id != protected_id][max(0, limit - 1):]
    for profile in overflow:
        delete_resume_profile_asset(db, profile)


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


def sync_job_profile_for_resume(
    db: Session,
    current_user: User,
    resume_data: dict,
    original_url: str,
    original_filename: str,
    storage_key: str,
    upload_id: str,
    terms: list[str],
    content_version: int,
    activate: bool = True,
) -> JobHuntingProfile:
    cleaned_terms = dedupe_strings(terms)[:10]
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    first_experience = next(
        (item for item in resume_data.get("experience", []) if isinstance(item, dict)),
        {},
    )
    existing = db.scalar(
        select(JobHuntingProfile).where(
            JobHuntingProfile.user_id == current_user.id,
            JobHuntingProfile.resume_path == original_url,
        )
    )
    profile = existing or JobHuntingProfile(
        user_id=current_user.id,
        platform="linkedin",
        filters={},
        blacklist_rules={},
        whitelist_rules={},
    )
    if not existing:
        db.add(profile)
    profile.name = resume_profile_name(original_filename, resume_data)
    profile.search_terms = cleaned_terms
    profile.resume_path = original_url
    profile.linkedin_url = linkedin_url_from_resume_data(resume_data)
    profile.website = basics.get("website") or basics.get("portfolio_url")
    profile.linkedin_headline = basics.get("headline")
    profile.linkedin_summary = resume_data.get("summary")
    profile.recent_employer = first_experience.get("company")
    profile.extra_data = {
        **(profile.extra_data or {}),
        "resume_upload_id": upload_id,
        "resume_filename": original_filename,
        "resume_url": original_url,
        "resume_storage_key": storage_key,
        "resume_source": "master_resume_upload",
        "resume_data": resume_data,
        "resume_content_version": content_version,
    }
    if activate:
        profile.is_default = True
        ensure_single_default_job_hunting_profile(db, current_user, profile)
    prune_resume_profiles(db, current_user, keep_profile=profile)
    return profile


def apply_master_resume_profile_prefill(
    db: Session,
    current_user: User,
    resume_data: dict,
    original_url: str,
) -> None:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    location = basics.get("location") if isinstance(basics.get("location"), dict) else {}
    profile_values = {
        "identity.first_name": basics.get("first_name"),
        "identity.middle_name": basics.get("middle_name"),
        "identity.last_name": basics.get("last_name"),
        "identity.title": basics.get("title") or basics.get("salutation") or basics.get("prefix"),
        "identity.phone": basics.get("phone"),
        "address.city": location.get("city"),
        "address.state": location.get("state"),
        "address.country": location.get("country"),
        "address.postal_code": location.get("postal_code"),
    }
    existing_values = core_profile_values(db, current_user.id)
    for field, value in profile_values.items():
        if not existing_values.get(field) and value:
            upsert_core_profile_value(db, user_id=current_user.id, core_field_key=field, value=str(value))
    if not current_user.display_name.strip() or "@" in current_user.display_name:
        name = " ".join(part for part in [basics.get("first_name"), basics.get("last_name")] if part)
        if name:
            current_user.display_name = name[:255]

    search_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.created_at.asc())
        .limit(1)
    )
    if not search_profile:
        search_profile = JobHuntingProfile(
            user_id=current_user.id,
            name="Default Job Hunting Profile",
            platform="linkedin",
            search_terms=[],
            filters={},
            blacklist_rules={},
            whitelist_rules={},
            is_default=True,
        )
        db.add(search_profile)
    first_experience = next(
        (item for item in resume_data.get("experience", []) if isinstance(item, dict)),
        {},
    )
    recommended_terms = dedupe_strings(resume_data.get("search_terms", []))
    search_values = {
        "resume_path": original_url,
        "linkedin_url": linkedin_url_from_resume_data(resume_data),
        "website": basics.get("website") or basics.get("portfolio_url"),
        "linkedin_headline": basics.get("headline"),
        "linkedin_summary": resume_data.get("summary"),
        "recent_employer": first_experience.get("company"),
    }
    for field, value in search_values.items():
        if not getattr(search_profile, field, None) and value:
            setattr(search_profile, field, value)
    if recommended_terms and not search_profile.search_terms:
        search_profile.search_terms = recommended_terms[:10]


def sync_user_skills(db: Session, current_user: User, resume_data: dict) -> None:
    raw_skills = resume_data.get("skills")
    extracted: list[tuple[str, str, str]] = []
    if isinstance(raw_skills, list):
        groups = raw_skills
    elif isinstance(raw_skills, dict):
        groups = [{"type": label.title(), "skills": values} for label, values in raw_skills.items()]
    else:
        groups = []
    skill_index = {
        skill.name.strip().lower(): skill.canonical_name
        for skill in db.scalars(select(Skill)).all()
    }
    for group in groups:
        if not isinstance(group, dict):
            continue
        category = str(group.get("type") or "Other").strip() or "Other"
        values = group.get("skills")
        if not isinstance(values, list):
            continue
        for raw in values:
            if not isinstance(raw, str):
                continue
            name = raw.strip()
            if not name:
                continue
            canonical_name = str(skill_index.get(name.lower(), name)).casefold()
            extracted.append((category, canonical_name, name))

    unique_rows: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for category, canonical_name, name in extracted:
        if canonical_name in seen:
            continue
        seen.add(canonical_name)
        unique_rows.append((category, canonical_name, name))

    db.execute(
        delete(UserSkill).where(
            UserSkill.user_id == current_user.id,
            UserSkill.source == "resume",
        )
    )
    plugin_canonical_names = {
        str(value).casefold()
        for value in db.scalars(
            select(UserSkill.canonical_name).where(
                UserSkill.user_id == current_user.id,
                UserSkill.source == "plugin",
            )
        ).all()
    }
    for category, canonical_name, name in unique_rows:
        if canonical_name in plugin_canonical_names:
            continue
        db.add(UserSkill(user_id=current_user.id, category=category, canonical_name=canonical_name, skill_name=name, source="resume"))


def process_master_resume(resume_id: UUID, content: bytes, upload_id: str) -> None:
    session_factory = get_main_override("SessionLocal", SessionLocal)
    db = session_factory()
    lock_key = f"master-resume:{resume_id}"
    locked = False
    try:
        locked = bool(
            db.scalar(
                text("SELECT pg_try_advisory_lock(hashtext(:lock_key))"),
                {"lock_key": lock_key},
            )
        )
        if not locked:
            return
        resume = db.get(MasterResume, resume_id)
        if (
            not resume
            or resume.status != "processing"
            or not resume_matches_upload(resume, upload_id)
        ):
            return
        current_user = db.get(User, resume.user_id)
        if not current_user:
            return
        extractor = get_main_override("extract_pdf_text", extract_pdf_text)
        source_text = extractor(content)
        parsed_resume = parse_resume_text_raw(source_text)
        resume_data = enrich_resume_data_from_source(source_text, normalize_resume_data(parsed_resume))
        db.refresh(resume)
        if resume.status != "processing" or not resume_matches_upload(resume, upload_id):
            return
        resume.resume_data = resume_data
        resume.status = "draft"
        profile = sync_job_profile_for_resume(
            db,
            current_user,
            resume_data,
            resume.original_url,
            resume.original_filename,
            resume.original_storage_key,
            upload_id,
            recommended_job_search_terms(parsed_resume, resume_data),
            resume.published_version,
            activate=False,
        )
        profile.extra_data = {
            **(profile.extra_data or {}),
            "resume_evaluation": resume.evaluation,
            "resume_evaluation_updated_at": utc_isoformat(resume.evaluation_updated_at),
        }
        db.commit()
        broadcast_sync("career_profile.processed", {
            "resume_id": str(resume.id),
            "status": "draft",
            "evaluation_status": "not_requested",
        })
    except ResumeParseError as exc:
        db.rollback()
        resume = db.get(MasterResume, resume_id)
        if resume and resume_matches_upload(resume, upload_id):
            current_user = db.get(User, resume.user_id)
            if current_user:
                refund_resume_coins(
                    db,
                    current_user,
                    RESUME_UPLOAD_COST,
                    "Resume Profile upload refund",
                    upload_id,
                )
            resume.status = "failed"
            db.commit()
        broadcast_sync("career_profile.processed", {"resume_id": str(resume_id), "status": "failed", "detail": str(exc)})
    except Exception:
        logger.exception("Master resume parsing failed resume_id=%s", resume_id)
        db.rollback()
        resume = db.get(MasterResume, resume_id)
        if (
            resume
            and resume.status not in {"review", "draft"}
            and resume_matches_upload(resume, upload_id)
        ):
            current_user = db.get(User, resume.user_id)
            if current_user:
                refund_resume_coins(
                    db,
                    current_user,
                    RESUME_UPLOAD_COST,
                    "Resume Profile upload refund",
                    upload_id,
                )
            resume.status = "failed"
            db.commit()
        if (
            not resume
            or resume.status not in {"review", "draft"}
            or not resume_matches_upload(resume, upload_id)
        ):
            broadcast_sync("career_profile.processed", {"resume_id": str(resume_id), "status": "failed", "detail": "AI resume analysis could not be completed."})
    finally:
        if locked:
            try:
                db.execute(
                    text("SELECT pg_advisory_unlock(hashtext(:lock_key))"),
                    {"lock_key": lock_key},
                )
                db.commit()
            except Exception:
                db.rollback()
        db.close()


def recover_master_resume(resume_id: UUID) -> None:
    db = SessionLocal()
    try:
        resume = db.get(MasterResume, resume_id)
        if not resume or resume.status != "processing":
            return
        storage_key = resume.original_storage_key
        upload_id = resume_upload_id(resume)
    finally:
        db.close()

    try:
        content = get_object_storage().download(storage_key)
    except StorageError:
        db = SessionLocal()
        try:
            resume = db.get(MasterResume, resume_id)
            if resume and resume.status == "processing":
                current_user = db.get(User, resume.user_id)
                if current_user:
                    refund_resume_coins(
                        db,
                        current_user,
                        RESUME_UPLOAD_COST,
                        "Resume Profile upload refund",
                        upload_id,
                    )
                resume.status = "failed"
                db.commit()
                broadcast_sync(
                    "career_profile.processed",
                    {
                        "resume_id": str(resume_id),
                        "status": "failed",
                        "detail": "The uploaded PDF could not be recovered. Please upload it again.",
                    },
                )
        finally:
            db.close()
        return
    process_master_resume(resume_id, content, upload_id)


# --- Master Resume Endpoints ---

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
            storage = get_main_override("get_object_storage", get_object_storage)()
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
    del current_user
    if not settings.resume_debug_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _, content = read_resume_upload(file)
    try:
        return parse_resume_text_raw(extract_pdf_text(content))
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
        evaluation = evaluate_resume_data(resume.resume_data)
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
    snapshot = resume_asset_master_response(profile)
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
) -> list[TailoredResume]:
    return list(
        db.scalars(
            select(TailoredResume)
            .where(TailoredResume.user_id == current_user.id)
            .order_by(TailoredResume.updated_at.desc(), TailoredResume.created_at.desc())
            .limit(limit)
        )
    )


@router.get("/tailored-resumes/{tailored_resume_id}", response_model=TailoredResumeRead)
def read_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    tailored_resume = db.get(TailoredResume, tailored_resume_id)
    if not tailored_resume or tailored_resume.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    return tailored_resume


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
