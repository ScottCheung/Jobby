"""clear all stored work style values

Revision ID: 20260617_0009
Revises: 20260616_0008
Create Date: 2026-06-17 06:40:00
"""
from alembic import op


revision = "20260617_0009"
down_revision = "20260616_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE job_applications
        SET work_style = NULL
        WHERE work_style IS NOT NULL
        """
    )


def downgrade() -> None:
    pass
