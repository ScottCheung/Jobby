"""cleanup duplicate job description

Revision ID: 20260623_0017
Revises: 20260620_0016
Create Date: 2026-06-23 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = "20260623_0017"
down_revision = "20260620_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if job_description column exists in the database
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("job_applications")]
    
    if "job_description" not in columns:
        op.add_column("job_applications", sa.Column("job_description", sa.Text()))

    # 1. Update the database column `job_description` using COALESCE from raw_data
    # 2. Deletes 'job_description' and 'description' keys from raw_data JSONB
    op.execute(
        """
        UPDATE job_applications
        SET 
            job_description = COALESCE(job_description, raw_data ->> 'job_description', raw_data ->> 'description'),
            raw_data = (raw_data - 'job_description') - 'description'
        """
    )


def downgrade() -> None:
    pass
