"""add persisted question recommendation score

Revision ID: 20260725_0044
Revises: 20260725_0043
Create Date: 2026-07-25 16:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260725_0044"
down_revision = "20260725_0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "question_metrics",
        sa.Column(
            "hot_score",
            sa.Numeric(12, 4),
            nullable=False,
            server_default="1",
        ),
    )
    op.create_index(
        "ix_question_metrics_hot_score",
        "question_metrics",
        ["hot_score"],
    )
    op.execute(
        """
        UPDATE question_metrics
        SET hot_score = GREATEST(
            0,
            1
            + ln(1 + view_count) * 0.08
            + ln(1 + practice_count) * 1.2
            + ln(1 + favorite_count) * 1.6
            + ln(1 + upvote_count) * 1.3
            - ln(1 + downvote_count) * 1.5
            + ln(1 + seen_in_interview_count) * 3.0
            + ln(1 + company_count) * 1.2
            + ln(1 + comment_count) * 0.35
            + (
                coalesce(blended_importance_score, 0)
                + coalesce(blended_frequency_score, 0)
              ) * 2.0
              / CASE
                  WHEN blended_importance_score IS NULL
                    AND blended_frequency_score IS NULL
                  THEN 1
                  WHEN blended_importance_score IS NULL
                    OR blended_frequency_score IS NULL
                  THEN 1
                  ELSE 2
                END
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_question_metrics_hot_score", table_name="question_metrics")
    op.drop_column("question_metrics", "hot_score")
