"""track the user's most recent product login

Revision ID: 20260725_0043
Revises: 20260725_0042
Create Date: 2026-07-25 14:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260725_0043"
down_revision = "20260725_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
