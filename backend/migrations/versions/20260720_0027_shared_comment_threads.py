"""share comment threads between equivalent questions

Revision ID: 20260720_0027
Revises: 20260720_0026
"""

from alembic import op
import sqlalchemy as sa


revision = "20260720_0027"
down_revision = "20260720_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_questions", sa.Column("community_thread_key", sa.String(length=64), nullable=True))
    op.create_index("ix_interview_questions_community_thread_key", "interview_questions", ["community_thread_key"])
    op.add_column("question_comments", sa.Column("community_thread_key", sa.String(length=64), nullable=True))
    op.create_index("ix_question_comments_community_thread_key", "question_comments", ["community_thread_key"])
    op.execute("""
        UPDATE interview_questions
        SET community_thread_key = md5(lower(btrim(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', ' ', 'g'), '\\s+', ' ', 'g'))))
    """)
    op.execute("""
        UPDATE question_comments AS comment
        SET community_thread_key = question.community_thread_key
        FROM interview_questions AS question
        WHERE comment.question_id = question.id
    """)


def downgrade() -> None:
    op.drop_index("ix_question_comments_community_thread_key", table_name="question_comments")
    op.drop_column("question_comments", "community_thread_key")
    op.drop_index("ix_interview_questions_community_thread_key", table_name="interview_questions")
    op.drop_column("interview_questions", "community_thread_key")
