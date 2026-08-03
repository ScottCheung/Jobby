"""allow resume re-evaluation history

Revision ID: 20260728_0049
Revises: 20260728_0048
Create Date: 2026-07-28 06:10:00.000000
"""

from alembic import op


revision = "20260728_0049"
down_revision = "20260728_0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_master_resume_evaluation_version",
        "master_resume_evaluation_snapshots",
        type_="unique",
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_master_resume_evaluation_version",
        "master_resume_evaluation_snapshots",
        ["master_resume_id", "resume_version"],
    )
