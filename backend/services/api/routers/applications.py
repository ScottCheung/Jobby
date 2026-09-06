import logging
from datetime import datetime, timedelta
from typing import Any, NoReturn
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import Date, cast, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from services.api.dependencies import get_or_create_current_user
from services.api.routers.helpers import apply_updates, get_main_override
from services.api.routers.interview import (
    application_gamification_snapshot,
    apply_application_gamification_events,
)
from services.api.routers.job_hunting_profiles import (
    _legacy_policy_values,
    _legacy_runtime_values,
)
from services.api.routers.resumes import _default_career_profile
from services.api.routers.skills import _get_user_profile_skills
from services.shared.application_decisions import evaluate_candidate, evaluation_to_dict
from services.shared.application_settings import (
    application_settings_from_storage,
    application_settings_to_storage,
)
from services.shared.database import SessionLocal, get_db
from services.shared.job_link_repair import (
    JobLinkRepairError,
    is_linkedin_public_summary,
    repair_from_link,
)
from services.shared.job_review import review_job
from services.shared.jobs import apply_job_updates, upsert_job
from services.shared.models import (
    JobApplication,
    JobHuntingProfile,
    MasterResume,
    RuntimeSettings,
    TailoredResume,
    User,
    UserSkill,
)
from services.shared.realtime import broadcast_sync
from services.shared.schemas import (
    ApplicationDecisionRequest,
    ApplicationFormInstructionsRequest,
    ApplicationFormInstructionsResponse,
    ApplicationPlanActionRequest,
    ApplicationPlanCreateRequest,
    JobApplicationBase,
    JobApplicationRead,
    JobApplicationUpdate,
    TailoredResumeRead,
)
from services.shared.time_utils import parse_datetime_to_utc, utc_isoformat, utc_now

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["applications"])


APPLICATION_JOB_FIELDS = {
    "platform",
    "job_id",
    "title",
    "company",
    "work_location",
    "job_description",
    "job_link",
    "first_posted_at",
    "last_posted_at",
    "posting_observed_at",
    "is_reposted",
    "posting_date_raw",
}


def _job_snapshot_from_application_values(values: dict[str, Any]) -> dict[str, Any]:
    return {
        "platform": values.get("platform") or "generic",
        "external_id": values.get("job_id"),
        "url": values.get("job_link"),
        "title": values.get("title"),
        "company": values.get("company"),
        "location": values.get("work_location"),
        "description": values.get("job_description"),
        "technologies": values.get("technologies") or [],
        "first_posted_at": values.get("first_posted_at"),
        "last_posted_at": values.get("last_posted_at"),
        "posting_observed_at": values.get("posting_observed_at"),
        "is_reposted": values.get("is_reposted"),
        "posting_date_raw": values.get("posting_date_raw") or {},
    }


def _application_values_only(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if key not in APPLICATION_JOB_FIELDS}


def _update_application_job(
    db: Session,
    application: JobApplication,
    values: dict[str, Any],
    *,
    user_id: UUID,
    source: str,
    allow_clear: bool,
) -> None:
    field_map = {
        "title": "title",
        "company": "company",
        "work_location": "location",
        "job_description": "description",
    }
    updates = {
        target: values[source_field]
        for source_field, target in field_map.items()
        if source_field in values and (allow_clear or values[source_field] not in (None, ""))
    }
    if updates:
        apply_job_updates(
            db,
            job=application.job,
            updates=updates,
            user_id=user_id,
            job_application=application,
            source=source,
        )

    identity_changed = False
    incoming_external_id = normalize_job_id(values.get("job_id")) if "job_id" in values else None
    if incoming_external_id and not application.job.external_id:
        application.job.external_id = incoming_external_id
        identity_changed = True
    incoming_platform = str(values.get("platform") or "").strip().casefold()
    if incoming_platform and application.job.platform == "generic":
        application.job.platform = incoming_platform
        identity_changed = True
    for source_field, target in (("job_link", "url"),):
        if source_field not in values:
            continue
        incoming = values[source_field]
        if incoming in (None, "") and not allow_clear:
            continue
        if getattr(application.job, target) != incoming:
            setattr(application.job, target, incoming)
            identity_changed = True
    first_posted_at = values.get("first_posted_at")
    if first_posted_at and (
        application.job.first_posted_at is None
        or first_posted_at < application.job.first_posted_at
    ):
        application.job.first_posted_at = first_posted_at
        identity_changed = True
    for field in ("last_posted_at", "posting_observed_at"):
        incoming = values.get(field)
        current = getattr(application.job, field)
        if incoming and (current is None or incoming > current):
            setattr(application.job, field, incoming)
            identity_changed = True
    if values.get("is_reposted") and not application.job.is_reposted:
        application.job.is_reposted = True
        identity_changed = True
    if values.get("posting_date_raw"):
        application.job.raw_extracted_snapshot = {
            **(application.job.raw_extracted_snapshot or {}),
            "posting_date_raw": values["posting_date_raw"],
        }
    if identity_changed:
        application.job.revision = int(application.job.revision or 1) + 1


def normalize_job_id(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None


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


NON_RECORDED_APPLICATION_STATUSES = (
    "draft",
    "processing",
    "interrupted",
    "skipped",
    "cancelled",
)


def ensure_recordable_application_status(status_value: str) -> None:
    if status_value in NON_RECORDED_APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only submitted applications can be recorded.",
        )


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

    query = select(JobApplication).options(selectinload(JobApplication.job)).where(
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
        query = query.where(JobApplication.external_job_id == job_id)
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

    repaired_job_fields = {
        "job_id": "external_id",
        "title": "title",
        "company": "company",
        "work_location": "location",
        "job_description": "description",
    }
    changed_job = False
    for source_field, target_field in repaired_job_fields.items():
        if source_field not in updates:
            continue
        value = updates[source_field]
        if getattr(application.job, target_field) != value:
            setattr(application.job, target_field, value)
            changed_job = True
    if changed_job:
        application.job.revision = int(application.job.revision or 1) + 1
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
        "date_posted": application.last_posted_at,
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

    career_profile = get_main_override("_default_career_profile", _default_career_profile)(db, current_user)
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
    session_factory = get_main_override("SessionLocal", SessionLocal)
    db = session_factory()
    try:
        tailored_resume = db.get(TailoredResume, tailored_resume_id)
        if not tailored_resume or tailored_resume.status != "processing":
            return
        application = db.get(JobApplication, tailored_resume.job_application_id)
        if not application:
            raise RuntimeError("Application not found")

        generator = get_main_override("_run_tailored_resume_generation", _run_tailored_resume_generation)
        result = generator(tailored_resume, application, mock=mock)
        db.refresh(tailored_resume)
        if tailored_resume.status != "processing":
            return
        _apply_tailored_resume_result(tailored_resume, result)
        db.commit()
        db.refresh(tailored_resume)
        broadcaster = get_main_override("broadcast_sync", broadcast_sync)
        broadcaster(
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
            broadcaster = get_main_override("broadcast_sync", broadcast_sync)
            broadcaster(
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

@router.post("/application-decisions")
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
            JobApplication.external_job_id == candidate_payload["external_id"],
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


def _automatic_application_disabled() -> NoReturn:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Automatic application plans are disabled. Use autofill, then record the application after submission.",
    )


@router.post("/application-plans", status_code=status.HTTP_201_CREATED)
def create_application_plan_endpoint(
    payload: ApplicationPlanCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    _automatic_application_disabled()


@router.get("/application-plans/{application_id}")
def read_application_plan(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    _automatic_application_disabled()

@router.post(
    "/application-plans/{application_id}/form-instructions",
    response_model=ApplicationFormInstructionsResponse,
    response_model_exclude_none=True,
)
def create_application_form_instructions(
    application_id: UUID,
    payload: ApplicationFormInstructionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    _automatic_application_disabled()


@router.post("/application-plans/{application_id}/tailored-resume", response_model=TailoredResumeRead)
def generate_application_plan_tailored_resume(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> TailoredResume:
    _automatic_application_disabled()


@router.post("/application-plans/{application_id}/actions")
def apply_application_plan_action(
    application_id: UUID,
    payload: ApplicationPlanActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    _automatic_application_disabled()

@router.get("/applications/stats")
def get_applications_stats(
    timezone: str = Query("UTC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    # Application history contains only jobs that were actually submitted.
    total_stmt = select(func.count(JobApplication.id)).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None),
        ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
    )
    total_applications = db.scalar(total_stmt) or 0
    total_submitted = total_applications

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
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == today_expr
        )
        today_submitted = db.scalar(today_submitted_stmt) or 0

        # yesterday submitted
        yesterday_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == yesterday_expr
        )
        yesterday_submitted = db.scalar(yesterday_submitted_stmt) or 0

        # today processed
        today_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == today_expr
        )
        today_processed = db.scalar(today_processed_stmt) or 0

        # yesterday processed
        yesterday_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
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
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == today_expr
        )
        today_submitted = db.scalar(today_submitted_stmt) or 0

        # yesterday submitted
        yesterday_submitted_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == yesterday_expr
        )
        yesterday_submitted = db.scalar(yesterday_submitted_stmt) or 0

        # today processed
        today_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == today_expr
        )
        today_processed = db.scalar(today_processed_stmt) or 0

        # yesterday processed
        yesterday_processed_stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == current_user.id,
            JobApplication.deleted_at.is_(None),
            ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
            local_date_expr == yesterday_expr
        )
        yesterday_processed = db.scalar(yesterday_processed_stmt) or 0

    # 4. Interviewing
    interviewing_stmt = select(func.count(JobApplication.id)).where(
        JobApplication.user_id == current_user.id,
        JobApplication.deleted_at.is_(None),
        ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
        JobApplication.raw_data['pipeline_stage'].as_string() == "interviewing"
    )
    interviewing = db.scalar(interviewing_stmt) or 0

    return {
        "total_applications": total_applications,
        "submitted": total_submitted,
        "today_submitted": today_submitted,
        "yesterday_submitted": yesterday_submitted,
        "today_processed": today_processed,
        "yesterday_processed": yesterday_processed,
        "interviewing": interviewing,
    }


@router.get("/applications", response_model=list[JobApplicationRead])
def list_applications(
    status_filter: str | None = Query(default=None, alias="status"),
    include_deleted: bool = Query(default=False),
    limit: int | None = Query(default=None),
    offset: int | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict]:
    query = select(JobApplication).options(selectinload(JobApplication.job)).where(
        JobApplication.user_id == current_user.id,
        ~JobApplication.status.in_(NON_RECORDED_APPLICATION_STATUSES),
    )
    if not include_deleted:
        query = query.where(JobApplication.deleted_at.is_(None))
    if status_filter:
        norm_status = normalize_application_status(status_filter)
        if norm_status != "submitted":
            query = query.where(JobApplication.status == norm_status)
    if search:
        search_query = f"%{search.strip().lower()}%"
        query = query.where(
            JobApplication.title.ilike(search_query) |
            JobApplication.company.ilike(search_query) |
            JobApplication.external_job_id.ilike(search_query)
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


@router.post("/applications", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: JobApplicationBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    values = payload.model_dump()
    values["job_id"] = normalize_job_id(values.get("job_id"))
    values["status"] = normalize_application_status(values.get("status"))
    sync_application_status_from_timeline(values)
    ensure_recordable_application_status(values["status"])
    ensure_pipeline_stage(values)
    values["work_style"] = None
    ensure_application_date_applied(values)
    ensure_status_updated_at(values)
    existing_application = find_existing_application(db, current_user, values)
    if existing_application:
        previous_snapshot = application_gamification_snapshot(existing_application)
        preserve_link_repaired_location(values, existing_application)
        ensure_status_updated_at(values, existing_application)
        _update_application_job(
            db,
            existing_application,
            values,
            user_id=current_user.id,
            source="application_api",
            allow_clear=False,
        )
        apply_updates(existing_application, _application_values_only(values))
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

    job_result = upsert_job(
        db,
        extracted_snapshot=_job_snapshot_from_application_values(values),
        user_id=current_user.id,
        source="application_api",
    )
    application = JobApplication(user_id=current_user.id, job=job_result.job)
    apply_updates(application, _application_values_only(values))
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
        _update_application_job(
            db,
            existing_application,
            values,
            user_id=current_user.id,
            source="application_api",
            allow_clear=False,
        )
        apply_updates(existing_application, _application_values_only(values))
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


@router.put("/applications/{application_id}", response_model=JobApplicationRead)
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
    if "status" in values:
        ensure_recordable_application_status(values["status"])
    ensure_pipeline_stage(values, application)
    ensure_application_date_applied(values, application)
    ensure_status_updated_at(values, application)
    preserve_link_repaired_location(values, application)
    previous_snapshot = application_gamification_snapshot(application)
    _update_application_job(
        db,
        application,
        values,
        user_id=current_user.id,
        source="application_api",
        allow_clear=True,
    )
    apply_updates(application, _application_values_only(values))
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


@router.post("/applications/{application_id}/repair-from-link", response_model=JobApplicationRead)
def repair_application_from_link(
    application_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    return async_application_from_link(application_id, db, current_user)


@router.post("/applications/{application_id}/async-from-link", response_model=JobApplicationRead)
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


@router.post("/applications/async-from-link/batch")
def async_applications_from_link_batch(
    limit: int = Query(default=100, ge=1, le=1000),
    status_filter: str | None = Query(default=None, alias="status"),
    only_missing: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    query = (
        select(JobApplication)
        .options(selectinload(JobApplication.job))
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


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/applications/{application_id}", response_model=JobApplicationRead)
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


@router.get("/applications/{application_id}/tailored-resume", response_model=TailoredResumeRead)
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


@router.post(
    "/applications/{application_id}/generate-resume",
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
    starter = get_main_override("start_tailored_resume_generation", start_tailored_resume_generation)
    tailored, should_generate = starter(db, current_user, application)
    if should_generate:
        processor = get_main_override("process_tailored_resume", process_tailored_resume)
        background_tasks.add_task(processor, tailored.id)
    return tailored


@router.put("/applications/{application_id}/tailored-resume", response_model=TailoredResumeRead)
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
    tailored.updated_at = utc_now()
    db.commit()
    db.refresh(tailored)
    return tailored

