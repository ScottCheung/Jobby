"""move application inputs into search_profiles

Revision ID: 20260620_0014
Revises: 20260620_0013
Create Date: 2026-06-20 18:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260620_0014"
down_revision = "20260620_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("search_profiles", sa.Column("years_of_experience", sa.String(length=50), nullable=True))
    op.add_column("search_profiles", sa.Column("require_visa", sa.String(length=50), nullable=True))
    op.add_column("search_profiles", sa.Column("website", sa.String(length=500), nullable=True))
    op.add_column("search_profiles", sa.Column("linkedin_url", sa.String(length=500), nullable=True))
    op.add_column("search_profiles", sa.Column("resume_path", sa.Text(), nullable=True))
    op.add_column("search_profiles", sa.Column("us_citizenship", sa.String(length=255), nullable=True))
    op.add_column("search_profiles", sa.Column("desired_salary", sa.Numeric(12, 2), nullable=True))
    op.add_column("search_profiles", sa.Column("current_ctc", sa.Numeric(12, 2), nullable=True))
    op.add_column("search_profiles", sa.Column("notice_period", sa.Integer(), nullable=True))
    op.add_column("search_profiles", sa.Column("linkedin_headline", sa.String(length=500), nullable=True))
    op.add_column("search_profiles", sa.Column("linkedin_summary", sa.Text(), nullable=True))
    op.add_column("search_profiles", sa.Column("cover_letter", sa.Text(), nullable=True))
    op.add_column("search_profiles", sa.Column("user_information_all", sa.Text(), nullable=True))
    op.add_column("search_profiles", sa.Column("recent_employer", sa.String(length=255), nullable=True))
    op.add_column("search_profiles", sa.Column("confidence_level", sa.String(length=50), nullable=True))
    op.add_column(
        "search_profiles",
        sa.Column(
            "extra_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.execute(
        """
        UPDATE search_profiles AS sp
        SET
            years_of_experience = jp.years_of_experience,
            require_visa = jp.require_visa,
            website = jp.website,
            linkedin_url = jp.linkedin_url,
            resume_path = jp.resume_path,
            us_citizenship = jp.us_citizenship,
            desired_salary = jp.desired_salary,
            current_ctc = jp.current_ctc,
            notice_period = jp.notice_period,
            linkedin_headline = jp.linkedin_headline,
            linkedin_summary = jp.linkedin_summary,
            cover_letter = jp.cover_letter,
            user_information_all = jp.user_information_all,
            recent_employer = jp.recent_employer,
            confidence_level = jp.confidence_level,
            extra_data = COALESCE(jp.extra_data, '{}'::jsonb)
        FROM job_preferences AS jp
        WHERE sp.user_id = jp.user_id
        """
    )

    op.alter_column("search_profiles", "extra_data", server_default=None)


def downgrade() -> None:
    op.drop_column("search_profiles", "extra_data")
    op.drop_column("search_profiles", "confidence_level")
    op.drop_column("search_profiles", "recent_employer")
    op.drop_column("search_profiles", "user_information_all")
    op.drop_column("search_profiles", "cover_letter")
    op.drop_column("search_profiles", "linkedin_summary")
    op.drop_column("search_profiles", "linkedin_headline")
    op.drop_column("search_profiles", "notice_period")
    op.drop_column("search_profiles", "current_ctc")
    op.drop_column("search_profiles", "desired_salary")
    op.drop_column("search_profiles", "us_citizenship")
    op.drop_column("search_profiles", "resume_path")
    op.drop_column("search_profiles", "linkedin_url")
    op.drop_column("search_profiles", "website")
    op.drop_column("search_profiles", "require_visa")
    op.drop_column("search_profiles", "years_of_experience")
