"""add pronouns and current salary autofill fields

Revision ID: 20260805_0066
Revises: 20260805_0065
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

from services.shared.autofill_profile import normalize_alias


revision = "20260805_0066"
down_revision = "20260805_0065"
branch_labels = None
depends_on = None


SYSTEM_RULES = (
    ("identity.pronouns", "Pronouns", ["pronouns"]),
    ("compensation.current_salary", "Current salary", ["current", "salary"]),
    ("compensation.current_salary", "Current annual salary", ["current", "annual", "salary"]),
    ("compensation.current_salary", "Current annual compensation", ["current", "annual", "compensation"]),
)


def upgrade() -> None:
    conn = op.get_bind()
    if "user_core_profile" in set(Inspector.from_engine(conn).get_table_names()):
        conn.execute(sa.text("UPDATE user_core_profile SET is_sensitive = true WHERE is_sensitive = false"))
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    for core_key, alias, features in SYSTEM_RULES:
        exists = conn.execute(
            sa.text(
                "SELECT 1 FROM field_mapping_rule "
                "WHERE user_id IS NULL AND core_field_key = :core_key "
                "AND normalized_alias = :alias AND scene = 'generic'"
            ),
            {"core_key": core_key, "alias": normalize_alias(alias)},
        ).first()
        if exists:
            continue
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


def downgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    conn.execute(
        sa.text(
            "DELETE FROM field_mapping_rule WHERE user_id IS NULL "
            "AND core_field_key IN ('identity.pronouns', 'compensation.current_salary')"
        )
    )
