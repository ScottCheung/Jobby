"""prospects and prospect_agent_logs

Revision ID: 20260801_0056
Revises: 20260730_0055
Create Date: 2026-08-01 13:34:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector

revision = "20260801_0056"
down_revision = "20260730_0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    if "prospects" not in existing_tables:
        op.create_table(
            "prospects",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("company", sa.String(length=255), nullable=False),
            sa.Column("linkedin_url", sa.Text(), nullable=True),
            sa.Column("role_type", sa.String(length=50), nullable=False, server_default="hiring_manager"),
            sa.Column("location", sa.String(length=255), nullable=True),
            sa.Column("has_active_job", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("active_job_title", sa.String(length=255), nullable=True),
            sa.Column("active_job_url", sa.Text(), nullable=True),
            sa.Column("priority_score", sa.Integer(), nullable=False, server_default="80"),
            sa.Column("match_level", sa.String(length=20), nullable=False, server_default="high"),
            sa.Column("recommendation_reason", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="recommended"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("last_interacted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    if "prospect_agent_logs" not in existing_tables:
        op.create_table(
            "prospect_agent_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
            sa.Column("prospects_found", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("prospects_added", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("logs", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    if "prospect_agent_logs" in existing_tables:
        op.drop_table("prospect_agent_logs")
    if "prospects" in existing_tables:
        op.drop_table("prospects")
