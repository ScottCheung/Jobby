"""add structured master resume storage

Revision ID: 20260727_0045
Revises: 20260725_0044
Create Date: 2026-07-27 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260727_0045"
down_revision = "20260725_0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "master_resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("original_storage_key", sa.String(length=1024), nullable=False),
        sa.Column("original_url", sa.String(length=2048), nullable=False),
        sa.Column("resume_data", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="review"),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
def downgrade() -> None:
    op.drop_table("master_resumes")
