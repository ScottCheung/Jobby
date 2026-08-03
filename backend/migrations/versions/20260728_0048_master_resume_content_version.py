"""add master resume content version

Revision ID: 20260728_0048
Revises: 20260728_0047
Create Date: 2026-07-28 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260728_0048"
down_revision = "20260728_0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_resumes",
        sa.Column("content_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_table(
        "master_resume_evaluation_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("master_resume_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resume_version", sa.Integer(), nullable=False),
        sa.Column("evaluation", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["master_resume_id"], ["master_resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "master_resume_id",
            "resume_version",
            name="uq_master_resume_evaluation_version",
        ),
    )
    op.create_index(
        op.f("ix_master_resume_evaluation_snapshots_master_resume_id"),
        "master_resume_evaluation_snapshots",
        ["master_resume_id"],
        unique=False,
    )
    op.execute(
        """
        INSERT INTO master_resume_evaluation_snapshots
            (id, master_resume_id, resume_version, evaluation, created_at)
        SELECT gen_random_uuid(), id, 1, evaluation, COALESCE(evaluation_updated_at, updated_at)
        FROM master_resumes
        WHERE evaluation IS NOT NULL AND evaluation <> '{}'::jsonb
        """
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_master_resume_evaluation_snapshots_master_resume_id"),
        table_name="master_resume_evaluation_snapshots",
    )
    op.drop_table("master_resume_evaluation_snapshots")
    op.drop_column("master_resumes", "content_version")
