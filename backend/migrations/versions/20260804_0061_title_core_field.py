"""add a canonical personal title field and preserve older salutations

Revision ID: 20260804_0061
Revises: 20260804_0060
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

from services.shared.autofill_profile import decrypt_profile_value, encrypt_profile_value, normalize_alias


revision = "20260804_0061"
down_revision = "20260804_0060"
branch_labels = None
depends_on = None


SYSTEM_RULES = (
    ("Title", ["title"]),
    ("Salutation", ["salutation"]),
    ("Prefix", ["prefix"]),
    ("Honorific", ["honorific"]),
    ("Name prefix", ["name", "prefix"]),
)


def _insert_core(conn, user_id, key: str, value: str) -> None:
    value = str(value or "").strip()
    if not value:
        return
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM user_core_profile "
            "WHERE user_id = :user_id AND core_field_key = :key"
        ),
        {"user_id": user_id, "key": key},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            "INSERT INTO user_core_profile "
            "(id, user_id, core_field_key, field_value, value_type, is_sensitive, version, created_at, updated_at) "
            "VALUES (:id, :user_id, :key, :value, 'text', true, 1, now(), now())"
        ),
        {
            "id": uuid4(),
            "user_id": user_id,
            "key": key,
            "value": encrypt_profile_value(value),
        },
    )


def _legacy_title(value: str, key: str) -> str | None:
    try:
        decoded = decrypt_profile_value(value)
    except (ValueError, TypeError):
        return None
    if key == "system.preferences":
        try:
            preferences = json.loads(decoded) if decoded else {}
        except json.JSONDecodeError:
            return None
        if isinstance(preferences, dict):
            for name in ("title", "salutation", "prefix", "honorific"):
                candidate = str(preferences.get(name) or "").strip()
                if candidate:
                    return candidate
        return None
    normalized_key = normalize_alias(key)
    if normalized_key in {
        "identity salutation",
        "identity prefix",
        "learned title",
        "learned salutation",
        "custom title",
    }:
        return decoded.strip() or None
    return None


def upgrade() -> None:
    conn = op.get_bind()
    tables = set(Inspector.from_engine(conn).get_table_names())

    # 0060 moved profile extras and old answer-library rows into encrypted KV
    # values. Promote any prior title-like value without overwriting a value the
    # user has already saved under the canonical key.
    if "user_core_profile" in tables:
        existing_titles = {
            row["user_id"]
            for row in conn.execute(
                sa.text(
                    "SELECT user_id FROM user_core_profile "
                    "WHERE core_field_key = 'identity.title'"
                )
            ).mappings()
        }
        rows = conn.execute(
            sa.text(
                "SELECT user_id, core_field_key, field_value FROM user_core_profile "
                "WHERE core_field_key IN "
                "('system.preferences', 'identity.salutation', 'identity.prefix', "
                "'learned.title', 'learned.salutation', 'custom.title')"
            )
        ).mappings()
        for row in rows:
            if row["user_id"] in existing_titles:
                continue
            candidate = _legacy_title(row["field_value"], row["core_field_key"])
            if candidate:
                _insert_core(conn, row["user_id"], "identity.title", candidate)
                existing_titles.add(row["user_id"])

    if "field_mapping_rule" not in tables:
        return
    for alias, features in SYSTEM_RULES:
        exists = conn.execute(
            sa.text(
                "SELECT 1 FROM field_mapping_rule "
                "WHERE user_id IS NULL AND core_field_key = 'identity.title' "
                "AND normalized_alias = :alias AND scene = 'generic'"
            ),
            {"alias": normalize_alias(alias)},
        ).first()
        if exists:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO field_mapping_rule "
                "(id, core_field_key, alias, normalized_alias, scene, semantic_features, "
                "value_transform, is_user_defined, confidence, times_used, created_at, updated_at) "
                "VALUES (:id, 'identity.title', :alias, :normalized_alias, 'generic', "
                ":features, '{}'::jsonb, false, 90, 0, now(), now())"
            ),
            {
                "id": uuid4(),
                "alias": alias,
                "normalized_alias": normalize_alias(alias),
                "features": json.dumps(features),
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    if "field_mapping_rule" in set(Inspector.from_engine(conn).get_table_names()):
        conn.execute(
            sa.text(
                "DELETE FROM field_mapping_rule "
                "WHERE user_id IS NULL AND core_field_key = 'identity.title'"
            )
        )
