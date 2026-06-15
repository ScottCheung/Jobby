"""skipped application pipeline stage

Revision ID: 20260616_0006
Revises: 20260616_0005
Create Date: 2026-06-16 13:45:00
"""
from alembic import op


revision = "20260616_0006"
down_revision = "20260616_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE job_applications SET pipeline_stage = 'skipped' WHERE status = 'skipped'")


def downgrade() -> None:
    op.execute("UPDATE job_applications SET pipeline_stage = 'applied' WHERE pipeline_stage = 'skipped'")
