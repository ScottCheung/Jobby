"""clean bullet markers in stored resume snapshots

Revision ID: 20260728_0052
Revises: 20260728_0051
Create Date: 2026-07-28 09:00:00.000000
"""

import hashlib
import json
import re

from alembic import op
import sqlalchemy as sa


revision = "20260728_0052"
down_revision = "20260728_0051"
branch_labels = None
depends_on = None


MARKER_RE = re.compile(r"^\s*(?:(?:[-*·•●▪◦‣–—]+)|(?:\d+[.)]))\s*")
CLEAN_LIST_KEYS = {"description", "highlights"}


def clean_resume_data(value, key: str | None = None):
    if isinstance(value, dict):
        return {item_key: clean_resume_data(item, item_key) for item_key, item in value.items()}
    if isinstance(value, list):
        if key in CLEAN_LIST_KEYS:
            return [
                MARKER_RE.sub("", item).strip() if isinstance(item, str) else clean_resume_data(item)
                for item in value
            ]
        return [clean_resume_data(item) for item in value]
    return value


def content_hash(value: dict) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def remap_evaluation(evaluation: dict | None, hashes: dict[str, str]) -> dict:
    result = dict(evaluation or {})
    source_hash = result.get("source_hash")
    if isinstance(source_hash, str) and source_hash in hashes:
        result["source_hash"] = hashes[source_hash]
    return result


def upgrade() -> None:
    connection = op.get_bind()
    hashes: dict[str, str] = {}

    version_rows = connection.execute(
        sa.text("SELECT id, resume_data, evaluation FROM master_resume_versions")
    ).mappings()
    for row in version_rows:
        original = row["resume_data"] or {}
        cleaned = clean_resume_data(original)
        hashes[content_hash(original)] = content_hash(cleaned)
        connection.execute(
            sa.text(
                "UPDATE master_resume_versions "
                "SET resume_data=CAST(:resume_data AS jsonb), "
                "evaluation=CAST(:evaluation AS jsonb) WHERE id=:id"
            ),
            {
                "id": row["id"],
                "resume_data": json.dumps(cleaned, ensure_ascii=False),
                "evaluation": json.dumps(remap_evaluation(row["evaluation"], hashes), ensure_ascii=False),
            },
        )

    resume_rows = connection.execute(
        sa.text(
            "SELECT id, resume_data, published_data, evaluation, published_evaluation "
            "FROM master_resumes"
        )
    ).mappings()
    for row in resume_rows:
        draft = row["resume_data"] or {}
        published = row["published_data"] or {}
        cleaned_draft = clean_resume_data(draft)
        cleaned_published = clean_resume_data(published)
        hashes[content_hash(draft)] = content_hash(cleaned_draft)
        hashes[content_hash(published)] = content_hash(cleaned_published)
        connection.execute(
            sa.text(
                "UPDATE master_resumes SET resume_data=CAST(:resume_data AS jsonb), "
                "published_data=CAST(:published_data AS jsonb), "
                "evaluation=CAST(:evaluation AS jsonb), "
                "published_evaluation=CAST(:published_evaluation AS jsonb) WHERE id=:id"
            ),
            {
                "id": row["id"],
                "resume_data": json.dumps(cleaned_draft, ensure_ascii=False),
                "published_data": json.dumps(cleaned_published, ensure_ascii=False),
                "evaluation": json.dumps(remap_evaluation(row["evaluation"], hashes), ensure_ascii=False),
                "published_evaluation": json.dumps(
                    remap_evaluation(row["published_evaluation"], hashes), ensure_ascii=False
                ),
            },
        )

    profile_rows = connection.execute(
        sa.text("SELECT id, extra_data FROM job_hunting_profiles WHERE resume_path IS NOT NULL")
    ).mappings()
    for row in profile_rows:
        extra = dict(row["extra_data"] or {})
        resume_data = extra.get("resume_data")
        if isinstance(resume_data, dict):
            cleaned = clean_resume_data(resume_data)
            hashes[content_hash(resume_data)] = content_hash(cleaned)
            extra["resume_data"] = cleaned
        if isinstance(extra.get("resume_evaluation"), dict):
            extra["resume_evaluation"] = remap_evaluation(extra["resume_evaluation"], hashes)
        connection.execute(
            sa.text(
                "UPDATE job_hunting_profiles "
                "SET extra_data=CAST(:extra_data AS jsonb) WHERE id=:id"
            ),
            {"id": row["id"], "extra_data": json.dumps(extra, ensure_ascii=False)},
        )

    evaluation_rows = connection.execute(
        sa.text("SELECT id, resume_data, evaluation FROM master_resume_evaluation_snapshots")
    ).mappings()
    for row in evaluation_rows:
        resume_data = row["resume_data"]
        cleaned = clean_resume_data(resume_data) if isinstance(resume_data, dict) else None
        if isinstance(resume_data, dict):
            hashes[content_hash(resume_data)] = content_hash(cleaned)
        connection.execute(
            sa.text(
                "UPDATE master_resume_evaluation_snapshots "
                "SET resume_data=CAST(:resume_data AS jsonb), "
                "evaluation=CAST(:evaluation AS jsonb) WHERE id=:id"
            ),
            {
                "id": row["id"],
                "resume_data": json.dumps(cleaned, ensure_ascii=False) if cleaned is not None else None,
                "evaluation": json.dumps(remap_evaluation(row["evaluation"], hashes), ensure_ascii=False),
            },
        )


def downgrade() -> None:
    pass
