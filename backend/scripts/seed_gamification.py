import sys
import os
from datetime import datetime, timezone, timedelta
import random

# Add parent directory to path to import services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.shared.database import SessionLocal
from services.shared.models import User, UserGamification, PracticeRecord, InterviewQuestion

def seed(email: str):
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"No user found with email: {email}")
        return

    # Create gamification profile if it doesn't exist
    gamification = db.query(UserGamification).filter(UserGamification.user_id == user.id).first()
    if not gamification:
        gamification = UserGamification(user_id=user.id, xp=0, coins=0, level=1, streak_days=0)
        db.add(gamification)
        
    print(f"Seeding data for user {user.email}")
        
    now = datetime.now(timezone.utc)
    
    # Generate practice records for the last 40 days
    questions = db.query(InterviewQuestion).filter(InterviewQuestion.submitted_by_user_id == user.id).all()
    if not questions:
        print("No questions found. Please seed questions first.")
        return
        
    print("Simulating practices...")
    for days_ago in range(40, -1, -1):
        # 80% chance to practice on any given day
        if random.random() < 0.8:
            practice_date = now - timedelta(days=days_ago)
            # 1 to 5 questions per day
            num_q = random.randint(1, 5)
            for _ in range(num_q):
                q = random.choice(questions)
                record = PracticeRecord(
                    user_id=user.id,
                    question_id=q.id,
                    date=practice_date,
                    confidence_score=random.randint(2, 5)
                )
                db.add(record)
                
            gamification.xp += num_q * 10
            gamification.coins += num_q * 2
            gamification.last_practice_date = practice_date
            gamification.streak_days += 1
        else:
            if days_ago > 0: # don't break streak if it's today and they haven't practiced yet
                gamification.streak_days = 0
                
    gamification.level = int(pow(gamification.xp / 100.0, 0.5)) + 1
    
    db.commit()
    print(f"Data seeded! New Stats: Level {gamification.level}, XP {gamification.xp}, Coins {gamification.coins}, Streak {gamification.streak_days}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python seed_gamification.py <email>")
        sys.exit(1)
    seed(sys.argv[1])
