"""add ai answer unlocks and practice evaluations

Revision ID: 20260722_0034
Revises: 20260721_0033
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260722_0034"
down_revision = "20260721_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_answer_unlocks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("answer_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("coins_spent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transaction_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["answer_id"], ["question_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["gamification_transactions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("answer_id", "user_id", name="uq_question_answer_unlock_user"),
    )
    op.create_index("ix_question_answer_unlocks_answer_id", "question_answer_unlocks", ["answer_id"])
    op.create_index("ix_question_answer_unlocks_user_id", "question_answer_unlocks", ["user_id"])

    op.create_table(
        "practice_evaluations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("practice_record_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="completed"),
        sa.Column("provider", sa.String(length=50), nullable=False, server_default="deepseek"),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("prompt_version", sa.String(length=50), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("coins_spent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transaction_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["practice_record_id"], ["practice_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["gamification_transactions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_practice_evaluations_practice_record_id", "practice_evaluations", ["practice_record_id"])
    op.create_index("ix_practice_evaluations_user_id", "practice_evaluations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_practice_evaluations_user_id", table_name="practice_evaluations")
    op.drop_index("ix_practice_evaluations_practice_record_id", table_name="practice_evaluations")
    op.drop_table("practice_evaluations")
    op.drop_index("ix_question_answer_unlocks_user_id", table_name="question_answer_unlocks")
    op.drop_index("ix_question_answer_unlocks_answer_id", table_name="question_answer_unlocks")
    op.drop_table("question_answer_unlocks")
