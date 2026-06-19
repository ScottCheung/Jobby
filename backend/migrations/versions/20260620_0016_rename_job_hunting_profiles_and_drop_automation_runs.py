"""rename search_profiles to job_hunting_profiles and drop automation_runs

Revision ID: 20260620_0016
Revises: 20260620_0015
Create Date: 2026-06-20 21:10:00.000000
"""

from alembic import op


revision = "20260620_0016"
down_revision = "20260620_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_automation_runs_status", table_name="automation_runs")
    op.drop_index("ix_automation_runs_user_id", table_name="automation_runs")
    op.drop_table("automation_runs")

    op.drop_index("ix_search_profiles_user_id", table_name="search_profiles")
    op.rename_table("search_profiles", "job_hunting_profiles")
    op.create_index(
        "ix_job_hunting_profiles_user_id",
        "job_hunting_profiles",
        ["user_id"],
    )


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for 20260620_0016")
