"""create core tables

Revision ID: 20260616_0001
Revises:
Create Date: 2026-06-16 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260616_0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("can_use_auto_apply", sa.Boolean(), nullable=False),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(length=100)),
        sa.Column("middle_name", sa.String(length=100)),
        sa.Column("last_name", sa.String(length=100)),
        sa.Column("phone_number", sa.String(length=50)),
        sa.Column("current_city", sa.String(length=255)),
        sa.Column("street", sa.String(length=255)),
        sa.Column("state", sa.String(length=100)),
        sa.Column("zipcode", sa.String(length=50)),
        sa.Column("country", sa.String(length=100)),
        sa.Column("ethnicity", sa.String(length=100)),
        sa.Column("gender", sa.String(length=100)),
        sa.Column("gender_identity", sa.String(length=100)),
        sa.Column("disability_status", sa.String(length=100)),
        sa.Column("veteran_status", sa.String(length=100)),
        sa.Column("extra_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "platform_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("account_name", sa.String(length=255), nullable=False),
        sa.Column("login_identifier", sa.String(length=255)),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("extra_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_platform_accounts_user_id", "platform_accounts", ["user_id"])

    op.create_table(
        "job_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("years_of_experience", sa.String(length=50)),
        sa.Column("require_visa", sa.String(length=50)),
        sa.Column("website", sa.String(length=500)),
        sa.Column("linkedin_url", sa.String(length=500)),
        sa.Column("us_citizenship", sa.String(length=255)),
        sa.Column("desired_salary", sa.Numeric(12, 2)),
        sa.Column("current_ctc", sa.Numeric(12, 2)),
        sa.Column("notice_period", sa.Integer()),
        sa.Column("linkedin_headline", sa.String(length=500)),
        sa.Column("linkedin_summary", sa.Text()),
        sa.Column("cover_letter", sa.Text()),
        sa.Column("recent_employer", sa.String(length=255)),
        sa.Column("confidence_level", sa.String(length=50)),
        sa.Column("extra_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "search_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("search_terms", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("search_location", sa.String(length=255)),
        sa.Column("filters", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("blacklist_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("whitelist_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["platform_account_id"], ["platform_accounts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_search_profiles_user_id", "search_profiles", ["user_id"])

    op.create_table(
        "runtime_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("run_in_background", sa.Boolean(), nullable=False),
        sa.Column("safe_mode", sa.Boolean(), nullable=False),
        sa.Column("stealth_mode", sa.Boolean(), nullable=False),
        sa.Column("click_gap", sa.Integer(), nullable=False),
        sa.Column("pause_before_submit", sa.Boolean(), nullable=False),
        sa.Column("pause_at_failed_question", sa.Boolean(), nullable=False),
        sa.Column("overwrite_previous_answers", sa.Boolean(), nullable=False),
        sa.Column("learn_from_manual_answers", sa.Boolean(), nullable=False),
        sa.Column("question_similarity_threshold", sa.Numeric(4, 3), nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["platform_account_id"], ["platform_accounts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_runtime_settings_user_id", "runtime_settings", ["user_id"])

    op.create_table(
        "question_cache_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("original_label", sa.Text(), nullable=False),
        sa.Column("normalized_label", sa.Text(), nullable=False),
        sa.Column("field_type", sa.String(length=50), nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("answer", sa.Text()),
        sa.Column("source", sa.String(length=100)),
        sa.Column("times_used", sa.Integer(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("companies", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["platform_account_id"], ["platform_accounts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "platform", "normalized_label", "field_type", name="uq_question_cache_user_label_type"),
    )
    op.create_index("ix_question_cache_entries_user_id", "question_cache_entries", ["user_id"])

    op.create_table(
        "job_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("job_id", sa.String(length=255)),
        sa.Column("title", sa.Text()),
        sa.Column("company", sa.String(length=255)),
        sa.Column("work_location", sa.String(length=255)),
        sa.Column("work_style", sa.String(length=100)),
        sa.Column("job_link", sa.Text()),
        sa.Column("external_job_link", sa.Text()),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("application_type", sa.String(length=100)),
        sa.Column("resume_path", sa.Text()),
        sa.Column("date_posted", sa.String(length=100)),
        sa.Column("date_applied", sa.DateTime(timezone=True)),
        sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("screenshot_path", sa.Text()),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["platform_account_id"], ["platform_accounts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_applications_company", "job_applications", ["company"])
    op.create_index("ix_job_applications_date_applied", "job_applications", ["date_applied"])
    op.create_index("ix_job_applications_job_id", "job_applications", ["job_id"])
    op.create_index("ix_job_applications_status", "job_applications", ["status"])
    op.create_index("ix_job_applications_user_id", "job_applications", ["user_id"])

    op.create_table(
        "automation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("search_profile_id", postgresql.UUID(as_uuid=True)),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("current_message", sa.Text()),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error_message", sa.Text()),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["platform_account_id"], ["platform_accounts.id"]),
        sa.ForeignKeyConstraint(["search_profile_id"], ["search_profiles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_automation_runs_status", "automation_runs", ["status"])
    op.create_index("ix_automation_runs_user_id", "automation_runs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_automation_runs_user_id", table_name="automation_runs")
    op.drop_index("ix_automation_runs_status", table_name="automation_runs")
    op.drop_table("automation_runs")

    op.drop_index("ix_job_applications_user_id", table_name="job_applications")
    op.drop_index("ix_job_applications_status", table_name="job_applications")
    op.drop_index("ix_job_applications_job_id", table_name="job_applications")
    op.drop_index("ix_job_applications_date_applied", table_name="job_applications")
    op.drop_index("ix_job_applications_company", table_name="job_applications")
    op.drop_table("job_applications")

    op.drop_index("ix_question_cache_entries_user_id", table_name="question_cache_entries")
    op.drop_table("question_cache_entries")

    op.drop_index("ix_runtime_settings_user_id", table_name="runtime_settings")
    op.drop_table("runtime_settings")

    op.drop_index("ix_search_profiles_user_id", table_name="search_profiles")
    op.drop_table("search_profiles")

    op.drop_table("job_preferences")

    op.drop_index("ix_platform_accounts_user_id", table_name="platform_accounts")
    op.drop_table("platform_accounts")

    op.drop_table("user_profiles")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
