"""add metadata to interview categories

Revision ID: 20260725_0042
Revises: 20260724_0041
Create Date: 2026-07-25 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260725_0042"
down_revision = "20260724_0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_categories", sa.Column("slug", sa.String(length=100), nullable=True))
    op.add_column("interview_categories", sa.Column("display_name", sa.String(length=255), nullable=True))
    op.add_column("interview_categories", sa.Column("icon_key", sa.String(length=100), nullable=True))
    op.add_column("interview_categories", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("interview_categories", sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.create_index("ix_interview_categories_slug", "interview_categories", ["slug"])
    op.create_index("ix_interview_categories_user_slug", "interview_categories", ["user_id", "slug"])

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE interview_categories
            SET display_name = TRIM(regexp_replace(name, '^\\s*\\d+\\s*[\\.)_:-]?\\s*', '')),
                slug = lower(regexp_replace(TRIM(regexp_replace(name, '^\\s*\\d+\\s*[\\.)_:-]?\\s*', '')), '[^a-zA-Z0-9]+', '_', 'g'))
            WHERE display_name IS NULL
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE interview_categories
            SET display_name = 'Project',
                name = 'Project',
                slug = 'project',
                icon_key = 'briefcase-business',
                sort_order = 30,
                is_system = true
            WHERE lower(replace(coalesce(display_name, name), '-', ' ')) IN ('experience', 'project')
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE interview_categories
            SET display_name = 'Role-specific',
                name = 'Role-specific',
                slug = 'role_specific',
                icon_key = 'gem',
                sort_order = 40,
                is_system = true
            WHERE lower(replace(coalesce(display_name, name), '-', ' ')) = 'role specific'
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE interview_categories
            SET display_name = 'About You',
                name = 'About You',
                slug = 'about_you',
                icon_key = 'user-round',
                sort_order = 10,
                is_system = true
            WHERE lower(replace(coalesce(display_name, name), '-', ' ')) = 'about you'
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE interview_categories
            SET display_name = 'Behaviour',
                name = 'Behaviour',
                slug = 'behaviour',
                icon_key = 'message-circle',
                sort_order = 20,
                is_system = true
            WHERE lower(replace(coalesce(display_name, name), '-', ' ')) IN ('behaviour', 'behavior')
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE interview_categories
            SET display_name = 'Company',
                name = 'Company',
                slug = 'company',
                icon_key = 'building-2',
                sort_order = 50,
                is_system = true
            WHERE lower(replace(coalesce(display_name, name), '-', ' ')) = 'company'
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_interview_categories_user_slug", table_name="interview_categories")
    op.drop_index("ix_interview_categories_slug", table_name="interview_categories")
    op.drop_column("interview_categories", "is_system")
    op.drop_column("interview_categories", "sort_order")
    op.drop_column("interview_categories", "icon_key")
    op.drop_column("interview_categories", "display_name")
    op.drop_column("interview_categories", "slug")
