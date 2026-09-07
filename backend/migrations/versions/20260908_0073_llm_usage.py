"""add normalized LLM usage records

Revision ID: 20260908_0073
Revises: 20260828_0072
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260908_0073"
down_revision = "20260828_0072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("operation", sa.String(length=80), nullable=False),
        sa.Column("correlation_id", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("cached_input_tokens", sa.Integer()),
        sa.Column("estimated_cost_usd", sa.Numeric(precision=14, scale=8)),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_llm_usage_operation", "llm_usage", ["operation"])
    op.create_index("ix_llm_usage_correlation_id", "llm_usage", ["correlation_id"])
    op.create_index("ix_llm_usage_created_at", "llm_usage", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_llm_usage_created_at", table_name="llm_usage")
    op.drop_index("ix_llm_usage_correlation_id", table_name="llm_usage")
    op.drop_index("ix_llm_usage_operation", table_name="llm_usage")
    op.drop_table("llm_usage")
