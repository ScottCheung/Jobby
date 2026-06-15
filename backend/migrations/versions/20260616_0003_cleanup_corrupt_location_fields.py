"""cleanup corrupt application location fields

Revision ID: 20260616_0003
Revises: 20260616_0002
Create Date: 2026-06-16 12:30:00
"""
from alembic import op


revision = "20260616_0003"
down_revision = "20260616_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE job_applications
        SET work_style = NULL
        WHERE work_style IS NOT NULL
          AND lower(work_style) NOT IN ('remote', 'hybrid', 'on-site', 'onsite')
        """
    )
    op.execute(
        """
        UPDATE job_applications
        SET work_location = NULL
        WHERE work_location IS NOT NULL
          AND (
            trim(work_location) = ''
            OR work_location = company
            OR position(lower(work_location) in lower(coalesce(company, ''))) > 0
          )
        """
    )


def downgrade() -> None:
    pass
