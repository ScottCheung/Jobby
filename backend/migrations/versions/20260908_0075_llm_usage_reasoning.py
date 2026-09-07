"""add LLM reasoning usage metadata

Revision ID: 20260908_0075
Revises: 20260908_0074
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_0075"
down_revision = "20260908_0074"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("llm_usage", sa.Column("reasoning_tokens", sa.Integer(), nullable=True))
    op.add_column("llm_usage", sa.Column("reasoning_effort", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("llm_usage", "reasoning_effort")
    op.drop_column("llm_usage", "reasoning_tokens")
