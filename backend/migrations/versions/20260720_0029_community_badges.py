"""add optional community identity badge

Revision ID: 20260720_0029
Revises: 20260720_0028
"""

from alembic import op
import sqlalchemy as sa

revision = "20260720_0029"
down_revision = "20260720_0028"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("users", sa.Column("community_badge", sa.String(length=30), nullable=True))

def downgrade() -> None:
    op.drop_column("users", "community_badge")
