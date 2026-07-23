"""store first-use AI question metadata

Revision ID: 20260723_0036
Revises: 20260723_0035
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260723_0036"
down_revision = "20260723_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "interview_questions",
        sa.Column("ai_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("interview_questions", "ai_metadata")
