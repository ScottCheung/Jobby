import sys
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from services.shared.settings import get_settings
from services.shared.models import PracticeRecord, GamificationTransaction

settings = get_settings()
engine = create_engine(settings.database_url)
Session = sessionmaker(bind=engine)
db = Session()

records = db.execute(select(PracticeRecord)).scalars().all()
print(f"Found {len(records)} practice records.")

count = 0
for r in records:
    # Check if a transaction already exists for this record
    exists = db.scalar(select(GamificationTransaction).where(GamificationTransaction.reference_id == str(r.id)).limit(1))
    if not exists:
        tx_xp = GamificationTransaction(
            user_id=r.user_id,
            amount=10,
            currency="xp",
            reason="Practice Completed (Backfilled)",
            reference_id=str(r.id),
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        tx_coin = GamificationTransaction(
            user_id=r.user_id,
            amount=2,
            currency="coin",
            reason="Practice Completed (Backfilled)",
            reference_id=str(r.id),
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        db.add(tx_xp)
        db.add(tx_coin)
        count += 2

db.commit()
print(f"Backfilled {count} transactions.")
