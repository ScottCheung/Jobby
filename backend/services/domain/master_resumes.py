import logging
from typing import Any
from urllib.parse import unquote, urlsplit
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select, text
from sqlalchemy.orm import Session

from services.api.routers.helpers import (
    CAREER_PROFILE_SOURCE,
    RESUME_UPLOAD_COST,
    dedupe_strings,
    ensure_single_default_job_hunting_profile,
    linkedin_url_from_resume_data,
    refund_resume_coins,
    resume_profile_name,
)
from services.shared.autofill_profile import core_profile_values, upsert_core_profile_value
from services.shared.database import SessionLocal
from services.shared.models import (
    JobHuntingProfile,
    MasterResume,
    Skill,
    User,
    UserSkill,
)
from services.shared.realtime import broadcast_sync
from services.shared.resume_parser import (
    ResumeParseError,
    enrich_resume_data_from_source,
    extract_pdf_text,
    normalize_resume_data,
    parse_resume_text_raw,
)
from services.shared.storage import StorageError, get_object_storage
from services.shared.time_utils import utc_now

logger = logging.getLogger(__name__)

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
    session_factory = SessionLocal
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
        extractor = extract_pdf_text
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


