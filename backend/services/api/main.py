import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
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

from services.api.routers.applications import router as applications_router
from services.api.routers.autofill import router as autofill_router
from services.api.routers.career_profiles import router as career_profiles_router
from services.api.routers.interview import router as interview_router
from services.api.routers.job_hunting_profiles import router as job_hunting_profiles_router
from services.api.routers.job_review import router as job_review_router
from services.api.routers.prospects import router as prospects_router
from services.api.routers.recommendations import router as recommendations_router
from services.api.routers.resumes import router as resumes_router
from services.api.routers.skills import router as skills_router
from services.api.routers.users import router as users_router
from services.shared.database import get_db
from services.shared.realtime import broadcaster
from services.shared.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

tags_metadata = [
    {"name": "interview", "description": "Interview Preparation, Question Bank, Practice Records & AI Evaluation APIs"},
    {"name": "user", "description": "User Profile, Settings, & Authentication APIs"},
    {"name": "applications", "description": "Submitted job application tracking APIs"},
    {"name": "prospects", "description": "AI Prospect Discovery & Recruiter Outreach APIs"},
    {"name": "recommendations", "description": "AI job recommendation inbox APIs"},
]


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
