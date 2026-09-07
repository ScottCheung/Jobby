import logging
from datetime import datetime, timedelta
from typing import Any, NoReturn
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import Date, cast, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from services.api.dependencies import get_or_create_current_user
from services.api.routers.helpers import apply_updates
from services.api.routers.interview import (
    application_gamification_snapshot,
    apply_application_gamification_events,
)
from services.api.routers.job_hunting_profiles import (
    _legacy_policy_values,
    _legacy_runtime_values,
)
from services.api.routers.resumes import tailored_resume_response
from services.domain.errors import ApplicationStatusNotRecordable, CareerProfileNotReady
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


from services.domain.application_lifecycle import (
    APPLICATION_JOB_FIELDS,
    NON_RECORDED_APPLICATION_STATUSES,
    UNKNOWN_LOCATION_VALUES,
    _application_values_only,
    _has_link_repaired_work_location,
    _has_meaningful_location,
    _is_worker_application_payload,
    _job_snapshot_from_application_values,
    _normalized_text,
    _update_application_job,
    async_application_from_link_record,
    default_pipeline_stage_for_status,
    ensure_application_date_applied,
    ensure_pipeline_stage,
    ensure_recordable_application_status,
    ensure_status_updated_at,
    find_existing_application,
    infer_latest_timeline_stage,
    infer_latest_timeline_timestamp,
    normalize_application_status,
    normalize_job_id,
    preserve_link_repaired_location,
    sync_application_status_from_timeline,
    sync_worker_application_from_link,
)
from services.domain.tailored_resumes import (
    _get_user_active_resume_data,
    create_tailored_resume_for_application,
    process_tailored_resume,
    start_tailored_resume_generation,
)



def job_application_response(application: JobApplication, tailored_resume_id: UUID | None = None) -> dict:
    data = JobApplicationRead.model_validate(application).model_dump(mode="json")
    data["has_tailored_resume"] = tailored_resume_id is not None
    data["tailored_resume_id"] = str(tailored_resume_id) if tailored_resume_id else None
    return data

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
    try:
        ensure_recordable_application_status(values["status"])
    except ApplicationStatusNotRecordable as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
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
        try:
            ensure_recordable_application_status(values["status"])
        except ApplicationStatusNotRecordable as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
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
    return tailored_resume_response(tailored, db)


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
    try:
        tailored, should_generate = start_tailored_resume_generation(db, current_user, application)
    except CareerProfileNotReady as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if should_generate:
        background_tasks.add_task(process_tailored_resume, tailored.id)
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
