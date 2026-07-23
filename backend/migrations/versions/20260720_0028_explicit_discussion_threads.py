"""replace title-derived comment threads with explicit threads

Revision ID: 20260720_0028
Revises: 20260720_0027
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "20260720_0028"
down_revision = "20260720_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_discussion_threads",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("canonical_question_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["canonical_question_id"], ["interview_questions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canonical_question_id"),
    )
    op.create_index("ix_question_discussion_threads_canonical_question_id", "question_discussion_threads", ["canonical_question_id"])
    op.add_column("interview_questions", sa.Column("discussion_thread_id", sa.UUID(), nullable=True))
    op.create_index("ix_interview_questions_discussion_thread_id", "interview_questions", ["discussion_thread_id"])
    op.create_foreign_key("fk_interview_questions_discussion_thread", "interview_questions", "question_discussion_threads", ["discussion_thread_id"], ["id"], ondelete="SET NULL")
    op.add_column("question_comments", sa.Column("discussion_thread_id", sa.UUID(), nullable=True))
    op.create_index("ix_question_comments_discussion_thread_id", "question_comments", ["discussion_thread_id"])
    op.create_foreign_key("fk_question_comments_discussion_thread", "question_comments", "question_discussion_threads", ["discussion_thread_id"], ["id"], ondelete="CASCADE")

    bind = op.get_bind()
    questions = bind.execute(sa.text("SELECT id FROM interview_questions")).mappings().all()
    for question in questions:
        thread_id = uuid4()
        bind.execute(
            sa.text("INSERT INTO question_discussion_threads (id, canonical_question_id) VALUES (:thread_id, :question_id)"),
            {"thread_id": thread_id, "question_id": question["id"]},
        )
        bind.execute(
            sa.text("UPDATE interview_questions SET discussion_thread_id = :thread_id WHERE id = :question_id"),
            {"thread_id": thread_id, "question_id": question["id"]},
        )
    op.execute("""
        UPDATE question_comments AS comment
        SET discussion_thread_id = question.discussion_thread_id
        FROM interview_questions AS question
        WHERE comment.question_id = question.id
    """)
    op.alter_column("question_comments", "discussion_thread_id", nullable=False)
    op.drop_index("ix_question_comments_community_thread_key", table_name="question_comments")
    op.drop_column("question_comments", "community_thread_key")
    op.drop_index("ix_interview_questions_community_thread_key", table_name="interview_questions")
    op.drop_column("interview_questions", "community_thread_key")


def downgrade() -> None:
    op.add_column("interview_questions", sa.Column("community_thread_key", sa.String(length=64), nullable=True))
    op.create_index("ix_interview_questions_community_thread_key", "interview_questions", ["community_thread_key"])
    op.add_column("question_comments", sa.Column("community_thread_key", sa.String(length=64), nullable=True))
    op.create_index("ix_question_comments_community_thread_key", "question_comments", ["community_thread_key"])
    op.drop_constraint("fk_question_comments_discussion_thread", "question_comments", type_="foreignkey")
    op.drop_index("ix_question_comments_discussion_thread_id", table_name="question_comments")
    op.drop_column("question_comments", "discussion_thread_id")
    op.drop_constraint("fk_interview_questions_discussion_thread", "interview_questions", type_="foreignkey")
    op.drop_index("ix_interview_questions_discussion_thread_id", table_name="interview_questions")
    op.drop_column("interview_questions", "discussion_thread_id")
    op.drop_table("question_discussion_threads")
