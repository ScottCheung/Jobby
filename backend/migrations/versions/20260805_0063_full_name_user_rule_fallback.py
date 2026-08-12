"""add name-part fallbacks to existing user full-name rules

Revision ID: 20260805_0063
Revises: 20260805_0062
"""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector


revision = "20260805_0063"
down_revision = "20260805_0062"
branch_labels = None
depends_on = None


NAME_PARTS_TRANSFORM = {
    "operation": "join",
    "source_keys": ["identity.first_name", "identity.middle_name", "identity.last_name"],
    "separator": " ",
}


def upgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    conn.execute(
        sa.text(
            "UPDATE field_mapping_rule SET "
            "value_transform = CAST(:transform AS jsonb), updated_at = now() "
            "WHERE user_id IS NOT NULL "
            "AND core_field_key IN ('identity.full_name', 'identity.legal_full_name') "
            "AND value_transform = '{}'::jsonb"
        ),
        {"transform": json.dumps(NAME_PARTS_TRANSFORM)},
    )


def downgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" not in set(Inspector.from_engine(conn).get_table_names()):
        return
    conn.execute(
        sa.text(
            "UPDATE field_mapping_rule SET value_transform = '{}'::jsonb, updated_at = now() "
            "WHERE user_id IS NOT NULL "
            "AND core_field_key IN ('identity.full_name', 'identity.legal_full_name') "
            "AND value_transform = CAST(:transform AS jsonb)"
        ),
        {"transform": json.dumps(NAME_PARTS_TRANSFORM)},
    )
