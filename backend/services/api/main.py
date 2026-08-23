from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4
import asyncio
import json
import logging
import re
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
    UserCoreProfile,
    FieldMappingRule,
    FormTempChange,
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
    UserSkillCreate,
    UserSkillRead,
    ApplicationDecisionRequest,
    ApplicationFormInstructionsRequest,
    ApplicationFormInstructionsResponse,
    AutofillAnswerBase,
    AutofillAnswerRead,
    FormAutofillInstructionsRequest,
    FormAutofillInstructionsResponse,
    FormTempChangeRequest,
    FormTempChangeRead,
    FormTempFinalizeRequest,
    FormTempFinalizeResponse,
    FieldMappingRuleBase,
    FieldMappingRuleRead,
    FormAnswerObservationRequest,
    FormAnswerObservationResponse,
    FormAnswerObservationRead,
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
from services.shared.autofill_profile import (
    CORE_FIELD_LABELS,
    LEGACY_PROFILE_KEYS,
    PROFILE_PREFERENCES_KEY,
    core_profile_rows,
    core_profile_values,
    default_core_value_transform,
    decrypt_profile_value,
    delete_core_profile_value,
    ensure_identity_core_values,
    extract_semantic_features,
    form_control_fingerprint,
    match_mapping_rule,
    normalize_alias,
    normalize_scene,
    profile_api_payload,
    suggested_custom_core_key,
    transformed_core_value,
    upsert_core_profile_value,
)
from services.shared.autofill_memory import fallback_mapping_scenes, platform_mapping_scene
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
    PlanTransitionError,
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


def profile_response(_profile: object | None, user: User, db: Session) -> dict:
    """Return a compatibility envelope assembled from encrypted KV rows."""
    ensure_identity_core_values(db, user)
    return profile_api_payload(db, user)


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
    ensure_identity_core_values(db, current_user)
    db.commit()
    return profile_response(None, current_user, db)


@app.put("/api/profile", response_model=UserProfileRead)
def update_profile(
    payload: UserProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    values = payload.model_dump(exclude_unset=True)
    preferred_name = (values.pop("preferred_name", None) or "").strip()
    if preferred_name:
        current_user.display_name = preferred_name[:255]
        upsert_core_profile_value(
            db, user_id=current_user.id, core_field_key="identity.preferred_name", value=preferred_name
        )
        if not values.get("first_name") and not core_profile_values(db, current_user.id).get("identity.first_name"):
            parts = preferred_name.split()
            values["first_name"] = parts[0]
            if not values.get("last_name") and not core_profile_values(db, current_user.id).get("identity.last_name") and len(parts) > 1:
                values["last_name"] = " ".join(parts[1:])
    fields = values.pop("fields", []) or []
    provided_core_keys = {field.get("core_field_key", "").strip().casefold() for field in fields}
    for field in fields:
        field_key = field.get("core_field_key", "").strip()
        field_value = field.get("value")
        if not field_key:
            continue
        if field_value is None or not str(field_value).strip():
            delete_core_profile_value(db, user_id=current_user.id, core_field_key=field_key)
        else:
            upsert_core_profile_value(
                db,
                user_id=current_user.id,
                core_field_key=field_key,
                value=str(field_value),
                value_type=field.get("value_type", "text"),
                is_sensitive=True,
            )
    for legacy_name, field_value in values.items():
        if legacy_name == "extra_data":
            if isinstance(field_value, dict):
                upsert_core_profile_value(
                    db,
                    user_id=current_user.id,
                    core_field_key=PROFILE_PREFERENCES_KEY,
                    value=json.dumps(field_value),
                    value_type="json",
                    is_sensitive=False,
                )
            continue
        core_key = LEGACY_PROFILE_KEYS.get(legacy_name)
        if not core_key:
            continue
        if core_key in provided_core_keys:
            continue
        if field_value is None or not str(field_value).strip():
            delete_core_profile_value(db, user_id=current_user.id, core_field_key=core_key)
        else:
            upsert_core_profile_value(db, user_id=current_user.id, core_field_key=core_key, value=str(field_value))
    ensure_identity_core_values(db, current_user)
    db.commit()
    db.refresh(current_user)
    return profile_response(None, current_user, db)


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


def _skill_identity(db: Session, raw_name: str) -> tuple[str, str]:
    name = raw_name.strip()
    catalog_skill = db.scalar(
        select(Skill).where(Skill.name == name.casefold())
    )
    display_name = (
        str(catalog_skill.canonical_name).strip()
        if catalog_skill and str(catalog_skill.canonical_name).strip()
        else name
    )
    return display_name, display_name.casefold()


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

    # Resume-derived rows can be rebuilt, but plugin-claimed skills are an
    # independent scoring input and must survive resume edits/confirmation.
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
    if (resume.raw_ai_response or {}).get("cover_letter"):
        result["cover_letter"] = resume.raw_ai_response["cover_letter"]
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


@app.put("/api/tailored-resumes/{tailored_resume_id}", response_model=TailoredResumeRead)
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
    tailored.updated_at = utc_now()
    db.commit()
    db.refresh(tailored)
    return tailored


@app.delete("/api/tailored-resumes/{tailored_resume_id}")
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



@app.post("/api/job-review/preview")
def preview_job_review(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    description = str(payload.get("job_description") or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="A job description is required")
    doc_type = str(payload.get("doc_type") or "resume").strip().lower()
    resume = _default_career_profile_resume(db, current_user)
    job = {"job_description": description}
    return {"messages": build_tailor_messages(job, resume, doc_type=doc_type)}


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
    doc_type = str(payload.get("doc_type") or "resume").strip().lower()
    job = {
        "job_description": description,
        "title": str(payload.get("title") or "").strip() or None,
        "company": str(payload.get("company") or "").strip() or None,
        "date_posted": str(payload.get("date_posted") or "").strip() or None,
    }
    mock = bool(payload.get("mock"))
    generation_id = str(payload.get("generation_id") or uuid4())

    # A resume and a cover letter are two documents for one job, not two
    # independent "recent tailor" versions. Reuse the existing record when the
    # same captured job is tailored again, preserving the other document.
    def _job_key(value: str | None) -> str:
        return " ".join((value or "").casefold().split())

    existing_records = db.scalars(
        select(TailoredResume)
        .where(TailoredResume.user_id == current_user.id)
        .order_by(TailoredResume.updated_at.desc())
    ).all()
    tailored_resume = next(
        (
            record
            for record in existing_records
            if _job_key(record.job_title) == _job_key(job["title"])
            and _job_key(record.company) == _job_key(job["company"])
            and _job_key(record.job_description) == _job_key(description)
        ),
        None,
    )

    if tailored_resume and tailored_resume.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This job already has a document generation in progress.",
        )

    if tailored_resume is None:
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
            resume_data={},
            raw_ai_response={
                "generation_id": generation_id,
                "generation_doc_type": doc_type,
            },
            core_competencies=[],
            key_qualifications=[],
            targeted_projects=[],
            status="processing",
        )
        db.add(tailored_resume)
    else:
        tailored_resume.status = "processing"
        tailored_resume.error_message = None
        tailored_resume.raw_ai_response = {
            **(tailored_resume.raw_ai_response or {}),
            "generation_id": generation_id,
            "generation_doc_type": doc_type,
        }
    db.commit()
    db.refresh(tailored_resume)

    try:
        result = review_job(job, profile_resume, doc_type=doc_type, mock=mock)
    except DeepSeekError as exc:
        logger.exception("Job review failed for pasted JD")
        db.rollback()
        tailored_resume = db.get(TailoredResume, tailored_resume.id)
        if tailored_resume and tailored_resume.status == "processing":
            tailored_resume.status = "failed"
            tailored_resume.error_message = "AI tailoring is temporarily unavailable. Please try again shortly."
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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI tailoring is temporarily unavailable. Please try again shortly.",
        ) from exc
    except Exception as exc:
        logger.exception("Job review failed for pasted JD")
        db.rollback()
        tailored_resume = db.get(TailoredResume, tailored_resume.id)
        if tailored_resume and tailored_resume.status == "processing":
            tailored_resume.status = "failed"
            tailored_resume.error_message = "Tailored document generation could not be completed."
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
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    if doc_type != "cover_letter":
        tailored_resume.resume_data = result.get("resume_data") or tailored_resume.resume_data
        tailored_resume.core_competencies = result.get("core_competencies") or result.get("key_qualifications") or []
        tailored_resume.key_qualifications = result.get("key_qualifications") or []
        tailored_resume.targeted_projects = result.get("targeted_projects") or []

    raw_ai_resp = dict(result.get("raw_ai_response") or {})
    previous_raw_ai_resp = dict(tailored_resume.raw_ai_response or {})
    previous_raw_ai_resp.pop("generation_id", None)
    previous_raw_ai_resp.pop("generation_doc_type", None)
    if previous_raw_ai_resp.get("cover_letter") and not result.get("cover_letter"):
        raw_ai_resp["cover_letter"] = previous_raw_ai_resp["cover_letter"]
    if result.get("cover_letter"):
        raw_ai_resp["cover_letter"] = result.get("cover_letter")
    generated_documents = dict(previous_raw_ai_resp.get("generated_documents") or {})
    if doc_type in {"resume", "both"}:
        generated_documents["resume"] = True
    if doc_type in {"cover_letter", "both"}:
        generated_documents["cover_letter"] = True
    raw_ai_resp["generated_documents"] = generated_documents
    tailored_resume.raw_ai_response = raw_ai_resp
    tailored_resume.status = "ready"
    tailored_resume.error_message = None
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
    tailored_dict = tailored_resume_response(tailored_resume)
    # Return the combined document set as well, so the client preview remains
    # complete when Resume and Cover Letter were generated in separate runs.
    combined_cover_letter = raw_ai_resp.get("cover_letter")
    if combined_cover_letter:
        tailored_dict["cover_letter"] = combined_cover_letter
        result["cover_letter"] = combined_cover_letter
    result["tailored_resume"] = tailored_dict
    return result



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
        "date_posted": application.date_posted,
    }
    return review_job(job, dict(tailored_resume.source_resume_data or {}), mock=mock)


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

        result = _run_tailored_resume_generation(tailored_resume, application, mock=mock)
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
    if should_be_default:
        _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
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
    if job_hunting_profile.is_default:
        _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
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
    _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
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
        _sync_job_profile_core_values(db, current_user, job_hunting_profile, overwrite=True)
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


def _get_user_profile_skills(db: Session, current_user: User) -> list[str]:
    return list(
        db.scalars(
            select(UserSkill.skill_name)
            .where(
                UserSkill.user_id == current_user.id,
                UserSkill.source == "plugin",
            )
            .order_by(UserSkill.created_at.asc())
        ).all()
    )


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

    resume_data = _get_user_active_resume_data(db, current_user)
    result = evaluate_candidate(
        candidate_payload,
        settings=settings,
        resume_data=resume_data,
        profile_skills=_get_user_profile_skills(db, current_user),
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
    date_posted = candidate_payload.get("date_posted") or candidate_payload.get("posted_at")
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
            if previous_plan.state in (
                ApplicationState.SUBMITTED,
                ApplicationState.PREPARING,
                ApplicationState.READY_TO_SUBMIT,
                ApplicationState.REJECTED,
            ):
                return _application_plan_response(existing, previous_plan)
        else:
            candidate_payload["already_applied"] = True

    resume_data = _get_user_active_resume_data(db, current_user)
    result = evaluate_candidate(
        candidate_payload,
        settings=settings,
        resume_data=resume_data,
        profile_skills=_get_user_profile_skills(db, current_user),
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
        if date_posted:
            existing.date_posted = date_posted
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
        date_posted=date_posted,
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


def _autofill_answer_category(label: str) -> str | None:
    norm = _normalize_form_label(label)
    if any(term in norm for term in ["notice period", "notice", "availability or notice", "notice period or availability", "离职状态", "离职通知期", "通知期", "离职期"]):
        return "notice_period"
    if any(term in norm for term in ["date available", "available date", "availability date", "earliest start date", "start date", "when can you start", "到岗时间", "最快到岗", "可到岗日期"]):
        return "date_available"
    if "current" in norm and any(term in norm for term in ["salary", "compensation", "remuneration", "ctc", "薪资", "目前薪资", "当前薪资"]):
        return "current_salary"
    if any(term in norm for term in ["day rate", "daily rate", "per day", "aud/day", "期望日薪", "日薪"]):
        return "day_rate"
    if any(term in norm for term in ["salary", "compensation", "remuneration", "pay expectation", "aud/year", "per year", "expected salary", "desired salary", "期望薪资", "目标薪资", "年薪"]):
        return "salary"
    if any(term in norm for term in ["visa sponsorship", "visa sponsor", "require sponsorship", "need sponsorship", "require visa", "sponsorship support", "签证赞助", "需要赞助"]):
        return "visa_sponsorship"
    if any(term in norm for term in ["citizenship", "nationality", "国籍"]):
        return "citizenship"
    if any(term in norm for term in ["details of your visa", "visa details", "details of visa", "visa type", "type of visa", "visa category", "签证类型", "签证细节"]):
        return "visa_type"
    if any(term in norm for term in ["on a work visa", "on a visa", "work visa", "working visa", "visa status", "current visa", "hold a visa", "visa holder", "签证状态", "持有签证"]):
        return "visa_status"
    if any(term in norm for term in ["work authorization", "authorized to work", "right to work", "work rights", "working rights", "full working rights", "eligible to work", "entitled to work", "legally authorized", "permission to work", "unrestricted work rights", "工作权限", "工作合法性", "合法工作"]):
        return "work_authorization"
    if any(term in norm for term in ["security clearance", "clearance status", "nv1", "nv2", "baseline clearance", "安全审查"]):
        return "security_clearance"
    if any(term in norm for term in ["police check", "background check", "criminal history", "无犯罪记录", "背景调查"]):
        return "police_check_consent"
    if any(term in norm for term in ["working with children", "wwcc", "wwc"]):
        return "wwcc_status"
    if any(term in norm for term in ["driver license", "driver's license", "driving license", "valid license", "驾照"]):
        return "drivers_license"
    if any(term in norm for term in ["work restriction", "restriction on work", "limitation on hours", "工作限制"]):
        return "work_restrictions"
    if any(term in norm for term in ["years of experience", "years experience", "experience years", "professional experience", "工作年限", "经验年限", "工作经验"]):
        return "experience"
    if any(term in norm for term in ["relocate", "relocation", "move for this role", "异地搬迁", "接受异地"]):
        return "relocation"
    if any(term in norm for term in ["office", "hybrid", "commute", "on-site", "onsite", "办公方式", "到岗频次"]):
        return "office_attendance"
    if any(term in norm for term in ["based", "where are you", "location", "city", "relocate", "所在城市", "当前位置", "居住地"]):
        return "location"
    if any(term in norm for term in ["text message", "sms", "text updates", "receive text"]):
        return "sms_opt_in"
    return None


def _autofill_intent_key(label: str) -> str | None:
    norm = _normalize_form_label(label)
    if norm in {"title", "salutation", "prefix", "honorific", "name prefix", "称谓", "尊称"}:
        return "identity.title"
    if "preferred name" in norm or "preferred first name" in norm or "常用名" in norm:
        return "identity.preferred_name"
    if "pronoun" in norm or "代词" in norm:
        return "identity.pronouns"
    if "legal name" in norm or "法定姓名" in norm:
        return "identity.legal_name"
    if any(term in norm for term in ["first name", "given name", "forename", "名字", "名"]):
        return "identity.first_name"
    if any(term in norm for term in ["last name", "family name", "surname", "姓氏", "姓"]):
        return "identity.last_name"
    if norm in {"name", "full name", "姓名", "全名"}:
        return "identity.full_name"
    if any(term in norm for term in ["email", "e-mail", "邮箱", "电子邮箱"]):
        return "identity.email"
    if any(term in norm for term in ["phone", "mobile", "contact number", "telephone", "电话", "手机", "联系电话"]):
        return "identity.phone"
    if any(term in norm for term in ["day rate", "daily rate", "per day", "aud/day", "期望日薪"]):
        return "compensation.desired_day_rate"
    # This is not the same question as ordinary work authorization. A
    # candidate who may work only with sponsorship is authorized to work, but
    # must answer "No" to "without sponsorship". Keep the polarity in the
    # intent so it cannot be lost during option mapping.
    if (
        any(term in norm for term in ["authorized to work", "right to work", "work rights", "eligible to work"])
        and any(term in norm for term in ["without sponsorship", "without visa sponsorship", "no sponsorship"])
    ):
        return "employment.work_authorization_without_sponsorship"
    category = _autofill_answer_category(label)
    return {
        "location": "employment.current_location",
        "office_attendance": "employment.office_attendance",
        "salary": "compensation.desired_base_salary",
        "day_rate": "compensation.desired_day_rate",
        "current_salary": "compensation.current_salary",
        "citizenship": "employment.citizenship",
        "visa_status": "employment.visa_status",
        "visa_type": "employment.visa_type",
        "visa_sponsorship": "employment.visa_sponsorship",
        "work_authorization": "employment.work_authorization",
        "security_clearance": "employment.security_clearance",
        "police_check_consent": "employment.police_check_consent",
        "wwcc_status": "employment.wwcc_status",
        "drivers_license": "employment.drivers_license",
        "work_restrictions": "employment.work_restrictions",
        "experience": "experience.years",
        "relocation": "employment.relocation",
        "date_available": "employment.date_available",
        "notice_period": "employment.notice_period",
        "sms_opt_in": "consent.sms",
    }.get(category)


_ATS_PLATFORMS = {"workday", "greenhouse", "lever", "ashby", "smartrecruiters", "taleo"}


def _autofill_intent_key_for_field(field: Any, platform: str = "generic") -> str | None:
    """Classify a field from its clean label, then conservative machine hints.

    The DOM label remains authoritative. ATS identifiers are only a fallback
    when the label itself cannot be classified, which avoids an opaque id
    overriding a human-readable question.
    """
    intent = _autofill_intent_key(str(getattr(field, "label", "") or ""))
    if intent:
        return intent
    if platform not in _ATS_PLATFORMS:
        return None
    for hint in (getattr(field, "name", None), getattr(field, "id", None)):
        normalized_hint = str(hint or "").replace("_", " ").replace("-", " ")
        intent = _autofill_intent_key(normalized_hint)
        if intent:
            return intent
    return None


def _inverse_sponsorship_answer(value: str | None) -> str | None:
    """Return the answer to an explicit *without sponsorship* question."""
    normalized = _normalize_form_label(str(value or ""))
    if normalized in {"yes", "true", "1", "required", "require", "needed", "need"}:
        return "No"
    if normalized in {"no", "false", "0", "not required", "none", "not needed"}:
        return "Yes"
    if "sponsor" in normalized or "visa" in normalized:
        if any(term in normalized for term in {"not required", "not needed", "no sponsorship", "without sponsorship"}):
            return "Yes"
        if any(term in normalized for term in {"required", "require", "needed", "need"}):
            return "No"
    return None


def _canonical_autofill_intent_key(value: str) -> str:
    raw = str(value or "").strip()
    normalized = normalize_alias(raw)
    if normalized in {
        "title",
        "salutation",
        "prefix",
        "honorific",
        "name prefix",
        "identity title",
        "identity salutation",
        "identity prefix",
        "learned title",
        "learned salutation",
        "custom title",
    }:
        return "identity.title"
    return raw


def _compatible_form_field_types(left: str, right: str) -> bool:
    """Allow safe reuse between equivalent text and choice controls."""
    if left == right:
        return True
    text_like = {"text", "textarea", "number"}
    choice_like = {"select", "radio"}
    return (left in text_like and right in text_like) or (left in choice_like and right in choice_like)


def _field_semantic_features(field: Any) -> list[str]:
    explicit = list(getattr(field, "semantic_features", None) or [])
    return explicit or extract_semantic_features(field.label, getattr(field, "name", None) or "", getattr(field, "id", None) or "")


def _match_form_mapping_rule(
    db: Session,
    *,
    user_id: UUID,
    field: Any,
    platform: str,
    scene: str,
    semantic_features: list[str],
) -> Any | None:
    """Prefer a user correction for this ATS, then reuse generic memory."""
    for mapping_scene in fallback_mapping_scenes(platform, scene):
        match = match_mapping_rule(
            db,
            user_id=user_id,
            alias=field.label,
            scene=mapping_scene,
            semantic_features=semantic_features,
            field_type=field.type,
        )
        if match:
            return match
    return None


def _is_single_consent_checkbox(field: Any) -> bool:
    """A required, single checkbox that records acceptance of site terms."""
    if str(getattr(field, "type", "")).casefold() != "checkbox":
        return False
    label = normalize_alias(
        " ".join(
            str(value or "")
            for value in (
                getattr(field, "label", ""),
                getattr(field, "name", ""),
                getattr(field, "id", ""),
            )
        )
    )
    return bool(
        getattr(field, "required", False)
        and re.search(r"(?:privacy|consent|terms|conditions|have read|agree|acknowledge|accept)", label)
    )


def _is_privacy_or_terms_checkbox(field: Any) -> bool:
    label = normalize_alias(
        " ".join(
            str(val) for val in (
                getattr(field, "label", ""),
                getattr(field, "name", ""),
                getattr(field, "id", ""),
            ) if val
        )
    )
    return bool(
        str(getattr(field, "type", "")).casefold() == "checkbox"
        and re.search(r"(?:privacy|consent|terms|conditions|have read|agree|acknowledge|accept)", label)
    )


def _is_phone_country_field(field: Any) -> bool:
    """Identify controls that represent phone country dialing codes across ATS forms."""
    field_id = str(getattr(field, "id", None) or "").strip().casefold()
    field_name = str(getattr(field, "name", None) or "").strip().casefold()
    field_key = str(getattr(field, "key", None) or "").strip().casefold()
    field_label = normalize_alias(str(getattr(field, "label", None) or ""))

    if field_id == "country" and str(getattr(field, "type", None) or "").strip().casefold() == "select":
        return True

    exact_labels = {
        "phone country",
        "phone country code",
        "country code",
        "phone code",
        "dial code",
        "phone dial code",
        "calling code",
        "country region code",
        "dialing code",
    }
    if field_label in exact_labels or any(term in field_label for term in ("phone country", "country code", "phone dial code")):
        return True

    keywords = ("phone_country", "country_code", "phone_code", "dial_code", "calling_code", "country_dial", "phonecountry", "countrycode")
    for identifier in (field_id, field_name, field_key):
        if identifier and any(kw in identifier for kw in keywords):
            return True

    return False


# Keep this deliberately small and explicit. The form country selector only
# needs a stable answer; the phone itself remains the user's source value.
_PHONE_COUNTRY_CODES: dict[str, tuple[str, str]] = {
    "AU": ("Australia", "+61"),
    "NZ": ("New Zealand", "+64"),
    "GB": ("United Kingdom", "+44"),
    "US": ("United States", "+1"),
    "CA": ("Canada", "+1"),
    "CN": ("China", "+86"),
    "IN": ("India", "+91"),
    "SG": ("Singapore", "+65"),
    "HK": ("Hong Kong", "+852"),
    "MY": ("Malaysia", "+60"),
    "PH": ("Philippines", "+63"),
    "ZA": ("South Africa", "+27"),
    "DE": ("Germany", "+49"),
    "FR": ("France", "+33"),
}


def _phone_country_code(phone: str | None, fallback_country: str | None = None) -> str | None:
    """Infer an ISO country from an international or common local number."""
    raw = str(phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        international = f"+{digits}"
        for code, (_, dial) in sorted(_PHONE_COUNTRY_CODES.items(), key=lambda item: -len(item[1][1])):
            if international.startswith(dial):
                return code
    if digits.startswith("00"):
        return _phone_country_code(f"+{digits[2:]}", fallback_country)
    fallback = normalize_alias(fallback_country or "")
    for code, (name, dial) in _PHONE_COUNTRY_CODES.items():
        if fallback in {normalize_alias(name), normalize_alias(code), normalize_alias(dial)}:
            return code
    # Australian mobile/geographic national numbers are unambiguous enough
    # for a useful default and cover the most common Jobby profile format.
    if re.fullmatch(r"0[23478]\d{8}", digits) or re.fullmatch(r"04\d{8}", digits):
        return "AU"
    return None


def _phone_country_value(field: Any, phone: str | None, fallback_country: str | None = None) -> str | None:
    code = _phone_country_code(phone, fallback_country)
    if not code:
        return None
    name, dial = _PHONE_COUNTRY_CODES[code]
    dial_no_plus = dial.removeprefix("+")
    candidates = {
        normalize_alias(name),
        normalize_alias(code),
        normalize_alias(dial),
        normalize_alias(dial_no_plus),
        normalize_alias(f"{name} ({dial})"),
        normalize_alias(f"{code} ({dial})"),
        normalize_alias(f"{dial} ({name})"),
        normalize_alias(f"{dial} {name}"),
        normalize_alias(f"{name} {dial}"),
    }
    for option in getattr(field, "options", None) or []:
        label = str(option.get("label") or "").strip()
        value = str(option.get("value") or "").strip()
        norm_label = normalize_alias(label)
        norm_value = normalize_alias(value)
        if not norm_label and not norm_value:
            continue

        if candidates & {norm_label, norm_value}:
            return value or label

        if any(
            candidate and (candidate in norm_label or candidate in norm_value)
            for candidate in (normalize_alias(dial), normalize_alias(name), normalize_alias(code))
            if len(candidate) >= 2
        ):
            return value or label

    # React Select implementations often use the country name as the value,
    # while native selects expose the ISO code. Prefer the visible name when
    # no options were supplied so the content driver can resolve it.
    return name


def _form_scene(payload_scene: str | None, fields: list[Any]) -> str:
    scene = normalize_scene(payload_scene)
    if scene != "generic":
        return scene
    text = " ".join(str(field.label) for field in fields).casefold()
    if any(term in text for term in ("visa", "immigration", "passport", "residency")):
        return "visa_application"
    if any(term in text for term in ("register", "sign up", "create account")):
        return "registration"
    return "generic"


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


def _match_form_field(
    db: Session,
    *,
    user_id: UUID,
    field: Any,
    scene: str,
) -> tuple[str | None, str | None, Any | None]:
    features = _field_semantic_features(field)
    match = None if _is_phone_country_field(field) else match_mapping_rule(
        db,
        user_id=user_id,
        alias=field.label,
        scene=scene,
        semantic_features=features,
        field_type=field.type,
    )
    if not match:
        return None, None, None
    values = core_profile_values(db, user_id)
    return transformed_core_value(match.rule, values), match.rule.core_field_key, match.rule


def _notice_period_candidates(raw_answer: str) -> list[str]:
    cleaned = str(raw_answer or "").strip()
    if not cleaned:
        return []
    try:
        days = int(cleaned)
    except (ValueError, TypeError):
        return [cleaned]

    candidates = [str(days), f"{days} days", f"{days} day", f"{days}d"]
    if days == 0:
        candidates.extend(["0", "immediate", "immediately", "no notice", "none", "0 days", "0 weeks", "available immediately"])
    else:
        weeks = round(days / 7)
        if weeks > 0:
            candidates.extend([f"{weeks} week", f"{weeks} weeks", f"{weeks} wks", f"{weeks} wk", f"{weeks}w", f"{weeks} week notice", f"{weeks} weeks notice"])
        months = round(days / 30)
        if months > 0:
            candidates.extend([f"{months} month", f"{months} months", f"{months} mon", f"{months}m", f"{months} month notice"])
    return candidates


def _coerce_form_value(
    raw_answer: str,
    field: Any,
    core_field_key: str | None = None,
) -> tuple[str | bool | None, str | None]:
    if field.type == "checkbox":
        if raw_answer.casefold() not in {"true", "false"}:
            return None, "Checkbox value is not boolean."
        return raw_answer.casefold() == "true", None
    if field.type in {"select", "radio"}:
        field_label = str(getattr(field, "label", "") or "")
        target_answers = [raw_answer]
        if core_field_key == "employment.notice_period" or "notice" in field_label.lower():
            target_answers.extend(_notice_period_candidates(raw_answer))
        elif core_field_key == "employment.work_authorization":
            if any(term in raw_answer.lower() for term in ["yes", "true", "full", "authorized", "citizen", "pr", "permanent", "permit", "work rights", "unrestricted"]):
                target_answers.extend(["yes", "y", "true", "1", "authorized", "eligible", "unrestricted work rights", "full working rights"])
                if "citizen" in raw_answer.lower():
                    target_answers.extend(["citizen", "australian/new zealand citizen", "australian citizen", "citizen / permanent resident"])
                elif any(term in raw_answer.lower() for term in ["pr", "permanent"]):
                    target_answers.extend(["permanent resident", "permanent", "pr holder", "citizen / permanent resident"])
                elif any(term in raw_answer.lower() for term in ["visa", "permit"]):
                    target_answers.extend(["valid visa holder", "visa holder", "visa", "temporary visa holder"])
            elif any(term in raw_answer.lower() for term in ["no", "false"]):
                target_answers.extend(["no", "n", "false", "0", "requires sponsorship", "no work rights"])
        elif core_field_key == "consent.sms" or "sms" in field_label.lower() or "text message" in field_label.lower():
            if any(term in raw_answer.lower() for term in ["no", "false", "opt out", "don't consent", "do not consent"]):
                target_answers.extend(["false", "no", "0", "no - i do not consent to receiving text messages"])
            else:
                target_answers.extend(["false", "no", "0", "no - i do not consent to receiving text messages", "true", "yes", "1", "yes - i consent to receiving text messages"])
        elif core_field_key == "employment.visa_status":
            if any(term in raw_answer.lower() for term in ["work visa", "temporary", "yes", "student", "bridging", "holder", "visa"]):
                target_answers.extend(["yes", "y", "true", "1", "temporary visa holder", "work visa", "valid visa holder", "working visa"])
            elif any(term in raw_answer.lower() for term in ["no", "false", "citizen", "pr", "permanent"]):
                target_answers.extend(["no", "n", "false", "0", "australian/new zealand citizen", "permanent resident"])
        elif core_field_key == "employment.visa_sponsorship":
            if any(term in raw_answer.lower() for term in ["no", "false", "none", "not required", "don't need", "will not require"]):
                target_answers.extend(["no", "n", "false", "0", "no sponsorship required", "will not require sponsorship"])
            elif any(term in raw_answer.lower() for term in ["yes", "true", "required", "need"]):
                target_answers.extend(["yes", "y", "true", "1", "sponsorship required"])
        elif core_field_key == "identity.pronouns" or "pronoun" in field_label.lower():
            lower_ans = raw_answer.lower()
            if any(term in lower_ans for term in ["he/him", "he / him", "male"]):
                target_answers.extend(["he/him", "he / him", "he / him / his", "he/him/his", "he", "him", "his", "male"])
            elif any(term in lower_ans for term in ["she/her", "she / her", "female"]):
                target_answers.extend(["she/her", "she / her", "she / her / hers", "she/her/hers", "she", "her", "hers", "female"])
            elif any(term in lower_ans for term in ["they/them", "they / them"]):
                target_answers.extend(["they/them", "they / them", "they / them / theirs", "they/them/theirs", "they", "them", "theirs"])
            elif any(term in lower_ans for term in ["prefer not to say", "decline", "do not wish"]):
                target_answers.extend(["prefer not to say", "decline to state", "do not wish to specify", "prefer not to specify"])

        normalized_candidates = {normalize_alias(ans) for ans in target_answers if ans}

        for option in field.options:
            option_value = str(option.get("value") or option.get("label") or "")
            normalized_value = normalize_alias(option_value)
            normalized_label = normalize_alias(option.get("label", ""))

            if not normalized_value and not normalized_label:
                continue
            if normalized_label in {"select", "choose", "please select", "-- select --"}:
                continue

            if normalized_candidates & {normalized_value, normalized_label}:
                return option_value, None

        # Conservative phrase matching for the remaining options. A single
        # shared word (for example "visa" or "other") is not evidence that
        # an option represents the user's answer, so never use it as a
        # fallback. Exact matching above still handles terse Yes/No values.
        best_option = None
        best_score = 0
        for option in field.options:
            option_value = str(option.get("value") or option.get("label") or "")
            norm_label = normalize_alias(option.get("label", ""))
            if not norm_label or norm_label in {"select", "choose", "please select", "-- select --"}:
                continue
            
            option_tokens = set(norm_label.split())
            for cand in normalized_candidates:
                cand_tokens = set(cand.split())
                if len(cand_tokens) < 2:
                    continue
                overlap = len(cand_tokens & option_tokens)
                if cand in norm_label or norm_label in cand:
                    score = 10 + overlap
                elif overlap >= 2 and overlap / len(cand_tokens) >= 0.75:
                    score = overlap
                else:
                    continue
                if score > best_score and score >= 1:
                    best_score = score
                    best_option = option_value

        if best_option is not None:
            return best_option, None

        if field.options:
            return None, "Value is not one of the available options."

    field_label = str(getattr(field, "label", "") or "")
    if core_field_key == "employment.date_available" or "available" in field_label.lower():
        label_text = f"{field_label} {getattr(field, 'placeholder', '')}".lower()
        if "mm/dd/yyyy" in label_text or "mm-dd-yyyy" in label_text:
            try:
                dt = datetime.strptime(raw_answer[:10], "%Y-%m-%d")
                return dt.strftime("%m/%d/%Y"), None
            except ValueError:
                pass
        elif "dd/mm/yyyy" in label_text or "dd-mm-yyyy" in label_text:
            try:
                dt = datetime.strptime(raw_answer[:10], "%Y-%m-%d")
                return dt.strftime("%d/%m/%Y"), None
            except ValueError:
                pass

    return raw_answer, None


# Keep these re-exports stable while endpoint code is gradually moved out of
# this legacy module. New logic lives in the small, independently testable
# modules instead of adding further responsibilities to `main.py`.
from services.shared.autofill_intents import (
    _autofill_answer_category,
    _autofill_intent_key,
    _autofill_intent_key_for_field,
    _inverse_sponsorship_answer,
)
from services.shared.form_option_mapper import coerce_form_value as _coerce_form_value


def _build_form_autofill_instructions(
    db: Session,
    *,
    payload: FormAutofillInstructionsRequest | ApplicationFormInstructionsRequest,
    current_user: User,
    platform: str,
    scene: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    instructions: list[dict[str, Any]] = []
    unanswered: list[dict[str, str]] = []
    traces: list[dict[str, Any]] = []
    if not dry_run:
        ensure_identity_core_values(db, current_user)
        job_profile = db.scalar(
            select(JobHuntingProfile)
            .where(JobHuntingProfile.user_id == current_user.id, JobHuntingProfile.is_default.is_(True))
            .order_by(JobHuntingProfile.updated_at.desc())
            .limit(1)
        )
        _sync_job_profile_core_values(db, current_user, job_profile)
        db.flush()
    values = core_profile_values(db, current_user.id)
    for field in payload.fields:
        features = _field_semantic_features(field)
        if _is_phone_country_field(field):
            value = _phone_country_value(
                field,
                values.get("identity.phone"),
                values.get("address.country"),
            )
            if value:
                instructions.append({
                    "type": "content.fill-field",
                    "commandId": str(uuid4()),
                    # `ApplicationFieldInstruction.source` is an execution
                    # channel, not an attribution field. Keep the detailed
                    # derivation in `traces`; returning it here violates the
                    # response schema and rejects the entire batch response.
                    "source": "backend",
                    "target": field.model_dump(exclude_none=True),
                    "value": value,
                })
                traces.append({
                    "key": field.key,
                    "label": field.label,
                    "intent_key": "identity.phone_country",
                    "core_field_key": "identity.phone",
                    "scene": scene,
                    "semantic_features": features,
                    "source": "phone_country_inference",
                    "status": "filled",
                    "value": value,
                })
            else:
                reason = "Could not infer the phone country from the saved phone number or address country."
                unanswered.append({"key": field.key, "label": field.label, "reason": reason})
                traces.append({"key": field.key, "label": field.label, "intent_key": "identity.phone_country", "core_field_key": "identity.phone", "scene": scene, "semantic_features": features, "source": "phone_country_inference", "status": "unanswered", "reason": reason})
            continue
        if field.type in {"password", "file", "unknown"}:
            reason = "This field requires explicit user handling."
            unanswered.append({"key": field.key, "label": field.label, "reason": reason})
            traces.append({"key": field.key, "label": field.label, "intent_key": None, "core_field_key": None, "scene": scene, "semantic_features": features, "source": "none", "status": "unanswered", "reason": reason})
            continue
        if _is_single_consent_checkbox(field):
            instructions.append({
                "type": "content.fill-field",
                "commandId": str(uuid4()),
                "source": "backend",
                "target": field.model_dump(exclude_none=True),
                "value": True,
            })
            traces.append({
                "key": field.key,
                "label": field.label,
                "intent_key": "consent.acceptance",
                "core_field_key": None,
                "scene": scene,
                "semantic_features": features,
                "source": "system_rule",
                "status": "filled",
                "value": True,
            })
            continue
        match = None if _is_phone_country_field(field) else _match_form_mapping_rule(
            db,
            user_id=current_user.id,
            field=field,
            platform=platform,
            scene=scene,
            semantic_features=features,
        )
        # High-confidence canonical questions (for example TechnologyOne's
        # work-rights and work-visa questions) must not depend on a user's
        # learned mapping rows. A stale or missing row otherwise leaves an
        # otherwise answerable radio field as `None` in the side panel.
        intent_key = _autofill_intent_key_for_field(field, platform)
        core_field_key = intent_key or (match.rule.core_field_key if match else None)
        if not core_field_key:
            reason = "No mapping rule matched this alias and form scene."
            unanswered.append({"key": field.key, "label": field.label, "reason": reason})
            traces.append({"key": field.key, "label": field.label, "intent_key": None, "core_field_key": None, "scene": scene, "semantic_features": features, "source": "none", "status": "unanswered", "reason": reason})
            continue
        raw_answer = values.get(core_field_key)
        coercion_key = core_field_key
        if core_field_key == "employment.work_authorization_without_sponsorship":
            raw_answer = _inverse_sponsorship_answer(values.get("employment.visa_sponsorship"))
            coercion_key = "employment.work_authorization"
        if match and not intent_key:
            raw_answer = transformed_core_value(match.rule, values)
        elif not raw_answer and intent_key in {"identity.full_name", "identity.legal_full_name"}:
            transform = default_core_value_transform(intent_key)
            if transform.get("operation") == "join":
                source_keys = transform.get("source_keys", [])
                parts = [values.get(str(k), "").strip() for k in source_keys]
                parts = [p for p in parts if p]
                if parts:
                    raw_answer = str(transform.get("separator", " ")).join(parts)
                else:
                    raw_answer = values.get("identity.preferred_name")
        if core_field_key == "employment.work_authorization":
            if not raw_answer or not str(raw_answer).strip():
                citizenship = values.get("employment.citizenship")
                visa_type = values.get("employment.visa_type") or values.get("employment.visa_status")
                if citizenship and str(citizenship).strip():
                    raw_answer = citizenship
                elif visa_type and str(visa_type).strip():
                    raw_answer = visa_type
                elif values.get("employment.visa_sponsorship") == "Yes":
                    raw_answer = "No"
                else:
                    raw_answer = "Yes"
        elif core_field_key == "employment.visa_status":
            if not raw_answer or not str(raw_answer).strip():
                if values.get("employment.visa_sponsorship") == "Yes" or values.get("employment.visa_type") or values.get("employment.visa_status"):
                    raw_answer = "Yes"
                else:
                    raw_answer = "No"
        elif core_field_key == "employment.visa_type":
            if not raw_answer or not str(raw_answer).strip():
                v_type = values.get("employment.visa_type") or values.get("employment.visa_status")
                v_expiry = values.get("employment.visa_expiry")
                if v_type and v_expiry:
                    raw_answer = f"{v_type} (Expiry: {v_expiry})"
                elif v_type:
                    raw_answer = v_type
        if core_field_key == "employment.date_available":
            notice_value = values.get("employment.notice_period")
            if notice_value is None or not str(notice_value).strip():
                raw_answer = None
            else:
                try:
                    notice_days = max(0, int(str(notice_value).strip()))
                except (TypeError, ValueError):
                    notice_days = 0
                raw_answer = (datetime.utcnow().date() + timedelta(days=notice_days)).isoformat()
        elif core_field_key == "compensation.desired_day_rate":
            if not raw_answer or not str(raw_answer).strip():
                salary_val = values.get("compensation.desired_base_salary")
                if salary_val and str(salary_val).strip():
                    try:
                        num = float(re.sub(r"[^\d.]", "", str(salary_val)))
                        if num > 0:
                            super_multiplier = 1.115
                            working_days = 220.0
                            raw_answer = str(int(round((num * super_multiplier) / working_days)))
                    except (ValueError, TypeError):
                        pass
        elif core_field_key == "compensation.desired_base_salary":
            if not raw_answer or not str(raw_answer).strip():
                day_rate_val = values.get("compensation.desired_day_rate")
                if day_rate_val and str(day_rate_val).strip():
                    try:
                        num = float(re.sub(r"[^\d.]", "", str(day_rate_val)))
                        if num > 0:
                            super_multiplier = 1.115
                            working_days = 220.0
                            raw_answer = str(int(round((num * working_days) / super_multiplier)))
                    except (ValueError, TypeError):
                        pass
        if not raw_answer:
            reason = "The mapped core field has no saved value."
            unanswered.append({"key": field.key, "label": field.label, "reason": reason})
            traces.append({"key": field.key, "label": field.label, "intent_key": core_field_key, "core_field_key": core_field_key, "scene": scene, "semantic_features": features, "source": "core_profile", "status": "unanswered", "reason": reason})
            continue
        value, reason = _coerce_form_value(str(raw_answer), field, coercion_key)
        if reason or value is None:
            unanswered.append({"key": field.key, "label": field.label, "reason": reason or "Value could not be used in this control."})
            traces.append({"key": field.key, "label": field.label, "intent_key": core_field_key, "core_field_key": core_field_key, "scene": scene, "semantic_features": features, "source": "core_profile", "status": "unanswered", "reason": reason})
            continue
        instructions.append({
            "type": "content.fill-field",
            "commandId": str(uuid4()),
            "source": "backend",
            "target": field.model_dump(exclude_none=True),
            "value": value,
        })
        traces.append({"key": field.key, "label": field.label, "intent_key": core_field_key, "core_field_key": core_field_key, "scene": scene, "semantic_features": features, "source": "intent_classifier" if intent_key else ("user_rule" if match.rule.is_user_defined else "system_rule"), "status": "filled", "value": value})
        if not dry_run and match:
            match.rule.times_used += 1
            match.rule.last_used_at = datetime.utcnow()
    if not dry_run:
        db.commit()
    return {"instructions": instructions, "unanswered_fields": unanswered, "traces": traces}


@app.post(
    "/api/form-autofill-instructions",
    response_model=FormAutofillInstructionsResponse,
    response_model_exclude_none=True,
)
def create_form_autofill_instructions(
    payload: FormAutofillInstructionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    """Match an inspected form directly against the user's saved data.

    This deliberately has no application-plan dependency: it is safe to use
    on an open form before a job has been inspected or an apply flow begins.
    """
    platform = payload.platform.strip().lower() or "generic"
    scene = _form_scene(payload.scene, payload.fields)
    return _build_form_autofill_instructions(
        db,
        payload=payload,
        current_user=current_user,
        platform=platform,
        scene=scene,
        dry_run=payload.dry_run,
    )


def _temp_change_response(change: FormTempChange) -> dict[str, Any]:
    return {
        "id": change.id,
        "session_id": change.session_id,
        "alias": change.alias,
        "temp_value": decrypt_profile_value(change.temp_value),
        "core_field_key": change.core_field_key,
        "scene": change.scene,
        "semantic_features": list(change.semantic_features or []),
        "field_type": change.field_type,
        "created_at": change.created_at,
        "updated_at": change.updated_at,
    }


def _upsert_form_temp_change(
    db: Session,
    *,
    payload: FormTempChangeRequest,
    current_user: User,
) -> FormTempChange | None:
    field = payload.field
    fingerprint = form_control_fingerprint(field)
    existing = db.scalar(
        select(FormTempChange).where(
            FormTempChange.user_id == current_user.id,
            FormTempChange.session_id == payload.session_id,
            FormTempChange.control_fingerprint == fingerprint,
        )
    )
    if not payload.temp_value.strip():
        if existing:
            db.delete(existing)
        return None
    scene = platform_mapping_scene(payload.platform, payload.scene)
    features = _field_semantic_features(field)
    match = None if _is_phone_country_field(field) else _match_form_mapping_rule(
        db,
        user_id=current_user.id,
        field=field,
        platform=payload.platform,
        scene=payload.scene,
        semantic_features=features,
    )
    if existing is None:
        existing = FormTempChange(
            user_id=current_user.id,
            session_id=payload.session_id,
            alias=field.label,
            normalized_alias=normalize_alias(field.label),
            temp_value="",
            core_field_key=match.rule.core_field_key if match else None,
            scene=scene,
            semantic_features=features,
            field_type=field.type,
            control_fingerprint=fingerprint,
            is_sensitive=True,
        )
        db.add(existing)
    from services.shared.autofill_profile import encrypt_profile_value
    existing.alias = field.label
    existing.normalized_alias = normalize_alias(field.label)
    existing.temp_value = encrypt_profile_value(payload.temp_value)
    existing.core_field_key = match.rule.core_field_key if match else existing.core_field_key
    existing.scene = scene
    existing.semantic_features = features
    existing.field_type = field.type
    return existing


@app.post("/api/form-temp-changes", response_model=FormTempChangeRead | None)
def save_form_temp_change(
    payload: FormTempChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any] | None:
    change = _upsert_form_temp_change(db, payload=payload, current_user=current_user)
    db.commit()
    if change is None:
        return None
    db.refresh(change)
    return _temp_change_response(change)


@app.get("/api/form-temp-changes", response_model=list[FormTempChangeRead])
def list_form_temp_changes(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict[str, Any]]:
    changes = list(db.scalars(
        select(FormTempChange)
        .where(FormTempChange.user_id == current_user.id, FormTempChange.session_id == session_id)
        .order_by(FormTempChange.updated_at.asc())
    ))
    return [_temp_change_response(change) for change in changes]


@app.post("/api/form-temp-changes/finalize", response_model=FormTempFinalizeResponse)
def finalize_form_temp_changes(
    payload: FormTempFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    try:
        for change in payload.changes:
            normalized = change.model_copy(update={"session_id": payload.session_id})
            _upsert_form_temp_change(db, payload=normalized, current_user=current_user)
        changes = list(db.scalars(
            select(FormTempChange).where(
                FormTempChange.user_id == current_user.id,
                FormTempChange.session_id == payload.session_id,
            )
        ))
        if not changes:
            db.commit()
            return {"status": "empty", "saved_count": 0, "discarded_count": 0}
        if not payload.save:
            discarded_count = len(changes)
            for change in changes:
                db.delete(change)
            db.commit()
            return {"status": "discarded", "saved_count": 0, "discarded_count": discarded_count}
        for change in changes:
            value = decrypt_profile_value(change.temp_value)
            core_key = change.core_field_key or suggested_custom_core_key(change.alias)
            upsert_core_profile_value(
                db, user_id=current_user.id, core_field_key=core_key, value=value,
                value_type="boolean" if change.field_type == "checkbox" else "text",
                is_sensitive=change.is_sensitive,
            )
            rule = db.scalar(
                select(FieldMappingRule).where(
                    FieldMappingRule.user_id == current_user.id,
                    FieldMappingRule.is_user_defined.is_(True),
                    FieldMappingRule.normalized_alias == change.normalized_alias,
                    FieldMappingRule.scene == change.scene,
                )
            )
            if rule is None:
                db.add(FieldMappingRule(
                    user_id=current_user.id,
                    core_field_key=core_key,
                    alias=change.alias,
                    normalized_alias=change.normalized_alias,
                    scene=change.scene,
                    semantic_features=change.semantic_features or [],
                    field_type=change.field_type,
                    value_transform=default_core_value_transform(core_key),
                    is_user_defined=True,
                    confidence=100,
                ))
            else:
                rule.core_field_key = core_key
                rule.alias = change.alias
                rule.semantic_features = change.semantic_features or []
                rule.field_type = change.field_type
                rule.confidence = 100
        saved_count = len(changes)
        for change in changes:
            db.delete(change)
        db.commit()
        return {"status": "saved", "saved_count": saved_count, "discarded_count": 0}
    except Exception:
        db.rollback()
        raise


@app.get("/api/field-mapping-rules", response_model=list[FieldMappingRuleRead])
def list_field_mapping_rules(
    include_system: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[FieldMappingRule]:
    condition = or_(FieldMappingRule.user_id == current_user.id, FieldMappingRule.user_id.is_(None)) if include_system else FieldMappingRule.user_id == current_user.id
    return list(db.scalars(select(FieldMappingRule).where(condition).order_by(FieldMappingRule.is_user_defined.desc(), FieldMappingRule.confidence.desc(), FieldMappingRule.alias)))


@app.post("/api/field-mapping-rules", response_model=FieldMappingRuleRead, status_code=status.HTTP_201_CREATED)
def create_field_mapping_rule(
    payload: FieldMappingRuleBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> FieldMappingRule:
    rule = FieldMappingRule(
        user_id=current_user.id,
        core_field_key=payload.core_field_key.strip(),
        alias=payload.alias.strip(),
        normalized_alias=normalize_alias(payload.alias),
        scene=normalize_scene(payload.scene),
        semantic_features=payload.semantic_features,
        field_type=payload.field_type,
        value_transform=payload.value_transform,
        is_user_defined=True,
        confidence=payload.confidence,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@app.put("/api/field-mapping-rules/{rule_id}", response_model=FieldMappingRuleRead)
def update_field_mapping_rule(
    rule_id: UUID,
    payload: FieldMappingRuleBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> FieldMappingRule:
    rule = db.get(FieldMappingRule, rule_id)
    if not rule or rule.user_id != current_user.id or not rule.is_user_defined:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User mapping rule not found")
    rule.core_field_key = payload.core_field_key.strip()
    rule.alias = payload.alias.strip()
    rule.normalized_alias = normalize_alias(payload.alias)
    rule.scene = normalize_scene(payload.scene)
    rule.semantic_features = payload.semantic_features
    rule.field_type = payload.field_type
    rule.value_transform = payload.value_transform
    rule.confidence = payload.confidence
    db.commit()
    db.refresh(rule)
    return rule


@app.delete("/api/field-mapping-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field_mapping_rule(
    rule_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    rule = db.get(FieldMappingRule, rule_id)
    if not rule or rule.user_id != current_user.id or not rule.is_user_defined:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User mapping rule not found")
    db.delete(rule)
    db.commit()


@app.post("/api/form-autofill-observations", response_model=FormAnswerObservationResponse)
def observe_manual_form_answer(
    payload: FormAnswerObservationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, str | None]:
    """Record a manual answer without immediately promoting it to AI Memory."""
    answer = (payload.answer or getattr(payload, "temp_value", "")).strip()
    if not answer or payload.field.type in {"password", "file", "unknown"}:
        return {"status": "ignored", "intent_key": None}
    # Older extension builds do not carry a stable form session or an explicit
    # save/cancel action, so accepting their observations would create orphaned
    # temporary data. They must upgrade before learning can be enabled.
    return {"status": "ignored", "intent_key": _autofill_intent_key(payload.field.label)}


@app.get("/api/form-autofill-observations", response_model=list[FormAnswerObservationRead])
def list_form_answer_observations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict[str, Any]]:
    """Compatibility view over unconfirmed session changes."""
    changes = list(db.scalars(
        select(FormTempChange)
        .where(FormTempChange.user_id == current_user.id)
        .order_by(FormTempChange.updated_at.desc())
    ))
    return [
        {
            **_temp_change_response(change),
            "platform": "generic",
            "company_scope": "",
            "original_label": change.alias,
            "answer": decrypt_profile_value(change.temp_value),
            "intent_key": change.core_field_key,
            "times_seen": 1,
            "status": "observed",
            "last_seen_at": change.updated_at,
        }
        for change in changes
    ]


@app.delete("/api/form-autofill-observations/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form_answer_observation(
    observation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    observation = db.get(FormTempChange, observation_id)
    if not observation or observation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form answer observation not found")
    db.delete(observation)
    db.commit()


@app.post(
    "/api/application-plans/{application_id}/form-instructions",
    response_model=ApplicationFormInstructionsResponse,
    response_model_exclude_none=True,
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

    return {
        "application_id": application_id,
        **_build_form_autofill_instructions(
            db,
            payload=payload,
            current_user=current_user,
            platform=plan.candidate.platform.strip().lower() or "generic",
            scene="job_application",
        ),
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
    except (ValueError, TypeError, PlanTransitionError) as exc:
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


@app.get("/api/autofill-answers", response_model=list[AutofillAnswerRead])
def list_autofill_answers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict[str, Any]]:
    rows = core_profile_rows(db, current_user.id)
    result: list[dict[str, Any]] = []
    needle = search.strip().casefold() if search and search.strip() else ""
    for row in rows:
        if row.core_field_key == PROFILE_PREFERENCES_KEY:
            continue
        value = decrypt_profile_value(row.field_value)
        if needle and needle not in row.core_field_key.casefold() and needle not in value.casefold():
            continue
        result.append({
            "id": row.id,
            "user_id": row.user_id,
            "intent_key": row.core_field_key,
            "value": value,
            "value_type": row.value_type,
            "authority": "user",
            "version": row.version,
            "last_confirmed_at": row.updated_at,
            "times_used": 0,
            "last_used_at": None,
            "active": True,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        })
    return result


@app.post("/api/autofill-answers", response_model=AutofillAnswerRead, status_code=status.HTTP_201_CREATED)
def create_autofill_answer(
    payload: AutofillAnswerBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    payload.intent_key = _canonical_autofill_intent_key(payload.intent_key)
    answer = upsert_core_profile_value(
        db,
        user_id=current_user.id,
        core_field_key=payload.intent_key,
        value=payload.value,
        value_type=payload.value_type,
    )
    db.commit()
    db.refresh(answer)
    return {
        "id": answer.id, "user_id": answer.user_id, "intent_key": answer.core_field_key,
        "value": payload.value, "value_type": answer.value_type, "authority": "user", "version": answer.version,
        "last_confirmed_at": answer.updated_at, "times_used": 0, "last_used_at": None, "active": True,
        "created_at": answer.created_at, "updated_at": answer.updated_at,
    }


@app.put("/api/autofill-answers/{answer_id}", response_model=AutofillAnswerRead)
def update_autofill_answer(
    answer_id: UUID,
    payload: AutofillAnswerBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    payload.intent_key = _canonical_autofill_intent_key(payload.intent_key)
    answer = db.get(UserCoreProfile, answer_id)
    if not answer or answer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Autofill answer not found")
    if answer.core_field_key != payload.intent_key:
        delete_core_profile_value(db, user_id=current_user.id, core_field_key=answer.core_field_key)
        answer = upsert_core_profile_value(db, user_id=current_user.id, core_field_key=payload.intent_key, value=payload.value, value_type=payload.value_type)
    else:
        upsert_core_profile_value(db, user_id=current_user.id, core_field_key=payload.intent_key, value=payload.value, value_type=payload.value_type)
    db.commit()
    db.refresh(answer)
    return {
        "id": answer.id, "user_id": answer.user_id, "intent_key": answer.core_field_key,
        "value": payload.value, "value_type": answer.value_type, "authority": "user", "version": answer.version,
        "last_confirmed_at": answer.updated_at, "times_used": 0, "last_used_at": None, "active": payload.active,
        "created_at": answer.created_at, "updated_at": answer.updated_at,
    }


@app.delete("/api/autofill-answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autofill_answer(
    answer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    answer = db.get(UserCoreProfile, answer_id)
    if not answer or answer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Autofill answer not found")
    db.delete(answer)
    db.commit()


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
        raise HTTPException(status_code=404, detail="No tailored resume found")
    return tailored


@app.post(
    "/api/applications/{application_id}/generate-resume",
    response_model=TailoredResumeRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_application_tailored_resume(
    application_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    application = db.get(JobApplication, application_id)
    if not application or application.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found")
    tailored, should_generate = start_tailored_resume_generation(db, current_user, application)
    if should_generate:
        background_tasks.add_task(process_tailored_resume, tailored.id)
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


@app.get("/api/user-skills", response_model=list[UserSkillRead])
def list_user_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[UserSkill]:
    return list(
        db.scalars(
            select(UserSkill)
            .where(
                UserSkill.user_id == current_user.id,
                UserSkill.source == "plugin",
            )
            .order_by(UserSkill.created_at.asc())
        ).all()
    )


@app.post(
    "/api/user-skills",
    response_model=UserSkillRead,
    status_code=status.HTTP_201_CREATED,
)
def add_user_skill(
    payload: UserSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> UserSkill:
    raw_name = payload.skill_name.strip()
    if not raw_name:
        raise HTTPException(status_code=422, detail="skill_name cannot be blank")
    display_name, canonical_name = _skill_identity(db, raw_name)
    existing = db.scalar(
        select(UserSkill).where(
            UserSkill.user_id == current_user.id,
            func.lower(UserSkill.canonical_name) == canonical_name,
        )
    )
    if existing:
        existing.skill_name = display_name
        existing.canonical_name = canonical_name
        existing.category = payload.category or existing.category or "Plugin Skills"
        existing.source = "plugin"
        skill = existing
    else:
        skill = UserSkill(
            user_id=current_user.id,
            skill_name=display_name,
            canonical_name=canonical_name,
            category=payload.category or "Plugin Skills",
            source="plugin",
        )
        db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@app.delete("/api/user-skills")
def delete_user_skill(
    skill_name: str = Query(..., min_length=1, max_length=255),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    raw_name = skill_name.strip()
    if not raw_name:
        raise HTTPException(status_code=422, detail="skill_name cannot be blank")
    _, canonical_name = _skill_identity(db, raw_name)
    skill = db.scalar(
        select(UserSkill).where(
            UserSkill.user_id == current_user.id,
            UserSkill.source == "plugin",
            func.lower(UserSkill.canonical_name) == canonical_name,
        )
    )
    if not skill:
        raise HTTPException(status_code=404, detail="Profile skill not found")
    deleted = {
        "id": str(skill.id),
        "skill_name": skill.skill_name,
        "canonical_name": skill.canonical_name,
    }
    db.delete(skill)
    db.commit()
    return {"success": True, "skill": deleted}
