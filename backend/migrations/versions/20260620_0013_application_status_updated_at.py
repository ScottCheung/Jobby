"""add application status_updated_at

Revision ID: 20260620_0013
Revises: 20260619_0012
Create Date: 2026-06-20 09:30:00
"""
from alembic import op
import sqlalchemy as sa


revision = "20260620_0013"
down_revision = "20260619_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "job_applications",
        sa.Column("status_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_job_applications_status_updated_at",
        "job_applications",
        ["status_updated_at"],
    )

    op.execute(
        """
        UPDATE job_applications
        SET status_updated_at = COALESCE(
            CASE
                WHEN raw_data ? 'timeline'
                 AND jsonb_typeof(raw_data -> 'timeline') = 'array'
                THEN (
                    SELECT NULLIF(entry ->> 'timestamp', '')::timestamptz
                    FROM jsonb_array_elements(raw_data -> 'timeline') AS entry
                    WHERE COALESCE(entry ->> 'stage', '') <> ''
                    ORDER BY COALESCE(entry ->> 'timestamp', '') DESC
                    LIMIT 1
                )
                ELSE NULL
            END,
            CASE
                WHEN status = 'submitted' THEN date_applied
                ELSE updated_at
            END,
            created_at
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_job_applications_status_updated_at", table_name="job_applications")
    op.drop_column("job_applications", "status_updated_at")
