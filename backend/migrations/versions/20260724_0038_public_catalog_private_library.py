"""public question catalog and private library state

Revision ID: 20260724_0038
Revises: 20260723_0037
Create Date: 2026-07-24 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260724_0038"
down_revision = "20260723_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A contributor submits a public question; they do not own a private copy.
    op.alter_column(
        "interview_questions",
        "user_id",
        new_column_name="submitted_by_user_id",
    )
    op.drop_index("ix_interview_questions_source_collection_id", table_name="interview_questions")
    op.drop_index("ix_interview_questions_source_question_id", table_name="interview_questions")
    op.drop_index("ix_interview_questions_archived_at", table_name="interview_questions")
    op.drop_constraint("fk_interview_questions_source_collection_id", "interview_questions", type_="foreignkey")
    op.drop_constraint("fk_interview_questions_source_question_id", "interview_questions", type_="foreignkey")
    op.drop_column("interview_questions", "source_collection_id")
    op.drop_column("interview_questions", "source_question_id")
    op.drop_column("interview_questions", "archived_at")
    op.drop_column("interview_questions", "is_library_copy")
    op.add_column(
        "interview_questions",
        sa.Column("status", sa.String(length=30), nullable=False, server_default="published"),
    )
    op.create_index("ix_interview_questions_status", "interview_questions", ["status"])

    # UserQuestion stores private learning state only. Playlist inclusion is
    # derived from UserCollection + InterviewCollectionQuestion.
    op.drop_index("ix_user_questions_collection_id", table_name="user_questions")
    op.drop_constraint("user_questions_collection_id_fkey", "user_questions", type_="foreignkey")
    op.drop_column("user_questions", "collection_id")
    op.drop_column("user_questions", "status")
    op.drop_column("user_questions", "added_at")
    op.drop_column("user_questions", "removed_at")
    op.add_column(
        "user_questions",
        sa.Column("is_saved", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("user_questions", sa.Column("saved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_user_questions_is_saved", "user_questions", ["is_saved"])


def downgrade() -> None:
    op.drop_index("ix_user_questions_is_saved", table_name="user_questions")
    op.drop_column("user_questions", "saved_at")
    op.drop_column("user_questions", "is_saved")
    op.add_column("user_questions", sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_questions", sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.add_column("user_questions", sa.Column("status", sa.String(length=50), nullable=False, server_default="active"))
    op.add_column("user_questions", sa.Column("collection_id", sa.UUID(), nullable=True))
    op.create_foreign_key("user_questions_collection_id_fkey", "user_questions", "interview_collections", ["collection_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_user_questions_collection_id", "user_questions", ["collection_id"])

    op.drop_index("ix_interview_questions_status", table_name="interview_questions")
    op.drop_column("interview_questions", "status")
    op.add_column("interview_questions", sa.Column("is_library_copy", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("interview_questions", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("interview_questions", sa.Column("source_question_id", sa.UUID(), nullable=True))
    op.add_column("interview_questions", sa.Column("source_collection_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_interview_questions_source_collection_id", "interview_questions", "interview_collections", ["source_collection_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_interview_questions_source_question_id", "interview_questions", "interview_questions", ["source_question_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_interview_questions_source_collection_id", "interview_questions", ["source_collection_id"])
    op.create_index("ix_interview_questions_source_question_id", "interview_questions", ["source_question_id"])
    op.create_index("ix_interview_questions_archived_at", "interview_questions", ["archived_at"])
    op.alter_column("interview_questions", "submitted_by_user_id", new_column_name="user_id")
