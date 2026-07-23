"""expand notification center records

Revision ID: 20260720_0031
Revises: 20260720_0030
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260720_0031"
down_revision = "20260720_0030"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("user_notifications", sa.Column("title", sa.String(length=255), nullable=True))
    op.add_column("user_notifications", sa.Column("action_url", sa.String(length=1024), nullable=True))
    op.add_column("user_notifications", sa.Column("actor_user_id", sa.UUID(), nullable=True))
    op.add_column("user_notifications", sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"))
    op.create_foreign_key("fk_user_notifications_actor", "user_notifications", "users", ["actor_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_user_notifications_actor_user_id", "user_notifications", ["actor_user_id"])

def downgrade() -> None:
    op.drop_index("ix_user_notifications_actor_user_id", table_name="user_notifications")
    op.drop_constraint("fk_user_notifications_actor", "user_notifications", type_="foreignkey")
    op.drop_column("user_notifications", "metadata")
    op.drop_column("user_notifications", "actor_user_id")
    op.drop_column("user_notifications", "action_url")
    op.drop_column("user_notifications", "title")
