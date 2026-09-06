from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.api.routers.helpers import (
    apply_updates,
    ensure_single_default_job_hunting_profile,
    normalize_job_hunting_profile_values,
)
from services.shared.application_settings import (
    application_settings_from_storage,
    application_settings_to_storage,
)
from services.shared.autofill_profile import (
    core_profile_values,
    delete_core_profile_value,
    ensure_identity_core_values,
    profile_api_payload,
    upsert_core_profile_value,
)
from services.shared.database import get_db
from services.shared.models import JobHuntingProfile, MasterResume, RuntimeSettings, User
from services.shared.schemas import (
    JobHuntingProfileBase,
    JobHuntingProfileRead,
    RuntimeSettingsBase,
    RuntimeSettingsRead,
    UserRead,
)
from services.shared.time_utils import utc_now

router = APIRouter(prefix="/api", tags=["job_hunting_profiles"])

PROFILE_INPUT_FIELDS = (
    "years_of_experience",
    "require_visa",
    "website",
    "linkedin_url",
    "resume_path",
    "citizenship",
    "desired_salary",
    "current_ctc",
    "notice_period",
    "linkedin_headline",
    "linkedin_summary",
    "cover_letter",
    "user_information_all",
    "recent_employer",
    "confidence_level",
)


def merge_job_hunting_profile_application_inputs(job_hunting_profile: JobHuntingProfile) -> JobHuntingProfile:
    search_extra = dict(job_hunting_profile.extra_data or {})
    updated = False
    if getattr(job_hunting_profile, "resume_path", None) in (None, ""):
        legacy_resume_path = search_extra.get("default_resume_path")
        if legacy_resume_path not in (None, ""):
            job_hunting_profile.resume_path = str(legacy_resume_path)
            updated = True

    if updated:
        job_hunting_profile.updated_at = utc_now()
    return job_hunting_profile


def list_job_hunting_profiles_for_user(db: Session, current_user: User) -> list[JobHuntingProfile]:
    profiles = list(
        db.scalars(
            select(JobHuntingProfile)
            .where(JobHuntingProfile.user_id == current_user.id)
            .order_by(JobHuntingProfile.is_default.desc(), JobHuntingProfile.updated_at.desc())
        )
    )
    normalized_any = False
    for profile in profiles:
        before_inputs = JobHuntingProfileRead.model_validate(profile).model_dump(mode="python")
        merge_job_hunting_profile_application_inputs(profile)
        normalized_values = normalize_job_hunting_profile_values(
            JobHuntingProfileRead.model_validate(profile).model_dump(mode="python"),
            profile,
        )
        if any(before_inputs.get(field_name) != getattr(profile, field_name, None) for field_name in PROFILE_INPUT_FIELDS):
            normalized_any = True
        if before_inputs.get("extra_data") != (profile.extra_data or {}):
            normalized_any = True
        if (
            normalized_values.get("filters") != (profile.filters or {})
            or normalized_values.get("blacklist_rules") != (profile.blacklist_rules or {})
            or normalized_values.get("whitelist_rules") != (profile.whitelist_rules or {})
        ):
            apply_updates(profile, normalized_values)
            normalized_any = True
    if normalized_any:
        db.commit()
        for profile in profiles:
            db.refresh(profile)
    return profiles


def _sync_job_profile_core_values(
    db: Session,
    user: User,
    job_profile: JobHuntingProfile | None,
    *,
    overwrite: bool = False,
) -> None:
    if not job_profile:
        return
    extra_data = job_profile.extra_data if isinstance(job_profile.extra_data, dict) else {}
    title_value = next(
        (
            str(extra_data.get(key) or "").strip()
            for key in ("title", "salutation", "prefix", "honorific")
            if str(extra_data.get(key) or "").strip()
        ),
        None,
    )
    values = {
        "identity.title": title_value,
        "employment.current_location": job_profile.search_location,
        "employment.citizenship": job_profile.citizenship,
        "employment.visa_sponsorship": job_profile.require_visa,
        "employment.recent_employer": job_profile.recent_employer,
        "experience.years": job_profile.years_of_experience,
        "compensation.desired_base_salary": job_profile.desired_salary,
        "compensation.current_salary": job_profile.current_ctc,
        "employment.linkedin_url": job_profile.linkedin_url,
        "employment.website": job_profile.website,
        "employment.notice_period": job_profile.notice_period,
    }
    existing = core_profile_values(db, user.id)
    for key, value in values.items():
        if value is not None and str(value).strip() and (overwrite or not existing.get(key)):
            upsert_core_profile_value(db, user_id=user.id, core_field_key=key, value=str(value))
        elif overwrite and (value is None or not str(value).strip()):
            delete_core_profile_value(db, user_id=user.id, core_field_key=key)


def _legacy_runtime_values(runtime_settings: RuntimeSettings | None) -> dict[str, Any]:
    if runtime_settings is None:
        return {}
    return {
        "switch_number": 30,
        "use_AI": bool((runtime_settings.settings or {}).get("use_AI", False)),
        "llm_provider": (runtime_settings.settings or {}).get("llm_provider", ""),
        "llm_model": (runtime_settings.settings or {}).get("llm_model", ""),
        "pause_at_failed_question": runtime_settings.pause_at_failed_question,
        "ai_min_confidence": (runtime_settings.settings or {}).get("ai_min_confidence", 0.70),
        "enable_tailored_resume": (runtime_settings.settings or {}).get("enable_tailored_resume", True),
        "tailored_resume_threshold": (runtime_settings.settings or {}).get("tailored_resume_threshold", 0.80),
    }


def _legacy_policy_values(job_hunting_profile: JobHuntingProfile | None) -> dict[str, Any]:
    if job_hunting_profile is None:
        return {}
    filters = dict(job_hunting_profile.filters or {})
    blacklist = dict(job_hunting_profile.blacklist_rules or {})
    whitelist = dict(job_hunting_profile.whitelist_rules or {})

    def values(*keys: str) -> list[str]:
        result: list[str] = []
        for key in keys:
            raw = blacklist.get(key) or whitelist.get(key) or []
            if isinstance(raw, str):
                raw = [raw]
            if isinstance(raw, list):
                result.extend(str(item).strip() for item in raw if str(item).strip())
        return result

    return {
        "only_easy_apply": bool(filters.get("easy_apply_only", False)),
        "blacklisted_companies": values("companies", "bad_companies"),
        "blacklisted_job_terms": values("bad_words", "about_company_bad_words"),
        "whitelisted_companies": values("good_companies", "about_company_good_words"),
    }


@router.get("/job-hunting-profile", response_model=JobHuntingProfileRead)
def read_default_job_hunting_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobHuntingProfile:
    job_hunting_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.created_at.asc())
        .limit(1)
    )
    if job_hunting_profile:
        profiles = list_job_hunting_profiles_for_user(db, current_user)
        for profile in profiles:
            if profile.id == job_hunting_profile.id:
                return profile
        return job_hunting_profile

    job_hunting_profile = JobHuntingProfile(
        user_id=current_user.id,
        name="Default Job Hunting Profile",
        platform="linkedin",
        search_terms=[],
        filters={},
        blacklist_rules={},
        whitelist_rules={},
        is_default=True,
    )
    db.add(job_hunting_profile)
    _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
    db.commit()
    db.refresh(job_hunting_profile)
    return job_hunting_profile


@router.get("/job-hunting-profiles", response_model=list[JobHuntingProfileRead])
def read_job_hunting_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[JobHuntingProfile]:
    profiles = list_job_hunting_profiles_for_user(db, current_user)
    if profiles:
        return profiles

    job_hunting_profile = JobHuntingProfile(
        user_id=current_user.id,
        name="Default Job Hunting Profile",
        platform="linkedin",
        search_terms=[],
        filters={},
        blacklist_rules={},
        whitelist_rules={},
        is_default=True,
    )
    db.add(job_hunting_profile)
    db.commit()
    db.refresh(job_hunting_profile)
    return [job_hunting_profile]


@router.post("/job-hunting-profiles", response_model=JobHuntingProfileRead, status_code=status.HTTP_201_CREATED)
def create_job_hunting_profile(
    payload: JobHuntingProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobHuntingProfile:
    values = normalize_job_hunting_profile_values(payload.model_dump())
    profiles = list_job_hunting_profiles_for_user(db, current_user)
    should_be_default = values.get("is_default", True) or not profiles
    job_hunting_profile = JobHuntingProfile(user_id=current_user.id)
    apply_updates(
        job_hunting_profile,
        {
            **values,
            "is_default": should_be_default,
        },
    )
    db.add(job_hunting_profile)
    db.commit()
    db.refresh(job_hunting_profile)
    if should_be_default:
        ensure_single_default_job_hunting_profile(db, current_user, job_hunting_profile)
        db.commit()
        db.refresh(job_hunting_profile)
    return job_hunting_profile


@router.put("/job-hunting-profiles/{profile_id}", response_model=JobHuntingProfileRead)
def update_job_hunting_profile(
    profile_id: UUID,
    payload: JobHuntingProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobHuntingProfile:
    job_hunting_profile = db.get(JobHuntingProfile, profile_id)
    if not job_hunting_profile or job_hunting_profile.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Search profile not found")

    values = normalize_job_hunting_profile_values(payload.model_dump(), job_hunting_profile)
    apply_updates(job_hunting_profile, values)
    if job_hunting_profile.is_default:
        _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
    db.commit()
    db.refresh(job_hunting_profile)
    if job_hunting_profile.is_default:
        ensure_single_default_job_hunting_profile(db, current_user, job_hunting_profile)
        db.commit()
        db.refresh(job_hunting_profile)
    return job_hunting_profile


@router.post("/job-hunting-profiles/{profile_id}/activate", response_model=JobHuntingProfileRead)
def activate_job_hunting_profile(
    profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobHuntingProfile:
    job_hunting_profile = db.get(JobHuntingProfile, profile_id)
    if not job_hunting_profile or job_hunting_profile.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Search profile not found")

    job_hunting_profile.is_default = True
    ensure_single_default_job_hunting_profile(db, current_user, job_hunting_profile)
    _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
    db.commit()
    db.refresh(job_hunting_profile)
    return job_hunting_profile


@router.delete("/job-hunting-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job_hunting_profile(
    profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    job_hunting_profile = db.get(JobHuntingProfile, profile_id)
    if not job_hunting_profile or job_hunting_profile.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Search profile not found")

    profiles = list_job_hunting_profiles_for_user(db, current_user)
    if len(profiles) <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one search profile must remain")

    was_default = bool(job_hunting_profile.is_default)
    db.delete(job_hunting_profile)
    db.commit()

    if was_default:
        next_default = db.scalar(
            select(JobHuntingProfile)
            .where(JobHuntingProfile.user_id == current_user.id)
            .order_by(JobHuntingProfile.updated_at.desc(), JobHuntingProfile.created_at.desc())
            .limit(1)
        )
        if next_default:
            next_default.is_default = True
            ensure_single_default_job_hunting_profile(db, current_user, next_default)
            db.commit()


@router.put("/job-hunting-profile", response_model=JobHuntingProfileRead)
def update_default_job_hunting_profile(
    payload: JobHuntingProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobHuntingProfile:
    job_hunting_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.created_at.asc())
        .limit(1)
    )
    if not job_hunting_profile:
        values = normalize_job_hunting_profile_values(payload.model_dump())
        job_hunting_profile = JobHuntingProfile(user_id=current_user.id)
        apply_updates(
            job_hunting_profile,
            {
                **values,
                "is_default": True,
            },
        )
        db.add(job_hunting_profile)
        _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
        db.commit()
        db.refresh(job_hunting_profile)
        return job_hunting_profile

    return update_job_hunting_profile(job_hunting_profile.id, payload, db, current_user)


@router.get("/runtime-settings", response_model=RuntimeSettingsRead)
def read_runtime_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> RuntimeSettings:
    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))
    if runtime_settings:
        return runtime_settings

    runtime_settings = RuntimeSettings(user_id=current_user.id, settings={})
    db.add(runtime_settings)
    db.commit()
    db.refresh(runtime_settings)
    return runtime_settings


@router.get("/application-settings")
def read_application_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, dict[str, Any]]:
    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))
    job_hunting_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.updated_at.desc())
        .limit(1)
    )
    settings = application_settings_from_storage(
        runtime_settings.settings if runtime_settings else {},
        legacy_runtime=_legacy_runtime_values(runtime_settings),
        legacy_policy=_legacy_policy_values(job_hunting_profile),
    )
    return application_settings_to_storage(settings)


@router.put("/application-settings")
def update_application_settings(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, dict[str, Any]]:
    settings = application_settings_from_storage(payload)
    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))
    if not runtime_settings:
        runtime_settings = RuntimeSettings(user_id=current_user.id)
        db.add(runtime_settings)
    runtime_settings.settings = application_settings_to_storage(settings)
    db.commit()
    return application_settings_to_storage(settings)


@router.put("/runtime-settings", response_model=RuntimeSettingsRead)
def update_runtime_settings(
    payload: RuntimeSettingsBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> RuntimeSettings:
    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))
    if not runtime_settings:
        runtime_settings = RuntimeSettings(user_id=current_user.id)
        db.add(runtime_settings)

    apply_updates(runtime_settings, payload.model_dump())
    db.commit()
    db.refresh(runtime_settings)
    return runtime_settings


@router.get("/worker/config")
def read_worker_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    ensure_identity_core_values(db, current_user)
    job_hunting_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.updated_at.desc(), JobHuntingProfile.created_at.desc())
        .limit(1)
    )
    if not job_hunting_profile:
        job_hunting_profile = db.scalar(
            select(JobHuntingProfile)
            .where(JobHuntingProfile.user_id == current_user.id)
            .order_by(JobHuntingProfile.updated_at.desc(), JobHuntingProfile.created_at.desc())
            .limit(1)
        )

    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))
    if job_hunting_profile:
        merge_job_hunting_profile_application_inputs(job_hunting_profile)

    master_resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    master_resume_data = master_resume.resume_data if master_resume else None

    application_settings = application_settings_from_storage(
        runtime_settings.settings if runtime_settings else {},
        legacy_runtime=_legacy_runtime_values(runtime_settings),
        legacy_policy=_legacy_policy_values(job_hunting_profile),
    )

    return {
        "user": UserRead.model_validate(current_user).model_dump(mode="json"),
        "profile": profile_api_payload(db, current_user),
        "job_hunting_profile": JobHuntingProfileRead.model_validate(job_hunting_profile).model_dump(mode="json") if job_hunting_profile else None,
        "runtime_settings": RuntimeSettingsRead.model_validate(runtime_settings).model_dump(mode="json") if runtime_settings else None,
        "application_settings": application_settings_to_storage(application_settings),
        "master_resume_data": master_resume_data,
    }
