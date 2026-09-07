"""associate usage records with users when available

Revision ID: 20260908_0074
Revises: 20260908_0073
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260908_0074"
down_revision = "20260908_0073"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "llm_usage",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_llm_usage_user_id", "llm_usage", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_llm_usage_user_id", table_name="llm_usage")
    op.drop_column("llm_usage", "user_id")
