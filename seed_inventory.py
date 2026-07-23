"""
Seed test inventory items for a specific user account.
Usage: python seed_inventory.py
"""

import sys
import os

# Add backend to path so we can reuse the shared models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend", "services"))

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL = "postgresql+psycopg://auto_job:auto_job_password@localhost:55432/auto_job_applier"
TARGET_EMAIL  = "scott5443003@gmail.com"

SEED_INVENTORY = {
    "loot_box":    50,
    "streak_card": 40,
    "double_xp":   30,
    "vip_days":    20,
}
SEED_COINS  = 1500
SEED_XP     = 800

# ─────────────────────────────────────────────────────────────────────────────
engine = create_engine(DATABASE_URL)

with Session(engine) as db:
    # 1. Find the user
    result = db.execute(
        text("SELECT id, email FROM users WHERE email = :email LIMIT 1"),
        {"email": TARGET_EMAIL},
    ).fetchone()

    if not result:
        print(f"❌  User '{TARGET_EMAIL}' not found in database.")
        sys.exit(1)

    user_id = result[0]
    print(f"✅  Found user: {result[1]} (id={user_id})")

    # 2. Find or create gamification row
    gami = db.execute(
        text("SELECT id, coins, xp FROM user_gamification WHERE user_id = :uid LIMIT 1"),
        {"uid": user_id},
    ).fetchone()

    if not gami:
        db.execute(
            text("""
                INSERT INTO user_gamification (user_id, xp, coins, level, streak_days, active_boosters)
                VALUES (:uid, 0, 0, 1, 0, '{}')
            """),
            {"uid": user_id},
        )
        db.commit()
        gami = db.execute(
            text("SELECT id, coins, xp FROM user_gamification WHERE user_id = :uid LIMIT 1"),
            {"uid": user_id},
        ).fetchone()
        print("   Created new gamification row.")

    gami_id  = gami[0]
    old_coins = gami[1] or 0
    old_xp    = gami[2] or 0

    existing_rows = db.execute(
        text("SELECT item_key, quantity FROM user_inventory_items WHERE user_id = :uid"),
        {"uid": user_id},
    ).fetchall()
    old_inv = {row[0]: row[1] or 0 for row in existing_rows}

    # 3. Merge inventory into relational item rows
    new_inv = dict(old_inv)
    for item_type, qty in SEED_INVENTORY.items():
        old_qty = new_inv.get(item_type, 0)
        new_inv[item_type] = old_qty + qty
        db.execute(
            text("""
                INSERT INTO user_inventory_items (user_id, item_key, quantity)
                VALUES (:uid, :item_key, :quantity)
                ON CONFLICT (user_id, item_key) DO UPDATE
                SET quantity = user_inventory_items.quantity + EXCLUDED.quantity,
                    updated_at = now()
            """),
            {"uid": user_id, "item_key": item_type, "quantity": qty},
        )

    # 4. Update
    db.execute(
        text("""
            UPDATE user_gamification
            SET
                coins     = coins + :coins,
                xp        = xp + :xp
            WHERE id = :gid
        """),
        {
            "coins":     SEED_COINS,
            "xp":        SEED_XP,
            "gid":       gami_id,
        },
    )
    db.commit()

    print()
    print("🎒  Inventory updated:")
    for k, v in new_inv.items():
        old = old_inv.get(k, 0)
        print(f"     {k:15s}  {old:2d} → {v:2d}  (+{v - old})")

    print()
    print(f"🪙  Coins:  {old_coins} → {old_coins + SEED_COINS}  (+{SEED_COINS})")
    print(f"⚡  XP:     {old_xp}   → {old_xp + SEED_XP}   (+{SEED_XP})")
    print()
    print("✨  Done! Refresh the app to see the changes.")
