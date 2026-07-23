"""add answer social interactions

Revision ID: 20260721_0033
Revises: 20260721_0032
Create Date: 2026-07-21 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from uuid import uuid4


revision = "20260721_0033"
down_revision = "20260721_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_answer_comments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("answer_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["answer_id"], ["question_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["question_answer_comments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_question_answer_comments_answer_id",
        "question_answer_comments",
        ["answer_id"],
    )
    op.create_index(
        "ix_question_answer_comments_parent_id",
        "question_answer_comments",
        ["parent_id"],
    )
    op.create_index(
        "ix_question_answer_comments_user_id",
        "question_answer_comments",
        ["user_id"],
    )

    op.create_table(
        "question_answer_comment_likes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("comment_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["question_answer_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_question_answer_comment_like_user"),
    )
    op.create_index(
        "ix_question_answer_comment_likes_comment_id",
        "question_answer_comment_likes",
        ["comment_id"],
    )
    op.create_index(
        "ix_question_answer_comment_likes_user_id",
        "question_answer_comment_likes",
        ["user_id"],
    )

    op.create_table(
        "question_answer_comment_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("comment_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["question_answer_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_question_answer_comment_report_user"),
    )
    op.create_index(
        "ix_question_answer_comment_reports_comment_id",
        "question_answer_comment_reports",
        ["comment_id"],
    )
    op.create_index(
        "ix_question_answer_comment_reports_user_id",
        "question_answer_comment_reports",
        ["user_id"],
    )

    op.create_table(
        "question_answer_saves",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("answer_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["answer_id"], ["question_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("answer_id", "user_id", name="uq_question_answer_save_user"),
    )
    op.create_index(
        "ix_question_answer_saves_answer_id",
        "question_answer_saves",
        ["answer_id"],
    )
    op.create_index(
        "ix_question_answer_saves_user_id",
        "question_answer_saves",
        ["user_id"],
    )

    op.create_table(
        "question_answer_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("answer_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["answer_id"], ["question_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("answer_id", "user_id", name="uq_question_answer_report_user"),
    )
    op.create_index(
        "ix_question_answer_reports_answer_id",
        "question_answer_reports",
        ["answer_id"],
    )
    op.create_index(
        "ix_question_answer_reports_user_id",
        "question_answer_reports",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_question_answer_reports_user_id", table_name="question_answer_reports")
    op.drop_index("ix_question_answer_reports_answer_id", table_name="question_answer_reports")
    op.drop_table("question_answer_reports")

    op.drop_index("ix_question_answer_saves_user_id", table_name="question_answer_saves")
    op.drop_index("ix_question_answer_saves_answer_id", table_name="question_answer_saves")
    op.drop_table("question_answer_saves")

    op.drop_index("ix_question_answer_comment_reports_user_id", table_name="question_answer_comment_reports")
    op.drop_index("ix_question_answer_comment_reports_comment_id", table_name="question_answer_comment_reports")
    op.drop_table("question_answer_comment_reports")

    op.drop_index("ix_question_answer_comment_likes_user_id", table_name="question_answer_comment_likes")
    op.drop_index("ix_question_answer_comment_likes_comment_id", table_name="question_answer_comment_likes")
    op.drop_table("question_answer_comment_likes")

    op.drop_index("ix_question_answer_comments_user_id", table_name="question_answer_comments")
    op.drop_index("ix_question_answer_comments_parent_id", table_name="question_answer_comments")
    op.drop_index("ix_question_answer_comments_answer_id", table_name="question_answer_comments")
    op.drop_table("question_answer_comments")
