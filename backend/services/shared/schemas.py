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


class UserGamificationBase(BaseModel):
    xp: int = 0
    coins: int = 0
    level: int = 1
    streak_days: int = 0
    last_practice_date: datetime | None = None

class UserGamificationRead(UserGamificationBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class GamificationTransactionBase(BaseModel):
    amount: int
    currency: str
    reason: str
    reference_id: str | None = None

class GamificationTransactionRead(GamificationTransactionBase, OrmModel):
    id: UUID
    user_id: UUID
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


class JobHuntingProfileBase(BaseModel):
    name: str = "Default LinkedIn Search"
    platform: str = "linkedin"
    platform_account_id: UUID | None = None
    search_terms: list = Field(default_factory=list)
    search_location: str | None = None
    filters: dict = Field(default_factory=dict)
    blacklist_rules: dict = Field(default_factory=dict)
    whitelist_rules: dict = Field(default_factory=dict)
    years_of_experience: str | None = None
    require_visa: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    resume_path: str | None = None
    citizenship: str | None = None
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
    is_default: bool = True


class JobHuntingProfileRead(JobHuntingProfileBase, OrmModel):
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
    status_updated_at: datetime | None = None
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
    platform: str | None = None
    job_id: str | None = None
    status: str | None = None
    title: str | None = None
    company: str | None = None
    work_location: str | None = None
    work_style: str | None = None
    job_description: str | None = None
    job_link: str | None = None
    external_job_link: str | None = None
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
    application_type: str | None = None
    resume_path: str | None = None
    date_posted: str | None = None
    date_applied: datetime | None = None
    status_updated_at: datetime | None = None
    questions: Any | None = None
    screenshot_path: str | None = None
    raw_data: dict | None = None


class SkillBase(BaseModel):
    name: str
    canonical_name: str
    is_alias: bool = False


class SkillRead(SkillBase, OrmModel):
    id: int
    created_at: datetime
    updated_at: datetime


class InterviewCategoryBase(BaseModel):
    name: str

class InterviewCategoryRead(InterviewCategoryBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class InterviewTagBase(BaseModel):
    name: str

class InterviewTagRead(InterviewTagBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class InterviewQuestionBase(BaseModel):
    category_id: UUID | None = None
    title: str
    frequency: str | None = None
    importance_score: int | None = 3
    answer_objective: str | None = None
    answer_framework: str | None = None
    sample_answer: str | None = None
    my_answer: str | None = None
    improvement_notes: str | None = None

class InterviewQuestionCreate(InterviewQuestionBase):
    tags: list[UUID] | None = None

class InterviewQuestionUpdate(BaseModel):
    category_id: UUID | None = None
    title: str | None = None
    frequency: str | None = None
    importance_score: int | None = None
    answer_objective: str | None = None
    answer_framework: str | None = None
    sample_answer: str | None = None
    my_answer: str | None = None
    improvement_notes: str | None = None
    tags: list[UUID] | None = None

class InterviewQuestionRead(InterviewQuestionBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    category: InterviewCategoryRead | None = None
    tags: list[InterviewTagRead] = Field(default_factory=list)


class AudioRecordBase(BaseModel):
    practice_record_id: UUID
    url_path: str
    duration: int | None = None

class AudioRecordRead(AudioRecordBase, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PracticeRecordBase(BaseModel):
    question_id: UUID
    my_answer: str | None = None
    confidence_score: int | None = None
    notes: str | None = None

class PracticeRecordCreate(PracticeRecordBase):
    pass

class GamificationUpdateSchema(BaseModel):
    xp_gained: int
    coins_gained: int
    new_streak: int
    new_level: int
    is_streak_extended: bool

class DailySummarySchema(BaseModel):
    completed_questions: int
    new_questions: int
    review_questions: int
    total_speaking_time_seconds: int
    best_answer_title: str | None
    current_streak: int
    xp_gained_today: int
    coins_gained_today: int
    level: int
    total_xp: int = 0
    next_level_xp: int = 0
    loot_boxes: int = 0
    has_checked_in_today: bool = False
    total_coins: int = 0

class HeatmapDataEntry(BaseModel):
    date: str
    count: int

class HeatmapDataSchema(BaseModel):
    entries: list[HeatmapDataEntry]

class PracticeRecordRead(PracticeRecordBase, OrmModel):
    id: UUID
    user_id: UUID
    date: datetime
    created_at: datetime
    updated_at: datetime
    audio_records: list[AudioRecordRead] = []
    gamification_update: GamificationUpdateSchema | None = None


class PracticePlanBase(BaseModel):
    name: str
    target_days: int = 30
    daily_questions_count: int = 5

class PracticePlanRead(PracticePlanBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class PlanTaskBase(BaseModel):
    plan_id: UUID
    question_id: UUID
    scheduled_date: datetime
    status: str = "pending"


class PlanTaskUpdate(BaseModel):
    scheduled_date: datetime | None = None
    status: str | None = None


class PlanTaskRead(PlanTaskBase, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class DailyQuestRead(BaseModel):
    id: UUID
    quest_date: datetime
    quest_type: str
    title: str
    description: str
    target_value: int
    current_value: int
    is_claimed: bool

    class Config:
        from_attributes = True

class AchievementRead(BaseModel):
    id: UUID
    badge_id: str
    badge_name: str
    description: str
    unlocked_at: datetime

    class Config:
        from_attributes = True
