"""add an AI job recommendation inbox

Revision ID: 20260828_0072
Revises: 20260826_0071
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260828_0072"
down_revision = "20260826_0071"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recommendation_reason", sa.Text()),
        sa.Column("work_style", sa.String(length=100)),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="recommended"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "job_id", name="uq_job_recommendations_user_job"),
    )
    op.create_index("ix_job_recommendations_user_id", "job_recommendations", ["user_id"])
    op.create_index("ix_job_recommendations_job_id", "job_recommendations", ["job_id"])
    op.create_index("ix_job_recommendations_user_status", "job_recommendations", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_job_recommendations_user_status", table_name="job_recommendations")
    op.drop_index("ix_job_recommendations_job_id", table_name="job_recommendations")
    op.drop_index("ix_job_recommendations_user_id", table_name="job_recommendations")
    op.drop_table("job_recommendations")
