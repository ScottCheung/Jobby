"""add gamification inventory, active boosters and claimed stage days

Revision ID: 20260723_0035
Revises: 20260722_0034
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260723_0035"
down_revision = "20260722_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_gamification",
        sa.Column(
            "inventory",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "user_gamification",
        sa.Column(
            "active_boosters",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "practice_plans",
        sa.Column(
            "claimed_stage_days",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("practice_plans", "claimed_stage_days")
    op.drop_column("user_gamification", "active_boosters")
    op.drop_column("user_gamification", "inventory")
