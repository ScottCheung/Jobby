"""canonical autofill answers, question mappings, and audit events

Revision ID: 20260803_0058
Revises: 20260802_0057
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector


revision = "20260803_0058"
down_revision = "20260802_0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = Inspector.from_engine(op.get_bind())
    tables = inspector.get_table_names()
    if "autofill_answers" not in tables:
        op.create_table(
            "autofill_answers",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("intent_key", sa.String(length=150), nullable=False),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column("value_type", sa.String(length=50), nullable=False, server_default="text"),
            sa.Column("authority", sa.String(length=30), nullable=False, server_default="user"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("last_confirmed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("times_used", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("user_id", "intent_key", name="uq_autofill_answers_user_intent"),
        )
        op.create_index("ix_autofill_answers_user_id", "autofill_answers", ["user_id"])
    if "form_question_mappings" not in tables:
        op.create_table(
            "form_question_mappings",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("answer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("autofill_answers.id", ondelete="SET NULL")),
            sa.Column("intent_key", sa.String(length=150), nullable=False),
            sa.Column("platform", sa.String(length=50), nullable=False, server_default="generic"),
            sa.Column("company_scope", sa.String(length=255), nullable=False, server_default=""),
            sa.Column("original_label", sa.Text(), nullable=False),
            sa.Column("normalized_label", sa.Text(), nullable=False),
            sa.Column("field_type", sa.String(length=50), nullable=False),
            sa.Column("control_fingerprint", sa.String(length=128), nullable=False),
            sa.Column("options_fingerprint", sa.String(length=128), nullable=False),
            sa.Column("confidence", sa.Numeric(4, 3), nullable=False, server_default="1"),
            sa.Column("times_used", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_used_at", sa.DateTime(timezone=True)),
            sa.Column("last_confirmed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("user_id", "platform", "company_scope", "normalized_label", "field_type", "control_fingerprint", name="uq_form_question_mapping_scope"),
        )
        op.create_index("ix_form_question_mappings_user_id", "form_question_mappings", ["user_id"])
        op.create_index("ix_form_question_mappings_lookup", "form_question_mappings", ["user_id", "platform", "company_scope", "normalized_label"])
        op.create_index("ix_form_question_mappings_intent", "form_question_mappings", ["user_id", "intent_key"])
    if "autofill_answer_events" not in tables:
        op.create_table(
            "autofill_answer_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("answer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("autofill_answers.id", ondelete="SET NULL")),
            sa.Column("mapping_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("form_question_mappings.id", ondelete="SET NULL")),
            sa.Column("event_type", sa.String(length=50), nullable=False),
            sa.Column("source", sa.String(length=50), nullable=False, server_default="system"),
            sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_autofill_answer_events_user_id", "autofill_answer_events", ["user_id"])
        op.create_index("ix_autofill_answer_events_answer_id", "autofill_answer_events", ["answer_id"])
        op.create_index("ix_autofill_answer_events_mapping_id", "autofill_answer_events", ["mapping_id"])


def downgrade() -> None:
    inspector = Inspector.from_engine(op.get_bind())
    tables = inspector.get_table_names()
    if "autofill_answer_events" in tables:
        op.drop_table("autofill_answer_events")
    if "form_question_mappings" in tables:
        op.drop_table("form_question_mappings")
    if "autofill_answers" in tables:
        op.drop_table("autofill_answers")
