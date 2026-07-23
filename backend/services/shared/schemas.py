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
    avatar_url: str | None = None
    community_badge: str | None = None
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
    loot_boxes: int = 0
    last_practice_date: datetime | None = None
    inventory: dict = Field(default_factory=dict)
    active_boosters: dict = Field(default_factory=dict)

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
    preferred_name: str | None = None
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


class CompanyBase(BaseModel):
    name: str
    logo_url: str | None = None

class CompanyRead(CompanyBase, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class InterviewQuestionBase(BaseModel):
    category_id: UUID | None = None
    title: str
    display_number: int | None = None
    difficulty: str | None = None
    estimated_duration_seconds: int | None = 120
    frequency: str | None = None
    importance_score: int | None = None
    author_frequency: str | None = None
    author_importance_score: int | None = None
    ai_metadata: dict | None = None
    answer_objective: str | None = None
    sample_answer: str | None = None
    my_answer: str | None = None
    improvement_notes: str | None = None
    collection_ids: list[UUID] = Field(default_factory=list)
    is_saved: bool = False

class InterviewQuestionCreate(InterviewQuestionBase):
    tags: list[UUID] | None = None

class InterviewQuestionUpdate(BaseModel):
    category_id: UUID | None = None
    title: str | None = None
    difficulty: str | None = None
    estimated_duration_seconds: int | None = None
    frequency: str | None = None
    importance_score: int | None = None
    answer_objective: str | None = None
    sample_answer: str | None = None
    my_answer: str | None = None
    improvement_notes: str | None = None
    tags: list[UUID] | None = None

class InterviewQuestionRead(InterviewQuestionBase, OrmModel):
    id: UUID
    submitted_by_user_id: UUID
    contributor_name: str | None = None
    can_edit: bool = False
    is_favorited: bool = False
    metrics: dict | None = None
    created_at: datetime
    updated_at: datetime
    category: InterviewCategoryRead | None = None
    tags: list[InterviewTagRead] = Field(default_factory=list)
    companies: list[CompanyRead] = Field(default_factory=list)


class QuestionAiMetadataRead(BaseModel):
    ai_metadata: dict


class InterviewCollectionBase(BaseModel):
    title: str
    slug: str
    description: str | None = None
    cover_url: str | None = None
    cover_storage_key: str | None = None
    collection_type: str = "community"
    theme: str | None = None
    price_coins: int = 0
    status: str = "published"


class InterviewCollectionRead(InterviewCollectionBase, OrmModel):
    id: UUID
    creator_user_id: UUID | None = None
    last_updated_at: datetime | None = None
    library_adds: int = 0
    question_count: int = 0
    user_active_question_count: int = 0
    missing_question_count: int = 0
    library_status: str = "not_added"
    sample_questions: list[str] = Field(default_factory=list)
    creator_name: str | None = None
    contributor_count: int = 0
    is_owned: bool = False
    is_in_library: bool = False
    is_purchased: bool = False
    can_purchase: bool = False
    free_label: str | None = None
    question_ids: list[UUID] = Field(default_factory=list)


class InterviewCollectionCreate(BaseModel):
    title: str
    description: str | None = None
    theme: str | None = None
    price_coins: int = 0
    status: str = "published"
    question_ids: list[UUID] = Field(default_factory=list)


class InterviewCollectionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    theme: str | None = None
    price_coins: int | None = None
    status: str | None = None
    question_ids: list[UUID] | None = None


class InterviewCollectionQuestionRead(BaseModel):
    id: UUID
    collection_id: UUID
    question_id: UUID
    sort_order: int = 0
    is_approved: bool = True


class UserCollectionRead(BaseModel):
    id: UUID
    collection_id: UUID
    is_purchased: bool = False
    purchased_at: datetime | None = None
    added_at: datetime
    removed_at: datetime | None = None


class UserQuestionRead(BaseModel):
    id: UUID
    user_id: UUID
    question_id: UUID
    is_saved: bool = False
    saved_at: datetime | None = None
    note: str | None = None
    is_favorited: bool = False
    first_viewed_at: datetime | None = None
    last_viewed_at: datetime | None = None
    view_count: int = 0
    first_practiced_at: datetime | None = None
    last_practiced_at: datetime | None = None
    practice_count: int = 0
    total_practice_seconds: int = 0
    category_id: UUID | None = None
    frequency: str | None = None
    importance_score: int | None = None
    my_answer: str | None = None
    improvement_notes: str | None = None


class InterviewReportBase(BaseModel):
    question_id: UUID
    company: str | None = None
    role: str | None = None
    seen_in_interview: bool = True
    happened_at: datetime | None = None
    notes: str | None = None
    raw_data: dict = Field(default_factory=dict)


class InterviewReportRead(InterviewReportBase, OrmModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class QuestionCommunitySummaryRead(BaseModel):
    frequency_average: float | None = None
    importance_average: float | None = None
    difficulty_average: float | None = None
    rating_count: int = 0
    view_count: int = 0
    unique_viewer_count: int = 0
    practice_count: int = 0
    unique_practicer_count: int = 0
    total_practice_seconds: int = 0
    average_practice_seconds: int | None = None
    favorite_count: int = 0
    is_favorited: bool = False
    upvote_count: int = 0
    downvote_count: int = 0
    seen_in_interview_count: int = 0
    company_count: int = 0
    comment_count: int = 0
    blended_importance_score: float | None = None
    blended_frequency_score: float | None = None
    top_companies: list[dict[str, int | str]] = Field(default_factory=list)
    user_frequency_rating: int | None = None
    user_importance_rating: int | None = None
    user_difficulty_rating: int | None = None
    user_reaction: str | None = None
    survey_bonus_xp: int = 0
    survey_bonus_coins: int = 0


class QuestionRatingUpdate(BaseModel):
    frequency_rating: int | None = Field(default=None, ge=1, le=5)
    importance_rating: int | None = Field(default=None, ge=1, le=5)
    difficulty_rating: int | None = Field(default=None, ge=1, le=5)


class QuestionReactionUpdate(BaseModel):
    value: str | None = None


class QuestionAnswerBase(BaseModel):
    source: str = "author"
    answer_type: str = "reference"
    status: str = "published"
    title: str | None = None
    body: str = Field(min_length=1)
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    is_recommended: bool = False


class QuestionAnswerCreate(QuestionAnswerBase):
    pass


class QuestionAnswerUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
    body: str | None = Field(default=None, min_length=1)
    metadata: dict | None = Field(default=None, validation_alias="metadata_")
    is_recommended: bool | None = None


class QuestionAnswerReactionUpdate(BaseModel):
    value: str | None = None


class QuestionAnswerRead(OrmModel):
    id: UUID
    question_id: UUID
    author_user_id: UUID | None = None
    source: str
    answer_type: str
    status: str
    title: str | None = None
    body: str | None = None
    structured_content: dict | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    is_recommended: bool = False
    recommended_by_user_id: UUID | None = None
    recommended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    reaction_count: int = 0
    upvote_count: int = 0
    downvote_count: int = 0
    user_reaction: str | None = None
    comment_count: int = 0
    is_saved: bool = False
    is_reported: bool = False
    is_author: bool = False
    can_manage: bool = False
    author_name: str | None = None
    author_avatar_url: str | None = None
    author_badge: str | None = None
    is_locked: bool = False
    unlock_cost: int = 0
    question_unlock_remaining_cost: int = 0


class QuestionMetricsRead(OrmModel):
    question_id: UUID
    view_count: int = 0
    unique_viewer_count: int = 0
    practice_count: int = 0
    unique_practicer_count: int = 0
    total_practice_seconds: int = 0
    average_practice_seconds: int | None = None
    favorite_count: int = 0
    upvote_count: int = 0
    downvote_count: int = 0
    seen_in_interview_count: int = 0
    company_count: int = 0
    rating_count: int = 0
    difficulty_average: float | None = None
    importance_average: float | None = None
    frequency_average: float | None = None
    blended_importance_score: float | None = None
    blended_frequency_score: float | None = None
    top_companies: list[dict[str, int | str]] = Field(default_factory=list)
    last_aggregated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class QuestionCommentCreate(BaseModel):
    kind: str = "discussion"
    body: str = Field(min_length=1, max_length=4000)
    parent_id: UUID | None = None


class QuestionCommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class QuestionCommentReportCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=40)


class QuestionCommentLikeRead(BaseModel):
    liked: bool
    like_count: int


class QuestionDuplicateCandidateRead(BaseModel):
    id: UUID
    title: str
    owner_name: str
    created_at: datetime
    match_type: str


class QuestionDuplicateGroupRead(BaseModel):
    normalized_title: str
    questions: list[QuestionDuplicateCandidateRead]


class QuestionDiscussionMergeRead(BaseModel):
    target_question_id: UUID
    merged_question_ids: list[UUID]
    comments_moved: int


class QuestionCommentRead(BaseModel):
    id: UUID
    question_id: UUID
    parent_id: UUID | None = None
    kind: str
    body: str
    author_name: str
    author_avatar_url: str | None = None
    author_badge: str | None = None
    is_author: bool = False
    like_count: int = 0
    is_liked: bool = False
    is_reported: bool = False
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime
    replies: list["QuestionCommentRead"] = Field(default_factory=list)


class QuestionCommentPageRead(BaseModel):
    items: list[QuestionCommentRead]
    next_cursor: datetime | None = None
    question_id: UUID


class QuestionAnswerCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    parent_id: UUID | None = None


class QuestionAnswerCommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class QuestionAnswerCommentReportCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=40)


class QuestionAnswerSaveRead(BaseModel):
    saved: bool


class QuestionAnswerCommentRead(BaseModel):
    id: UUID
    answer_id: UUID
    parent_id: UUID | None = None
    body: str
    author_name: str
    author_avatar_url: str | None = None
    author_badge: str | None = None
    is_author: bool = False
    like_count: int = 0
    is_liked: bool = False
    is_reported: bool = False
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime
    replies: list["QuestionAnswerCommentRead"] = Field(default_factory=list)


class QuestionAnswerCommentPageRead(BaseModel):
    items: list[QuestionAnswerCommentRead]
    next_cursor: datetime | None = None
    answer_id: UUID

class CommunityInterviewReportRead(BaseModel):
    id: UUID
    company: str | None = None
    role: str | None = None
    location: str | None = None
    happened_at: datetime

class UserNotificationRead(OrmModel):
    id: UUID
    kind: str
    title: str | None = None
    message: str
    action_url: str | None = None
    actor_user_id: UUID | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    question_id: UUID | None = None
    read_at: datetime | None = None
    created_at: datetime


class AudioRecordBase(BaseModel):
    practice_record_id: UUID
    url_path: str
    storage_key: str | None = None
    duration: int | None = None

class AudioRecordRead(AudioRecordBase, OrmModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PracticeRecordBase(BaseModel):
    question_id: UUID
    started_at: datetime | None = None
    submitted_at: datetime | None = None
    duration_seconds: int | None = None
    my_answer: str | None = None
    confidence_score: int | None = None
    notes: str | None = None

class PracticeRecordCreate(PracticeRecordBase):
    pass


class PracticeRecordUpdate(BaseModel):
    my_answer: str | None = None
    confidence_score: int | None = None
    notes: str | None = None


class PracticeEvaluationRead(OrmModel):
    id: UUID
    practice_record_id: UUID
    status: str
    provider: str
    model: str
    prompt_version: str
    overall_score: int | None = None
    result: dict = Field(default_factory=dict)
    coins_spent: int = 0
    created_at: datetime


class AnswerUnlockRead(BaseModel):
    answer: QuestionAnswerRead
    coins_spent: int
    remaining_coins: int

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
    max_daily_xp_gain: int = 500
    max_daily_coin_gain: int = 100
    inventory: dict = Field(default_factory=dict)
    active_boosters: dict = Field(default_factory=dict)

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
    claimed_stage_days: list[int] = Field(default_factory=list)
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
    unlocked_at: datetime | None = None
    unlocked: bool = False
    unlock_reason: str | None = None

    class Config:
        from_attributes = True


class GamificationConfigRead(BaseModel):
    scope: str
    config: dict
    updated_at: datetime | None = None
    updated_by_user_id: UUID | None = None

    class Config:
        from_attributes = True


class GamificationConfigUpdate(BaseModel):
    config: dict
