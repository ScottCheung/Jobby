"""question community interactions

Revision ID: 20260720_0023
Revises: 20260720_0022
"""

from alembic import op
import sqlalchemy as sa


revision = "20260720_0023"
down_revision = "20260720_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_ratings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("importance_rating", sa.Integer(), nullable=True),
        sa.Column("difficulty_rating", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("question_id", "user_id", name="uq_question_rating_user"),
    )
    op.create_index("ix_question_ratings_question_id", "question_ratings", ["question_id"])
    op.create_index("ix_question_ratings_user_id", "question_ratings", ["user_id"])
    op.create_table(
        "question_reactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("value", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("question_id", "user_id", name="uq_question_reaction_user"),
    )
    op.create_index("ix_question_reactions_question_id", "question_reactions", ["question_id"])
    op.create_index("ix_question_reactions_user_id", "question_reactions", ["user_id"])
    op.create_table(
        "question_comments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="discussion"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["question_comments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_comments_question_id", "question_comments", ["question_id"])
    op.create_index("ix_question_comments_user_id", "question_comments", ["user_id"])
    op.create_index("ix_question_comments_parent_id", "question_comments", ["parent_id"])


def downgrade() -> None:
    op.drop_table("question_comments")
    op.drop_table("question_reactions")
    op.drop_table("question_ratings")
