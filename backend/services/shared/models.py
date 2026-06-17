from datetime import datetime
from enum import StrEnum
from uuid import UUID as PyUUID
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.shared.database import Base


class UserRole(StrEnum):
    admin = "admin"
    user = "user"


class UserStatus(StrEnum):
    active = "active"
    disabled = "disabled"


class Platform(StrEnum):
    linkedin = "linkedin"
    seek = "seek"


class AutomationRunStatus(StrEnum):
    pending = "pending"
    running = "running"
    cancel_requested = "cancel_requested"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=UserRole.admin.value)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=UserStatus.active.value)
    can_use_auto_apply: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    profile: Mapped["UserProfile"] = relationship(back_populates="user", cascade="all, delete-orphan")
    platform_accounts: Mapped[list["PlatformAccount"]] = relationship(back_populates="user")
    job_preferences: Mapped["JobPreference"] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    first_name: Mapped[str | None] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    phone_number: Mapped[str | None] = mapped_column(String(50))
    current_city: Mapped[str | None] = mapped_column(String(255))
    street: Mapped[str | None] = mapped_column(String(255))
    state: Mapped[str | None] = mapped_column(String(100))
    zipcode: Mapped[str | None] = mapped_column(String(50))
    country: Mapped[str | None] = mapped_column(String(100))
    ethnicity: Mapped[str | None] = mapped_column(String(100))
    gender: Mapped[str | None] = mapped_column(String(100))
    gender_identity: Mapped[str | None] = mapped_column(String(100))
    disability_status: Mapped[str | None] = mapped_column(String(100))
    veteran_status: Mapped[str | None] = mapped_column(String(100))
    extra_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped[User] = relationship(back_populates="profile")


class PlatformAccount(Base, TimestampMixin):
    __tablename__ = "platform_accounts"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default=Platform.linkedin.value)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    login_identifier: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extra_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped[User] = relationship(back_populates="platform_accounts")


class JobPreference(Base, TimestampMixin):
    __tablename__ = "job_preferences"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    years_of_experience: Mapped[str | None] = mapped_column(String(50))
    require_visa: Mapped[str | None] = mapped_column(String(50))
    website: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    resume_path: Mapped[str | None] = mapped_column(Text)
    us_citizenship: Mapped[str | None] = mapped_column(String(255))
    desired_salary: Mapped[float | None] = mapped_column(Numeric(12, 2))
    current_ctc: Mapped[float | None] = mapped_column(Numeric(12, 2))
    notice_period: Mapped[int | None] = mapped_column(Integer)
    linkedin_headline: Mapped[str | None] = mapped_column(String(500))
    linkedin_summary: Mapped[str | None] = mapped_column(Text)
    cover_letter: Mapped[str | None] = mapped_column(Text)
    user_information_all: Mapped[str | None] = mapped_column(Text)
    recent_employer: Mapped[str | None] = mapped_column(String(255))
    confidence_level: Mapped[str | None] = mapped_column(String(50))
    extra_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped[User] = relationship(back_populates="job_preferences")


class SearchProfile(Base, TimestampMixin):
    __tablename__ = "search_profiles"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform_account_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("platform_accounts.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Default LinkedIn Search")
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default=Platform.linkedin.value)
    search_terms: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    search_location: Mapped[str | None] = mapped_column(String(255))
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    blacklist_rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    whitelist_rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class RuntimeSettings(Base, TimestampMixin):
    __tablename__ = "runtime_settings"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform_account_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("platform_accounts.id"))
    run_in_background: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    safe_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    stealth_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    click_gap: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    pause_before_submit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    pause_at_failed_question: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    overwrite_previous_answers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    learn_from_manual_answers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    question_similarity_threshold: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=0.85)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class QuestionCacheEntry(Base, TimestampMixin):
    __tablename__ = "question_cache_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", "normalized_label", "field_type", name="uq_question_cache_user_label_type"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform_account_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("platform_accounts.id"))
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default=Platform.linkedin.value)
    original_label: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_label: Mapped[str] = mapped_column(Text, nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)
    options: Mapped[list | None] = mapped_column(JSONB)
    answer: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(100))
    times_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    companies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


class JobApplication(Base, TimestampMixin):
    __tablename__ = "job_applications"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform_account_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("platform_accounts.id"))
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default=Platform.linkedin.value)
    job_id: Mapped[str | None] = mapped_column(String(255), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    company: Mapped[str | None] = mapped_column(String(255), index=True)
    work_location: Mapped[str | None] = mapped_column(String(255))
    work_style: Mapped[str | None] = mapped_column(String(100))
    job_description: Mapped[str | None] = mapped_column(Text)
    job_link: Mapped[str | None] = mapped_column(Text)
    external_job_link: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="submitted", index=True)
    pipeline_stage: Mapped[str] = mapped_column(String(50), nullable=False, default="applied", index=True)
    interview_stage: Mapped[str | None] = mapped_column(String(100))
    next_action: Mapped[str | None] = mapped_column(String(255))
    next_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    application_type: Mapped[str | None] = mapped_column(String(100))
    resume_path: Mapped[str | None] = mapped_column(Text)
    date_posted: Mapped[str | None] = mapped_column(String(100))
    date_applied: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    questions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    skip_reason: Mapped[str | None] = mapped_column(Text)
    screenshot_path: Mapped[str | None] = mapped_column(Text)
    raw_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AutomationRun(Base, TimestampMixin):
    __tablename__ = "automation_runs"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform_account_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("platform_accounts.id"))
    search_profile_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("search_profiles.id"))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=AutomationRunStatus.pending.value, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_message: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
