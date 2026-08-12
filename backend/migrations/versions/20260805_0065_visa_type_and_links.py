"""add visa type and link core fields

Revision ID: 20260805_0065
Revises: 20260805_0064
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

from services.shared.autofill_profile import normalize_alias


revision = "20260805_0065"
down_revision = "20260805_0064"
branch_labels = None
depends_on = None


SYSTEM_RULES = (
    ("employment.visa_type", "Visa type", ["visa", "type"]),
    ("employment.visa_sponsorship", "Visa sponsorship required", ["visa", "sponsorship", "required"]),
    ("employment.website", "Website", ["website"]),
    ("employment.portfolio_url", "Portfolio URL", ["portfolio", "url"]),
    ("employment.github_url", "GitHub URL", ["github", "url"]),
    ("employment.github_url", "GitHub profile", ["github", "profile"]),
)


def _insert_rule(conn, core_key: str, alias: str, features: list[str]) -> None:
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM field_mapping_rule "
            "WHERE user_id IS NULL AND core_field_key = :core_key "
            "AND normalized_alias = :alias AND scene = 'generic'"
        ),
        {"core_key": core_key, "alias": normalize_alias(alias)},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            "INSERT INTO field_mapping_rule "
            "(id, core_field_key, alias, normalized_alias, scene, semantic_features, "
            "value_transform, is_user_defined, confidence, times_used, created_at, updated_at) "
            "VALUES (:id, :core_key, :alias, :normalized_alias, 'generic', "
            "CAST(:features AS jsonb), '{}'::jsonb, false, 90, 0, now(), now())"
        ),
        {
            "id": uuid4(),
            "core_key": core_key,
            "alias": alias,
            "normalized_alias": normalize_alias(alias),
            "features": json.dumps(features),
        },
    )


def upgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    conn.execute(
        sa.text(
            "UPDATE field_mapping_rule SET core_field_key = 'employment.visa_type', "
            "semantic_features = '[\"visa\", \"type\"]'::jsonb, confidence = 90, updated_at = now() "
            "WHERE user_id IS NULL AND core_field_key = 'employment.visa_status' "
            "AND normalized_alias = 'visa type' AND scene = 'generic'"
        )
    )
    for core_key, alias, features in SYSTEM_RULES:
        _insert_rule(conn, core_key, alias, features)


def downgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    conn.execute(
        sa.text(
            "DELETE FROM field_mapping_rule WHERE user_id IS NULL "
            "AND core_field_key IN ('employment.visa_type', 'employment.portfolio_url', 'employment.github_url')"
        )
    )
