"""add durable tailored resume generation status

Revision ID: 20260823_0069
Revises: 20260813_0068
"""

from alembic import op
import sqlalchemy as sa


revision = "20260823_0069"
down_revision = "20260813_0068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tailored_resumes",
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ready"),
    )
    op.add_column(
        "tailored_resumes",
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_tailored_resumes_status", "tailored_resumes", ["status"])


def downgrade() -> None:
    op.drop_index("ix_tailored_resumes_status", table_name="tailored_resumes")
    op.drop_column("tailored_resumes", "error_message")
    op.drop_column("tailored_resumes", "status")
