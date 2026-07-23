"""reward completed-practice ratings once

Revision ID: 20260720_0030
Revises: 20260720_0029
"""

from alembic import op
import sqlalchemy as sa

revision = "20260720_0030"
down_revision = "20260720_0029"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("question_ratings", sa.Column("survey_reward_granted", sa.Boolean(), nullable=False, server_default=sa.false()))

def downgrade() -> None:
    op.drop_column("question_ratings", "survey_reward_granted")
