"""collection cover storage key

Revision ID: 20260720_0021
Revises: 7a1d28edc725
"""

from alembic import op
import sqlalchemy as sa


revision = "20260720_0021"
down_revision = "7a1d28edc725"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_collections", sa.Column("cover_storage_key", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_collections", "cover_storage_key")
