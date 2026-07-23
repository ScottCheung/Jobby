"""add question answers and metrics foundation

Revision ID: 20260721_0032
Revises: 405f61ad397d
Create Date: 2026-07-21 13:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4


revision = "20260721_0032"
down_revision = "405f61ad397d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    op.add_column("interview_questions", sa.Column("author_frequency", sa.String(length=50), nullable=True))
    op.add_column("interview_questions", sa.Column("author_importance_score", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE interview_questions
        SET author_frequency = frequency,
            author_importance_score = importance_score
        """
    )

    op.add_column("user_questions", sa.Column("is_favorited", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("user_questions", sa.Column("first_viewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_questions", sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_questions", sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_questions", sa.Column("first_practiced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_questions", sa.Column("last_practiced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_questions", sa.Column("practice_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_questions", sa.Column("total_practice_seconds", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("question_ratings", sa.Column("frequency_rating", sa.Integer(), nullable=True))

    op.add_column("practice_records", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("practice_records", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("practice_records", sa.Column("duration_seconds", sa.Integer(), nullable=True))

    op.create_table(
        "question_metrics",
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_viewer_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("practice_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_practicer_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_practice_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_practice_seconds", sa.Integer(), nullable=True),
        sa.Column("favorite_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("upvote_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("downvote_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("seen_in_interview_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("company_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("difficulty_average", sa.Numeric(4, 2), nullable=True),
        sa.Column("importance_average", sa.Numeric(4, 2), nullable=True),
        sa.Column("frequency_average", sa.Numeric(4, 2), nullable=True),
        sa.Column("blended_importance_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("blended_frequency_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("top_companies", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("last_aggregated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("question_id"),
    )
    # Give every existing question its single aggregate row. The API refreshes
    # the values on relevant writes and when the community summary is read.
    op.execute(
        """
        INSERT INTO question_metrics (question_id)
        SELECT id FROM interview_questions
        """
    )

    op.create_table(
        "question_answers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("author_user_id", sa.UUID(), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=False, server_default="author"),
        sa.Column("answer_type", sa.String(length=30), nullable=False, server_default="reference"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="published"),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("recommended_by_user_id", sa.UUID(), nullable=True),
        sa.Column("recommended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recommended_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_answers_question_id", "question_answers", ["question_id"])
    op.create_index("ix_question_answers_author_user_id", "question_answers", ["author_user_id"])
    op.create_index("ix_question_answers_recommended_by_user_id", "question_answers", ["recommended_by_user_id"])

    op.create_table(
        "question_answer_reactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("answer_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("value", sa.String(length=10), nullable=False, server_default="up"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["answer_id"], ["question_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("answer_id", "user_id", name="uq_question_answer_reaction_user"),
    )
    op.create_index("ix_question_answer_reactions_answer_id", "question_answer_reactions", ["answer_id"])
    op.create_index("ix_question_answer_reactions_user_id", "question_answer_reactions", ["user_id"])

    questions = bind.execute(
        sa.text(
            """
            SELECT id, user_id, answer_objective, answer_framework, sample_answer
            FROM interview_questions
            """
        )
    ).mappings().all()
    question_answers = sa.table(
        "question_answers",
        sa.column("id", sa.UUID()),
        sa.column("question_id", sa.UUID()),
        sa.column("author_user_id", sa.UUID()),
        sa.column("source", sa.String()),
        sa.column("answer_type", sa.String()),
        sa.column("status", sa.String()),
        sa.column("title", sa.String()),
        sa.column("body", sa.Text()),
        sa.column("metadata", postgresql.JSONB(astext_type=sa.Text())),
        sa.column("is_recommended", sa.Boolean()),
        sa.column("recommended_by_user_id", sa.UUID()),
        sa.column("recommended_at", sa.DateTime(timezone=True)),
    )
    inserts = []
    legacy_fields = (
        ("answer_objective", "reference", "Author Reference Answer"),
        ("answer_framework", "framework", "Author Framework"),
        ("sample_answer", "reference", "Legacy Sample Answer"),
    )
    for question in questions:
        for field_name, answer_type, title in legacy_fields:
            body = (question[field_name] or "").strip()
            if not body:
                continue
            inserts.append(
                {
                    "id": uuid4(),
                    "question_id": question["id"],
                    "author_user_id": question["user_id"],
                    "source": "author",
                    "answer_type": answer_type,
                    "status": "published",
                    "title": title,
                    "body": body,
                    "metadata": {"legacy_field": field_name},
                    "is_recommended": False,
                    "recommended_by_user_id": None,
                    "recommended_at": None,
                }
            )
    if inserts:
        op.bulk_insert(question_answers, inserts)


def downgrade() -> None:
    op.drop_index("ix_question_answer_reactions_user_id", table_name="question_answer_reactions")
    op.drop_index("ix_question_answer_reactions_answer_id", table_name="question_answer_reactions")
    op.drop_table("question_answer_reactions")

    op.drop_index("ix_question_answers_recommended_by_user_id", table_name="question_answers")
    op.drop_index("ix_question_answers_author_user_id", table_name="question_answers")
    op.drop_index("ix_question_answers_question_id", table_name="question_answers")
    op.drop_table("question_answers")

    op.drop_table("question_metrics")

    op.drop_column("practice_records", "duration_seconds")
    op.drop_column("practice_records", "submitted_at")
    op.drop_column("practice_records", "started_at")

    op.drop_column("question_ratings", "frequency_rating")

    op.drop_column("user_questions", "total_practice_seconds")
    op.drop_column("user_questions", "practice_count")
    op.drop_column("user_questions", "last_practiced_at")
    op.drop_column("user_questions", "first_practiced_at")
    op.drop_column("user_questions", "view_count")
    op.drop_column("user_questions", "last_viewed_at")
    op.drop_column("user_questions", "first_viewed_at")
    op.drop_column("user_questions", "is_favorited")

    op.drop_column("interview_questions", "author_importance_score")
    op.drop_column("interview_questions", "author_frequency")
