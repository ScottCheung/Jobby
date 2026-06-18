"""create skills table

Revision ID: 20260618_0011
Revises: 20260618_0010
Create Date: 2026-06-18 21:55:42.873548
"""
from alembic import op
import sqlalchemy as sa


revision = '20260618_0011'
down_revision = '20260618_0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('skills',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('canonical_name', sa.String(length=255), nullable=False),
    sa.Column('is_alias', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_skills_name'), 'skills', ['name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_skills_name'), table_name='skills')
    op.drop_table('skills')
