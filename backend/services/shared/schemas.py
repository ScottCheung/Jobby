from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRead(OrmModel):
    id: UUID
    email: str
    display_name: str
    role: str
    status: str
    can_use_auto_apply: bool
    created_at: datetime
    updated_at: datetime


class UserProfileBase(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    current_city: str | None = None
    street: str | None = None
    state: str | None = None
    zipcode: str | None = None
    country: str | None = None
    ethnicity: str | None = None
    gender: str | None = None
    gender_identity: str | None = None
    disability_status: str | None = None
    veteran_status: str | None = None
    extra_data: dict = Field(default_factory=dict)


class UserProfileRead(UserProfileBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class JobPreferenceBase(BaseModel):
    years_of_experience: str | None = None
    require_visa: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    resume_path: str | None = None
    us_citizenship: str | None = None
    desired_salary: Decimal | None = None
    current_ctc: Decimal | None = None
    notice_period: int | None = None
    linkedin_headline: str | None = None
    linkedin_summary: str | None = None
    cover_letter: str | None = None
    user_information_all: str | None = None
    recent_employer: str | None = None
    confidence_level: str | None = None
    extra_data: dict = Field(default_factory=dict)


class JobPreferenceRead(JobPreferenceBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class SearchProfileBase(BaseModel):
    name: str = "Default LinkedIn Search"
    platform: str = "linkedin"
    platform_account_id: UUID | None = None
    search_terms: list = Field(default_factory=list)
    search_location: str | None = None
    filters: dict = Field(default_factory=dict)
    blacklist_rules: dict = Field(default_factory=dict)
    whitelist_rules: dict = Field(default_factory=dict)
    is_default: bool = True


class SearchProfileRead(SearchProfileBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class RuntimeSettingsBase(BaseModel):
    platform_account_id: UUID | None = None
    run_in_background: bool = False
    safe_mode: bool = True
    stealth_mode: bool = True
    click_gap: int = 2
    pause_before_submit: bool = True
    pause_at_failed_question: bool = True
    overwrite_previous_answers: bool = False
    learn_from_manual_answers: bool = True
    question_similarity_threshold: Decimal = Decimal("0.85")
    settings: dict = Field(default_factory=dict)


class RuntimeSettingsRead(RuntimeSettingsBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class QuestionCacheEntryBase(BaseModel):
    platform_account_id: UUID | None = None
    platform: str = "linkedin"
    original_label: str
    normalized_label: str
    field_type: str
    options: list | None = None
    answer: str | None = None
    source: str | None = None
    times_used: int = 0
    last_used_at: datetime | None = None
    companies: list = Field(default_factory=list)


class QuestionCacheEntryRead(QuestionCacheEntryBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class JobApplicationBase(BaseModel):
    platform_account_id: UUID | None = None
    platform: str = "linkedin"
    job_id: str | None = None
    title: str | None = None
    company: str | None = None
    work_location: str | None = None
    work_style: str | None = None
    job_description: str | None = None
    job_link: str | None = None
    external_job_link: str | None = None
    status: str = "submitted"
    pipeline_stage: str = "applied"
    interview_stage: str | None = None
    next_action: str | None = None
    next_action_at: datetime | None = None
    notes: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    last_contacted_at: datetime | None = None
    deleted_at: datetime | None = None
    application_type: str | None = None
    resume_path: str | None = None
    date_posted: str | None = None
    date_applied: datetime | None = None
    questions: Any = Field(default_factory=list)
    skip_reason: str | None = None
    screenshot_path: str | None = None
    raw_data: dict = Field(default_factory=dict)


class JobApplicationRead(JobApplicationBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class JobApplicationUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
    company: str | None = None
    work_location: str | None = None
    work_style: str | None = None
    job_description: str | None = None
    skip_reason: str | None = None
    pipeline_stage: str | None = None
    interview_stage: str | None = None
    next_action: str | None = None
    next_action_at: datetime | None = None
    notes: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    last_contacted_at: datetime | None = None
    deleted_at: datetime | None = None


class AutomationRunBase(BaseModel):
    platform_account_id: UUID | None = None
    search_profile_id: UUID | None = None
    status: str = "pending"
    started_at: datetime | None = None
    finished_at: datetime | None = None
    current_message: str | None = None
    summary: dict = Field(default_factory=dict)
    error_message: str | None = None


class AutomationRunRead(AutomationRunBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class SkillBase(BaseModel):
    name: str
    canonical_name: str
    is_alias: bool = False


class SkillRead(SkillBase, OrmModel):
    id: int
    created_at: datetime
    updated_at: datetime


