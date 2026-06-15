"""application pipeline fields and worker queue status

Revision ID: 20260616_0002
Revises: 20260616_0001
Create Date: 2026-06-16 12:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = "20260616_0002"
down_revision = "20260616_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_applications", sa.Column("pipeline_stage", sa.String(length=50), nullable=False, server_default="applied"))
    op.add_column("job_applications", sa.Column("interview_stage", sa.String(length=100)))
    op.add_column("job_applications", sa.Column("next_action", sa.String(length=255)))
    op.add_column("job_applications", sa.Column("next_action_at", sa.DateTime(timezone=True)))
    op.add_column("job_applications", sa.Column("notes", sa.Text()))
    op.add_column("job_applications", sa.Column("contact_name", sa.String(length=255)))
    op.add_column("job_applications", sa.Column("contact_email", sa.String(length=255)))
    op.add_column("job_applications", sa.Column("last_contacted_at", sa.DateTime(timezone=True)))
    op.create_index("ix_job_applications_pipeline_stage", "job_applications", ["pipeline_stage"])
    op.create_index("ix_job_applications_next_action_at", "job_applications", ["next_action_at"])

    op.execute("UPDATE job_applications SET status = 'submitted' WHERE status = 'applied'")
    op.alter_column("job_applications", "status", server_default="submitted")
    op.alter_column("job_applications", "pipeline_stage", server_default=None)


def downgrade() -> None:
    op.execute("UPDATE job_applications SET status = 'applied' WHERE status = 'submitted'")
    op.alter_column("job_applications", "status", server_default=None)
    op.drop_index("ix_job_applications_next_action_at", table_name="job_applications")
    op.drop_index("ix_job_applications_pipeline_stage", table_name="job_applications")
    op.drop_column("job_applications", "last_contacted_at")
    op.drop_column("job_applications", "contact_email")
    op.drop_column("job_applications", "contact_name")
    op.drop_column("job_applications", "notes")
    op.drop_column("job_applications", "next_action_at")
    op.drop_column("job_applications", "next_action")
    op.drop_column("job_applications", "interview_stage")
    op.drop_column("job_applications", "pipeline_stage")
