"""create user_inventory_items table and migrate inventory data

Revision ID: 20260724_0040
Revises: 20260724_0039
Create Date: 2026-07-24 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260724_0040"
down_revision = "20260724_0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_inventory_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_key", sa.String(length=50), nullable=False, index=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("extra_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "item_key", name="uq_user_inventory_item_key"),
    )
    op.create_index("ix_user_inventory_items_user_id", "user_inventory_items", ["user_id"])
    op.create_index("ix_user_inventory_items_item_key", "user_inventory_items", ["item_key"])

    # Data migration: copy items from user_gamification.inventory JSONB AND loot_boxes column into user_inventory_items
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT user_id, loot_boxes, inventory FROM user_gamification")).fetchall()
    
    for row in rows:
        user_id = row[0]
        loot_boxes = row[1] or 0
        inv = row[2] if isinstance(row[2], dict) else {}
        
        # Merge loot_boxes count
        items = dict(inv or {})
        if loot_boxes > 0:
            items["loot_box"] = max(loot_boxes, items.get("loot_box", 0))
            
        for item_key, qty in items.items():
            if isinstance(qty, int) and qty > 0:
                connection.execute(
                    sa.text("""
                        INSERT INTO user_inventory_items (user_id, item_key, quantity)
                        VALUES (:user_id, :item_key, :quantity)
                        ON CONFLICT (user_id, item_key) DO UPDATE
                        SET quantity = EXCLUDED.quantity
                    """),
                    {"user_id": user_id, "item_key": item_key, "quantity": qty}
                )


def downgrade() -> None:
    op.drop_index("ix_user_inventory_items_item_key", table_name="user_inventory_items")
    op.drop_index("ix_user_inventory_items_user_id", table_name="user_inventory_items")
    op.drop_table("user_inventory_items")
