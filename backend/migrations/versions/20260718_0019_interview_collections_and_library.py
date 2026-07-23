"""interview collections and library

Revision ID: 20260718_0019
Revises: 20260717_0018
Create Date: 2026-07-18 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260718_0019"
down_revision = "20260717_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_questions", sa.Column("source_collection_id", sa.UUID(), nullable=True))
    op.add_column("interview_questions", sa.Column("source_question_id", sa.UUID(), nullable=True))
    op.add_column("interview_questions", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("interview_questions", sa.Column("is_library_copy", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.create_index("ix_interview_questions_source_collection_id", "interview_questions", ["source_collection_id"])
    op.create_index("ix_interview_questions_source_question_id", "interview_questions", ["source_question_id"])
    op.create_index("ix_interview_questions_archived_at", "interview_questions", ["archived_at"])

    op.create_table(
        "interview_collections",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_url", sa.Text(), nullable=True),
        sa.Column("creator_user_id", sa.UUID(), nullable=True),
        sa.Column("collection_type", sa.String(length=50), nullable=False),
        sa.Column("price_coins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("downloads", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creator_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "interview_collection_questions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("collection_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["collection_id"], ["interview_collections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("collection_id", "question_id", name="uq_interview_collection_question"),
    )
    op.create_index("ix_interview_collection_questions_collection_id", "interview_collection_questions", ["collection_id"])
    op.create_index("ix_interview_collection_questions_question_id", "interview_collection_questions", ["question_id"])

    op.create_table(
        "user_collections",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("collection_id", sa.UUID(), nullable=False),
        sa.Column("is_purchased", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["collection_id"], ["interview_collections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "collection_id", name="uq_user_collection"),
    )
    op.create_index("ix_user_collections_user_id", "user_collections", ["user_id"])
    op.create_index("ix_user_collections_collection_id", "user_collections", ["collection_id"])

    op.create_table(
        "user_questions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("collection_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["collection_id"], ["interview_collections.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "question_id", name="uq_user_question"),
    )
    op.create_index("ix_user_questions_user_id", "user_questions", ["user_id"])
    op.create_index("ix_user_questions_question_id", "user_questions", ["question_id"])
    op.create_index("ix_user_questions_collection_id", "user_questions", ["collection_id"])

    op.create_table(
        "collection_contributors",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("collection_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("contribution_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rank", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["collection_id"], ["interview_collections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("collection_id", "user_id", name="uq_collection_contributor"),
    )
    op.create_index("ix_collection_contributors_collection_id", "collection_contributors", ["collection_id"])
    op.create_index("ix_collection_contributors_user_id", "collection_contributors", ["user_id"])

    op.create_table(
        "interview_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=255), nullable=True),
        sa.Column("seen_in_interview", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("happened_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["interview_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interview_reports_user_id", "interview_reports", ["user_id"])
    op.create_index("ix_interview_reports_question_id", "interview_reports", ["question_id"])

    op.create_foreign_key(
        "fk_interview_questions_source_collection_id",
        "interview_questions",
        "interview_collections",
        ["source_collection_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_interview_questions_source_question_id",
        "interview_questions",
        "interview_questions",
        ["source_question_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_interview_questions_source_question_id", "interview_questions", type_="foreignkey")
    op.drop_constraint("fk_interview_questions_source_collection_id", "interview_questions", type_="foreignkey")
    op.drop_table("interview_reports")
    op.drop_table("collection_contributors")
    op.drop_table("user_questions")
    op.drop_table("user_collections")
    op.drop_table("interview_collection_questions")
    op.drop_table("interview_collections")
    op.drop_index("ix_interview_questions_archived_at", table_name="interview_questions")
    op.drop_index("ix_interview_questions_source_question_id", table_name="interview_questions")
    op.drop_index("ix_interview_questions_source_collection_id", table_name="interview_questions")
    op.drop_column("interview_questions", "is_library_copy")
    op.drop_column("interview_questions", "archived_at")
    op.drop_column("interview_questions", "source_question_id")
    op.drop_column("interview_questions", "source_collection_id")
