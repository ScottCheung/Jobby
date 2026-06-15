"""application skipped status and skip reason

Revision ID: 20260616_0005
Revises: 20260616_0004
Create Date: 2026-06-16 13:30:00
"""
from alembic import op


revision = "20260616_0005"
down_revision = "20260616_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("job_applications", "error_message", new_column_name="skip_reason")
    op.execute("UPDATE job_applications SET status = 'skipped' WHERE status = 'failed'")
    op.execute("UPDATE job_applications SET pipeline_stage = 'skipped' WHERE pipeline_stage = 'rejected' AND status = 'skipped'")


def downgrade() -> None:
    op.execute("UPDATE job_applications SET status = 'failed' WHERE status = 'skipped'")
    op.execute("UPDATE job_applications SET pipeline_stage = 'rejected' WHERE pipeline_stage = 'skipped' AND status = 'failed'")
    op.alter_column("job_applications", "skip_reason", new_column_name="error_message")
