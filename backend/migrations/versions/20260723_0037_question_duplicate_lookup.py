"""add indexed question duplicate lookup

Revision ID: 20260723_0037
Revises: 20260723_0036
"""

from alembic import op
import sqlalchemy as sa


revision = "20260723_0037"
down_revision = "20260723_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "interview_questions",
        sa.Column("normalized_title", sa.String(length=500), nullable=True),
    )
    op.execute(
        """
        UPDATE interview_questions
        SET normalized_title = lower(
            btrim(
                regexp_replace(
                    regexp_replace(title, '[^[:alnum:]_[:space:]]', ' ', 'g'),
                    '[[:space:]]+', ' ', 'g'
                )
            )
        )
        WHERE normalized_title IS NULL
        """
    )
    op.create_index(
        "ix_interview_questions_normalized_title",
        "interview_questions",
        ["normalized_title"],
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        "ix_interview_questions_normalized_title_trgm",
        "interview_questions",
        ["normalized_title"],
        postgresql_using="gin",
        postgresql_ops={"normalized_title": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_interview_questions_normalized_title_trgm", table_name="interview_questions")
    op.drop_index("ix_interview_questions_normalized_title", table_name="interview_questions")
    op.drop_column("interview_questions", "normalized_title")
