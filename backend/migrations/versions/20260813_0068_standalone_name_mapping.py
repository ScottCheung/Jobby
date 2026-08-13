"""standalone name mapping rule

Revision ID: 20260813_0068
Revises: 20260805_0067
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

from services.shared.autofill_profile import normalize_alias


revision = "20260813_0068"
down_revision = "20260805_0067"
branch_labels = None
depends_on = None


NAME_PARTS_TRANSFORM = {
    "operation": "join",
    "source_keys": ["identity.first_name", "identity.middle_name", "identity.last_name"],
    "separator": " ",
}

SYSTEM_RULES = (
    ("identity.full_name", "Name", ["name"]),
)


def upgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return

    for core_key, alias, features in SYSTEM_RULES:
        params = {
            "core_key": core_key,
            "alias": alias,
            "normalized_alias": normalize_alias(alias),
            "features": json.dumps(features),
            "transform": json.dumps(NAME_PARTS_TRANSFORM),
        }
        updated = conn.execute(
            sa.text(
                "UPDATE field_mapping_rule SET "
                "semantic_features = CAST(:features AS jsonb), "
                "value_transform = CAST(:transform AS jsonb), "
                "confidence = 90, updated_at = now() "
                "WHERE user_id IS NULL AND is_user_defined = false "
                "AND core_field_key = :core_key AND normalized_alias = :normalized_alias "
                "AND scene = 'generic'"
            ),
            params,
        )
        if updated.rowcount:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO field_mapping_rule "
                "(id, core_field_key, alias, normalized_alias, scene, semantic_features, "
                "value_transform, is_user_defined, confidence, times_used, created_at, updated_at) "
                "VALUES (:id, :core_key, :alias, :normalized_alias, 'generic', "
                "CAST(:features AS jsonb), CAST(:transform AS jsonb), false, 90, 0, now(), now())"
            ),
            {"id": uuid4(), **params},
        )


def downgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    conn.execute(
        sa.text(
            "DELETE FROM field_mapping_rule "
            "WHERE user_id IS NULL AND core_field_key = 'identity.full_name' "
            "AND normalized_alias = 'name' AND scene = 'generic'"
        )
    )
