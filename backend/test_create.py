import asyncio
from services.shared.database import SessionLocal
from services.shared.models import User
from services.shared.schemas import InterviewQuestionCreate
from services.api.routers.interview import create_question

def test():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No users found.")
            return

        payload = InterviewQuestionCreate(
            title="Test Backend Question",
            frequency="Medium",
            importance_score=3,
            answer_objective="",
            answer_framework=""
        )

        question = create_question(payload=payload, db=db, current_user=user)
        print("Success! Created question:", question.id, question.title)
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    test()
