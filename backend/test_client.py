from fastapi.testclient import TestClient
from services.api.main import app
from services.shared.database import SessionLocal
from services.shared.models import User
from services.api.dependencies import get_or_create_current_user

def override_get_user():
    db = SessionLocal()
    user = db.query(User).first()
    db.close()
    return user

app.dependency_overrides[get_or_create_current_user] = override_get_user

client = TestClient(app)

response = client.post("/api/interview/questions", json={
    "title": "React",
    "frequency": "Medium",
    "importance_score": 3,
    "answer_objective": "",
    "answer_framework": ""
})

print("Status code:", response.status_code)
print("Response JSON:", response.json())
