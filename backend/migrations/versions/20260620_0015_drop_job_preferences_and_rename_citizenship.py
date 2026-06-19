"""drop job_preferences and rename citizenship

Revision ID: 20260620_0015
Revises: 20260620_0014
Create Date: 2026-06-20 20:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260620_0015"
down_revision = "20260620_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("search_profiles", "us_citizenship", new_column_name="citizenship")
    op.drop_table("job_preferences")


def downgrade() -> None:
    op.create_table(
        "job_preferences",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("years_of_experience", sa.String(length=50), nullable=True),
        sa.Column("require_visa", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("linkedin_url", sa.String(length=500), nullable=True),
        sa.Column("resume_path", sa.Text(), nullable=True),
        sa.Column("us_citizenship", sa.String(length=255), nullable=True),
        sa.Column("desired_salary", sa.Numeric(12, 2), nullable=True),
        sa.Column("current_ctc", sa.Numeric(12, 2), nullable=True),
        sa.Column("notice_period", sa.Integer(), nullable=True),
        sa.Column("linkedin_headline", sa.String(length=500), nullable=True),
        sa.Column("linkedin_summary", sa.Text(), nullable=True),
        sa.Column("cover_letter", sa.Text(), nullable=True),
        sa.Column("user_information_all", sa.Text(), nullable=True),
        sa.Column("recent_employer", sa.String(length=255), nullable=True),
        sa.Column("confidence_level", sa.String(length=50), nullable=True),
        sa.Column("extra_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.alter_column("search_profiles", "citizenship", new_column_name="us_citizenship")
