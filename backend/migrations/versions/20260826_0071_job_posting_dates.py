"""store canonical first and latest job posting timestamps

Revision ID: 20260826_0071
Revises: 20260825_0070
"""

from alembic import op
import sqlalchemy as sa


revision = "20260826_0071"
down_revision = "20260825_0070"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("first_posted_at", sa.DateTime(timezone=True)))
    op.add_column("jobs", sa.Column("last_posted_at", sa.DateTime(timezone=True)))
    op.add_column("jobs", sa.Column("posting_observed_at", sa.DateTime(timezone=True)))
    op.add_column(
        "jobs",
        sa.Column("is_reposted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        r"""
        UPDATE jobs
        SET posting_observed_at = created_at,
            last_posted_at = CASE
                WHEN BTRIM(date_posted) ~ '^\d{4}-\d{2}-\d{2}([ T].*)?$'
                    THEN BTRIM(date_posted)::timestamptz
                WHEN BTRIM(date_posted) ~* '(today|just posted|just now)'
                    THEN created_at
                WHEN BTRIM(date_posted) ~* 'yesterday'
                    THEN created_at - INTERVAL '1 day'
                WHEN BTRIM(date_posted) ~* '\d+\s*(minutes?|mins?)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\s*(minutes?|mins?)', 'i'))[1]
                        || ' minutes'
                    )::interval
                WHEN BTRIM(date_posted) ~* '\d+\+\s*(days?|d)([[:space:]]|$)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\+\s*(days?|d)([[:space:]]|$)', 'i'))[1]
                        || ' days'
                    )::interval
                WHEN BTRIM(date_posted) ~* '\d+\s*(hours?|hrs?|h)([[:space:]]|$)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\s*(hours?|hrs?|h)([[:space:]]|$)', 'i'))[1]
                        || ' hours'
                    )::interval
                WHEN BTRIM(date_posted) ~* '\d+\s*(days?|d)\+?([[:space:]]|$)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\s*(days?|d)\+?([[:space:]]|$)', 'i'))[1]
                        || ' days'
                    )::interval
                WHEN BTRIM(date_posted) ~* '\d+\s*(weeks?|wks?|w)([[:space:]]|$)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\s*(weeks?|wks?|w)([[:space:]]|$)', 'i'))[1]
                        || ' weeks'
                    )::interval
                WHEN BTRIM(date_posted) ~* '\d+\s*(months?|mos?|mo)([[:space:]]|$)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\s*(months?|mos?|mo)([[:space:]]|$)', 'i'))[1]::int
                        * INTERVAL '30 days'
                    )
                WHEN BTRIM(date_posted) ~* '\d+\s*(years?|yrs?|y)([[:space:]]|$)'
                    THEN created_at - (
                        (regexp_match(BTRIM(date_posted), '(\d+)\s*(years?|yrs?|y)([[:space:]]|$)', 'i'))[1]
                        || ' years'
                    )::interval
                ELSE NULL
            END,
            is_reposted = BTRIM(date_posted) ~* '^reposted([[:space:]]|$)',
            raw_extracted_snapshot = jsonb_set(
                COALESCE(raw_extracted_snapshot, '{}'::jsonb),
                '{posting_date_raw}',
                jsonb_build_object('label', date_posted),
                true
            )
        WHERE NULLIF(BTRIM(date_posted), '') IS NOT NULL
        """
    )
    op.execute("UPDATE jobs SET first_posted_at = last_posted_at WHERE last_posted_at IS NOT NULL")
    op.drop_column("jobs", "date_posted")


def downgrade() -> None:
    op.add_column("jobs", sa.Column("date_posted", sa.String(length=100)))
    op.execute(
        "UPDATE jobs SET date_posted = last_posted_at::text WHERE last_posted_at IS NOT NULL"
    )
    op.drop_column("jobs", "is_reposted")
    op.drop_column("jobs", "posting_observed_at")
    op.drop_column("jobs", "last_posted_at")
    op.drop_column("jobs", "first_posted_at")
