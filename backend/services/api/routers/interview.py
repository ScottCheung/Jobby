from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.database import get_db
from services.api.dependencies import get_or_create_current_user
from services.shared.models import (
    User,
    InterviewQuestion,
    InterviewCategory,
    InterviewTag,
    QuestionTagAssociation,
    PracticeRecord,
    PracticePlan,
    PlanTask,
    AudioRecord
)
from services.shared.schemas import (
    InterviewQuestionCreate,
    InterviewQuestionUpdate,
    InterviewQuestionRead,
    InterviewCategoryBase,
    InterviewCategoryRead,
    InterviewTagBase,
    InterviewTagRead,
    PracticeRecordCreate,
    PracticeRecordRead,
    PracticePlanBase,
    PracticePlanRead,
    PlanTaskBase,
    PlanTaskRead
)

router = APIRouter(prefix="/api/interview", tags=["Interview Practice"])

# Categories
@router.get("/categories", response_model=list[InterviewCategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    categories = db.scalars(select(InterviewCategory).where(InterviewCategory.user_id == current_user.id)).all()
    if not categories:
        default_categories = [
            "01 About Yourself",
            "02 Projects",
            "03 Behaviour Stories",
            "04 Professional",
            "05 Company Research",
            "06 Questions To Ask",
            "07 Interview Tips"
        ]
        for name in default_categories:
            cat = InterviewCategory(user_id=current_user.id, name=name)
            db.add(cat)
        db.commit()
        categories = db.scalars(select(InterviewCategory).where(InterviewCategory.user_id == current_user.id)).all()
    return categories

@router.post("/categories", response_model=InterviewCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: InterviewCategoryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    category = InterviewCategory(user_id=current_user.id, name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

# Tags
@router.get("/tags", response_model=list[InterviewTagRead])
def list_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    tags = db.scalars(select(InterviewTag).where(InterviewTag.user_id == current_user.id)).all()
    return tags

@router.post("/tags", response_model=InterviewTagRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: InterviewTagBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    tag = InterviewTag(user_id=current_user.id, name=payload.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag

# Questions
@router.get("/questions", response_model=list[InterviewQuestionRead])
def list_questions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    questions = db.scalars(
        select(InterviewQuestion)
        .where(InterviewQuestion.user_id == current_user.id)
        .order_by(InterviewQuestion.created_at.desc())
    ).all()
    return questions

@router.post("/questions", response_model=InterviewQuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: InterviewQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    data = payload.model_dump(exclude={"tags"})
    question = InterviewQuestion(user_id=current_user.id, **data)
    
    if payload.tags:
        tags = db.scalars(select(InterviewTag).where(InterviewTag.id.in_(payload.tags), InterviewTag.user_id == current_user.id)).all()
        question.tags = list(tags)
        
    db.add(question)
    db.commit()
    db.refresh(question)
    return question

@router.get("/questions/{question_id}", response_model=InterviewQuestionRead)
def get_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = db.scalar(select(InterviewQuestion).where(InterviewQuestion.id == question_id, InterviewQuestion.user_id == current_user.id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question

@router.put("/questions/{question_id}", response_model=InterviewQuestionRead)
def update_question(
    question_id: UUID,
    payload: InterviewQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = db.scalar(select(InterviewQuestion).where(InterviewQuestion.id == question_id, InterviewQuestion.user_id == current_user.id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    update_data = payload.model_dump(exclude_unset=True, exclude={"tags"})
    for key, value in update_data.items():
        setattr(question, key, value)
        
    if payload.tags is not None:
        if not payload.tags:
            question.tags = []
        else:
            tags = db.scalars(select(InterviewTag).where(InterviewTag.id.in_(payload.tags), InterviewTag.user_id == current_user.id)).all()
            question.tags = list(tags)
            
    db.commit()
    db.refresh(question)
    return question

@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = db.scalar(select(InterviewQuestion).where(InterviewQuestion.id == question_id, InterviewQuestion.user_id == current_user.id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(question)
    db.commit()

# Practice Records
@router.get("/practice-records", response_model=list[PracticeRecordRead])
def list_practice_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    records = db.scalars(
        select(PracticeRecord)
        .where(PracticeRecord.user_id == current_user.id)
        .order_by(PracticeRecord.created_at.desc())
    ).all()
    return records

@router.post("/practice-records", response_model=PracticeRecordRead, status_code=status.HTTP_201_CREATED)
def create_practice_record(
    payload: PracticeRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    question = db.scalar(select(InterviewQuestion).where(InterviewQuestion.id == payload.question_id, InterviewQuestion.user_id == current_user.id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    record = PracticeRecord(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.post("/practice-records/{record_id}/audio", status_code=status.HTTP_201_CREATED)
def upload_practice_audio(
    record_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(select(PracticeRecord).where(PracticeRecord.id == record_id, PracticeRecord.user_id == current_user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")
        
    import shutil
    import os
    
    upload_dir = "/app/storage/audio"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_id = uuid4()
    filename = f"{file_id}.webm"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    url_path = f"/api/interview/audio/{filename}"
    audio_rec = AudioRecord(practice_record_id=record_id, url_path=url_path)
    db.add(audio_rec)
    db.commit()
    db.refresh(audio_rec)
    
    return {"id": str(audio_rec.id), "url_path": url_path}

@router.delete("/practice-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_practice_record(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(select(PracticeRecord).where(PracticeRecord.id == record_id, PracticeRecord.user_id == current_user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")
        
    import os
    for audio in record.audio_records:
        filename = audio.url_path.split("/")[-1]
        file_path = os.path.join("/app/storage/audio", filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error removing audio file: {e}")
                
    db.delete(record)
    db.commit()


# Practice Plans
@router.get("/plans", response_model=list[PracticePlanRead])
def list_practice_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plans = db.scalars(
        select(PracticePlan)
        .where(PracticePlan.user_id == current_user.id)
        .order_by(PracticePlan.created_at.desc())
    ).all()
    return plans

@router.post("/plans", response_model=PracticePlanRead, status_code=status.HTTP_201_CREATED)
def create_practice_plan(
    payload: PracticePlanBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = PracticePlan(user_id=current_user.id, **payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/plans/{plan_id}/tasks", response_model=list[PlanTaskRead])
def list_plan_tasks(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    tasks = db.scalars(
        select(PlanTask)
        .where(PlanTask.plan_id == plan_id)
        .order_by(PlanTask.scheduled_date.asc())
    ).all()
    return tasks

@router.post("/plans/{plan_id}/tasks", response_model=PlanTaskRead, status_code=status.HTTP_201_CREATED)
def create_plan_task(
    plan_id: UUID,
    payload: PlanTaskBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    task = PlanTask(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task
