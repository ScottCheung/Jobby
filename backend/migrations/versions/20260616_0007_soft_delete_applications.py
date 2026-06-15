"""soft delete applications

Revision ID: 20260616_0007
Revises: 20260616_0006
Create Date: 2026-06-16 14:15:00
"""
from alembic import op
import sqlalchemy as sa


revision = "20260616_0007"
down_revision = "20260616_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_applications", sa.Column("deleted_at", sa.DateTime(timezone=True)))
    op.create_index("ix_job_applications_deleted_at", "job_applications", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_job_applications_deleted_at", table_name="job_applications")
    op.drop_column("job_applications", "deleted_at")
