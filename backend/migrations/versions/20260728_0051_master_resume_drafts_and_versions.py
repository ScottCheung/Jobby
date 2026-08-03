"""separate resume drafts from published versions

Revision ID: 20260728_0051
Revises: 20260728_0050
Create Date: 2026-07-28 08:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260728_0051"
down_revision = "20260728_0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("master_resumes", sa.Column("published_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("master_resumes", sa.Column("draft_base_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("master_resumes", sa.Column("published_data", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("master_resumes", sa.Column("published_filename", sa.String(length=255), nullable=True))
    op.add_column("master_resumes", sa.Column("published_storage_key", sa.String(length=1024), nullable=True))
    op.add_column("master_resumes", sa.Column("published_url", sa.String(length=2048), nullable=True))
    op.add_column("master_resumes", sa.Column("published_evaluation", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("master_resumes", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("master_resume_evaluation_snapshots", sa.Column("published_version", sa.Integer(), nullable=True))

    op.create_table(
        "master_resume_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("master_resume_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("resume_data", postgresql.JSONB(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("original_storage_key", sa.String(length=1024), nullable=False),
        sa.Column("original_url", sa.String(length=2048), nullable=False),
        sa.Column("evaluation", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["master_resume_id"], ["master_resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("master_resume_id", "version", name="uq_master_resume_version"),
    )
    op.create_index(
        op.f("ix_master_resume_versions_master_resume_id"),
        "master_resume_versions",
        ["master_resume_id"],
        unique=False,
    )

    op.execute(
        """
        WITH recoverable_assets AS (
            SELECT
                mr.id AS master_resume_id,
                row_number() OVER (
                    PARTITION BY mr.id ORDER BY profile.created_at, profile.id
                )::integer AS version,
                profile.extra_data->'resume_data' AS resume_data,
                COALESCE(NULLIF(profile.extra_data->>'resume_filename', ''), 'Resume.pdf') AS original_filename,
                COALESCE(profile.extra_data->>'resume_storage_key', '') AS original_storage_key,
                profile.resume_path AS original_url,
                CASE
                    WHEN jsonb_typeof(profile.extra_data->'resume_evaluation') = 'object'
                    THEN profile.extra_data->'resume_evaluation'
                    ELSE '{}'::jsonb
                END AS evaluation,
                profile.created_at AS published_at
            FROM master_resumes mr
            JOIN job_hunting_profiles profile
              ON profile.user_id = mr.user_id
             AND profile.resume_path IS NOT NULL
            WHERE jsonb_typeof(profile.extra_data->'resume_data') = 'object'
              AND profile.extra_data->'resume_data' <> '{}'::jsonb
        )
        INSERT INTO master_resume_versions (
            id, master_resume_id, version, resume_data, original_filename,
            original_storage_key, original_url, evaluation, published_at
        )
        SELECT
            gen_random_uuid(), master_resume_id, version, resume_data,
            original_filename, original_storage_key, original_url, evaluation, published_at
        FROM recoverable_assets
        """
    )
    op.execute(
        """
        INSERT INTO master_resume_versions (
            id, master_resume_id, version, resume_data, original_filename,
            original_storage_key, original_url, evaluation, published_at
        )
        SELECT
            gen_random_uuid(), resume.id, 1, resume.resume_data,
            resume.original_filename, resume.original_storage_key, resume.original_url,
            COALESCE(resume.evaluation, '{}'::jsonb), COALESCE(resume.confirmed_at, resume.updated_at)
        FROM master_resumes resume
        WHERE resume.resume_data <> '{}'::jsonb
          AND NOT EXISTS (
              SELECT 1 FROM master_resume_versions version
              WHERE version.master_resume_id = resume.id
          )
        """
    )
    op.execute(
        """
        WITH latest AS (
            SELECT DISTINCT ON (master_resume_id) *
            FROM master_resume_versions
            ORDER BY master_resume_id, version DESC
        )
        UPDATE master_resumes resume
        SET
            published_version = latest.version,
            draft_base_version = latest.version,
            published_data = latest.resume_data,
            published_filename = latest.original_filename,
            published_storage_key = latest.original_storage_key,
            published_url = latest.original_url,
            published_evaluation = latest.evaluation,
            published_at = latest.published_at,
            content_version = latest.version,
            status = CASE WHEN resume.resume_data = latest.resume_data THEN 'confirmed' ELSE 'draft' END
        FROM latest
        WHERE resume.id = latest.master_resume_id
        """
    )
    op.execute(
        """
        UPDATE master_resume_evaluation_snapshots snapshot
        SET published_version = version.version
        FROM master_resume_versions version
        WHERE version.master_resume_id = snapshot.master_resume_id
          AND snapshot.evaluation->>'source_hash' = version.evaluation->>'source_hash'
          AND snapshot.evaluation ? 'source_hash'
        """
    )
    op.execute(
        """
        UPDATE master_resumes resume
        SET evaluation = (
                SELECT version.evaluation
                FROM master_resume_versions version
                WHERE version.master_resume_id = resume.id
                  AND version.evaluation <> '{}'::jsonb
                ORDER BY version.version DESC
                LIMIT 1
            ),
            evaluation_updated_at = (
                SELECT version.published_at
                FROM master_resume_versions version
                WHERE version.master_resume_id = resume.id
                  AND version.evaluation <> '{}'::jsonb
                ORDER BY version.version DESC
                LIMIT 1
            )
        WHERE resume.evaluation = '{}'::jsonb
          AND EXISTS (
              SELECT 1 FROM master_resume_versions version
              WHERE version.master_resume_id = resume.id
                AND version.evaluation <> '{}'::jsonb
          )
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_master_resume_versions_master_resume_id"), table_name="master_resume_versions")
    op.drop_table("master_resume_versions")
    op.drop_column("master_resume_evaluation_snapshots", "published_version")
    op.drop_column("master_resumes", "published_at")
    op.drop_column("master_resumes", "published_evaluation")
    op.drop_column("master_resumes", "published_url")
    op.drop_column("master_resumes", "published_storage_key")
    op.drop_column("master_resumes", "published_filename")
    op.drop_column("master_resumes", "published_data")
    op.drop_column("master_resumes", "draft_base_version")
    op.drop_column("master_resumes", "published_version")
