"""short-lived browser extension connection sessions

Revision ID: 20260802_0057
Revises: 20260801_0056
Create Date: 2026-08-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector


revision = "20260802_0057"
down_revision = "20260801_0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = Inspector.from_engine(op.get_bind())
    if "extension_sessions" in inspector.get_table_names():
        return

    op.create_table(
        "extension_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("code_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("code_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("token_hash", sa.String(length=128), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_extension_sessions_user_id", "extension_sessions", ["user_id"])
    op.create_index("ix_extension_sessions_code_hash", "extension_sessions", ["code_hash"], unique=True)
    op.create_index("ix_extension_sessions_token_hash", "extension_sessions", ["token_hash"], unique=True)


def downgrade() -> None:
    inspector = Inspector.from_engine(op.get_bind())
    if "extension_sessions" not in inspector.get_table_names():
        return
    op.drop_index("ix_extension_sessions_token_hash", table_name="extension_sessions")
    op.drop_index("ix_extension_sessions_code_hash", table_name="extension_sessions")
    op.drop_index("ix_extension_sessions_user_id", table_name="extension_sessions")
    op.drop_table("extension_sessions")
