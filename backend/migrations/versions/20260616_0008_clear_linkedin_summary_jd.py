"""clear linkedin public summary job descriptions

Revision ID: 20260616_0008
Revises: 20260616_0007
Create Date: 2026-06-16 14:45:00
"""
from alembic import op


revision = "20260616_0008"
down_revision = "20260616_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE job_applications
        SET job_description = NULL
        WHERE job_description ILIKE '%See this and similar jobs on LinkedIn%'
           OR job_description ILIKE '%…See this%'
        """
    )


def downgrade() -> None:
    pass
