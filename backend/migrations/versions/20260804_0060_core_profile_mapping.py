"""replace fixed profile and answer memory tables with encrypted KV autofill data

Revision ID: 20260804_0060
Revises: 20260804_0059
"""

import json
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector

from services.shared.autofill_profile import encrypt_profile_value, normalize_alias


revision = "20260804_0060"
down_revision = "20260804_0059"
branch_labels = None
depends_on = None


SYSTEM_RULES = [
    ("identity.preferred_name", "Preferred name", "generic", ["preferred", "name"]),
    ("identity.first_name", "First name", "generic", ["first", "name"]),
    ("identity.first_name", "Given name", "generic", ["given", "name"]),
    ("identity.first_name", "Forename", "generic", ["forename"]),
    ("identity.first_name", "Legal first name", "generic", ["legal", "first", "name"]),
    ("identity.middle_name", "Middle name", "generic", ["middle", "name"]),
    ("identity.last_name", "Last name", "generic", ["last", "name"]),
    ("identity.last_name", "Family name", "generic", ["family", "name"]),
    ("identity.last_name", "Surname", "generic", ["surname"]),
    ("identity.full_name", "Full name", "generic", ["full", "name"]),
    ("identity.full_name", "Name", "generic", ["name"]),
    ("identity.legal_full_name", "Legal name", "visa_application", ["legal", "name", "visa"]),
    ("identity.legal_full_name", "Legal name", "generic", ["legal", "name"]),
    ("identity.email", "Email", "generic", ["email"]),
    ("identity.email", "E-mail address", "generic", ["email", "address"]),
    ("identity.phone", "Phone number", "generic", ["phone", "number"]),
    ("identity.phone", "Mobile number", "generic", ["mobile", "number"]),
    ("address.street", "Street address", "generic", ["street", "address"]),
    ("address.city", "City", "generic", ["city"]),
    ("address.city", "Current city", "generic", ["current", "city"]),
    ("address.state", "State", "generic", ["state"]),
    ("address.state", "Province", "generic", ["province"]),
    ("address.postal_code", "Postal code", "generic", ["postal", "code"]),
    ("address.postal_code", "ZIP code", "generic", ["zip", "code"]),
    ("address.country", "Country", "generic", ["country"]),
    ("employment.current_location", "Current location", "generic", ["current", "location"]),
    ("employment.current_location", "Where are you based", "generic", ["based", "location"]),
    ("employment.work_authorization", "Work authorization", "generic", ["work", "authorization"]),
    ("employment.work_authorization", "Are you legally authorized to work", "generic", ["legal", "authorized", "work"]),
    ("employment.visa_sponsorship", "Visa sponsorship", "generic", ["visa", "sponsorship"]),
    ("employment.visa_sponsorship", "Will you require visa sponsorship", "generic", ["require", "visa", "sponsorship"]),
    ("employment.relocation", "Willing to relocate", "generic", ["relocate"]),
    ("employment.office_attendance", "Office attendance", "generic", ["office", "attendance"]),
    ("employment.linkedin_url", "LinkedIn URL", "generic", ["linkedin", "url"]),
    ("employment.website", "Portfolio website", "generic", ["portfolio", "website"]),
    ("employment.recent_employer", "Most recent employer", "generic", ["recent", "employer"]),
    ("experience.years", "Years of experience", "generic", ["years", "experience"]),
    ("compensation.desired_base_salary", "Desired annual base salary", "generic", ["desired", "salary"]),
    ("demographic.ethnicity", "Ethnicity", "generic", ["ethnicity"]),
    ("demographic.gender", "Gender", "generic", ["gender"]),
    ("demographic.gender_identity", "Gender identity", "generic", ["gender", "identity"]),
    ("demographic.disability_status", "Disability status", "generic", ["disability"]),
    ("demographic.veteran_status", "Veteran status", "generic", ["veteran"]),
]


def _tables() -> set[str]:
    return set(Inspector.from_engine(op.get_bind()).get_table_names())


def _insert_core(conn, user_id, key: str, value: str, value_type: str = "text") -> None:
    if value is None or not str(value).strip():
        return
    exists = conn.execute(
        sa.text("SELECT 1 FROM user_core_profile WHERE user_id = :user_id AND core_field_key = :key"),
        {"user_id": user_id, "key": key},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            "INSERT INTO user_core_profile "
            "(id, user_id, core_field_key, field_value, value_type, is_sensitive, version, created_at, updated_at) "
            "VALUES (:id, :user_id, :key, :value, :value_type, true, 1, now(), now())"
        ),
        {
            "id": uuid4(),
            "user_id": user_id,
            "key": key,
            "value": encrypt_profile_value(str(value)),
            "value_type": value_type,
        },
    )


def upgrade() -> None:
    conn = op.get_bind()
    tables = _tables()
    if "user_core_profile" not in tables:
        op.create_table(
            "user_core_profile",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("core_field_key", sa.String(length=150), nullable=False),
            sa.Column("field_value", sa.Text(), nullable=False),
            sa.Column("value_type", sa.String(length=50), nullable=False, server_default="text"),
            sa.Column("is_sensitive", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("user_id", "core_field_key", name="uq_user_core_profile_user_key"),
        )
        op.create_index("ix_user_core_profile_user_id", "user_core_profile", ["user_id"])
    if "field_mapping_rule" not in tables:
        op.create_table(
            "field_mapping_rule",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
            sa.Column("core_field_key", sa.String(length=150), nullable=False),
            sa.Column("alias", sa.String(length=500), nullable=False),
            sa.Column("normalized_alias", sa.String(length=500), nullable=False),
            sa.Column("scene", sa.String(length=100), nullable=False, server_default="generic"),
            sa.Column("semantic_features", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("field_type", sa.String(length=50)),
            sa.Column("value_transform", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("is_user_defined", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("confidence", sa.Integer(), nullable=False, server_default="80"),
            sa.Column("times_used", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_used_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_field_mapping_rule_lookup", "field_mapping_rule", ["normalized_alias", "scene", "is_user_defined", "confidence"])
        op.create_index("ix_field_mapping_rule_user", "field_mapping_rule", ["user_id", "is_user_defined", "confidence"])
    if "form_temp_change" not in tables:
        op.create_table(
            "form_temp_change",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("alias", sa.String(length=500), nullable=False),
            sa.Column("normalized_alias", sa.String(length=500), nullable=False),
            sa.Column("temp_value", sa.Text(), nullable=False),
            sa.Column("core_field_key", sa.String(length=150)),
            sa.Column("scene", sa.String(length=100), nullable=False, server_default="generic"),
            sa.Column("semantic_features", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("field_type", sa.String(length=50), nullable=False),
            sa.Column("control_fingerprint", sa.String(length=128), nullable=False),
            sa.Column("is_sensitive", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("user_id", "session_id", "control_fingerprint", name="uq_form_temp_change_session_control"),
        )
        op.create_index("ix_form_temp_change_user_id", "form_temp_change", ["user_id"])
        op.create_index("ix_form_temp_change_session", "form_temp_change", ["user_id", "session_id", "updated_at"])

    # Migrate the fixed profile columns. Values are encrypted before insertion;
    # empty columns are deliberately omitted so KV rows stay meaningful.
    if "user_profiles" in tables:
        profile_columns = {
            column["name"]
            for column in Inspector.from_engine(op.get_bind()).get_columns("user_profiles")
        }
        columns = [
            column
            for column in (
                "first_name", "middle_name", "last_name", "email", "phone_number", "current_city", "street",
                "state", "zipcode", "country", "ethnicity", "gender", "gender_identity", "disability_status", "veteran_status",
            )
            if column in profile_columns
        ]
        selected_columns = ["id", "user_id", *columns]
        if "extra_data" in profile_columns:
            selected_columns.append("extra_data")
        rows = conn.execute(sa.text(f"SELECT {', '.join(selected_columns)} FROM user_profiles")).mappings()
        key_map = {
            "first_name": "identity.first_name", "middle_name": "identity.middle_name", "last_name": "identity.last_name",
            "email": "identity.email", "phone_number": "identity.phone", "current_city": "address.city", "street": "address.street",
            "state": "address.state", "zipcode": "address.postal_code", "country": "address.country", "ethnicity": "demographic.ethnicity",
            "gender": "demographic.gender", "gender_identity": "demographic.gender_identity", "disability_status": "demographic.disability_status",
            "veteran_status": "demographic.veteran_status",
        }
        for row in rows:
            for column, key in key_map.items():
                if column in row:
                    _insert_core(conn, row["user_id"], key, row[column])
            extra = row.get("extra_data") or {}
            if extra:
                _insert_core(conn, row["user_id"], "system.preferences", json.dumps(extra), "json")
    for user_id, display_name, email in conn.execute(sa.text("SELECT id, display_name, email FROM users")).fetchall():
        _insert_core(conn, user_id, "identity.preferred_name", display_name)
        _insert_core(conn, user_id, "identity.email", email)

    # Preserve reusable answers as canonical keys and their exact aliases as
    # user rules. Observations remain intentionally unpromoted and are dropped.
    intent_to_core = {
        "identity.preferred_name": "identity.preferred_name", "identity.first_name": "identity.first_name",
        "identity.last_name": "identity.last_name", "identity.full_name": "identity.full_name", "identity.legal_name": "identity.legal_full_name",
        "identity.email": "identity.email", "identity.phone": "identity.phone", "employment.current_location": "employment.current_location",
        "compensation.desired_base_salary": "compensation.desired_base_salary", "employment.visa_sponsorship": "employment.visa_sponsorship",
        "employment.work_authorization": "employment.work_authorization", "employment.relocation": "employment.relocation",
        "employment.office_attendance": "employment.office_attendance", "experience.years": "experience.years",
    }
    old_answers = {}
    if "autofill_answers" in tables:
        for answer in conn.execute(sa.text("SELECT id, user_id, intent_key, value, value_type FROM autofill_answers")).mappings():
            key = intent_to_core.get(answer["intent_key"], f"learned.{normalize_alias(answer['intent_key']).replace(' ', '_')}")
            old_answers[str(answer["id"])] = (answer["user_id"], key)
            _insert_core(conn, answer["user_id"], key, answer["value"], answer["value_type"] or "text")
    if "form_question_mappings" in tables:
        mappings = conn.execute(sa.text(
            "SELECT user_id, intent_key, original_label, company_scope, field_type, confidence "
            "FROM form_question_mappings"
        )).mappings()
        for mapping in mappings:
            core_key = intent_to_core.get(mapping["intent_key"], f"learned.{normalize_alias(mapping['intent_key']).replace(' ', '_')}")
            alias = mapping["original_label"]
            scene = normalize_alias(mapping["company_scope"] or "generic").replace(" ", "_") or "generic"
            conn.execute(sa.text(
                "INSERT INTO field_mapping_rule "
                "(id, user_id, core_field_key, alias, normalized_alias, scene, semantic_features, field_type, value_transform, is_user_defined, confidence, times_used, created_at, updated_at) "
                "VALUES (:id, :user_id, :core_key, :alias, :normalized_alias, :scene, :features, :field_type, :transform, true, :confidence, 0, now(), now())"
            ), {
                "id": uuid4(), "user_id": mapping["user_id"], "core_key": core_key, "alias": alias,
                "normalized_alias": normalize_alias(alias), "scene": scene, "features": json.dumps(normalize_alias(alias).split()),
                "field_type": mapping["field_type"], "transform": json.dumps({}),
                "confidence": max(0, min(100, round(float(mapping["confidence"] or 1) * 100))),
            })

    for core_key, alias, scene, features in SYSTEM_RULES:
        exists = conn.execute(sa.text(
            "SELECT 1 FROM field_mapping_rule WHERE user_id IS NULL AND core_field_key = :core_key "
            "AND normalized_alias = :alias AND scene = :scene"
        ), {"core_key": core_key, "alias": normalize_alias(alias), "scene": scene}).first()
        if not exists:
            conn.execute(sa.text(
                "INSERT INTO field_mapping_rule "
                "(id, core_field_key, alias, normalized_alias, scene, semantic_features, value_transform, is_user_defined, confidence, times_used, created_at, updated_at) "
                "VALUES (:id, :core_key, :alias, :normalized_alias, :scene, :features, :transform, false, 80, 0, now(), now())"
            ), {
                "id": uuid4(), "core_key": core_key, "alias": alias, "normalized_alias": normalize_alias(alias),
                "scene": scene, "features": json.dumps(features), "transform": json.dumps(
                    {"operation": "join", "source_keys": ["identity.first_name", "identity.middle_name", "identity.last_name"]}
                    if core_key in {"identity.full_name", "identity.legal_full_name"} else {}
                ),
            })

    # The old answer, mapping, observation, and fixed-profile stores no longer
    # have an owner after this migration and must not remain writable.
    tables = _tables()
    for table in ("autofill_answer_events", "form_answer_observations", "form_question_mappings", "autofill_answers", "user_profiles"):
        if table in tables:
            op.drop_table(table)


def downgrade() -> None:
    raise RuntimeError(
        "20260804_0060 is irreversible: restoring the fixed profile and automatic observation tables "
        "would discard encrypted core values and re-enable unconfirmed data promotion."
    )
