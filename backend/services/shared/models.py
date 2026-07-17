from datetime import datetime
from enum import StrEnum
from uuid import UUID as PyUUID
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.shared.database import Base
from services.shared.time_utils import parse_datetime_to_utc, utc_isoformat


class UserRole(StrEnum):
    admin = "admin"
    user = "user"


class UserStatus(StrEnum):
    active = "active"
    disabled = "disabled"


class Platform(StrEnum):
    linkedin = "linkedin"
    seek = "seek"


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
    
    interview_categories: Mapped[list["InterviewCategory"]] = relationship(back_populates="user")
    interview_tags: Mapped[list["InterviewTag"]] = relationship(back_populates="user")
    interview_questions: Mapped[list["InterviewQuestion"]] = relationship(back_populates="user")
    gamification_profile: Mapped["UserGamification"] = relationship(back_populates="user", cascade="all, delete-orphan")
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


class UserGamification(Base, TimestampMixin):
    __tablename__ = "user_gamification"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    loot_boxes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_practice_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_checkin_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="gamification_profile")


class UserDailyQuest(Base, TimestampMixin):
    __tablename__ = "user_daily_quests"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quest_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quest_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    target_value: Mapped[int] = mapped_column(Integer, nullable=False)
    current_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_claimed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class UserAchievement(Base, TimestampMixin):
    __tablename__ = "user_achievements"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id: Mapped[str] = mapped_column(String(50), nullable=False)
    badge_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class GamificationTransaction(Base, TimestampMixin):
    __tablename__ = "gamification_transactions"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False)  # 'xp' or 'coin'
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(foreign_keys=[user_id])


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

class JobHuntingProfile(Base, TimestampMixin):
    __tablename__ = "job_hunting_profiles"

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
    years_of_experience: Mapped[str | None] = mapped_column(String(50))
    require_visa: Mapped[str | None] = mapped_column(String(50))
    website: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    resume_path: Mapped[str | None] = mapped_column(Text)
    citizenship: Mapped[str | None] = mapped_column(String(255))
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
    __table_args__ = (
        Index(
            "uq_job_applications_user_id_job_id_active",
            "user_id",
            "job_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND job_id IS NOT NULL"),
        ),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default=Platform.linkedin.value)
    job_id: Mapped[str | None] = mapped_column(String(255), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    company: Mapped[str | None] = mapped_column(String(255), index=True)
    work_location: Mapped[str | None] = mapped_column(String(255))
    job_link: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="submitted", index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    date_posted: Mapped[str | None] = mapped_column(String(100))
    date_applied: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    status_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    skip_reason: Mapped[str | None] = mapped_column(Text)
    job_description: Mapped[str | None] = mapped_column(Text)
    raw_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    @property
    def questions(self) -> list:
        return (self.raw_data or {}).get("questions") or []

    @questions.setter
    def questions(self, value: list) -> None:
        self.raw_data = {**(self.raw_data or {}), "questions": value}

    @property
    def screenshot_path(self) -> str | None:
        return (self.raw_data or {}).get("screenshot_path")

    @screenshot_path.setter
    def screenshot_path(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "screenshot_path": value}

    # Properties mapping dropped columns transparently to raw_data JSONB
    @property
    def platform_account_id(self) -> PyUUID | None:
        val = (self.raw_data or {}).get("platform_account_id")
        if val is None:
            return None
        return PyUUID(val) if isinstance(val, str) else val

    @platform_account_id.setter
    def platform_account_id(self, value: PyUUID | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "platform_account_id": str(value) if value else None}

    @property
    def work_style(self) -> str | None:
        return (self.raw_data or {}).get("work_style")

    @work_style.setter
    def work_style(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "work_style": value}

    @property
    def external_job_link(self) -> str | None:
        return (self.raw_data or {}).get("external_job_link")

    @external_job_link.setter
    def external_job_link(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "external_job_link": value}

    @property
    def pipeline_stage(self) -> str:
        return (self.raw_data or {}).get("pipeline_stage") or "applied"

    @pipeline_stage.setter
    def pipeline_stage(self, value: str) -> None:
        self.raw_data = {**(self.raw_data or {}), "pipeline_stage": value}

    @property
    def interview_stage(self) -> str | None:
        return (self.raw_data or {}).get("interview_stage")

    @interview_stage.setter
    def interview_stage(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "interview_stage": value}

    @property
    def next_action(self) -> str | None:
        return (self.raw_data or {}).get("next_action")

    @next_action.setter
    def next_action(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "next_action": value}

    @property
    def next_action_at(self) -> datetime | None:
        val = (self.raw_data or {}).get("next_action_at")
        if val is None:
            return None
        return parse_datetime_to_utc(val) if isinstance(val, str) else val

    @next_action_at.setter
    def next_action_at(self, value: datetime | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "next_action_at": utc_isoformat(value) if value else None}

    @property
    def notes(self) -> str | None:
        return (self.raw_data or {}).get("notes")

    @notes.setter
    def notes(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "notes": value}



    @property
    def contact_name(self) -> str | None:
        return (self.raw_data or {}).get("contact_name")

    @contact_name.setter
    def contact_name(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "contact_name": value}

    @property
    def contact_email(self) -> str | None:
        return (self.raw_data or {}).get("contact_email")

    @contact_email.setter
    def contact_email(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "contact_email": value}

    @property
    def last_contacted_at(self) -> datetime | None:
        val = (self.raw_data or {}).get("last_contacted_at")
        if val is None:
            return None
        return parse_datetime_to_utc(val) if isinstance(val, str) else val

    @last_contacted_at.setter
    def last_contacted_at(self, value: datetime | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "last_contacted_at": utc_isoformat(value) if value else None}

    @property
    def application_type(self) -> str | None:
        return (self.raw_data or {}).get("application_type")

    @application_type.setter
    def application_type(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "application_type": value}

    @property
    def resume_path(self) -> str | None:
        return (self.raw_data or {}).get("resume_path")

    @resume_path.setter
    def resume_path(self, value: str | None) -> None:
        self.raw_data = {**(self.raw_data or {}), "resume_path": value}


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_alias: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class InterviewCategory(Base, TimestampMixin):
    __tablename__ = "interview_categories"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    user: Mapped[User] = relationship(back_populates="interview_categories", foreign_keys=[user_id])
    questions: Mapped[list["InterviewQuestion"]] = relationship(back_populates="category", cascade="all, delete-orphan")


class InterviewTag(Base, TimestampMixin):
    __tablename__ = "interview_tags"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    user: Mapped[User] = relationship(back_populates="interview_tags", foreign_keys=[user_id])
    questions: Mapped[list["InterviewQuestion"]] = relationship(
        secondary="question_tag_association",
        back_populates="tags"
    )

class QuestionTagAssociation(Base):
    __tablename__ = "question_tag_association"
    
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_tags.id", ondelete="CASCADE"), primary_key=True)


class InterviewQuestion(Base, TimestampMixin):
    __tablename__ = "interview_questions"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_categories.id", ondelete="SET NULL"))
    
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    frequency: Mapped[str | None] = mapped_column(String(50))
    importance_score: Mapped[int | None] = mapped_column(Integer, default=3)
    
    answer_objective: Mapped[str | None] = mapped_column(Text)
    answer_framework: Mapped[str | None] = mapped_column(Text)
    sample_answer: Mapped[str | None] = mapped_column(Text)
    my_answer: Mapped[str | None] = mapped_column(Text)
    improvement_notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="interview_questions", foreign_keys=[user_id])
    category: Mapped[InterviewCategory | None] = relationship(back_populates="questions", foreign_keys=[category_id])
    tags: Mapped[list[InterviewTag]] = relationship(
        secondary="question_tag_association",
        back_populates="questions"
    )
    practice_records: Mapped[list["PracticeRecord"]] = relationship(back_populates="question", cascade="all, delete-orphan")


class PracticeRecord(Base, TimestampMixin):
    __tablename__ = "practice_records"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    my_answer: Mapped[str | None] = mapped_column(Text)
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    question: Mapped[InterviewQuestion] = relationship(back_populates="practice_records", foreign_keys=[question_id])
    audio_records: Mapped[list["AudioRecord"]] = relationship(back_populates="practice_record", cascade="all, delete-orphan")


class AudioRecord(Base, TimestampMixin):
    __tablename__ = "audio_records"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    practice_record_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("practice_records.id", ondelete="CASCADE"), index=True)
    url_path: Mapped[str] = mapped_column(Text, nullable=False)
    duration: Mapped[int | None] = mapped_column(Integer)

    practice_record: Mapped[PracticeRecord] = relationship(back_populates="audio_records", foreign_keys=[practice_record_id])


class PracticePlan(Base, TimestampMixin):
    __tablename__ = "practice_plans"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    daily_questions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    tasks: Mapped[list["PlanTask"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanTask(Base, TimestampMixin):
    __tablename__ = "plan_tasks"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    plan_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("practice_plans.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    
    scheduled_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")

    plan: Mapped[PracticePlan] = relationship(back_populates="tasks", foreign_keys=[plan_id])
    question: Mapped[InterviewQuestion] = relationship(foreign_keys=[question_id])

