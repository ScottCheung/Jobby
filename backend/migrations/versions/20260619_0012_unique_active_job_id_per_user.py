"""enforce unique active job id per user

Revision ID: 20260619_0012
Revises: 20260618_0011
Create Date: 2026-06-19 10:30:00
"""
from alembic import op


revision = "20260619_0012"
down_revision = "20260618_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE job_applications
        SET job_id = NULL
        WHERE job_id IS NOT NULL AND btrim(job_id) = ''
        """
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, btrim(job_id)
                    ORDER BY
                        COALESCE(date_applied, updated_at, created_at) DESC,
                        updated_at DESC,
                        created_at DESC,
                        id DESC
                ) AS row_num
            FROM job_applications
            WHERE deleted_at IS NULL
              AND job_id IS NOT NULL
              AND btrim(job_id) <> ''
        )
        UPDATE job_applications AS target
        SET deleted_at = COALESCE(target.deleted_at, NOW())
        FROM ranked
        WHERE target.id = ranked.id
          AND ranked.row_num > 1
        """
    )

    op.create_index(
        "uq_job_applications_user_id_job_id_active",
        "job_applications",
        ["user_id", "job_id"],
        unique=True,
        postgresql_where="deleted_at IS NULL AND job_id IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_job_applications_user_id_job_id_active", table_name="job_applications")
