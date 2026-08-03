"""add canonical core competencies field to tailored resumes

Revision ID: 20260730_0055
Revises: 20260730_0054
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260730_0055"
down_revision = "20260730_0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tailored_resumes",
        sa.Column("core_competencies", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.execute("UPDATE tailored_resumes SET core_competencies = key_qualifications WHERE core_competencies = '[]'::jsonb")
    op.alter_column("tailored_resumes", "prompt_version", server_default="job-review-v3")


def downgrade() -> None:
    op.alter_column("tailored_resumes", "prompt_version", server_default="job-review-v2")
    op.drop_column("tailored_resumes", "core_competencies")
