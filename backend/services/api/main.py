from datetime import datetime
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.api.local_worker import get_current_run_id, is_worker_running, start_local_worker, stop_local_worker, sync_current_worker_state
from services.shared.database import get_db
from services.shared.job_link_repair import JobLinkRepairError, is_linkedin_public_summary, repair_from_link
from services.shared.models import (
    AutomationRun,
    JobApplication,
    JobPreference,
    QuestionCacheEntry,
    RuntimeSettings,
    SearchProfile,
    User,
    UserProfile,
)
from services.shared.schemas import (
    AutomationRunBase,
    AutomationRunRead,
    JobApplicationBase,
    JobApplicationRead,
    JobApplicationUpdate,
    JobPreferenceBase,
    JobPreferenceRead,
    QuestionCacheEntryBase,
    QuestionCacheEntryRead,
    RuntimeSettingsBase,
    RuntimeSettingsRead,
    SearchProfileBase,
    SearchProfileRead,
    UserProfileBase,
    UserProfileRead,
    UserRead,
)
from services.shared.settings import get_settings


settings = get_settings()
app = FastAPI(title="Auto Job Applier API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def apply_updates(model: object, values: dict) -> None:
    for key, value in values.items():
        setattr(model, key, value)


def normalize_application_status(value: str | None) -> str:
    status_value = str(value or "").strip().lower()
    if status_value in {"applied", "apply", "success", "succeeded", "submitted"}:
        return "submitted"
    if status_value in {"cancelled", "canceled", "stopped"}:
        return "cancelled"
    if status_value in {"failed", "fail", "error", "skipped", "skiped", "skip"}:
        return "skipped"
    return status_value or "submitted"


def async_application_from_link_record(application: JobApplication) -> tuple[dict, str | None]:
    link = application.job_link or application.external_job_link
    original_location = application.work_location
    if not link:
        warning = "This application does not have a job link to async from"
        application.raw_data = {
            **(application.raw_data or {}),
            "link_async_warning": warning,
            "link_async_attempted_at": datetime.now().isoformat(),
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
            "link_async_attempted_at": datetime.now().isoformat(),
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
            "link_async_attempted_at": datetime.now().isoformat(),
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
            "attempted_at": datetime.now().isoformat(),
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


@app.get("/api/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_or_create_current_user)) -> User:
    return current_user


@app.get("/api/profile", response_model=UserProfileRead)
def read_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> UserProfile:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if profile:
        return profile

    profile = UserProfile(user_id=current_user.id, extra_data={})
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@app.put("/api/profile", response_model=UserProfileRead)
def update_profile(
    payload: UserProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> UserProfile:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    apply_updates(profile, payload.model_dump())
    db.commit()
    db.refresh(profile)
    return profile


@app.get("/api/job-preferences", response_model=JobPreferenceRead)
def read_job_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobPreference:
    preferences = db.scalar(select(JobPreference).where(JobPreference.user_id == current_user.id))
    if preferences:
        return preferences

    preferences = JobPreference(user_id=current_user.id, extra_data={})
    db.add(preferences)
    db.commit()
    db.refresh(preferences)
    return preferences


@app.put("/api/job-preferences", response_model=JobPreferenceRead)
def update_job_preferences(
    payload: JobPreferenceBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobPreference:
    preferences = db.scalar(select(JobPreference).where(JobPreference.user_id == current_user.id))
    if not preferences:
        preferences = JobPreference(user_id=current_user.id)
        db.add(preferences)

    apply_updates(preferences, payload.model_dump())
    db.commit()
    db.refresh(preferences)
    return preferences


@app.get("/api/search-profile", response_model=SearchProfileRead)
def read_default_search_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> SearchProfile:
    search_profile = db.scalar(
        select(SearchProfile)
        .where(SearchProfile.user_id == current_user.id, SearchProfile.is_default.is_(True))
        .order_by(SearchProfile.created_at.asc())
        .limit(1)
    )
    if search_profile:
        return search_profile

    search_profile = SearchProfile(
        user_id=current_user.id,
        name="Default LinkedIn Search",
        platform="linkedin",
        search_terms=[],
        filters={},
        blacklist_rules={},
        whitelist_rules={},
        is_default=True,
    )
    db.add(search_profile)
    db.commit()
    db.refresh(search_profile)
    return search_profile


@app.put("/api/search-profile", response_model=SearchProfileRead)
def update_default_search_profile(
    payload: SearchProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> SearchProfile:
    search_profile = db.scalar(
        select(SearchProfile)
        .where(SearchProfile.user_id == current_user.id, SearchProfile.is_default.is_(True))
        .order_by(SearchProfile.created_at.asc())
        .limit(1)
    )
    if not search_profile:
        search_profile = SearchProfile(user_id=current_user.id)
        db.add(search_profile)

    apply_updates(search_profile, payload.model_dump())
    db.commit()
    db.refresh(search_profile)
    return search_profile


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
    preferences = db.scalar(select(JobPreference).where(JobPreference.user_id == current_user.id))
    search_profile = db.scalar(
        select(SearchProfile)
        .where(SearchProfile.user_id == current_user.id, SearchProfile.is_default.is_(True))
        .order_by(SearchProfile.created_at.asc())
        .limit(1)
    )
    runtime_settings = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == current_user.id))

    return {
        "user": UserRead.model_validate(current_user).model_dump(mode="json"),
        "profile": UserProfileRead.model_validate(profile).model_dump(mode="json") if profile else None,
        "job_preferences": JobPreferenceRead.model_validate(preferences).model_dump(mode="json") if preferences else None,
        "search_profile": SearchProfileRead.model_validate(search_profile).model_dump(mode="json") if search_profile else None,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[QuestionCacheEntry]:
    return list(
        db.scalars(
            select(QuestionCacheEntry)
            .where(QuestionCacheEntry.user_id == current_user.id)
            .order_by(QuestionCacheEntry.last_used_at.desc().nullslast(), QuestionCacheEntry.created_at.desc())
        )
    )


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


@app.get("/api/applications", response_model=list[JobApplicationRead])
def list_applications(
    status_filter: str | None = Query(default=None, alias="status"),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[JobApplication]:
    query = select(JobApplication).where(JobApplication.user_id == current_user.id)
    if not include_deleted:
        query = query.where(JobApplication.deleted_at.is_(None))
    if status_filter:
        query = query.where(JobApplication.status == normalize_application_status(status_filter))
    return list(db.scalars(query.order_by(JobApplication.date_applied.desc().nullslast(), JobApplication.created_at.desc())))


@app.post("/api/applications", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: JobApplicationBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> JobApplication:
    values = payload.model_dump()
    values["status"] = normalize_application_status(values.get("status"))
    values["work_style"] = None
    application = JobApplication(user_id=current_user.id, **values)
    if application.job_link or application.external_job_link:
        async_application_from_link_record(application)
    db.add(application)
    db.commit()
    db.refresh(application)
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
    if "status" in values:
        values["status"] = normalize_application_status(values.get("status"))
    apply_updates(application, values)
    db.commit()
    db.refresh(application)
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
        query = query.where(JobApplication.status == normalize_application_status(status_filter))
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
    for application in rows:
        updates, error = async_application_from_link_record(application)
        if error:
            failed_count += 1
            results.append({"id": str(application.id), "status": "failed", "error": error})
        else:
            repaired_count += 1
            results.append({"id": str(application.id), "status": "synced", "fields": sorted(updates.keys())})

    db.commit()
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

    application.deleted_at = datetime.now()
    db.commit()


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


@app.get("/api/automation-runs/latest", response_model=AutomationRunRead | None)
def read_latest_automation_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> AutomationRun | None:
    sync_current_worker_state(db)
    return db.scalar(
        select(AutomationRun)
        .where(AutomationRun.user_id == current_user.id)
        .order_by(AutomationRun.created_at.desc())
        .limit(1)
    )


@app.post("/api/automation-runs", response_model=AutomationRunRead, status_code=status.HTTP_201_CREATED)
def create_automation_run(
    payload: AutomationRunBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> AutomationRun:
    if not current_user.can_use_auto_apply:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auto apply is not enabled for this user")

    run = AutomationRun(user_id=current_user.id, **payload.model_dump())
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@app.post("/api/automation-runs/start-local-worker", response_model=AutomationRunRead)
def start_local_worker_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> AutomationRun:
    if not current_user.can_use_auto_apply:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auto apply is not enabled for this user")
    pending_or_running = db.scalar(
        select(AutomationRun)
        .where(AutomationRun.user_id == current_user.id, AutomationRun.status.in_(["pending", "running", "cancel_requested"]))
        .order_by(AutomationRun.created_at.desc())
        .limit(1)
    )
    if pending_or_running:
        return pending_or_running
    if is_worker_running():
        current_run_id = get_current_run_id()
        if current_run_id:
            run = db.get(AutomationRun, current_run_id)
            if run:
                return run
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Local worker is already running")

    if settings.enable_api_local_worker:
        try:
            return start_local_worker(db, current_user)
        except RuntimeError as error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    run = AutomationRun(
        user_id=current_user.id,
        status="pending",
        current_message="Waiting for the host worker agent to start worker/runAiBot.py",
        summary={"requested_by": "user_console", "runner": "host_worker_agent"},
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@app.post("/api/automation-runs/stop-local-worker", response_model=AutomationRunRead)
def stop_local_worker_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> AutomationRun:
    run = db.scalar(
        select(AutomationRun)
        .where(AutomationRun.user_id == current_user.id, AutomationRun.status.in_(["pending", "running", "cancel_requested"]))
        .order_by(AutomationRun.created_at.desc())
        .limit(1)
    )
    if not run:
        latest_run = db.scalar(
            select(AutomationRun)
            .where(AutomationRun.user_id == current_user.id)
            .order_by(AutomationRun.created_at.desc())
            .limit(1)
        )
        if latest_run:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Latest automation run is already {latest_run.status}",
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No automation run has been started yet")

    try:
        return stop_local_worker(db)
    except RuntimeError as error:
        if run.status == "pending":
            run.status = "cancelled"
            run.finished_at = run.finished_at or datetime.now()
            run.current_message = "Cancelled before the host worker agent started"
        else:
            run.status = "cancel_requested"
            run.current_message = "Stop requested; waiting for the host worker agent to terminate Python"
        run.error_message = str(error)
        db.commit()
        db.refresh(run)
        return run


@app.get("/api/automation-runs/{run_id}", response_model=AutomationRunRead)
def read_automation_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> AutomationRun:
    run = db.get(AutomationRun, run_id)
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation run not found")
    return run


@app.put("/api/automation-runs/{run_id}", response_model=AutomationRunRead)
def update_automation_run(
    run_id: UUID,
    payload: AutomationRunBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> AutomationRun:
    run = db.get(AutomationRun, run_id)
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation run not found")

    apply_updates(run, payload.model_dump())
    db.commit()
    db.refresh(run)
    return run
