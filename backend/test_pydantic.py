import asyncio
from services.shared.database import SessionLocal
from services.shared.models import User
from services.shared.schemas import InterviewQuestionCreate, InterviewQuestionRead
from services.api.routers.interview import create_question

def test():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No users found.")
            return

        payload = InterviewQuestionCreate(
            title="Test Pydantic Serialization",
            frequency="Medium",
            importance_score=3,
            answer_objective="",
            answer_framework=""
        )

        question = create_question(payload=payload, db=db, current_user=user)
        print("Model created.")
        
        # Test serialization
        read_model = InterviewQuestionRead.model_validate(question)
        print("Serialization success:", read_model.model_dump_json())
    except Exception as e:
        print("Error during serialization:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
