"""gamification admin config

Revision ID: 20260717_0018
Revises: f8bbe3ae79eb
Create Date: 2026-07-17 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260717_0018"
down_revision = "f8bbe3ae79eb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gamification_configs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("scope", sa.String(length=50), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_by_user_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scope"),
    )


def downgrade() -> None:
    op.drop_table("gamification_configs")
