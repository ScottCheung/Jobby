"""add master resume evaluation

Revision ID: 20260728_0047
Revises: 20260726_0046
Create Date: 2026-07-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260728_0047"
down_revision = "20260726_0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_resumes",
        sa.Column(
            "evaluation",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "master_resumes",
        sa.Column("evaluation_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("master_resumes", "evaluation_updated_at")
    op.drop_column("master_resumes", "evaluation")
