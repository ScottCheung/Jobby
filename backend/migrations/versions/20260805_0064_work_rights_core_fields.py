"""separate citizenship and visa fields from work authorization

Revision ID: 20260805_0064
Revises: 20260805_0063
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

from services.shared.autofill_profile import normalize_alias


revision = "20260805_0064"
down_revision = "20260805_0063"
branch_labels = None
depends_on = None


SYSTEM_RULES = (
    ("employment.citizenship", "Citizenship", ["citizenship"]),
    ("employment.citizenship", "Country of citizenship", ["country", "citizenship"]),
    ("employment.visa_status", "Visa status", ["visa", "status"]),
    ("employment.visa_status", "Current visa status", ["current", "visa", "status"]),
    ("employment.visa_status", "Visa type", ["visa", "type"]),
    ("employment.visa_expiry", "Visa expiry date", ["visa", "expiry", "date"]),
)


def upgrade() -> None:
    conn = op.get_bind()
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
            "AND core_field_key IN ('employment.citizenship', 'employment.visa_status', 'employment.visa_expiry')"
        )
    )
