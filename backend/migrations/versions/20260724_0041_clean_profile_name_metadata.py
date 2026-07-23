"""clean profile name metadata

Revision ID: 20260724_0041
Revises: 20260724_0040
Create Date: 2026-07-24 21:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260724_0041"
down_revision = "20260724_0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE users AS u
            SET display_name = LEFT(TRIM(up.extra_data->>'preferred_name'), 255)
            FROM user_profiles AS up
            WHERE up.user_id = u.id
              AND NULLIF(TRIM(up.extra_data->>'preferred_name'), '') IS NOT NULL
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE user_profiles
            SET extra_data = COALESCE(extra_data, '{}'::jsonb) - 'preferred_name' - 'platform_nickname'
            WHERE extra_data ? 'preferred_name'
               OR extra_data ? 'platform_nickname'
            """
        )
    )


def downgrade() -> None:
    pass
