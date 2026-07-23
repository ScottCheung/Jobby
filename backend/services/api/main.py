from datetime import datetime
from uuid import UUID
import asyncio

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

try:
    import orjson
    from fastapi.responses import ORJSONResponse
    DefaultResponseClass = ORJSONResponse
except ImportError:
    DefaultResponseClass = JSONResponse

from sqlalchemy import or_, select, text, func, cast, Date
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from services.shared.realtime import broadcaster, broadcast_sync


from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.job_link_repair import JobLinkRepairError, is_linkedin_public_summary, repair_from_link
from services.shared.models import (
    JobApplication,
    QuestionCacheEntry,
    RuntimeSettings,
    JobHuntingProfile,
    Skill,
    User,
    UserProfile,
)
from services.shared.schemas import (
    JobApplicationBase,
    JobApplicationRead,
    JobApplicationUpdate,
    QuestionCacheEntryBase,
    QuestionCacheEntryRead,
    RuntimeSettingsBase,
    RuntimeSettingsRead,
    JobHuntingProfileBase,
    JobHuntingProfileRead,
    SkillRead,
    UserProfileBase,
    UserProfileRead,
    UserRead,
)
from services.shared.settings import get_settings
from services.shared.storage import StorageError, get_object_storage
from services.shared.time_utils import parse_datetime_to_utc, utc_isoformat, utc_now
from services.shared.media import MediaError, optimize_avatar_to_webp


from services.api.routers.interview import (
    router as interview_router,
    application_gamification_snapshot,
    apply_application_gamification_events,
)

settings = get_settings()

tags_metadata = [
    {"name": "interview", "description": "Interview Preparation, Question Bank, Practice Records & AI Evaluation APIs"},
    {"name": "user", "description": "User Profile, Settings, & Authentication APIs"},
    {"name": "applications", "description": "Job Applications Tracking & Auto-Apply APIs"},
]

app = FastAPI(
    title="Auto Job Applier & Interview Prep API",
    description="High-performance backend API for AI Job Application Automation, Interview Question Library, Gamification, and Practice Mode.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=tags_metadata,
    default_response_class=DefaultResponseClass,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(interview_router)

from fastapi.staticfiles import StaticFiles
import os
audio_dir = "/app/storage/audio"
if not os.path.exists("/app") or not os.access("/", os.W_OK):
    audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "audio"))
os.makedirs(audio_dir, exist_ok=True)
app.mount("/api/interview/audio", StaticFiles(directory=audio_dir), name="audio")


@app.on_event("startup")
async def store_sse_loop() -> None:
    broadcaster.loop = asyncio.get_running_loop()


def apply_updates(model: object, values: dict) -> None:
    if "raw_data" in values and hasattr(model, "raw_data"):
        setattr(model, "raw_data", values["raw_data"])
    for key, value in values.items():
        if key == "raw_data":
            continue
        setattr(model, key, value)


def profile_response(profile: UserProfile, user: User) -> dict:
    data = UserProfileRead.model_validate(profile).model_dump(mode="json")
    data["preferred_name"] = user.display_name
    return data


def normalize_job_id(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None


def normalize_job_hunting_profile_values(values: dict, existing: JobHuntingProfile | None = None) -> dict:
    normalized = dict(values)
    filters = dict(normalized.get("filters") or {})
    blacklist_rules = dict(normalized.get("blacklist_rules") or {})
    whitelist_rules = dict(normalized.get("whitelist_rules") or {})

    existing_filters = dict(existing.filters or {}) if existing else {}
    existing_blacklist_rules = dict(existing.blacklist_rules or {}) if existing else {}
    existing_whitelist_rules = dict(existing.whitelist_rules or {}) if existing else {}

    for key in ("security_clearance", "did_masters", "current_experience"):
        if key not in filters and key in blacklist_rules:
            filters[key] = blacklist_rules.pop(key)
        elif key not in filters and key in existing_blacklist_rules and key not in existing_filters:
            filters[key] = existing_blacklist_rules[key]

    if "about_company_good_words" not in whitelist_rules:
        if "about_company_good_words" in blacklist_rules:
            whitelist_rules["about_company_good_words"] = blacklist_rules.pop(
                "about_company_good_words"
            )
        elif (
            "about_company_good_words" in existing_blacklist_rules
            and "about_company_good_words" not in existing_whitelist_rules
        ):
            whitelist_rules["about_company_good_words"] = existing_blacklist_rules[
                "about_company_good_words"
            ]

    normalized["filters"] = filters
    normalized["blacklist_rules"] = blacklist_rules
    normalized["whitelist_rules"] = whitelist_rules
    return normalized


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


def ensure_single_default_job_hunting_profile(
    db: Session,
    current_user: User,
    selected_profile: JobHuntingProfile,
) -> None:
    profiles = list(
        db.scalars(
            select(JobHuntingProfile).where(JobHuntingProfile.user_id == current_user.id)
        )
    )
    for profile in profiles:
        should_be_default = profile.id == selected_profile.id
        if bool(profile.is_default) == should_be_default:
            continue
        profile.is_default = should_be_default


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


def normalize_application_status(value: str | None) -> str:
    status_value = str(value or "").strip().lower()
    if status_value in {"applied", "apply", "success", "succeeded", "submitted"}:
        return "submitted"
    if status_value in {"processing", "running", "in_progress", "pending"}:
        return "processing"
    if status_value in {"interrupted", "needs_review", "timed_out", "timeout"}:
        return "interrupted"
    if status_value in {"cancelled", "canceled", "stopped"}:
        return "cancelled"
    if status_value in {"failed", "fail", "error", "skipped", "skiped", "skip"}:
        return "skipped"
    return status_value or "submitted"


def default_pipeline_stage_for_status(status_value: str | None) -> str:
    normalized = normalize_application_status(status_value)
    return "applied" if normalized == "submitted" else normalized


def infer_latest_timeline_stage(timeline: list[object]) -> str | None:
    normalized_entries: list[dict] = []
    for entry in timeline:
        if isinstance(entry, dict):
            normalized_entries.append(entry)
    if not normalized_entries:
        return None

    sorted_entries = sorted(
        normalized_entries,
        key=lambda entry: str(entry.get("timestamp") or ""),
    )
    latest_stage = str(sorted_entries[-1].get("stage") or "").strip().lower()
    if not latest_stage:
        return None

    if latest_stage == "applied":
        for entry in reversed(sorted_entries[:-1]):
            stage = str(entry.get("stage") or "").strip().lower()
            if stage and stage != "applied":
                return stage
    return latest_stage


def infer_latest_timeline_timestamp(timeline: list[object], stage: str | None = None) -> datetime | None:
    normalized_entries: list[dict] = []
    for entry in timeline:
        if isinstance(entry, dict):
            normalized_entries.append(entry)
    if not normalized_entries:
        return None

    sorted_entries = sorted(
        normalized_entries,
        key=lambda entry: str(entry.get("timestamp") or ""),
    )

    if stage:
        for entry in reversed(sorted_entries):
            entry_stage = str(entry.get("stage") or "").strip().lower()
            if entry_stage != stage:
                continue
            parsed = parse_datetime_to_utc(entry.get("timestamp"))
            if parsed is not None:
                return parsed

    for entry in reversed(sorted_entries):
        parsed = parse_datetime_to_utc(entry.get("timestamp"))
        if parsed is not None:
            return parsed

    return None


def sync_application_status_from_timeline(values: dict, existing: JobApplication | None = None) -> None:
    has_incoming_raw_data = isinstance(values.get("raw_data"), dict)
    raw_data = values.get("raw_data")
    if not isinstance(raw_data, dict):
        raw_data = (existing.raw_data or {}) if existing else {}
    else:
        raw_data = dict(raw_data)

    timeline = raw_data.get("timeline")
    if not isinstance(timeline, list) or not timeline:
        return
    if "status" in values and not has_incoming_raw_data:
        return

    latest_stage = infer_latest_timeline_stage(timeline)
    if not latest_stage:
        return

    raw_data["pipeline_stage"] = latest_stage
    raw_data["status"] = normalize_application_status("submitted" if latest_stage == "applied" else latest_stage)
    values["raw_data"] = raw_data
    values["pipeline_stage"] = latest_stage
    values["status"] = normalize_application_status("submitted" if latest_stage == "applied" else latest_stage)


def ensure_pipeline_stage(values: dict, existing: JobApplication | None = None) -> None:
    current_stage = values.get("pipeline_stage")
    if isinstance(current_stage, str) and current_stage.strip():
        return
    if "status" in values:
        values["pipeline_stage"] = default_pipeline_stage_for_status(values.get("status"))
        return
    if existing:
        existing_stage = str(existing.pipeline_stage or "").strip()
        if existing_stage:
            values["pipeline_stage"] = existing_stage
            return
    values["pipeline_stage"] = default_pipeline_stage_for_status(values.get("status"))


def ensure_application_date_applied(values: dict, existing: JobApplication | None = None) -> None:
    next_status = normalize_application_status(
        values.get("status") if "status" in values else getattr(existing, "status", None)
    )
    if values.get("date_applied") is not None:
        return
    if existing and existing.date_applied is not None:
        return
    if next_status in {"submitted", "cancelled"}:
        values["date_applied"] = utc_now()


def ensure_status_updated_at(values: dict, existing: JobApplication | None = None) -> None:
    explicit_status_timestamp = values.get("status_updated_at")
    if explicit_status_timestamp is not None:
        return

    raw_data = values.get("raw_data")
    if not isinstance(raw_data, dict):
        raw_data = dict(existing.raw_data or {}) if existing else {}
    else:
        raw_data = dict(raw_data)

    next_status = normalize_application_status(
        values.get("status") if "status" in values else getattr(existing, "status", None)
    )
    current_stage = str(values.get("pipeline_stage") or getattr(existing, "pipeline_stage", "") or "").strip().lower()
    normalized_stage = "applied" if next_status == "submitted" else (current_stage or default_pipeline_stage_for_status(next_status))

    timeline = raw_data.get("timeline")
    if isinstance(timeline, list) and timeline:
        timeline_timestamp = infer_latest_timeline_timestamp(timeline, normalized_stage)
        if timeline_timestamp is not None:
            values["status_updated_at"] = timeline_timestamp
            return

    if existing and "status" not in values and "pipeline_stage" not in values and not (
        isinstance(values.get("raw_data"), dict) and "timeline" in values["raw_data"]
    ):
        values["status_updated_at"] = existing.status_updated_at
        return

    fallback_timestamp = None
    if normalized_stage == "applied":
        fallback_timestamp = (
            values.get("date_applied")
            or getattr(existing, "date_applied", None)
            or values.get("updated_at")
            or getattr(existing, "updated_at", None)
        )
    else:
        fallback_timestamp = values.get("updated_at") or getattr(existing, "updated_at", None)

    values["status_updated_at"] = fallback_timestamp or getattr(existing, "status_updated_at", None) or utc_now()


def _normalized_text(value: str | None) -> str:
    return " ".join(str(value or "").strip().lower().split())


def find_existing_application(
    db: Session,
    current_user: User,
    values: dict,
) -> JobApplication | None:
    job_id = normalize_job_id(values.get("job_id")) or ""
    job_link = str(values.get("job_link") or "").strip()
    external_job_link = str(values.get("external_job_link") or "").strip()
    title = _normalized_text(values.get("title"))
    company = _normalized_text(values.get("company"))

    query = select(JobApplication).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None),
    )

    link_clauses = []
    if job_link:
        link_clauses.extend([
            JobApplication.job_link == job_link,
            JobApplication.raw_data['external_job_link'].as_string() == job_link,
        ])
    if external_job_link:
        link_clauses.extend([
            JobApplication.raw_data['external_job_link'].as_string() == external_job_link,
            JobApplication.job_link == external_job_link,
        ])

    if job_id:
        query = query.where(JobApplication.job_id == job_id)
    elif link_clauses:
        query = query.where(or_(*link_clauses))
    elif title and company:
        query = query.where(
            JobApplication.title.is_not(None),
            JobApplication.company.is_not(None),
        )
    else:
        return None

    candidates = list(
        db.scalars(
            query.order_by(
                JobApplication.date_applied.desc().nullslast(),
                JobApplication.updated_at.desc(),
                JobApplication.created_at.desc(),
            )
        )
    )
    if not candidates:
        return None

    if job_id:
        return candidates[0]

    for candidate in candidates:
        if job_link and (candidate.job_link == job_link or candidate.external_job_link == job_link):
            return candidate
        if external_job_link and (
            candidate.external_job_link == external_job_link or candidate.job_link == external_job_link
        ):
            return candidate

    for candidate in candidates:
        if _normalized_text(candidate.title) == title and _normalized_text(candidate.company) == company:
            return candidate

    return None


def reconcile_stale_processing_applications(
    db: Session,
    current_user: User,
    timeout_seconds: int = 120,
) -> list[JobApplication]:
    now = utc_now()
    rows = list(
        db.scalars(
            select(JobApplication).where(
                JobApplication.user_id == current_user.id,
                JobApplication.deleted_at.is_(None),
                JobApplication.status == "processing",
            )
        )
    )

    updated_rows: list[JobApplication] = []
    for application in rows:
        last_touched = application.updated_at or application.created_at
        if not last_touched:
            continue
        comparable_last_touched = (
            last_touched.astimezone(now.tzinfo) if last_touched.tzinfo and now.tzinfo else last_touched
        )
        if (now - comparable_last_touched).total_seconds() <= timeout_seconds:
            continue

        application.status = "interrupted"
        application.skip_reason = application.skip_reason or "Application flow was interrupted and needs review"
        raw_data = application.raw_data or {}
        application.raw_data = {
            **raw_data,
            "processing_timeout_at": utc_isoformat(now),
            "processing_recovered_as": "interrupted",
        }
        updated_rows.append(application)

    if updated_rows:
        db.commit()
        for application in updated_rows:
            db.refresh(application)
            broadcast_sync(
                "application_updated",
                JobApplicationRead.model_validate(application).model_dump(mode="json"),
            )

    return updated_rows


def async_application_from_link_record(application: JobApplication) -> tuple[dict, str | None]:
    link = application.job_link or application.external_job_link
    original_location = application.work_location
    if not link:
        warning = "This application does not have a job link to async from"
        application.raw_data = {
            **(application.raw_data or {}),
            "link_async_warning": warning,
            "link_async_attempted_at": utc_isoformat(utc_now()),
            "link_async_trace": {
                "source_link": None,
                "original_location": original_location,
                "repaired_location": None,
                "selected_location": original_location,
                "fields": [],
            },
        }
        return {}, warning

    try:
        repaired = repair_from_link(link)
    except JobLinkRepairError as error:
        warning = str(error)
        application.raw_data = {
            **(application.raw_data or {}),
            "link_async_warning": warning,
            "link_async_attempted_at": utc_isoformat(utc_now()),
            "link_async_trace": {
                "source_link": link,
                "original_location": original_location,
                "repaired_location": None,
                "selected_location": original_location,
                "fields": [],
            },
        }
        return {}, warning

    updatable_fields = ("job_id", "title", "company", "work_location", "job_description")
    updates = {field: repaired.get(field) for field in updatable_fields if repaired.get(field)}
    if application.job_description and is_linkedin_public_summary(application.job_description) and not updates.get("job_description"):
        updates["job_description"] = None
    if not updates:
        warning = "LinkedIn only returned a public preview for this job. Full JD needs to be captured by the local browser worker while logged in."
        application.raw_data = {
            **(application.raw_data or {}),
            "link_async_warning": warning,
            "link_async_attempted_at": utc_isoformat(utc_now()),
            "link_async_trace": {
                "source_link": link,
                "original_location": original_location,
                "repaired_location": repaired.get("work_location"),
                "selected_location": original_location,
                "fields": [],
            },
        }
        return {}, warning

    apply_updates(application, updates)
    application.raw_data = {
        **(application.raw_data or {}),
        "link_async_warning": None,
        "link_async": {
            "attempted_at": utc_isoformat(utc_now()),
            "source_link": link,
            "fields": sorted(updates.keys()),
        },
        "link_async_trace": {
            "source_link": link,
            "original_location": original_location,
            "repaired_location": repaired.get("work_location"),
            "selected_location": application.work_location,
            "fields": sorted(updates.keys()),
        },
    }
    return updates, None


UNKNOWN_LOCATION_VALUES = {
    "",
    "unknown",
    "null",
    "none",
    "not specified",
    "location not recorded",
}


def _has_meaningful_location(value: str | None) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized not in UNKNOWN_LOCATION_VALUES


def _is_worker_application_payload(values: dict) -> bool:
    raw_data = values.get("raw_data")
    if not isinstance(raw_data, dict):
        return False
    return any(key in raw_data for key in ("logged_at", "search_term", "application_type"))


def _has_link_repaired_work_location(application: JobApplication) -> bool:
    if not _has_meaningful_location(application.work_location):
        return False

    raw_data = application.raw_data or {}
    link_async = raw_data.get("link_async")
    if isinstance(link_async, dict) and "work_location" in set(link_async.get("fields") or []):
        return True

    link_async_trace = raw_data.get("link_async_trace")
    if isinstance(link_async_trace, dict) and link_async_trace.get("repaired_location"):
        return True

    return False


def preserve_link_repaired_location(values: dict, existing: JobApplication | None = None) -> None:
    if not existing or "work_location" not in values or not _is_worker_application_payload(values):
        return
    if not _has_link_repaired_work_location(existing):
        return

    incoming_location = values.pop("work_location")
    raw_data = dict(values.get("raw_data") or {})
    raw_data["worker_reported_work_location"] = incoming_location
    values["raw_data"] = raw_data


def sync_worker_application_from_link(application: JobApplication, values: dict) -> None:
    if not _is_worker_application_payload(values):
        return
    if "work_location" not in values and "job_link" not in values and "external_job_link" not in values:
        return
    if not (application.job_link or application.external_job_link):
        return

    async_application_from_link_record(application)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def readiness(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {
        "status": "ready",
        "database": "connected",
        "worker_mode": "in_process" if settings.enable_api_local_worker else "desktop_agent",
        "capabilities": {
            "tenancy_mode": "single_user",
            "supported_platforms": ["linkedin"],
            "future_platforms": ["seek"],
        },
    }


@app.get("/api/sse")
async def sse_endpoint():
    q = broadcaster.subscribe()
    async def event_generator():
        try:
            yield "retry: 1000\n:event stream connected\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(q.get(), timeout=15)
                    yield message
                except asyncio.TimeoutError:
                    # Comments keep browser, proxy, and load-balancer connections alive.
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )



@app.get("/api/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_or_create_current_user)) -> User:
    return current_user


@app.post("/api/me/avatar", response_model=UserRead)
def upload_current_user_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> User:
    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(status_code=400, detail="Use a PNG, JPEG, WebP, or GIF image")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(content) > settings.image_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Image must be 12 MB or smaller")
    try:
        optimized = optimize_avatar_to_webp(content)
    except MediaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        public_url = get_object_storage().upload(
            f"user-avatars/{current_user.id}/avatar.webp",
            optimized,
            "image/webp",
        )
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # The stable storage key is overwritten, so version the public URL to avoid
    # clients retaining the previous image under its long-lived cache policy.
    current_user.avatar_url = f"{public_url}?v={int(utc_now().timestamp())}"
    db.commit()
    db.refresh(current_user)
    return current_user


@app.delete("/api/me/avatar", response_model=UserRead)
def remove_current_user_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> User:
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/profile", response_model=UserProfileRead)
def read_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if profile:
        return profile_response(profile, current_user)

    profile = UserProfile(user_id=current_user.id, extra_data={})
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile_response(profile, current_user)


@app.put("/api/profile", response_model=UserProfileRead)
def update_profile(
    payload: UserProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    values = payload.model_dump(exclude_unset=True)
    preferred_name = (values.pop("preferred_name", None) or "").strip()
    if preferred_name:
        current_user.display_name = preferred_name[:255]
    apply_updates(profile, values)
    db.commit()
    db.refresh(profile)
    db.refresh(current_user)
    return profile_response(profile, current_user)


@app.get("/api/job-hunting-profile", response_model=JobHuntingProfileRead)
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
        name="Default LinkedIn Search",
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
    return job_hunting_profile


@app.get("/api/job-hunting-profiles", response_model=list[JobHuntingProfileRead])
def read_job_hunting_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[JobHuntingProfile]:
    profiles = list_job_hunting_profiles_for_user(db, current_user)
    if profiles:
        return profiles

    job_hunting_profile = JobHuntingProfile(
        user_id=current_user.id,
        name="Default LinkedIn Search",
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


@app.post("/api/job-hunting-profiles", response_model=JobHuntingProfileRead, status_code=status.HTTP_201_CREATED)
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


@app.put("/api/job-hunting-profiles/{profile_id}", response_model=JobHuntingProfileRead)
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
    db.commit()
    db.refresh(job_hunting_profile)
    if job_hunting_profile.is_default:
        ensure_single_default_job_hunting_profile(db, current_user, job_hunting_profile)
        db.commit()
        db.refresh(job_hunting_profile)
    return job_hunting_profile


@app.post("/api/job-hunting-profiles/{profile_id}/activate", response_model=JobHuntingProfileRead)
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
    db.commit()
    db.refresh(job_hunting_profile)
    return job_hunting_profile


@app.delete("/api/job-hunting-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@app.put("/api/job-hunting-profile", response_model=JobHuntingProfileRead)
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
        db.commit()
        db.refresh(job_hunting_profile)
        return job_hunting_profile

    return update_job_hunting_profile(job_hunting_profile.id, payload, db, current_user)


@app.get("/api/runtime-settings", response_model=RuntimeSettingsRead)
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


@app.get("/api/worker/config")
def read_worker_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    job_hunting_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.created_at.asc())
        .limit(1)
    )
    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))
    if job_hunting_profile:
        merge_job_hunting_profile_application_inputs(job_hunting_profile)

    return {
        "user": UserRead.model_validate(current_user).model_dump(mode="json"),
        "profile": UserProfileRead.model_validate(profile).model_dump(mode="json") if profile else None,
        "job_hunting_profile": JobHuntingProfileRead.model_validate(job_hunting_profile).model_dump(mode="json") if job_hunting_profile else None,
        "runtime_settings": RuntimeSettingsRead.model_validate(runtime_settings).model_dump(mode="json") if runtime_settings else None,
    }


@app.put("/api/runtime-settings", response_model=RuntimeSettingsRead)
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


@app.get("/api/question-cache", response_model=list[QuestionCacheEntryRead])
def list_question_cache(
    limit: int | None = Query(default=None),
    offset: int | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[QuestionCacheEntry]:
    query = select(QuestionCacheEntry).where(QuestionCacheEntry.user_id == current_user.id)
    if search:
        search_query = f"%{search.strip().lower()}%"
        query = query.where(
            QuestionCacheEntry.original_label.ilike(search_query) |
            QuestionCacheEntry.answer.ilike(search_query)
        )
    stmt = query.order_by(QuestionCacheEntry.last_used_at.desc().nullslast(), QuestionCacheEntry.created_at.desc())
    if offset is not None:
        stmt = stmt.offset(offset)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))



@app.post("/api/question-cache/upsert", response_model=QuestionCacheEntryRead)
def upsert_question_cache_entry(
    payload: QuestionCacheEntryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> QuestionCacheEntry:
    entry = db.scalar(
        select(QuestionCacheEntry).where(
            QuestionCacheEntry.user_id == current_user.id,
            QuestionCacheEntry.platform == payload.platform,
            QuestionCacheEntry.normalized_label == payload.normalized_label,
            QuestionCacheEntry.field_type == payload.field_type,
        )
    )
    if not entry:
        entry = QuestionCacheEntry(user_id=current_user.id)
        db.add(entry)

    apply_updates(entry, payload.model_dump())
    db.commit()
    db.refresh(entry)
    broadcast_sync("question_cache_upserted", QuestionCacheEntryRead.model_validate(entry).model_dump(mode="json"))
    return entry


@app.post("/api/question-cache", response_model=QuestionCacheEntryRead, status_code=status.HTTP_201_CREATED)
def create_question_cache_entry(
    payload: QuestionCacheEntryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> QuestionCacheEntry:
    entry = QuestionCacheEntry(user_id=current_user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    broadcast_sync("question_cache_created", QuestionCacheEntryRead.model_validate(entry).model_dump(mode="json"))
    return entry


@app.put("/api/question-cache/{entry_id}", response_model=QuestionCacheEntryRead)
def update_question_cache_entry(
    entry_id: UUID,
    payload: QuestionCacheEntryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> QuestionCacheEntry:
    entry = db.get(QuestionCacheEntry, entry_id)
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question cache entry not found")

    apply_updates(entry, payload.model_dump())
    db.commit()
    db.refresh(entry)
    broadcast_sync("question_cache_updated", QuestionCacheEntryRead.model_validate(entry).model_dump(mode="json"))
    return entry


@app.delete("/api/question-cache/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question_cache_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    entry = db.get(QuestionCacheEntry, entry_id)
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question cache entry not found")

    db.delete(entry)
    db.commit()
    broadcast_sync("question_cache_deleted", {"id": str(entry_id)})


@app.get("/api/applications/stats")
def get_applications_stats(
    timezone: str = Query("UTC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    # 1. Total applications
    total_stmt = select(func.count(JobApplication.id)).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None)
    )
    total_applications = db.scalar(total_stmt) or 0

    # 2. Total submitted applications
    total_submitted_stmt = select(func.count(JobApplication.id)).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None),
        ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"])
    )
    total_submitted = db.scalar(total_submitted_stmt) or 0

    # 3. Today's and Yesterday's submitted and processed
    # Coalesce display date: status_updated_at ?? date_applied ?? updated_at ?? created_at
    display_dt = func.coalesce(
        JobApplication.status_updated_at,
        JobApplication.date_applied,
        JobApplication.updated_at,
        JobApplication.created_at
    )

    try:
        local_date_expr = cast(func.timezone(timezone, display_dt), Date)
        today_expr = cast(func.timezone(timezone, func.now()), Date)
        yesterday_expr = cast(func.timezone(timezone, func.now() - text("INTERVAL '1 day'")), Date)

        # today submitted
        today_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"]),
            local_date_expr == today_expr
        )
        today_submitted = db.scalar(today_submitted_stmt) or 0

        # yesterday submitted
        yesterday_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"]),
            local_date_expr == yesterday_expr
        )
        yesterday_submitted = db.scalar(yesterday_submitted_stmt) or 0

        # today processed
        today_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            local_date_expr == today_expr
        )
        today_processed = db.scalar(today_processed_stmt) or 0

        # yesterday processed
        yesterday_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            local_date_expr == yesterday_expr
        )
        yesterday_processed = db.scalar(yesterday_processed_stmt) or 0

    except Exception:
        # Fallback to UTC
        local_date_expr = cast(func.timezone("UTC", display_dt), Date)
        today_expr = cast(func.timezone("UTC", func.now()), Date)
        yesterday_expr = cast(func.timezone("UTC", func.now() - text("INTERVAL '1 day'")), Date)

        # today submitted
        today_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"]),
            local_date_expr == today_expr
        )
        today_submitted = db.scalar(today_submitted_stmt) or 0

        # yesterday submitted
        yesterday_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"]),
            local_date_expr == yesterday_expr
        )
        yesterday_submitted = db.scalar(yesterday_submitted_stmt) or 0

        # today processed
        today_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            local_date_expr == today_expr
        )
        today_processed = db.scalar(today_processed_stmt) or 0

        # yesterday processed
        yesterday_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            local_date_expr == yesterday_expr
        )
        yesterday_processed = db.scalar(yesterday_processed_stmt) or 0

    # 4. Interviewing
    interviewing_stmt = select(func.count(JobApplication.id)).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None),
        JobApplication.raw_data['pipeline_stage'].as_string() == "interviewing"
    )
    interviewing = db.scalar(interviewing_stmt) or 0

    # 5. Skipped
    skipped_stmt = select(func.count(JobApplication.id)).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None),
        JobApplication.status.ilike("%skip%")
    )
    skipped = db.scalar(skipped_stmt) or 0

    return {
        "total_applications": total_applications,
        "submitted": total_submitted,
        "today_submitted": today_submitted,
        "yesterday_submitted": yesterday_submitted,
        "today_processed": today_processed,
        "yesterday_processed": yesterday_processed,
        "interviewing": interviewing,
        "skipped": skipped
    }


@app.get("/api/applications", response_model=list[JobApplicationRead])
def list_applications(
    status_filter: str | None = Query(default=None, alias="status"),
    include_deleted: bool = Query(default=False),
    limit: int | None = Query(default=None),
    offset: int | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[JobApplication]:
    reconcile_stale_processing_applications(db, current_user)
    query = select(JobApplication).where(JobApplication.user_id == current_user.id)
    if not include_deleted:
        query = query.where(JobApplication.deleted_at.is_(None))
    if status_filter:
        norm_status = normalize_application_status(status_filter)
        if norm_status == "submitted":
            query = query.where(
                ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"])
            )
        else:
            query = query.where(JobApplication.status == norm_status)
    if search:
        search_query = f"%{search.strip().lower()}%"
        query = query.where(
            JobApplication.title.ilike(search_query) |
            JobApplication.company.ilike(search_query) |
            JobApplication.job_id.ilike(search_query)
        )
    stmt = query.order_by(
        JobApplication.status_updated_at.desc().nullslast(),
        JobApplication.date_applied.desc().nullslast(),
        JobApplication.updated_at.desc(),
        JobApplication.created_at.desc(),
    )
    if offset is not None:
        stmt = stmt.offset(offset)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))



@app.post("/api/applications", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: JobApplicationBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobApplication:
    values = payload.model_dump()
    values["job_id"] = normalize_job_id(values.get("job_id"))
    values["status"] = normalize_application_status(values.get("status"))
    sync_application_status_from_timeline(values)
    ensure_pipeline_stage(values)
    values["work_style"] = None
    ensure_application_date_applied(values)
    ensure_status_updated_at(values)
    existing_application = find_existing_application(db, current_user, values)
    if existing_application:
        previous_snapshot = application_gamification_snapshot(existing_application)
        preserve_link_repaired_location(values, existing_application)
        ensure_status_updated_at(values, existing_application)
        apply_updates(existing_application, values)
        sync_worker_application_from_link(existing_application, values)
        apply_application_gamification_events(
            db,
            current_user,
            existing_application,
            previous_snapshot,
            utc_now(),
        )
        db.commit()
        db.refresh(existing_application)
        broadcast_sync("application_updated", JobApplicationRead.model_validate(existing_application).model_dump(mode="json"))
        return existing_application

    application = JobApplication(user_id=current_user.id)
    apply_updates(application, values)
    if application.job_link or application.external_job_link:
        async_application_from_link_record(application)
    db.add(application)
    db.flush()
    apply_application_gamification_events(
        db,
        current_user,
        application,
        None,
        utc_now(),
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_application = find_existing_application(db, current_user, values)
        if not existing_application:
            raise
        previous_snapshot = application_gamification_snapshot(existing_application)
        preserve_link_repaired_location(values, existing_application)
        apply_updates(existing_application, values)
        sync_worker_application_from_link(existing_application, values)
        apply_application_gamification_events(
            db,
            current_user,
            existing_application,
            previous_snapshot,
            utc_now(),
        )
        db.commit()
        db.refresh(existing_application)
        broadcast_sync("application_updated", JobApplicationRead.model_validate(existing_application).model_dump(mode="json"))
        return existing_application
    db.refresh(application)
    broadcast_sync("application_created", JobApplicationRead.model_validate(application).model_dump(mode="json"))
    return application


@app.put("/api/applications/{application_id}", response_model=JobApplicationRead)
def update_application(
    application_id: UUID,
    payload: JobApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobApplication:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    values = payload.model_dump(exclude_unset=True)
    if "job_id" in values:
        values["job_id"] = normalize_job_id(values.get("job_id"))
    if "status" in values:
        values["status"] = normalize_application_status(values.get("status"))
    sync_application_status_from_timeline(values, application)
    ensure_pipeline_stage(values, application)
    ensure_application_date_applied(values, application)
    ensure_status_updated_at(values, application)
    preserve_link_repaired_location(values, application)
    previous_snapshot = application_gamification_snapshot(application)
    apply_updates(application, values)
    sync_worker_application_from_link(application, values)
    apply_application_gamification_events(
        db,
        current_user,
        application,
        previous_snapshot,
        utc_now(),
    )
    db.commit()
    db.refresh(application)
    broadcast_sync("application_updated", JobApplicationRead.model_validate(application).model_dump(mode="json"))
    return application


@app.post("/api/applications/{application_id}/repair-from-link", response_model=JobApplicationRead)
def repair_application_from_link(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobApplication:
    return async_application_from_link(application_id, db, current_user)


@app.post("/api/applications/{application_id}/async-from-link", response_model=JobApplicationRead)
def async_application_from_link(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobApplication:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if application.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application was deleted")

    _, error = async_application_from_link_record(application)
    db.commit()
    db.refresh(application)
    broadcast_sync("application_updated", JobApplicationRead.model_validate(application).model_dump(mode="json"))
    return application


@app.post("/api/applications/async-from-link/batch")
def async_applications_from_link_batch(
    limit: int = Query(default=100, ge=1, le=1000),
    status_filter: str | None = Query(default=None, alias="status"),
    only_missing: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    query = (
        select(JobApplication)
        .where(JobApplication.user_id == current_user.id, JobApplication.deleted_at.is_(None), JobApplication.job_link.is_not(None))
        .order_by(JobApplication.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        norm_status = normalize_application_status(status_filter)
        if norm_status == "submitted":
            query = query.where(
                ~JobApplication.status.in_(["processing", "interrupted", "skipped", "cancelled"])
            )
        else:
            query = query.where(JobApplication.status == norm_status)
    if only_missing:
        query = query.where(
            (JobApplication.title.is_(None))
            | (JobApplication.company.is_(None))
            | (JobApplication.work_location.is_(None))
            | (JobApplication.job_description.is_(None))
        )

    rows = list(db.scalars(query))
    results = []
    repaired_count = 0
    failed_count = 0
    repaired_rows = []
    for application in rows:
        updates, error = async_application_from_link_record(application)
        if error:
            failed_count += 1
            results.append({"id": str(application.id), "status": "failed", "error": error})
        else:
            repaired_count += 1
            results.append({"id": str(application.id), "status": "synced", "fields": sorted(updates.keys())})
            repaired_rows.append(application)

    db.commit()
    for application in repaired_rows:
        db.refresh(application)
        broadcast_sync("application_updated", JobApplicationRead.model_validate(application).model_dump(mode="json"))

    return {
        "processed": len(rows),
        "synced": repaired_count,
        "failed": failed_count,
        "results": results,
    }


@app.delete("/api/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.deleted_at = utc_now()
    db.commit()
    broadcast_sync("application_deleted", {"id": str(application_id)})


@app.get("/api/applications/{application_id}", response_model=JobApplicationRead)
def read_application(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobApplication:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id or application.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


@app.get("/api/skills/version")
def get_skills_version(db: Session = Depends(get_db)) -> dict:
    latest = db.scalar(select(Skill.updated_at).order_by(Skill.updated_at.desc()).limit(1))
    return {"version": latest.isoformat() if latest else None}


@app.get("/api/skills")
def get_skills(db: Session = Depends(get_db)) -> dict:
    latest = db.scalar(select(Skill.updated_at).order_by(Skill.updated_at.desc()).limit(1))
    version_str = latest.isoformat() if latest else None

    skills = db.scalars(select(Skill)).all()
    index_map = {s.name: s.canonical_name for s in skills}

    return {
        "version": version_str,
        "index": index_map
    }
