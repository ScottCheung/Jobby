"""store evaluated resume snapshots

Revision ID: 20260728_0050
Revises: 20260728_0049
Create Date: 2026-07-28 07:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260728_0050"
down_revision = "20260728_0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_resume_evaluation_snapshots",
        sa.Column("resume_data", postgresql.JSONB(), nullable=True),
    )
def downgrade() -> None:
    op.drop_column("master_resume_evaluation_snapshots", "resume_data")
