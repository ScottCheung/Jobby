"""persist tailored resumes for job applications

Revision ID: 20260730_0054
Revises: 20260728_0053
Create Date: 2026-07-30 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260730_0054"
down_revision = "20260728_0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tailored_resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("career_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_application_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("job_title", sa.Text(), nullable=True),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=False),
        sa.Column("source_resume_data", postgresql.JSONB(), nullable=False),
        sa.Column("resume_data", postgresql.JSONB(), nullable=False),
        sa.Column("raw_ai_response", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("key_qualifications", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("targeted_projects", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("prompt_version", sa.String(length=50), nullable=False, server_default="job-review-v2"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["career_profile_id"], ["job_hunting_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["job_application_id"], ["job_applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_tailored_resumes_user_id", "tailored_resumes", ["user_id"])
    op.create_index("ix_tailored_resumes_career_profile_id", "tailored_resumes", ["career_profile_id"])
    op.create_index("ix_tailored_resumes_job_application_id", "tailored_resumes", ["job_application_id"])


def downgrade() -> None:
    op.drop_index("ix_tailored_resumes_job_application_id", table_name="tailored_resumes")
    op.drop_index("ix_tailored_resumes_career_profile_id", table_name="tailored_resumes")
    op.drop_index("ix_tailored_resumes_user_id", table_name="tailored_resumes")
    op.drop_table("tailored_resumes")
