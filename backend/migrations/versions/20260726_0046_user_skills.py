"""add user skills table

Revision ID: 20260726_0046
Revises: 20260727_0045
Create Date: 2026-07-26 00:46:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '20260726_0046'
down_revision = '20260727_0045'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_skills',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('skill_name', sa.String(length=255), nullable=False),
        sa.Column('canonical_name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'canonical_name', name='uq_user_skills_user_canonical_name'),
    )
    op.create_index(op.f('ix_user_skills_user_id'), 'user_skills', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_skills_canonical_name'), 'user_skills', ['canonical_name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_skills_canonical_name'), table_name='user_skills')
    op.drop_index(op.f('ix_user_skills_user_id'), table_name='user_skills')
    op.drop_table('user_skills')
