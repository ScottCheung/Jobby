"""user notifications

Revision ID: 20260720_0024
Revises: 20260720_0023
"""
from alembic import op
import sqlalchemy as sa
revision = "20260720_0024"
down_revision = "20260720_0023"
branch_labels = None
depends_on = None
def upgrade() -> None:
    op.create_table("user_notifications", sa.Column("id", sa.UUID(), nullable=False), sa.Column("user_id", sa.UUID(), nullable=False), sa.Column("kind", sa.String(length=40), nullable=False), sa.Column("message", sa.Text(), nullable=False), sa.Column("question_id", sa.UUID(), nullable=True), sa.Column("read_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_user_notifications_user_id", "user_notifications", ["user_id"])
    op.create_index("ix_user_notifications_question_id", "user_notifications", ["question_id"])
def downgrade() -> None: op.drop_table("user_notifications")
