"""deduplicated manual form answer observations

Revision ID: 20260804_0059
Revises: 20260803_0058
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector


revision = "20260804_0059"
down_revision = "20260803_0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = Inspector.from_engine(op.get_bind())
    if "form_answer_observations" in inspector.get_table_names():
        return
    op.create_table(
        "form_answer_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False, server_default="generic"),
        sa.Column("company_scope", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("original_label", sa.Text(), nullable=False),
        sa.Column("normalized_label", sa.Text(), nullable=False),
        sa.Column("field_type", sa.String(length=50), nullable=False),
        sa.Column("control_fingerprint", sa.String(length=128), nullable=False),
        sa.Column("options_fingerprint", sa.String(length=128), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("answer_hash", sa.String(length=128), nullable=False),
        sa.Column("intent_key", sa.String(length=150)),
        sa.Column("times_seen", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="observed"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "platform", "company_scope", "normalized_label", "field_type", "control_fingerprint", name="uq_form_answer_observation_scope"),
    )
    op.create_index("ix_form_answer_observations_user_id", "form_answer_observations", ["user_id"])
    op.create_index("ix_form_answer_observations_intent", "form_answer_observations", ["user_id", "intent_key", "answer_hash"])


def downgrade() -> None:
    inspector = Inspector.from_engine(op.get_bind())
    if "form_answer_observations" in inspector.get_table_names():
        op.drop_table("form_answer_observations")
