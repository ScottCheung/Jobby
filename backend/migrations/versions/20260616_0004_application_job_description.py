"""application job description

Revision ID: 20260616_0004
Revises: 20260616_0003
Create Date: 2026-06-16 13:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = "20260616_0004"
down_revision = "20260616_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_applications", sa.Column("job_description", sa.Text()))
    op.execute(
        """
        UPDATE job_applications
        SET job_description = NULLIF(raw_data ->> 'description', '')
        WHERE job_description IS NULL
          AND raw_data ? 'description'
        """
    )


def downgrade() -> None:
    op.drop_column("job_applications", "job_description")
