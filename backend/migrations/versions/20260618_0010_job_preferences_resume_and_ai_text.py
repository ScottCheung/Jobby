"""add resume_path and user_information_all to job_preferences

Revision ID: 20260618_0010
Revises: 20260617_0009
Create Date: 2026-06-18 14:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260618_0010"
down_revision = "20260617_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_preferences", sa.Column("resume_path", sa.Text(), nullable=True))
    op.add_column("job_preferences", sa.Column("user_information_all", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_preferences", "user_information_all")
    op.drop_column("job_preferences", "resume_path")
