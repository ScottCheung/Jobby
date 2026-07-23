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
    avatar_url: Mapped[str | None] = mapped_column(String(2048))
    community_badge: Mapped[str | None] = mapped_column(String(30))
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=UserRole.admin.value)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=UserStatus.active.value)
    can_use_auto_apply: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    profile: Mapped["UserProfile"] = relationship(back_populates="user", cascade="all, delete-orphan")
    platform_accounts: Mapped[list["PlatformAccount"]] = relationship(back_populates="user")
    
    interview_categories: Mapped[list["InterviewCategory"]] = relationship(back_populates="user")
    interview_tags: Mapped[list["InterviewTag"]] = relationship(back_populates="user")
    submitted_interview_questions: Mapped[list["InterviewQuestion"]] = relationship(back_populates="submitted_by")
    question_answers: Mapped[list["QuestionAnswer"]] = relationship(back_populates="author", foreign_keys="QuestionAnswer.author_user_id")
    question_answer_comments: Mapped[list["QuestionAnswerComment"]] = relationship(back_populates="user", foreign_keys="QuestionAnswerComment.user_id")
    gamification_profile: Mapped["UserGamification"] = relationship(back_populates="user", cascade="all, delete-orphan")
    inventory_items: Mapped[list["UserInventoryItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")

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
    inventory: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    active_boosters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped["User"] = relationship(back_populates="gamification_profile")
    inventory_items: Mapped[list["UserInventoryItem"]] = relationship(
        primaryjoin="UserGamification.user_id == foreign(UserInventoryItem.user_id)",
        viewonly=True,
    )


class UserInventoryItem(Base, TimestampMixin):
    __tablename__ = "user_inventory_items"
    __table_args__ = (
        UniqueConstraint("user_id", "item_key", name="uq_user_inventory_item_key"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extra_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped["User"] = relationship(back_populates="inventory_items")


class UserDailyQuest(Base, TimestampMixin):
    __tablename__ = "user_daily_quests"
    __table_args__ = (
        Index("idx_user_daily_quests_user_date", "user_id", "quest_date"),
    )

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
    __table_args__ = (
        Index("idx_user_achievements_user_badge", "user_id", "badge_id"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id: Mapped[str] = mapped_column(String(50), nullable=False)
    badge_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class GamificationTransaction(Base, TimestampMixin):
    __tablename__ = "gamification_transactions"
    __table_args__ = (
        Index("idx_gamification_tx_user_created", "user_id", "created_at"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False)  # 'xp' or 'coin'
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(foreign_keys=[user_id])


class GamificationConfig(Base, TimestampMixin):
    __tablename__ = "gamification_configs"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    scope: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, default="global")
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_by_user_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    updated_by_user: Mapped["User | None"] = relationship(foreign_keys=[updated_by_user_id])


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
    user_questions: Mapped[list["UserQuestion"]] = relationship(
        secondary="user_question_tag_association",
        back_populates="tags"
    )

class UserQuestionTagAssociation(Base):
    __tablename__ = "user_question_tag_association"
    
    user_question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("user_questions.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_tags.id", ondelete="CASCADE"), primary_key=True)

class QuestionTagAssociation(Base):
    __tablename__ = "question_tag_association"
    
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_tags.id", ondelete="CASCADE"), primary_key=True)


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(1000))

    questions: Mapped[list["InterviewQuestion"]] = relationship(
        secondary="question_company_association",
        back_populates="companies"
    )

class QuestionCompanyAssociation(Base):
    __tablename__ = "question_company_association"

    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
class InterviewQuestion(Base, TimestampMixin):
    __tablename__ = "interview_questions"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    # Questions are public community records. This identifies the contributor
    # who submitted the record; it is not an ownership or access-control field.
    submitted_by_user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_categories.id", ondelete="SET NULL"))
    
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    display_number: Mapped[int | None] = mapped_column(Integer, unique=True, index=True, nullable=True)
    # Deterministic key for indexed duplicate lookups. It is deliberately not
    # unique: the same prompt may legitimately exist in separate collections.
    normalized_title: Mapped[str | None] = mapped_column(String(500), index=True)
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estimated_duration_seconds: Mapped[int | None] = mapped_column(Integer, default=120, nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(50))
    importance_score: Mapped[int | None] = mapped_column(Integer, default=3)
    author_frequency: Mapped[str | None] = mapped_column(String(50))
    author_importance_score: Mapped[int | None] = mapped_column(Integer, default=3)
    # Generated only when the first AI reference answer is requested.
    ai_metadata: Mapped[dict | None] = mapped_column(JSONB)
    
    answer_objective: Mapped[str | None] = mapped_column(Text)
    sample_answer: Mapped[str | None] = mapped_column(Text)
    my_answer: Mapped[str | None] = mapped_column(Text)
    improvement_notes: Mapped[str | None] = mapped_column(Text)
    # Public catalog moderation lifecycle. Personal Library membership always
    # lives in UserQuestion and is deliberately independent of this status.
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="published", index=True)

    submitted_by: Mapped[User] = relationship(back_populates="submitted_interview_questions", foreign_keys=[submitted_by_user_id])
    category: Mapped[InterviewCategory | None] = relationship(back_populates="questions", foreign_keys=[category_id])
    tags: Mapped[list[InterviewTag]] = relationship(
        secondary="question_tag_association",
        back_populates="questions"
    )
    companies: Mapped[list[Company]] = relationship(
        secondary="question_company_association",
        back_populates="questions"
    )
    answers: Mapped[list["QuestionAnswer"]] = relationship(back_populates="question", cascade="all, delete-orphan")
    metrics: Mapped["QuestionMetrics | None"] = relationship(back_populates="question", cascade="all, delete-orphan", uselist=False)
    practice_records: Mapped[list["PracticeRecord"]] = relationship(back_populates="question", cascade="all, delete-orphan")
    user_question_links: Mapped[list["UserQuestion"]] = relationship(back_populates="question")


class InterviewCollection(Base, TimestampMixin):
    __tablename__ = "interview_collections"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(Text)
    cover_storage_key: Mapped[str | None] = mapped_column(String(1024))
    creator_user_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    collection_type: Mapped[str] = mapped_column(String(50), nullable=False, default="community")
    theme: Mapped[str | None] = mapped_column(String(50), index=True)
    price_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="published")
    last_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    downloads: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    creator: Mapped[User | None] = relationship(foreign_keys=[creator_user_id])
    questions: Mapped[list["InterviewCollectionQuestion"]] = relationship(back_populates="collection", cascade="all, delete-orphan")
    subscriptions: Mapped[list["UserCollection"]] = relationship(back_populates="collection", cascade="all, delete-orphan")
    contributors: Mapped[list["CollectionContributor"]] = relationship(back_populates="collection", cascade="all, delete-orphan")


class InterviewCollectionQuestion(Base, TimestampMixin):
    __tablename__ = "interview_collection_questions"
    __table_args__ = (
        UniqueConstraint("collection_id", "question_id", name="uq_interview_collection_question"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    collection_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_collections.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    collection: Mapped[InterviewCollection] = relationship(back_populates="questions")
    question: Mapped[InterviewQuestion] = relationship(foreign_keys=[question_id])


class UserCollection(Base, TimestampMixin):
    __tablename__ = "user_collections"
    __table_args__ = (
        UniqueConstraint("user_id", "collection_id", name="uq_user_collection"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    collection_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_collections.id", ondelete="CASCADE"), index=True)
    is_purchased: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    purchased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    collection: Mapped[InterviewCollection] = relationship(back_populates="subscriptions")


class UserQuestion(Base, TimestampMixin):
    __tablename__ = "user_questions"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    # A user can save a question independently of any number of subscribed
    # collections. Collection membership is derived from UserCollection and
    # InterviewCollectionQuestion instead of being stored here.
    is_saved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    saved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)
    is_favorited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    first_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    practice_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_practice_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    category_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_categories.id", ondelete="SET NULL"), index=True)
    frequency: Mapped[str | None] = mapped_column(String(50))
    importance_score: Mapped[int | None] = mapped_column(Integer, default=3)
    my_answer: Mapped[str | None] = mapped_column(Text)
    improvement_notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    question: Mapped[InterviewQuestion] = relationship(back_populates="user_question_links", foreign_keys=[question_id])
    category: Mapped["InterviewCategory | None"] = relationship(foreign_keys=[category_id])
    tags: Mapped[list[InterviewTag]] = relationship(
        secondary="user_question_tag_association",
        back_populates="user_questions"
    )


class CollectionContributor(Base, TimestampMixin):
    __tablename__ = "collection_contributors"
    __table_args__ = (
        UniqueConstraint("collection_id", "user_id", name="uq_collection_contributor"),
    )

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    collection_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_collections.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contribution_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    collection: Mapped[InterviewCollection] = relationship(back_populates="contributors")
    user: Mapped[User] = relationship(foreign_keys=[user_id])


class InterviewReport(Base, TimestampMixin):
    __tablename__ = "interview_reports"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    company: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255))
    seen_in_interview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    notes: Mapped[str | None] = mapped_column(Text)
    raw_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    question: Mapped[InterviewQuestion] = relationship(foreign_keys=[question_id])


class QuestionInterviewReportSummary(Base, TimestampMixin):
    __tablename__ = "question_interview_report_summaries"

    question_id: Mapped[PyUUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("interview_questions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    company_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    top_companies: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)


class QuestionRating(Base, TimestampMixin):
    __tablename__ = "question_ratings"
    __table_args__ = (UniqueConstraint("question_id", "user_id", name="uq_question_rating_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    frequency_rating: Mapped[int | None] = mapped_column(Integer)
    importance_rating: Mapped[int | None] = mapped_column(Integer)
    difficulty_rating: Mapped[int | None] = mapped_column(Integer)
    survey_reward_granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class QuestionReaction(Base, TimestampMixin):
    __tablename__ = "question_reactions"
    __table_args__ = (UniqueConstraint("question_id", "user_id", name="uq_question_reaction_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    value: Mapped[str] = mapped_column(String(10), nullable=False)


class QuestionMetrics(Base, TimestampMixin):
    __tablename__ = "question_metrics"

    question_id: Mapped[PyUUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("interview_questions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unique_viewer_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    practice_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unique_practicer_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_practice_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    average_practice_seconds: Mapped[int | None] = mapped_column(Integer)
    favorite_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    upvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    seen_in_interview_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    company_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    difficulty_average: Mapped[float | None] = mapped_column(Numeric(4, 2))
    importance_average: Mapped[float | None] = mapped_column(Numeric(4, 2))
    frequency_average: Mapped[float | None] = mapped_column(Numeric(4, 2))
    blended_importance_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    blended_frequency_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    top_companies: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    last_aggregated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    question: Mapped[InterviewQuestion] = relationship(back_populates="metrics")


class QuestionAnswer(Base, TimestampMixin):
    __tablename__ = "question_answers"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    author_user_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="author")
    answer_type: Mapped[str] = mapped_column(String(30), nullable=False, default="reference")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="published")
    title: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    is_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recommended_by_user_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    recommended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    question: Mapped[InterviewQuestion] = relationship(back_populates="answers", foreign_keys=[question_id])
    author: Mapped[User | None] = relationship(back_populates="question_answers", foreign_keys=[author_user_id])
    reactions: Mapped[list["QuestionAnswerReaction"]] = relationship(back_populates="answer", cascade="all, delete-orphan")
    comments: Mapped[list["QuestionAnswerComment"]] = relationship(back_populates="answer", cascade="all, delete-orphan")
    saves: Mapped[list["QuestionAnswerSave"]] = relationship(back_populates="answer", cascade="all, delete-orphan")
    unlocks: Mapped[list["QuestionAnswerUnlock"]] = relationship(back_populates="answer", cascade="all, delete-orphan")


class QuestionAnswerUnlock(Base, TimestampMixin):
    __tablename__ = "question_answer_unlocks"
    __table_args__ = (UniqueConstraint("answer_id", "user_id", name="uq_question_answer_unlock_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    answer_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    coins_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    transaction_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("gamification_transactions.id", ondelete="SET NULL"))

    answer: Mapped[QuestionAnswer] = relationship(back_populates="unlocks", foreign_keys=[answer_id])


class PracticeEvaluation(Base, TimestampMixin):
    __tablename__ = "practice_evaluations"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    practice_record_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("practice_records.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="completed")
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="deepseek")
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(50), nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    overall_score: Mapped[int | None] = mapped_column(Integer)
    result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    coins_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    transaction_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("gamification_transactions.id", ondelete="SET NULL"))

    practice_record: Mapped["PracticeRecord"] = relationship(foreign_keys=[practice_record_id])
    user: Mapped[User] = relationship(foreign_keys=[user_id])


class QuestionAnswerReaction(Base, TimestampMixin):
    __tablename__ = "question_answer_reactions"
    __table_args__ = (UniqueConstraint("answer_id", "user_id", name="uq_question_answer_reaction_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    answer_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    value: Mapped[str] = mapped_column(String(10), nullable=False, default="up")

    answer: Mapped[QuestionAnswer] = relationship(back_populates="reactions", foreign_keys=[answer_id])


class QuestionAnswerComment(Base, TimestampMixin):
    __tablename__ = "question_answer_comments"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    answer_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answer_comments.id", ondelete="SET NULL"), index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    answer: Mapped[QuestionAnswer] = relationship(back_populates="comments", foreign_keys=[answer_id])
    user: Mapped[User] = relationship(back_populates="question_answer_comments", foreign_keys=[user_id])


class QuestionAnswerCommentLike(Base, TimestampMixin):
    __tablename__ = "question_answer_comment_likes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_question_answer_comment_like_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    comment_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answer_comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)


class QuestionAnswerCommentReport(Base, TimestampMixin):
    __tablename__ = "question_answer_comment_reports"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_question_answer_comment_report_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    comment_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answer_comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)


class QuestionAnswerSave(Base, TimestampMixin):
    __tablename__ = "question_answer_saves"
    __table_args__ = (UniqueConstraint("answer_id", "user_id", name="uq_question_answer_save_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    answer_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)

    answer: Mapped[QuestionAnswer] = relationship(back_populates="saves", foreign_keys=[answer_id])


class QuestionAnswerReport(Base, TimestampMixin):
    __tablename__ = "question_answer_reports"
    __table_args__ = (UniqueConstraint("answer_id", "user_id", name="uq_question_answer_report_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    answer_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_answers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)


class QuestionComment(Base, TimestampMixin):
    __tablename__ = "question_comments"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_comments.id", ondelete="SET NULL"), index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="discussion")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(foreign_keys=[user_id])


class QuestionCommentLike(Base, TimestampMixin):
    __tablename__ = "question_comment_likes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_question_comment_like_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    comment_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)


class QuestionCommentReport(Base, TimestampMixin):
    __tablename__ = "question_comment_reports"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_question_comment_report_user"),)

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    comment_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("question_comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)


class UserNotification(Base, TimestampMixin):
    __tablename__ = "user_notifications"
    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(1024))
    actor_user_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    question_id: Mapped[PyUUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PracticeRecord(Base, TimestampMixin):
    __tablename__ = "practice_records"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
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
    storage_key: Mapped[str | None] = mapped_column(String(1024))
    duration: Mapped[int | None] = mapped_column(Integer)

    practice_record: Mapped[PracticeRecord] = relationship(back_populates="audio_records", foreign_keys=[practice_record_id])


class PracticePlan(Base, TimestampMixin):
    __tablename__ = "practice_plans"

    id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    daily_questions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    claimed_stage_days: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

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
