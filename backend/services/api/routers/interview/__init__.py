from fastapi import APIRouter

from .collections import router as collections_router
from .community import router as community_router
from .gamification import (
    application_gamification_snapshot,
    apply_application_gamification_events,
    router as gamification_router,
)
from .practice import router as practice_router
from .questions import router as questions_router

router = APIRouter(prefix="/api/interview", tags=["Interview Practice"])

router.include_router(questions_router)
router.include_router(practice_router)
router.include_router(collections_router)
router.include_router(gamification_router)
router.include_router(community_router)

__all__ = [
    "router",
    "application_gamification_snapshot",
    "apply_application_gamification_events",
]
