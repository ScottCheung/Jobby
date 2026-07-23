"""audio storage key

Revision ID: 20260720_0022
Revises: 20260720_0021
"""

from alembic import op
import sqlalchemy as sa


revision = "20260720_0022"
down_revision = "20260720_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audio_records", sa.Column("storage_key", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("audio_records", "storage_key")
