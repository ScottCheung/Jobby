import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

try:
    import orjson
    from fastapi.responses import ORJSONResponse
    DefaultResponseClass = ORJSONResponse
except ImportError:
    DefaultResponseClass = JSONResponse

from services.api.routers.applications import (
    _job_snapshot_from_application_values,
    _run_tailored_resume_generation,
    _update_application_job,
    apply_application_plan_action,
    create_application,
    create_application_form_instructions,
    create_application_plan_endpoint,
    create_tailored_resume_for_application,
    find_existing_application,
    generate_application_plan_tailored_resume,
    generate_application_tailored_resume,
    job_application_response,
    normalize_application_status,
    normalize_job_id,
    process_tailored_resume,
    read_application_plan,
    router as applications_router,
    start_tailored_resume_generation,
)
from services.api.routers.autofill import (
    _autofill_answer_category,
    _autofill_intent_key,
    _autofill_intent_key_for_field,
    _build_form_autofill_instructions,
    _canonical_autofill_intent_key,
    _coerce_form_value,
    _compatible_form_field_types,
    _form_scene,
    _inverse_sponsorship_answer,
    _is_phone_country_field,
    _is_single_consent_checkbox,
    _phone_country_code,
    _phone_country_value,
    router as autofill_router,
)
from services.api.routers.career_profiles import router as career_profiles_router
from services.api.routers.helpers import apply_updates, refund_resume_coins
from services.api.routers.interview import router as interview_router
from services.api.routers.job_hunting_profiles import router as job_hunting_profiles_router
import services.api.routers.job_review as job_review_module
from services.api.routers.job_review import router as job_review_router
from services.api.routers.prospects import router as prospects_router
from services.api.routers.recommendations import router as recommendations_router
from services.api.routers.resumes import (
    _default_career_profile,
    canonical_resume_storage_key,
    delete_master_resume,
    delete_master_resume_version,
    delete_tailored_resume,
    master_resume_response,
    process_master_resume,
    resume_upload_id,
    router as resumes_router,
    tailored_resume_response,
    update_tailored_resume,
)
from services.api.routers.skills import (
    add_user_skill,
    delete_user_skill,
    router as skills_router,
)
from services.api.routers.users import router as users_router
from services.shared.database import SessionLocal, get_db
from services.shared.job_review import review_job
from services.shared.models import JobApplication, MasterResume, TailoredResume
from services.shared.realtime import broadcast_sync, broadcaster
from services.shared.resume_evaluator import RUBRIC_VERSION, resume_content_hash
from services.shared.resume_parser import extract_pdf_text
from services.shared.settings import get_settings
from services.shared.storage import get_object_storage
from services.shared.time_utils import utc_now

settings = get_settings()
logger = logging.getLogger(__name__)

tags_metadata = [
    {"name": "interview", "description": "Interview Preparation, Question Bank, Practice Records & AI Evaluation APIs"},
    {"name": "user", "description": "User Profile, Settings, & Authentication APIs"},
    {"name": "applications", "description": "Submitted job application tracking APIs"},
    {"name": "prospects", "description": "AI Prospect Discovery & Recruiter Outreach APIs"},
    {"name": "recommendations", "description": "AI job recommendation inbox APIs"},
]


def review_job_from_jd(*args, **kwargs):
    """Compatibility delegation to job_review router with patch synchronization."""
    patches = {}
    for attr in ("_default_career_profile", "review_job", "tailored_resume_response", "broadcast_sync"):
        val = globals().get(attr)
        if val is not getattr(job_review_module, attr, None):
            patches[attr] = getattr(job_review_module, attr, None)
            setattr(job_review_module, attr, val)
    try:
        return job_review_module.review_job_from_jd(*args, **kwargs)
    finally:
        for attr, orig in patches.items():
            if orig is not None:
                setattr(job_review_module, attr, orig)


@asynccontextmanager
async def lifespan(app: FastAPI):
    broadcaster.loop = asyncio.get_running_loop()
    yield


app = FastAPI(
    title="Jobby Career Assistant API",
    description="Job recognition, form autofill, submitted application tracking, and interview preparation APIs.",
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

audio_dir = "/app/storage/audio"
if not os.path.exists("/app") or not os.access("/", os.W_OK):
    audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "audio"))
os.makedirs(audio_dir, exist_ok=True)
app.mount("/api/interview/audio", StaticFiles(directory=audio_dir), name="audio")

app.include_router(interview_router)
app.include_router(prospects_router)
app.include_router(recommendations_router)
app.include_router(users_router)
app.include_router(career_profiles_router)
app.include_router(resumes_router)
app.include_router(job_review_router)
app.include_router(job_hunting_profiles_router)
app.include_router(skills_router)
app.include_router(autofill_router)
app.include_router(applications_router)


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
