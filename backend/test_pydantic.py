from datetime import datetime
from uuid import uuid4
from pydantic import BaseModel, Field

class OrmModel(BaseModel):
    class Config:
        from_attributes = True

class QuestionAnswerRead(OrmModel):
    id: str
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")

data1 = {"id": "1", "metadata": {"key": "val1"}}
data2 = {"id": "2", "metadata_": {"key": "val2"}}

try:
    obj1 = QuestionAnswerRead.model_validate(data1)
    print("obj1 metadata:", obj1.metadata)
except Exception as e:
    print("obj1 error:", e)

try:
    obj2 = QuestionAnswerRead.model_validate(data2)
    print("obj2 metadata:", obj2.metadata)
except Exception as e:
    print("obj2 error:", e)
