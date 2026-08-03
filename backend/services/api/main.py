from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4
import asyncio
import logging
from urllib.parse import unquote, urlsplit
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

try:
    import orjson
    from fastapi.responses import ORJSONResponse
    DefaultResponseClass = ORJSONResponse
except ImportError:
    DefaultResponseClass = JSONResponse

from sqlalchemy import delete, or_, select, text, func, cast, Date, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from services.shared.realtime import broadcaster, broadcast_sync


from services.api.dependencies import get_or_create_current_user
from services.shared.database import SessionLocal, get_db
from services.shared.job_link_repair import JobLinkRepairError, is_linkedin_public_summary, repair_from_link
from services.shared.models import (
    JobApplication,
    QuestionCacheEntry,
    RuntimeSettings,
    JobHuntingProfile,
    GamificationTransaction,
    MasterResume,
    CareerProfileScoreSnapshot,
    MasterResumeEvaluationSnapshot,
    MasterResumeVersion,
    TailoredResume,
    Skill,
    User,
    UserGamification,
    UserProfile,
    UserSkill,
)
from services.shared.schemas import (
    JobApplicationBase,
    JobApplicationRead,
    JobApplicationUpdate,
    QuestionCacheEntryBase,
    QuestionCacheEntryRead,
    RuntimeSettingsBase,
    RuntimeSettingsRead,
    ApplicationDecisionRequest,
    ApplicationFormInstructionsRequest,
    ApplicationFormInstructionsResponse,
    ApplicationPlanActionRequest,
    ApplicationPlanCreateRequest,
    JobHuntingProfileBase,
    JobHuntingProfileRead,
    MasterResumeRead,
    MasterResumeEvaluationHistoryRead,
    MasterResumeVersionRead,
    MasterResumeUpdate,
    CareerProfileRead,
    CareerProfileScoreHistoryRead,
    CareerProfileUpdate,
    TailoredResumeRead,
    ResumeAssetRead,
    ResumeSourceRead,
    SkillRead,
    UserProfileBase,
    UserProfileRead,
    UserRead,
)
from services.shared.settings import get_settings
from services.shared.storage import StorageError, get_object_storage
from services.shared.application_settings import (
    application_settings_from_storage,
    application_settings_to_storage,
)
from services.shared.application_decisions import evaluate_candidate, evaluation_to_dict
from services.shared.application_plans import (
    append_plan_event,
    plan_can_be_reevaluated,
    plan_from_dict,
    plan_requires_tailored_resume,
    plan_to_dict,
)
from application_core.models import ApplicationState
from application_core.workflow import (
    approve_review,
    begin_preparation,
    begin_submission,
    mark_failed,
    mark_prepared,
    mark_submitted,
    reject_review,
    request_review,
)
from services.shared.time_utils import parse_datetime_to_utc, utc_isoformat, utc_now
from services.shared.media import MediaError, optimize_avatar_to_webp
from services.shared.resume_parser import ResumeParseError, enrich_resume_data_from_source, extract_pdf_source, extract_pdf_text, normalize_resume_data, parse_resume_text, parse_resume_text_raw
from services.shared.resume_evaluator import RUBRIC_VERSION, ResumeEvaluationError, evaluate_resume_data, resume_content_hash
from services.shared.deepseek import DeepSeekError
from services.shared.job_review import build_tailor_messages, review_job


from services.api.routers.interview import (
    router as interview_router,
    application_gamification_snapshot,
    apply_application_gamification_events,
)
from services.api.routers.prospects import router as prospects_router

settings = get_settings()
logger = logging.getLogger(__name__)

RESUME_PARSE_COST = 5
RESUME_EVALUATION_COST = 10
RESUME_UPLOAD_COST = RESUME_PARSE_COST
CAREER_PROFILE_UPLOAD_AND_SCORE_COST = RESUME_UPLOAD_COST + RESUME_EVALUATION_COST
RESUME_RECOVERY_AFTER = timedelta(minutes=2)

tags_metadata = [
    {"name": "interview", "description": "Interview Preparation, Question Bank, Practice Records & AI Evaluation APIs"},
    {"name": "user", "description": "User Profile, Settings, & Authentication APIs"},
    {"name": "applications", "description": "Job Applications Tracking & Auto-Apply APIs"},
    {"name": "prospects", "description": "AI Prospect Discovery & Recruiter Outreach APIs"},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    broadcaster.loop = asyncio.get_running_loop()
    yield


app = FastAPI(
    title="Auto Job Applier & Interview Prep API",
    description="High-performance backend API for AI Job Application Automation, Interview Question Library, Gamification, and Practice Mode.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=tags_metadata,
    default_response_class=DefaultResponseClass,
    lifespan=lifespan,
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
app.include_router(prospects_router)


from fastapi.staticfiles import StaticFiles
import os
audio_dir = "/app/storage/audio"
if not os.path.exists("/app") or not os.access("/", os.W_OK):
    audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "audio"))
os.makedirs(audio_dir, exist_ok=True)
app.mount("/api/interview/audio", StaticFiles(directory=audio_dir), name="audio")


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
    if not data.get("email"):
        data["email"] = user.email
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
    if status_value in {"draft", "saved"}:
        return "draft"
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
    if normalized == "draft":
        return "draft"
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
        if not values.get("first_name") and not getattr(profile, "first_name", None):
            parts = preferred_name.split()
            values["first_name"] = parts[0]
            if not values.get("last_name") and not getattr(profile, "last_name", None) and len(parts) > 1:
                values["last_name"] = " ".join(parts[1:])
    apply_updates(profile, values)
    db.commit()
    db.refresh(profile)
    db.refresh(current_user)
    return profile_response(profile, current_user)


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


def spend_resume_coins(
    db: Session,
    current_user: User,
    amount: int,
    reason: str,
    reference_id: str,
) -> None:
    existing = db.scalar(
        select(GamificationTransaction.id).where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.currency == "coin",
            GamificationTransaction.amount == -amount,
            GamificationTransaction.reason == reason,
            GamificationTransaction.reference_id == reference_id,
        )
    )
    if existing:
        return
    wallet = db.scalar(
        select(UserGamification)
        .where(UserGamification.user_id == current_user.id)
        .with_for_update()
    )
    if not wallet:
        wallet = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(wallet)
        db.flush()
    if wallet.coins < amount:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Not enough coins")
    wallet.coins -= amount
    db.add(GamificationTransaction(
        user_id=current_user.id,
        amount=-amount,
        currency="coin",
        reason=reason,
        reference_id=reference_id,
    ))


def refund_resume_coins(
    db: Session,
    current_user: User,
    amount: int,
    reason: str,
    reference_id: str,
) -> None:
    existing = db.scalar(
        select(GamificationTransaction.id).where(
            GamificationTransaction.user_id == current_user.id,
            GamificationTransaction.currency == "coin",
            GamificationTransaction.amount == amount,
            GamificationTransaction.reason == reason,
            GamificationTransaction.reference_id == reference_id,
        )
    )
    if existing:
        return
    wallet = db.scalar(
        select(UserGamification)
        .where(UserGamification.user_id == current_user.id)
        .with_for_update()
    )
    if not wallet:
        wallet = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(wallet)
        db.flush()
    wallet.coins += amount
    db.add(GamificationTransaction(
        user_id=current_user.id,
        amount=amount,
        currency="coin",
        reason=reason,
        reference_id=reference_id,
    ))


def read_resume_upload(file: UploadFile) -> tuple[str, bytes]:
    filename = (file.filename or "resume.pdf").split("/")[-1].split("\\")[-1]
    content_type = (file.content_type or "").lower()
    if not filename.lower().endswith(".pdf") or content_type not in {"", "application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Upload a PDF resume")
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Resume file is empty")
    if len(content) > settings.resume_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Resume must be 12 MB or smaller")
    return filename, content


def linkedin_url_from_resume_data(resume_data: dict) -> str | None:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    value = basics.get("linkedin_id") or basics.get("linkedin_url")
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    value = value.replace("www.linkedin.com/in/", "").replace("linkedin.com/in/", "").strip("/ ")
    return f"https://www.linkedin.com/in/{value}" if value else None


def dedupe_strings(items: list[Any]) -> list[str]:
    result: list[str] = []
    for item in items:
        if not isinstance(item, str):
            continue
        value = item.strip()
        if value and value not in result:
            result.append(value)
    return result


def resume_profile_name(filename: str, resume_data: dict) -> str:
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    headline = basics.get("headline") if isinstance(basics.get("headline"), str) else ""
    clean_filename = filename.rsplit(".", 1)[0].strip() or "Resume"
    label = headline.strip() or clean_filename
    return f"{label[:180]} Profile"


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
    """Create one search profile for this uploaded resume and make it the active default."""
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
    """Return the structured snapshot associated with a stored resume asset."""
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


def apply_master_resume_profile_prefill(
    db: Session,
    current_user: User,
    resume_data: dict,
    original_url: str,
) -> None:
    """Fill empty profile fields only; confirmation must never overwrite user edits."""
    basics = resume_data.get("basics") if isinstance(resume_data.get("basics"), dict) else {}
    location = basics.get("location") if isinstance(basics.get("location"), dict) else {}
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if not profile:
        profile = UserProfile(user_id=current_user.id, extra_data={})
        db.add(profile)
    profile_values = {
        "first_name": basics.get("first_name"),
        "middle_name": basics.get("middle_name"),
        "last_name": basics.get("last_name"),
        "phone_number": basics.get("phone"),
        "current_city": location.get("city"),
        "state": location.get("state"),
        "country": location.get("country"),
        "zipcode": location.get("postal_code"),
    }
    for field, value in profile_values.items():
        if not getattr(profile, field, None) and value:
            setattr(profile, field, value)
    if not current_user.display_name.strip() or "@" in current_user.display_name:
        name = " ".join(part for part in [basics.get("first_name"), basics.get("last_name")] if part)
        if name:
            current_user.display_name = name[:255]

    def linkedin_url_from_resume() -> str | None:
        value = basics.get("linkedin_id") or basics.get("linkedin_url")
        if not isinstance(value, str):
            return None
        value = value.strip()
        if not value:
            return None
        if value.startswith("http://") or value.startswith("https://"):
            return value
        value = value.replace("www.linkedin.com/in/", "").replace("linkedin.com/in/", "").strip("/ ")
        return f"https://www.linkedin.com/in/{value}" if value else None

    def dedupe_strings(items: list[Any]) -> list[str]:
        result: list[str] = []
        for item in items:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if value and value not in result:
                result.append(value)
        return result

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
        "linkedin_url": linkedin_url_from_resume(),
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


def sync_job_profile_search_terms(db: Session, current_user: User, terms: list[str]) -> None:
    cleaned: list[str] = []
    for term in terms:
        if not isinstance(term, str):
            continue
        value = term.strip()
        if value and value not in cleaned:
            cleaned.append(value)
    if not cleaned:
        return
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
            search_terms=cleaned[:10],
            filters={},
            blacklist_rules={},
            whitelist_rules={},
            is_default=True,
        )
        db.add(search_profile)
        return
    search_profile.search_terms = cleaned[:10]


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


def recommended_job_search_terms(raw_resume: dict, resume_data: dict) -> list[str]:
    """Use the model's terms when available, with a resume-based fallback for older parses."""
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


def sync_user_skills(db: Session, current_user: User, resume_data: dict) -> None:
    raw_skills = resume_data.get("skills")
    extracted: list[tuple[str, str]] = []
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
            canonical_name = skill_index.get(name.lower(), name.lower())
            extracted.append((category, canonical_name, name))

    unique_rows: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for category, canonical_name, name in extracted:
        if canonical_name in seen:
            continue
        seen.add(canonical_name)
        unique_rows.append((category, canonical_name, name))

    db.execute(delete(UserSkill).where(UserSkill.user_id == current_user.id))
    for category, canonical_name, name in unique_rows:
        db.add(UserSkill(user_id=current_user.id, category=category, canonical_name=canonical_name, skill_name=name, source="resume"))


def process_master_resume(resume_id: UUID, content: bytes, upload_id: str) -> None:
    """Parse after the upload response so the UI can report AI progress immediately."""
    db = SessionLocal()
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
        source_text = extract_pdf_text(content)
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
    """Resume an interrupted parse from the durable object-storage copy."""
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


# Resume Profiles are intentionally stored in the existing job_hunting_profiles
# table. A profile owns its resume and its application settings; resume-specific
# state stays namespaced in extra_data instead of creating another parallel model.
CAREER_PROFILE_SOURCE = "career_profile"


def career_profile_score_table_exists(db: Session) -> bool:
    return inspect(db.get_bind()).has_table(CareerProfileScoreSnapshot.__tablename__)


def score_history_entry(evaluation: dict, resume_data: dict, created_at: datetime) -> dict:
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
        parsed = parse_resume_text_raw(source_text)
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
            evaluation = evaluate_resume_data(resume_data)
            evaluation["coins_spent"] = RESUME_EVALUATION_COST
            if career_profile_score_table_exists(db):
                db.add(CareerProfileScoreSnapshot(career_profile_id=profile.id, evaluation=evaluation, resume_data=resume_data))
        except ResumeEvaluationError:
            # A parsed resume is still useful if scoring is temporarily unavailable.
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


@app.get("/api/career-profiles", response_model=list[CareerProfileRead])
def list_career_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    return [career_profile_response(profile) for profile in career_profiles_for_user(db, current_user)]


@app.get("/api/career-profiles/{profile_id}", response_model=CareerProfileRead)
def read_career_profile(
    profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    return career_profile_response(profile)


@app.post("/api/career-profiles/upload", response_model=CareerProfileRead, status_code=status.HTTP_201_CREATED)
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


@app.put("/api/career-profiles/{profile_id}", response_model=CareerProfileRead)
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


@app.post("/api/career-profiles/{profile_id}/primary", response_model=CareerProfileRead)
def set_primary_career_profile(profile_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_or_create_current_user)) -> dict:
    profile = db.get(JobHuntingProfile, profile_id)
    if not profile or profile.user_id != current_user.id or (profile.extra_data or {}).get("resume_source") != CAREER_PROFILE_SOURCE:
        raise HTTPException(status_code=404, detail="Resume Profile not found")
    ensure_single_default_job_hunting_profile(db, current_user, profile)
    db.commit()
    db.refresh(profile)
    return career_profile_response(profile)


@app.delete("/api/career-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@app.post("/api/career-profiles/{profile_id}/evaluate", response_model=CareerProfileRead)
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
        evaluation = evaluate_resume_data(resume_data)
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


@app.get("/api/career-profiles/{profile_id}/score-history", response_model=list[CareerProfileScoreHistoryRead])
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


@app.get("/api/master-resume", response_model=MasterResumeRead)
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


def tailored_resume_response(resume: TailoredResume) -> dict:
    result = TailoredResumeRead.model_validate(resume).model_dump(mode="json")
    if not result.get("core_competencies"):
        result["core_competencies"] = result.get("key_qualifications") or []
    return result


@app.get("/api/tailored-resumes", response_model=list[TailoredResumeRead])
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


@app.get("/api/tailored-resumes/{tailored_resume_id}", response_model=TailoredResumeRead)
def read_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    tailored_resume = db.get(TailoredResume, tailored_resume_id)
    if not tailored_resume or tailored_resume.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    return tailored_resume


@app.post("/api/job-review/preview")
def preview_job_review(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    description = str(payload.get("job_description") or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="A job description is required")
    resume = _default_career_profile_resume(db, current_user)
    job = {"job_description": description}
    return {"messages": build_tailor_messages(job, resume)}


@app.post("/api/job-review")
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
    try:
        job = {
            "job_description": description,
            "title": str(payload.get("title") or "").strip() or None,
            "company": str(payload.get("company") or "").strip() or None,
            "date_posted": str(payload.get("date_posted") or "").strip() or None,
        }
        result = review_job(job, profile_resume)
    except DeepSeekError as exc:
        logger.exception("Job review failed for pasted JD")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI tailoring is temporarily unavailable. Please try again shortly.",
        ) from exc
    except Exception as exc:
        logger.exception("Job review failed for pasted JD")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    application = JobApplication(
        user_id=current_user.id,
        title=job["title"],
        company=job["company"],
        job_description=description,
        date_posted=job["date_posted"],
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
        resume_data=result.get("resume_data") or {},
        raw_ai_response=result.get("raw_ai_response") or {},
        core_competencies=result.get("core_competencies") or result.get("key_qualifications") or [],
        key_qualifications=result.get("key_qualifications") or [],
        targeted_projects=result.get("targeted_projects") or [],
    )
    db.add(tailored_resume)
    db.commit()
    db.refresh(tailored_resume)
    result["tailored_resume"] = tailored_resume_response(tailored_resume)
    return result


def create_tailored_resume_for_application(
    db: Session,
    current_user: User,
    application: JobApplication,
    *,
    mock: bool = False,
) -> TailoredResume | None:
    """Generate or retrieve tailored resume for a job application."""
    existing = db.scalar(select(TailoredResume).where(TailoredResume.job_application_id == application.id))
    if existing:
        return existing
    description = str(application.job_description or "").strip() or f"Application for {application.title or 'Role'} at {application.company or 'Company'}"
    try:
        career_profile = _default_career_profile(db, current_user)
        profile_resume = dict((career_profile.extra_data or {}).get("resume_data") or {})
        job = {
            "job_description": description,
            "title": application.title,
            "company": application.company,
            "date_posted": application.date_posted,
        }
        result = review_job(job, profile_resume, mock=mock)
        tailored_resume = TailoredResume(
            user_id=current_user.id,
            career_profile_id=career_profile.id,
            job_application_id=application.id,
            job_title=application.title,
            company=application.company,
            job_description=description,
            source_resume_data=profile_resume,
            resume_data=result.get("resume_data") or {},
            raw_ai_response=result.get("raw_ai_response") or {},
            core_competencies=result.get("core_competencies") or result.get("key_qualifications") or [],
            key_qualifications=result.get("key_qualifications") or [],
            targeted_projects=result.get("targeted_projects") or [],
        )
        db.add(tailored_resume)
        db.commit()
        db.refresh(tailored_resume)
        return tailored_resume
    except Exception:
        logger.exception("Failed to create tailored resume for application_id=%s", application.id)
        return None


def job_application_response(application: JobApplication, tailored_resume_id: UUID | None = None) -> dict:
    data = JobApplicationRead.model_validate(application).model_dump(mode="json")
    data["has_tailored_resume"] = tailored_resume_id is not None
    data["tailored_resume_id"] = str(tailored_resume_id) if tailored_resume_id else None
    return data



@app.delete("/api/master-resume", status_code=status.HTTP_204_NO_CONTENT)
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
            get_object_storage().delete(resume.original_storage_key)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.delete(resume)
    db.commit()
    return None


@app.post("/api/master-resume/debug/source", response_model=ResumeSourceRead)
def extract_master_resume_source(
    file: UploadFile = File(...),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    """Development-only PDF extraction probe. It does not persist files or call AI."""
    del current_user
    if not settings.resume_debug_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    filename, content = read_resume_upload(file)
    try:
        return {"original_filename": filename, **extract_pdf_source(content)}
    except ResumeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/master-resume/debug/ai", response_model=dict)
def debug_master_resume_ai(
    file: UploadFile = File(...),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    """Development-only resume parser probe that returns the AI's raw JSON output."""
    del current_user
    if not settings.resume_debug_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _, content = read_resume_upload(file)
    try:
        return parse_resume_text_raw(extract_pdf_text(content))
    except ResumeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/resume-assets", response_model=list[ResumeAssetRead])
def list_resume_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    return [resume_asset_response(profile) for profile in resume_asset_profiles(db, current_user)]


@app.post("/api/resume-assets/{profile_id}/select", response_model=MasterResumeRead)
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


@app.delete("/api/resume-assets/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@app.post("/api/master-resume/upload", response_model=MasterResumeRead)
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


@app.post("/api/master-resume/retry", response_model=MasterResumeRead)
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


@app.post("/api/master-resume/cancel", response_model=MasterResumeRead)
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


@app.put("/api/master-resume", response_model=MasterResumeRead)
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


@app.post("/api/master-resume/evaluate", response_model=MasterResumeRead)
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


@app.get(
    "/api/master-resume/evaluation-history",
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


@app.get(
    "/api/master-resume/versions",
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


@app.delete(
    "/api/master-resume/versions/{version}",
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


@app.post(
    "/api/master-resume/versions/{version}/draft",
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


@app.post("/api/master-resume/confirm", response_model=MasterResumeRead)
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


@app.get("/api/application-settings")
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


@app.put("/api/application-settings")
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


@app.post("/api/application-decisions")
def evaluate_application_decision(
    payload: ApplicationDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    """Evaluate one discovered job before any resume generation or browser work."""
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

    candidate_payload = payload.candidate.model_dump()
    if getattr(payload, "job_description", None) and not candidate_payload.get("description"):
        candidate_payload["description"] = payload.job_description
    existing = db.scalar(
        select(JobApplication.id).where(
            JobApplication.user_id == current_user.id,
            JobApplication.platform == candidate_payload["platform"],
            JobApplication.job_id == candidate_payload["external_id"],
            JobApplication.deleted_at.is_(None),
        )
    )
    if existing:
        candidate_payload["already_applied"] = True

    master_resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    result = evaluate_candidate(
        candidate_payload,
        settings=settings,
        resume_data=master_resume.resume_data if master_resume else None,
    )
    return evaluation_to_dict(result)


def _application_plan_response(application: JobApplication, plan: object) -> dict[str, Any]:
    return {
        "application_id": str(application.id),
        "plan": plan_to_dict(plan),
    }


@app.post("/api/application-plans", status_code=status.HTTP_201_CREATED)
def create_application_plan_endpoint(
    payload: ApplicationPlanCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    """Create or recover an idempotent application plan for one discovered job."""
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

    candidate_payload = payload.candidate.model_dump()
    if payload.job_description and not candidate_payload.get("description"):
        candidate_payload["description"] = payload.job_description
    existing = db.scalar(
        select(JobApplication).where(
            JobApplication.user_id == current_user.id,
            JobApplication.platform == candidate_payload["platform"],
            JobApplication.job_id == candidate_payload["external_id"],
            JobApplication.deleted_at.is_(None),
        )
    )
    previous_plan = None
    if existing:
        stored_plan = (existing.raw_data or {}).get("application_plan")
        if stored_plan:
            previous_plan = plan_from_dict(stored_plan)
            if not plan_can_be_reevaluated(previous_plan):
                return _application_plan_response(existing, previous_plan)
        else:
            candidate_payload["already_applied"] = True

    master_resume = db.scalar(select(MasterResume).where(MasterResume.user_id == current_user.id))
    result = evaluate_candidate(
        candidate_payload,
        settings=settings,
        resume_data=master_resume.resume_data if master_resume else None,
    )
    from application_core.workflow import create_application_plan

    plan = create_application_plan(result.candidate, result.decision)
    if existing:
        raw_data = append_plan_event(
            existing.raw_data or {},
            action="reevaluate" if previous_plan else "create",
            from_state=previous_plan.state.value if previous_plan else None,
            to_state=plan.state.value,
            actor="api",
        )
        raw_data["application_plan"] = plan_to_dict(plan)
        existing.raw_data = raw_data
        existing.title = result.candidate.title
        existing.company = result.candidate.company
        existing.job_description = payload.job_description
        existing.job_link = payload.job_link
        existing.work_location = payload.work_location
        existing.status = "skipped" if plan.state is ApplicationState.SKIPPED else (
            "interrupted" if plan.state is ApplicationState.AWAITING_USER_REVIEW else "draft"
        )
        existing.skip_reason = result.decision.explanation if plan.state is ApplicationState.SKIPPED else None
        existing.status_updated_at = utc_now()
        db.commit()
        db.refresh(existing)
        return _application_plan_response(existing, plan)

    initial_status = "skipped" if plan.state is ApplicationState.SKIPPED else (
        "interrupted" if plan.state is ApplicationState.AWAITING_USER_REVIEW else "draft"
    )
    plan_raw_data = append_plan_event(
        {"application_plan": plan_to_dict(plan)},
        action="create",
        from_state=None,
        to_state=plan.state.value,
        actor="api",
    )
    application = JobApplication(
        user_id=current_user.id,
        platform=result.candidate.platform,
        job_id=result.candidate.external_id,
        title=result.candidate.title,
        company=result.candidate.company,
        job_description=payload.job_description,
        job_link=payload.job_link,
        work_location=payload.work_location,
        status=initial_status,
        skip_reason=result.decision.explanation if plan.state is ApplicationState.SKIPPED else None,
        raw_data=plan_raw_data,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return _application_plan_response(application, plan)


@app.get("/api/application-plans/{application_id}")
def read_application_plan(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")
    stored_plan = (application.raw_data or {}).get("application_plan")
    if not stored_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")
    return _application_plan_response(application, plan_from_dict(stored_plan))


def _normalize_form_label(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _resolve_field_answer_from_user_data(
    label: str,
    field_type: str,
    user: User,
    profile: UserProfile | None,
    job_profile: JobHuntingProfile | None,
) -> str | None:
    norm = _normalize_form_label(label)
    if not norm:
        return None

    # Name matching
    if any(k in norm for k in ["first name", "given name", "forename"]):
        return profile.first_name if profile and profile.first_name else None
    if any(k in norm for k in ["last name", "family name", "surname"]):
        return profile.last_name if profile and profile.last_name else None
    if norm in ["name", "full name"]:
        if profile and profile.first_name and profile.last_name:
            return f"{profile.first_name} {profile.last_name}"
        return user.display_name or None

    # Contact matching
    if any(k in norm for k in ["email", "e-mail"]):
        return (profile.email if profile and profile.email else user.email) or None
    if any(k in norm for k in ["phone", "mobile", "contact number", "telephone"]):
        return profile.phone_number if profile and profile.phone_number else None

    # Location matching
    if norm in ["city", "current city", "location"]:
        return profile.current_city if profile and profile.current_city else None
    if norm in ["state", "province"]:
        return profile.state if profile and profile.state else None
    if any(k in norm for k in ["zip", "postal code", "postcode", "zipcode"]):
        return profile.zipcode if profile and profile.zipcode else None
    if norm in ["country"]:
        return profile.country if profile and profile.country else None

    # Job / profile matching
    if any(k in norm for k in ["linkedin", "linkedin profile", "linkedin url"]):
        return job_profile.linkedin_url if job_profile and job_profile.linkedin_url else None
    if any(k in norm for k in ["website", "portfolio", "personal website", "url"]):
        return job_profile.website if job_profile and job_profile.website else None
    if any(k in norm for k in ["years of experience", "experience years", "work experience"]):
        return job_profile.years_of_experience if job_profile and job_profile.years_of_experience else None
    if any(k in norm for k in ["visa", "sponsorship", "require visa", "work authorization"]):
        return job_profile.require_visa if job_profile and job_profile.require_visa else None
    if any(k in norm for k in ["citizenship", "work rights"]):
        return job_profile.citizenship if job_profile and job_profile.citizenship else None
    if any(k in norm for k in ["employer", "current company", "recent company", "most recent employer"]):
        return job_profile.recent_employer if job_profile and job_profile.recent_employer else None

    return None


@app.post(
    "/api/application-plans/{application_id}/form-instructions",
    response_model=ApplicationFormInstructionsResponse,
)
def create_application_form_instructions(
    application_id: UUID,
    payload: ApplicationFormInstructionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    """Return exact cached answers for a previously created application plan."""
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")

    stored_plan = (application.raw_data or {}).get("application_plan")
    if not stored_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")
    plan = plan_from_dict(stored_plan)
    if plan.state in {ApplicationState.SKIPPED, ApplicationState.REJECTED, ApplicationState.SUBMITTED, ApplicationState.FAILED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This application plan cannot fill fields in its current state.")

    user_profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    job_profile = db.scalar(
        select(JobHuntingProfile)
        .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
        .order_by(JobHuntingProfile.updated_at.desc())
        .limit(1)
    )

    normalized_labels = {_normalize_form_label(field.label) for field in payload.fields}
    entries = db.scalars(
        select(QuestionCacheEntry).where(
            QuestionCacheEntry.user_id == current_user.id,
            QuestionCacheEntry.platform == plan.candidate.platform,
            QuestionCacheEntry.normalized_label.in_(normalized_labels),
        )
    )
    cached_answers = {
        (entry.normalized_label, entry.field_type): entry
        for entry in entries
        if str(entry.answer or "").strip()
    }

    instructions: list[dict[str, Any]] = []
    unanswered: list[dict[str, str]] = []
    for field in payload.fields:
        if field.type in {"password", "file", "unknown"}:
            unanswered.append({"key": field.key, "label": field.label, "reason": "This field requires explicit user handling."})
            continue

        normalized_label = _normalize_form_label(field.label)
        entry = cached_answers.get((normalized_label, field.type))
        raw_answer: str | None = str(entry.answer or "").strip() if entry else None

        if not raw_answer:
            resolved_answer = _resolve_field_answer_from_user_data(
                field.label, field.type, current_user, user_profile, job_profile
            )
            if resolved_answer:
                raw_answer = resolved_answer
                # Save auto-resolved answer into QuestionCacheEntry for future hits
                cache_entry = db.scalar(
                    select(QuestionCacheEntry).where(
                        QuestionCacheEntry.user_id == current_user.id,
                        QuestionCacheEntry.platform == plan.candidate.platform,
                        QuestionCacheEntry.normalized_label == normalized_label,
                        QuestionCacheEntry.field_type == field.type,
                    )
                )
                if not cache_entry:
                    cache_entry = QuestionCacheEntry(
                        user_id=current_user.id,
                        platform=plan.candidate.platform,
                        original_label=field.label,
                        normalized_label=normalized_label,
                        field_type=field.type,
                        answer=raw_answer,
                        source="profile_auto_matched",
                    )
                    db.add(cache_entry)
                else:
                    cache_entry.answer = raw_answer
                    cache_entry.source = "profile_auto_matched"
                db.commit()

        if not raw_answer:
            unanswered.append({"key": field.key, "label": field.label, "reason": "No exact cached or profile answer is available."})
            continue

        value: str | bool = raw_answer
        if field.type == "checkbox":
            if raw_answer.casefold() not in {"true", "false"}:
                unanswered.append({"key": field.key, "label": field.label, "reason": "Checkbox answer is not boolean."})
                continue
            value = raw_answer.casefold() == "true"
        if field.type in {"select", "radio"}:
            normalized_options = {
                _normalize_form_label(option.get("value", ""))
                for option in field.options
            } | {
                _normalize_form_label(option.get("label", ""))
                for option in field.options
            }
            if normalized_options and _normalize_form_label(raw_answer) not in normalized_options:
                # Try partial option matching if exact option label miss
                matched_option = next(
                    (
                        option.get("value") or option.get("label")
                        for option in field.options
                        if _normalize_form_label(raw_answer) in _normalize_form_label(option.get("label", ""))
                        or _normalize_form_label(option.get("label", "")) in _normalize_form_label(raw_answer)
                    ),
                    None,
                )
                if matched_option:
                    value = matched_option
                else:
                    unanswered.append({"key": field.key, "label": field.label, "reason": "Answer is not one of the available options."})
                    continue

        instructions.append(
            {
                "commandId": str(uuid4()),
                "source": "backend",
                "target": field.model_dump(),
                "value": value,
            }
        )

    return {
        "application_id": application_id,
        "instructions": instructions,
        "unanswered_fields": unanswered,
    }


@app.post("/api/application-plans/{application_id}/tailored-resume", response_model=TailoredResumeRead)
def generate_application_plan_tailored_resume(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    """Generate a tailored resume only when the durable plan explicitly requires it."""
    application = db.scalar(
        select(JobApplication)
        .where(JobApplication.id == application_id, JobApplication.user_id == current_user.id)
        .with_for_update()
    )
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")
    stored_plan = (application.raw_data or {}).get("application_plan")
    if not stored_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")

    plan = plan_from_dict(stored_plan)
    if not plan_requires_tailored_resume(plan):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This application plan does not request a tailored resume.",
        )

    tailored_resume = create_tailored_resume_for_application(
        db,
        current_user,
        application,
        mock=False,
    )
    if not tailored_resume:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tailored resume generation is unavailable.",
        )

    raw_data = append_plan_event(
        application.raw_data or {},
        action="generate_tailored_resume",
        from_state=plan.state.value,
        to_state=plan.state.value,
        actor="worker",
    )
    raw_data["application_plan"] = plan_to_dict(plan)
    raw_data["tailored_resume_id"] = str(tailored_resume.id)
    raw_data["tailored_resume_strategy"] = "tailored"
    application.raw_data = raw_data
    db.commit()
    db.refresh(tailored_resume)
    return tailored_resume


@app.post("/api/application-plans/{application_id}/actions")
def apply_application_plan_action(
    application_id: UUID,
    payload: ApplicationPlanActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    application = db.scalar(
        select(JobApplication)
        .where(JobApplication.id == application_id, JobApplication.user_id == current_user.id)
        .with_for_update()
    )
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")
    stored_plan = (application.raw_data or {}).get("application_plan")
    if not stored_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application plan not found")

    plan = plan_from_dict(stored_plan)
    previous_state = plan.state
    action = payload.action.strip().casefold()
    try:
        if action == "prepare":
            plan = begin_preparation(plan)
        elif action == "request_review":
            if plan.state is ApplicationState.PLANNED:
                plan = begin_preparation(plan)
            plan = request_review(plan, payload.reason or "")
        elif action == "mark_prepared":
            plan = mark_prepared(plan)
        elif action in {"approve", "confirm_submit"}:
            plan = approve_review(plan)
        elif action == "reject":
            plan = reject_review(plan, payload.reason or "")
        elif action == "begin_submission":
            plan = begin_submission(plan)
        elif action == "mark_submitted":
            plan = mark_submitted(plan)
        elif action == "mark_failed":
            plan = mark_failed(plan, payload.reason or "Worker browser flow failed.")
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown plan action: {action}")
    except HTTPException:
        raise
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    raw_data = append_plan_event(
        application.raw_data or {},
        action=action,
        from_state=previous_state.value,
        to_state=plan.state.value,
        actor=str(current_user.email or "user"),
    )
    raw_data["application_plan"] = plan_to_dict(plan)
    application.raw_data = raw_data
    application.status = {
        ApplicationState.SKIPPED: "skipped",
        ApplicationState.AWAITING_USER_REVIEW: "interrupted",
        ApplicationState.SUBMITTING: "processing",
        ApplicationState.SUBMITTED: "submitted",
        ApplicationState.REJECTED: "skipped",
        ApplicationState.FAILED: "skipped",
    }.get(plan.state, application.status)
    application.skip_reason = plan.review_reason if plan.state in {
        ApplicationState.SKIPPED,
        ApplicationState.REJECTED,
        ApplicationState.FAILED,
    } else None
    application.status_updated_at = utc_now()
    db.commit()
    db.refresh(application)
    return _application_plan_response(application, plan)


@app.get("/api/worker/config")
def read_worker_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
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
        "profile": UserProfileRead.model_validate(profile).model_dump(mode="json") if profile else None,
        "job_hunting_profile": JobHuntingProfileRead.model_validate(job_hunting_profile).model_dump(mode="json") if job_hunting_profile else None,
        "runtime_settings": RuntimeSettingsRead.model_validate(runtime_settings).model_dump(mode="json") if runtime_settings else None,
        "application_settings": application_settings_to_storage(application_settings),
        "master_resume_data": master_resume_data,
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
    platform: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[QuestionCacheEntry]:
    query = select(QuestionCacheEntry).where(QuestionCacheEntry.user_id == current_user.id)
    if platform and platform.strip():
        query = query.where(QuestionCacheEntry.platform == platform.strip().lower())
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
        ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"])
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
            ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"]),
            local_date_expr == today_expr
        )
        today_submitted = db.scalar(today_submitted_stmt) or 0

        # yesterday submitted
        yesterday_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"]),
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
            ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"]),
            local_date_expr == today_expr
        )
        today_submitted = db.scalar(today_submitted_stmt) or 0

        # yesterday submitted
        yesterday_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"]),
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
) -> list[dict]:
    reconcile_stale_processing_applications(db, current_user)
    query = select(JobApplication).where(JobApplication.user_id == current_user.id)
    if not include_deleted:
        query = query.where(JobApplication.deleted_at.is_(None))
    if status_filter:
        norm_status = normalize_application_status(status_filter)
        if norm_status == "submitted":
            query = query.where(
                ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"])
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
    applications = list(db.scalars(stmt))
    if not applications:
        return []

    app_ids = [app.id for app in applications]
    tailored_rows = db.execute(
        select(TailoredResume.job_application_id, TailoredResume.id)
        .where(TailoredResume.job_application_id.in_(app_ids), TailoredResume.user_id == current_user.id)
    ).all()
    tailored_map = {row[0]: row[1] for row in tailored_rows}

    return [job_application_response(app, tailored_map.get(app.id)) for app in applications]


@app.post("/api/applications", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: JobApplicationBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
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
        if existing_application.job_description:
            create_tailored_resume_for_application(db, current_user, existing_application, mock=True)
        db.commit()
        db.refresh(existing_application)
        tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == existing_application.id))
        resp = job_application_response(existing_application, tailored_id)
        broadcast_sync("application_updated", resp)
        return resp

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
    if application.job_description:
        create_tailored_resume_for_application(db, current_user, application, mock=True)
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
        if existing_application.job_description:
            create_tailored_resume_for_application(db, current_user, existing_application, mock=True)
        db.commit()
        db.refresh(existing_application)
        tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == existing_application.id))
        resp = job_application_response(existing_application, tailored_id)
        broadcast_sync("application_updated", resp)
        return resp
    db.refresh(application)
    tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == application.id))
    resp = job_application_response(application, tailored_id)
    broadcast_sync("application_created", resp)
    return resp


@app.put("/api/applications/{application_id}", response_model=JobApplicationRead)
def update_application(
    application_id: UUID,
    payload: JobApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
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
    if application.job_description:
        create_tailored_resume_for_application(db, current_user, application, mock=True)
    db.commit()
    db.refresh(application)
    tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == application.id))
    resp = job_application_response(application, tailored_id)
    broadcast_sync("application_updated", resp)
    return resp


@app.post("/api/applications/{application_id}/repair-from-link", response_model=JobApplicationRead)
def repair_application_from_link(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    return async_application_from_link(application_id, db, current_user)


@app.post("/api/applications/{application_id}/async-from-link", response_model=JobApplicationRead)
def async_application_from_link(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if application.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application was deleted")

    _, error = async_application_from_link_record(application)
    if application.job_description:
        create_tailored_resume_for_application(db, current_user, application, mock=True)
    db.commit()
    db.refresh(application)
    tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == application.id))
    resp = job_application_response(application, tailored_id)
    broadcast_sync("application_updated", resp)
    return resp


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
                ~JobApplication.status.in_(["draft", "processing", "interrupted", "skipped", "cancelled"])
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
        tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == application.id))
        broadcast_sync("application_updated", job_application_response(application, tailored_id))

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
) -> dict:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id or application.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    tailored_id = db.scalar(select(TailoredResume.id).where(TailoredResume.job_application_id == application.id))
    return job_application_response(application, tailored_id)


@app.get("/api/applications/{application_id}/tailored-resume", response_model=TailoredResumeRead)
def get_application_tailored_resume(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found")
    tailored = db.scalar(select(TailoredResume).where(TailoredResume.job_application_id == application.id))
    if not tailored:
        tailored = create_tailored_resume_for_application(db, current_user, application, mock=False)
    if not tailored:
        raise HTTPException(status_code=404, detail="No tailored resume found. Please select a Resume Profile first.")
    return tailored


@app.post("/api/applications/{application_id}/generate-resume", response_model=TailoredResumeRead)
def generate_application_tailored_resume(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found")
    tailored = create_tailored_resume_for_application(db, current_user, application, mock=False)
    if not tailored:
        raise HTTPException(status_code=500, detail="Failed to generate tailored resume. Please select a Resume Profile first.")
    return tailored


@app.put("/api/applications/{application_id}/tailored-resume", response_model=TailoredResumeRead)
def update_application_tailored_resume(
    application_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found")
    tailored = db.scalar(select(TailoredResume).where(TailoredResume.job_application_id == application.id))
    if not tailored:
        raise HTTPException(status_code=404, detail="Tailored resume not found for this application")
    if "resume_data" in payload and isinstance(payload["resume_data"], dict):
        tailored.resume_data = payload["resume_data"]
    if "core_competencies" in payload and isinstance(payload["core_competencies"], list):
        tailored.core_competencies = payload["core_competencies"]
    if "key_qualifications" in payload and isinstance(payload["key_qualifications"], list):
        tailored.key_qualifications = payload["key_qualifications"]
    tailored.updated_at = utc_now()
    db.commit()
    db.refresh(tailored)
    return tailored



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
