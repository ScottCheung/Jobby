"""denormalize question interview report summaries

Revision ID: 20260720_0025
Revises: 20260720_0024
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260720_0025"
down_revision = "20260720_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_interview_report_summaries",
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("report_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("company_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("top_companies", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("question_id"),
    )


def downgrade() -> None:
    op.drop_table("question_interview_report_summaries")
