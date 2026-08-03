from __future__ import annotations
from pydantic import BaseModel, Field

class PlatformCapabilities(BaseModel):
    supports_resume_upload: bool = True
    supports_human_review: bool = True
    supports_submission: bool = True

class PlatformCapabilityError(RuntimeError):
    pass

class ApplicationPreparation(BaseModel):
    review_reason: str | None = None
