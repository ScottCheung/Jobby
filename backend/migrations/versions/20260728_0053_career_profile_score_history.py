"""add immutable Resume Profile score history

Revision ID: 20260728_0053
Revises: 20260728_0052
Create Date: 2026-07-28 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260728_0053"
down_revision = "20260728_0052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "career_profile_score_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("career_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evaluation", postgresql.JSONB(), nullable=False),
        sa.Column("resume_data", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["career_profile_id"], ["job_hunting_profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_career_profile_score_snapshots_career_profile_id", "career_profile_score_snapshots", ["career_profile_id"])


def downgrade() -> None:
    op.drop_index("ix_career_profile_score_snapshots_career_profile_id", table_name="career_profile_score_snapshots")
    op.drop_table("career_profile_score_snapshots")
