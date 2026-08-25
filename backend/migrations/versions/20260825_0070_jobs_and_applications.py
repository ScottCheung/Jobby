"""separate jobs from job applications and add correction audit history

Revision ID: 20260825_0070
Revises: 20260823_0069
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260825_0070"
down_revision = "20260823_0069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False, server_default="generic"),
        sa.Column("external_id", sa.String(length=255)),
        sa.Column("url", sa.Text()),
        sa.Column("normalized_url", sa.Text()),
        sa.Column("url_hash", sa.String(length=64)),
        sa.Column("title", sa.Text()),
        sa.Column("company", sa.String(length=255)),
        sa.Column("location", sa.String(length=255)),
        sa.Column("description", sa.Text()),
        sa.Column("technologies", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("date_posted", sa.String(length=100)),
        sa.Column("raw_extracted_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "uq_jobs_platform_external_id",
        "jobs",
        ["platform", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )
    op.create_index(
        "uq_jobs_url_hash",
        "jobs",
        ["url_hash"],
        unique=True,
        postgresql_where=sa.text("url_hash IS NOT NULL"),
    )
    op.create_index("ix_jobs_company", "jobs", ["company"])

    op.add_column("job_applications", sa.Column("job_ref_id", postgresql.UUID(as_uuid=True)))

    op.execute(
        """
        WITH source AS (
            SELECT
                ja.*,
                CASE
                    WHEN NULLIF(BTRIM(ja.job_id), '') IS NOT NULL
                        THEN 'external:' || COALESCE(NULLIF(BTRIM(LOWER(ja.platform)), ''), 'generic') || ':' || BTRIM(ja.job_id)
                    WHEN NULLIF(BTRIM(ja.job_link), '') IS NOT NULL
                        THEN 'url:' || ENCODE(DIGEST(REGEXP_REPLACE(LOWER(SPLIT_PART(BTRIM(ja.job_link), '#', 1)), '/+$', ''), 'sha256'), 'hex')
                    ELSE 'application:' || ja.id::text
                END AS identity_key,
                CASE
                    WHEN NULLIF(BTRIM(ja.job_link), '') IS NOT NULL
                        THEN REGEXP_REPLACE(LOWER(SPLIT_PART(BTRIM(ja.job_link), '#', 1)), '/+$', '')
                    ELSE NULL
                END AS normalized_job_link
            FROM job_applications AS ja
        ), aggregated AS (
            SELECT
                identity_key,
                (ARRAY_AGG(id ORDER BY updated_at DESC, created_at DESC))[1] AS legacy_application_id,
                COALESCE(
                    (ARRAY_AGG(NULLIF(BTRIM(LOWER(platform)), '') ORDER BY updated_at DESC)
                        FILTER (WHERE NULLIF(BTRIM(platform), '') IS NOT NULL))[1],
                    'generic'
                ) AS platform,
                (ARRAY_AGG(NULLIF(BTRIM(job_id), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(job_id), '') IS NOT NULL))[1] AS external_id,
                (ARRAY_AGG(NULLIF(BTRIM(job_link), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(job_link), '') IS NOT NULL))[1] AS url,
                (ARRAY_AGG(normalized_job_link ORDER BY updated_at DESC)
                    FILTER (WHERE normalized_job_link IS NOT NULL))[1] AS normalized_url,
                (ARRAY_AGG(NULLIF(BTRIM(title), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(title), '') IS NOT NULL))[1] AS title,
                (ARRAY_AGG(NULLIF(BTRIM(company), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(company), '') IS NOT NULL))[1] AS company,
                (ARRAY_AGG(NULLIF(BTRIM(work_location), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(work_location), '') IS NOT NULL))[1] AS location,
                (ARRAY_AGG(NULLIF(BTRIM(job_description), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(job_description), '') IS NOT NULL))[1] AS description,
                (ARRAY_AGG(NULLIF(BTRIM(date_posted), '') ORDER BY updated_at DESC)
                    FILTER (WHERE NULLIF(BTRIM(date_posted), '') IS NOT NULL))[1] AS date_posted,
                MIN(created_at) AS created_at,
                MAX(updated_at) AS updated_at
            FROM source
            GROUP BY identity_key
        )
        INSERT INTO jobs (
            id,
            platform,
            external_id,
            url,
            normalized_url,
            url_hash,
            title,
            company,
            location,
            description,
            technologies,
            date_posted,
            raw_extracted_snapshot,
            revision,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            platform,
            external_id,
            url,
            normalized_url,
            CASE
                WHEN external_id IS NULL AND normalized_url IS NOT NULL
                    THEN ENCODE(DIGEST(normalized_url, 'sha256'), 'hex')
                ELSE NULL
            END,
            title,
            company,
            location,
            description,
            '[]'::jsonb,
            date_posted,
            JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
                'source', 'legacy_migration',
                'legacy_application_id', legacy_application_id,
                'platform', platform,
                'external_id', external_id,
                'url', url,
                'title', title,
                'company', company,
                'location', location,
                'description', description,
                'technologies', '[]'::jsonb,
                'date_posted', date_posted
            )),
            1,
            created_at,
            updated_at
        FROM aggregated
        """
    )

    op.execute(
        """
        UPDATE job_applications AS ja
        SET job_ref_id = job.id
        FROM jobs AS job
        WHERE ja.job_ref_id IS NULL
          AND NULLIF(BTRIM(ja.job_id), '') IS NOT NULL
          AND job.platform = COALESCE(NULLIF(BTRIM(LOWER(ja.platform)), ''), 'generic')
          AND job.external_id = BTRIM(ja.job_id)
        """
    )
    op.execute(
        """
        UPDATE job_applications AS ja
        SET job_ref_id = job.id
        FROM jobs AS job
        WHERE ja.job_ref_id IS NULL
          AND NULLIF(BTRIM(ja.job_link), '') IS NOT NULL
          AND job.url_hash = ENCODE(DIGEST(REGEXP_REPLACE(LOWER(SPLIT_PART(BTRIM(ja.job_link), '#', 1)), '/+$', ''), 'sha256'), 'hex')
        """
    )
    op.execute(
        """
        UPDATE job_applications AS ja
        SET job_ref_id = job.id
        FROM jobs AS job
        WHERE ja.job_ref_id IS NULL
          AND job.raw_extracted_snapshot->>'legacy_application_id' = ja.id::text
        """
    )
    op.alter_column("job_applications", "job_ref_id", nullable=False)
    op.create_foreign_key(
        "fk_job_applications_job_id_jobs",
        "job_applications",
        "jobs",
        ["job_ref_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.drop_index("uq_job_applications_user_id_job_id_active", table_name="job_applications")
    op.drop_index("ix_job_applications_job_id", table_name="job_applications")
    op.drop_index("ix_job_applications_company", table_name="job_applications")
    for column in (
        "job_id",
        "platform",
        "title",
        "company",
        "work_location",
        "job_link",
        "date_posted",
        "job_description",
    ):
        op.drop_column("job_applications", column)
    op.alter_column("job_applications", "job_ref_id", new_column_name="job_id")
    op.create_index("ix_job_applications_job_id", "job_applications", ["job_id"])
    op.create_index(
        "uq_job_applications_user_id_job_id_active",
        "job_applications",
        ["user_id", "job_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_job_app_user_status_date",
        "job_applications",
        ["user_id", "deleted_at", "status", "date_applied"],
    )

    op.create_table(
        "job_extraction_corrections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_application_id", postgresql.UUID(as_uuid=True)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("base_revision", sa.Integer(), nullable=False),
        sa.Column("resulting_revision", sa.Integer(), nullable=False),
        sa.Column("original", postgresql.JSONB(), nullable=False),
        sa.Column("modified", postgresql.JSONB(), nullable=False),
        sa.Column("changed_fields", postgresql.ARRAY(sa.String(length=50)), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="browser_extension"),
        sa.Column("idempotency_key", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_application_id"], ["job_applications.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_job_extraction_corrections_job_created",
        "job_extraction_corrections",
        ["job_id", "created_at"],
    )
    op.create_index(
        "uq_job_extraction_corrections_idempotency",
        "job_extraction_corrections",
        ["job_id", "user_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_job_extraction_corrections_idempotency", table_name="job_extraction_corrections")
    op.drop_index("ix_job_extraction_corrections_job_created", table_name="job_extraction_corrections")
    op.drop_table("job_extraction_corrections")

    op.add_column("job_applications", sa.Column("legacy_job_id", sa.String(length=255)))
    op.add_column("job_applications", sa.Column("platform", sa.String(length=50), nullable=False, server_default="generic"))
    op.add_column("job_applications", sa.Column("title", sa.Text()))
    op.add_column("job_applications", sa.Column("company", sa.String(length=255)))
    op.add_column("job_applications", sa.Column("work_location", sa.String(length=255)))
    op.add_column("job_applications", sa.Column("job_link", sa.Text()))
    op.add_column("job_applications", sa.Column("date_posted", sa.String(length=100)))
    op.add_column("job_applications", sa.Column("job_description", sa.Text()))
    op.execute(
        """
        UPDATE job_applications AS ja
        SET legacy_job_id = job.external_id,
            platform = job.platform,
            title = job.title,
            company = job.company,
            work_location = job.location,
            job_link = job.url,
            date_posted = job.date_posted,
            job_description = job.description
        FROM jobs AS job
        WHERE job.id = ja.job_id
        """
    )

    op.drop_index("uq_job_applications_user_id_job_id_active", table_name="job_applications")
    op.drop_index("idx_job_app_user_status_date", table_name="job_applications")
    op.drop_index("ix_job_applications_job_id", table_name="job_applications")
    op.drop_constraint("fk_job_applications_job_id_jobs", "job_applications", type_="foreignkey")
    op.drop_column("job_applications", "job_id")
    op.alter_column("job_applications", "legacy_job_id", new_column_name="job_id")
    op.create_index("ix_job_applications_job_id", "job_applications", ["job_id"])
    op.create_index("ix_job_applications_company", "job_applications", ["company"])
    op.create_index(
        "uq_job_applications_user_id_job_id_active",
        "job_applications",
        ["user_id", "job_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND job_id IS NOT NULL"),
    )

    op.drop_index("ix_jobs_company", table_name="jobs")
    op.drop_index("uq_jobs_url_hash", table_name="jobs")
    op.drop_index("uq_jobs_platform_external_id", table_name="jobs")
    op.drop_table("jobs")
