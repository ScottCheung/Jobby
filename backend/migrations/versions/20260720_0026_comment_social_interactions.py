"""add social comment interactions

Revision ID: 20260720_0026
Revises: 20260720_0025
"""

from alembic import op
import sqlalchemy as sa


revision = "20260720_0026"
down_revision = "20260720_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=2048), nullable=True))
    op.add_column("question_comments", sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "question_comment_likes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("comment_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["question_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_question_comment_like_user"),
    )
    op.create_index("ix_question_comment_likes_comment_id", "question_comment_likes", ["comment_id"])
    op.create_index("ix_question_comment_likes_user_id", "question_comment_likes", ["user_id"])
    op.create_table(
        "question_comment_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("comment_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["question_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_question_comment_report_user"),
    )
    op.create_index("ix_question_comment_reports_comment_id", "question_comment_reports", ["comment_id"])
    op.create_index("ix_question_comment_reports_user_id", "question_comment_reports", ["user_id"])


def downgrade() -> None:
    op.drop_table("question_comment_reports")
    op.drop_table("question_comment_likes")
    op.drop_column("question_comments", "is_anonymous")
    op.drop_column("users", "avatar_url")
