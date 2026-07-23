"""add theme to question sets

Revision ID: 20260724_0039
Revises: 20260724_0038
Create Date: 2026-07-24 16:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260724_0039"
down_revision = "20260724_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_collections", sa.Column("theme", sa.String(length=50), nullable=True))
    op.create_index("ix_interview_collections_theme", "interview_collections", ["theme"])


def downgrade() -> None:
    op.drop_index("ix_interview_collections_theme", table_name="interview_collections")
    op.drop_column("interview_collections", "theme")
