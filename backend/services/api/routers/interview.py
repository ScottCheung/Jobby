from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, func
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
    PlanTask,
    PracticePlan,
    AudioRecord,
    UserGamification,
    GamificationTransaction,
    UserDailyQuest,
    UserAchievement
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
    PlanTaskRead,
    PlanTaskUpdate,
    DailySummarySchema,
    HeatmapDataSchema,
    GamificationTransactionRead,
    DailyQuestRead,
    AchievementRead
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

# --- Auto-Tagging Rules ---
AUTO_TAG_RULES = {
    "Backend": ["backend", "api", "database", "sql", "nosql", "postgres", "redis", "microservices", "docker", "kubernetes", "di", "dependency injection", "orm"],
    "Frontend": ["frontend", "react", "vue", "angular", "css", "html", "javascript", "typescript", "dom", "nextjs", "webpack", "state management", "redux"],
    "Architecture": ["architecture", "system design", "scalability", "load balancing", "caching", "cap theorem", "solid", "design pattern"],
    "Behavioral": ["behavioral", "conflict", "challenge", "mistake", "leadership", "teamwork", "communication", "failed", "success", "tell me about a time"],
    "Algorithm": ["algorithm", "data structure", "big o", "sort", "search", "tree", "graph", "dynamic programming", "leetcode"],
    "DevOps": ["devops", "ci/cd", "pipeline", "jenkins", "github actions", "aws", "gcp", "azure", "terraform", "infrastructure"],
    "Security": ["security", "auth", "oauth", "jwt", "encryption", "xss", "csrf", "cors", "vulnerability"],
}

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
    title_stripped = payload.title.strip()
    existing_question = db.scalar(
        select(InterviewQuestion)
        .where(
            InterviewQuestion.user_id == current_user.id,
            func.lower(InterviewQuestion.title) == func.lower(title_stripped)
        )
    )
    if existing_question:
        return existing_question

    data = payload.model_dump(exclude={"tags"})
    data["title"] = title_stripped
    question = InterviewQuestion(user_id=current_user.id, **data)
    
    if payload.tags:
        tags = db.scalars(select(InterviewTag).where(InterviewTag.id.in_(payload.tags), InterviewTag.user_id == current_user.id)).all()
        question.tags = list(tags)
        
    db.add(question)
    
    # Auto-Tagging Logic
    text_to_search = f"{question.title} {question.answer_objective or ''}".lower()
    tags_to_add = set()
    
    for tag_name, keywords in AUTO_TAG_RULES.items():
        if any(kw.lower() in text_to_search for kw in keywords):
            tags_to_add.add(tag_name)
            
    if tags_to_add:
        # Get existing tags for this user (case-insensitive check)
        existing_tags = db.scalars(
            select(InterviewTag).where(
                InterviewTag.user_id == current_user.id,
                func.lower(InterviewTag.name).in_([t.lower() for t in tags_to_add])
            )
        ).all()
        existing_tag_names_lower = {t.name.lower(): t for t in existing_tags}
        
        # Create missing tags
        all_relevant_tags = list(existing_tags)
        for tag_name in tags_to_add:
            tag_name_lower = tag_name.lower()
            if tag_name_lower not in existing_tag_names_lower:
                new_tag = InterviewTag(user_id=current_user.id, name=tag_name) # Default primary color
                db.add(new_tag)
                all_relevant_tags.append(new_tag)
                existing_tag_names_lower[tag_name_lower] = new_tag
                
        # Combine with explicit tags using SQLAlchemy relationship
        for tag in all_relevant_tags:
            if tag not in question.tags:
                question.tags.append(tag)
            
    db.commit()
    db.refresh(question)
    return question

@router.post("/questions/batch", response_model=list[InterviewQuestionRead], status_code=status.HTTP_201_CREATED)
def batch_create_questions(
    payload: list[InterviewQuestionCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    created_questions = []
    
    # 1. Deduplicate within payload (case-insensitive) and strip titles
    seen_titles_in_payload = set()
    unique_payload = []
    for q_payload in payload:
        title_stripped = q_payload.title.strip()
        title_lower = title_stripped.lower()
        if title_lower not in seen_titles_in_payload:
            seen_titles_in_payload.add(title_lower)
            unique_payload.append((title_stripped, title_lower, q_payload))
            
    if not unique_payload:
        return []

    # 2. Check which titles already exist in database for this user (case-insensitive)
    existing_questions = db.scalars(
        select(InterviewQuestion)
        .where(
            InterviewQuestion.user_id == current_user.id,
            func.lower(InterviewQuestion.title).in_([item[1] for item in unique_payload])
        )
    ).all()
    existing_titles_lower = {q.title.strip().lower() for q in existing_questions}
    
    # 3. Filter to keep only the ones that do not exist yet
    to_create = []
    all_tag_ids = set()
    for title_stripped, title_lower, q_payload in unique_payload:
        if title_lower not in existing_titles_lower:
            to_create.append((title_stripped, q_payload))
            if q_payload.tags:
                all_tag_ids.update(q_payload.tags)
                
    if not to_create:
        return []
            
    tags_by_id = {}
    if all_tag_ids:
        tags = db.scalars(
            select(InterviewTag)
            .where(InterviewTag.id.in_(list(all_tag_ids)), InterviewTag.user_id == current_user.id)
        ).all()
        tags_by_id = {tag.id: tag for tag in tags}
        
    for title_stripped, q_payload in to_create:
        data = q_payload.model_dump(exclude={"tags"})
        data["title"] = title_stripped
        question = InterviewQuestion(user_id=current_user.id, **data)
        if q_payload.tags:
            question.tags = [tags_by_id[t_id] for t_id in q_payload.tags if t_id in tags_by_id]
        db.add(question)
        created_questions.append(question)
        
    # Auto-Tagging for batch
    all_tags_to_add = set()
    question_tags_map = {} # InterviewQuestion -> set of tag names
    
    for q in created_questions:
        text_to_search = f"{q.title} {q.answer_objective or ''}".lower()
        tags_for_q = set()
        for tag_name, keywords in AUTO_TAG_RULES.items():
            if any(kw.lower() in text_to_search for kw in keywords):
                tags_for_q.add(tag_name)
        
        if tags_for_q:
            all_tags_to_add.update(tags_for_q)
            question_tags_map[q] = tags_for_q
            
    if all_tags_to_add:
        # Case-insensitive query for existing tags
        existing_tags = db.scalars(
            select(InterviewTag).where(
                InterviewTag.user_id == current_user.id,
                func.lower(InterviewTag.name).in_([t.lower() for t in all_tags_to_add])
            )
        ).all()
        existing_tags_by_name_lower = {t.name.lower(): t for t in existing_tags}
        
        # Create missing tags
        for tag_name in all_tags_to_add:
            tag_name_lower = tag_name.lower()
            if tag_name_lower not in existing_tags_by_name_lower:
                new_tag = InterviewTag(user_id=current_user.id, name=tag_name)
                db.add(new_tag)
                existing_tags_by_name_lower[tag_name_lower] = new_tag
                
        # Associate tags with questions using relationship appending
        for q, tags_to_add in question_tags_map.items():
            for tag_name in tags_to_add:
                tag_obj = existing_tags_by_name_lower[tag_name.lower()]
                if tag_obj not in q.tags:
                    q.tags.append(tag_obj)
        
    db.commit()
    for q in created_questions:
        db.refresh(q)
            
    return created_questions

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
    from datetime import datetime, timezone, timedelta
    
    question = db.scalar(select(InterviewQuestion).where(InterviewQuestion.id == payload.question_id, InterviewQuestion.user_id == current_user.id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    record = PracticeRecord(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    
    # --- Auto-Complete Plan Task ---
    pending_task = db.scalar(
        select(PlanTask)
        .join(PracticePlan)
        .where(
            PracticePlan.user_id == current_user.id,
            PlanTask.question_id == payload.question_id,
            PlanTask.status == "pending"
        )
        .order_by(PlanTask.scheduled_date.asc())
        .limit(1)
    )
    if pending_task:
        pending_task.status = "completed"

    # --- Gamification Logic ---
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not gamification:
        gamification = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, loot_boxes=0)
        db.add(gamification)
        
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if this question was already practiced today to prevent duplicate rewards
    already_practiced_today = db.scalar(
        select(func.count(PracticeRecord.id))
        .where(
            PracticeRecord.user_id == current_user.id,
            PracticeRecord.question_id == payload.question_id,
            PracticeRecord.date >= today_start,
            PracticeRecord.id != record.id
        )
    ) > 0
    
    last_practice = gamification.last_practice_date
    
    xp_gained = 0
    coins_gained = 0
    is_streak_extended = False
    
    if not already_practiced_today:
        xp_gained = 10
        coins_gained = 2
        
        # Log basic practice transaction
        practice_tx = GamificationTransaction(
            user_id=current_user.id,
            amount=xp_gained,
            currency="xp",
            reason="Practice Completed",
            reference_id=str(record.id)
        )
        practice_coin_tx = GamificationTransaction(
            user_id=current_user.id,
            amount=coins_gained,
            currency="coin",
            reason="Practice Completed",
            reference_id=str(record.id)
        )
        db.add(practice_tx)
        db.add(practice_coin_tx)
        
        if not last_practice:
            gamification.streak_days = 1
            is_streak_extended = True
        else:
            last_date = last_practice.date()
            today_date = now.date()
            
            diff = (today_date - last_date).days
            if diff == 1:
                gamification.streak_days += 1
                is_streak_extended = True
                if gamification.streak_days % 7 == 0:
                    streak_xp = 500
                    xp_gained += streak_xp
                    streak_tx = GamificationTransaction(
                        user_id=current_user.id,
                        amount=streak_xp,
                        currency="xp",
                        reason=f"{gamification.streak_days}-Day Streak Bonus",
                        reference_id=str(record.id)
                    )
                    db.add(streak_tx)
            elif diff > 1:
                gamification.streak_days = 1
                is_streak_extended = True
                
        gamification.last_practice_date = now
        gamification.xp += xp_gained
        gamification.coins += coins_gained
        
        # Calculate Level
        import math
        new_level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
        gamification.level = new_level
        
    # --- Update Daily Quests ---
    quests = db.scalars(
        select(UserDailyQuest)
        .where(
            UserDailyQuest.user_id == current_user.id,
            func.date(UserDailyQuest.quest_date) == now.date()
        )
    ).all()
    for q in quests:
        if q.quest_type == "practice_1" and q.current_value < q.target_value:
            q.current_value += 1
        elif q.quest_type == "practice_3" and q.current_value < q.target_value:
            q.current_value += 1
            
    # --- Check Achievements ---
    total_practices = db.scalar(
        select(func.count(PracticeRecord.id))
        .where(PracticeRecord.user_id == current_user.id)
    )
    
    def award_achievement(badge_id, badge_name, description):
        exists = db.scalar(select(UserAchievement).where(UserAchievement.user_id == current_user.id, UserAchievement.badge_id == badge_id).limit(1))
        if not exists:
            db.add(UserAchievement(user_id=current_user.id, badge_id=badge_id, badge_name=badge_name, description=description, unlocked_at=now))
            
    if total_practices >= 1:
        award_achievement("first_steps", "First Steps", "Practice your first question")
    if total_practices >= 10:
        award_achievement("tenacious", "Tenacious", "Practice 10 questions")
    if gamification.streak_days >= 7:
        award_achievement("streak_master", "Streak Master", "Reach a 7-day streak")
    
    db.commit()
    db.refresh(record)
    
    # Inject gamification update into the response record explicitly using a dict
    from services.shared.schemas import PracticeRecordRead
    record_dict = PracticeRecordRead.model_validate(record).model_dump()
    record_dict["gamification_update"] = {
        "xp_gained": xp_gained,
        "coins_gained": coins_gained,
        "new_streak": gamification.streak_days,
        "new_level": gamification.level,
        "is_streak_extended": is_streak_extended
    }
    
    return record_dict

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


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_practice_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()


@router.put("/plans/{plan_id}/tasks/{task_id}", response_model=PlanTaskRead)
def update_plan_task(
    plan_id: UUID,
    task_id: UUID,
    payload: PlanTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    plan = db.scalar(select(PracticePlan).where(PracticePlan.id == plan_id, PracticePlan.user_id == current_user.id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    task = db.scalar(select(PlanTask).where(PlanTask.id == task_id, PlanTask.plan_id == plan_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task

# Gamification Endpoints
@router.get("/gamification/summary", response_model=DailySummarySchema)
def get_daily_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    from datetime import datetime, timezone
    
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get today's practice records
    todays_records = db.scalars(
        select(PracticeRecord)
        .where(
            PracticeRecord.user_id == current_user.id,
            PracticeRecord.date >= today_start
        )
    ).all()
    
    completed_questions = len(list(todays_records))
    
    new_questions = 0
    review_questions = 0
    
    total_speaking_time = 0
    best_score = -1
    best_answer_title = None
    
    xp_gained_today = completed_questions * 10
    coins_gained_today = completed_questions * 2
    
    for record in todays_records:
        prior_practice = db.scalar(
            select(func.count(PracticeRecord.id))
            .where(
                PracticeRecord.user_id == current_user.id,
                PracticeRecord.question_id == record.question_id,
                PracticeRecord.date < today_start
            )
        )
        if prior_practice > 0:
            review_questions += 1
        else:
            new_questions += 1
            
        for audio in record.audio_records:
            if audio.duration:
                total_speaking_time += audio.duration
                
        if record.confidence_score is not None and record.confidence_score > best_score:
            best_score = record.confidence_score
            if record.question:
                best_answer_title = record.question.title

    next_level_xp = ((gamification.level if gamification else 1) ** 2) * 100
    
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    has_checked_in_today = False
    if gamification and gamification.last_checkin_date:
        if gamification.last_checkin_date.date() == now.date():
            has_checked_in_today = True

    return {
        "completed_questions": completed_questions,
        "new_questions": new_questions,
        "review_questions": review_questions,
        "total_speaking_time_seconds": total_speaking_time,
        "best_answer_title": best_answer_title,
        "current_streak": gamification.streak_days if gamification else 0,
        "xp_gained_today": xp_gained_today,
        "coins_gained_today": coins_gained_today,
        "level": gamification.level if gamification else 1,
        "total_xp": gamification.xp if gamification else 0,
        "next_level_xp": next_level_xp,
        "loot_boxes": gamification.loot_boxes if gamification else 0,
        "has_checked_in_today": has_checked_in_today,
        "total_coins": gamification.coins if gamification else 0
    }

@router.get("/gamification/heatmap", response_model=HeatmapDataSchema)
def get_gamification_heatmap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    from sqlalchemy import cast, Date
    
    results = db.execute(
        select(cast(PracticeRecord.date, Date).label("date"), func.count(PracticeRecord.id).label("count"))
        .where(PracticeRecord.user_id == current_user.id)
        .group_by(cast(PracticeRecord.date, Date))
    ).all()
    
    entries = [{"date": r.date.isoformat(), "count": r.count} for r in results]
    
    return {"entries": entries}


@router.get("/gamification/transactions", response_model=list[GamificationTransactionRead])
def get_gamification_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    transactions = db.scalars(
        select(GamificationTransaction)
        .where(GamificationTransaction.user_id == current_user.id)
        .order_by(GamificationTransaction.created_at.desc())
    ).all()
    return transactions


import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

class LootBoxResponse(BaseModel):
    coins_won: int
    new_balance: int

@router.post("/gamification/checkin")
def daily_checkin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not gamification:
        gamification = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, loot_boxes=0)
        db.add(gamification)
        
    now = datetime.now(timezone.utc)
    # Check if already checked in today
    if gamification.last_checkin_date and gamification.last_checkin_date.date() == now.date():
        raise HTTPException(status_code=400, detail="Already checked in today")
        
    # Award XP and Loot box
    gamification.last_checkin_date = now
    gamification.xp += 50
    gamification.loot_boxes += 1
    
    # Log transaction
    tx_xp = GamificationTransaction(
        user_id=current_user.id,
        amount=50,
        currency="xp",
        reason="Daily Check-in Bonus"
    )
    db.add(tx_xp)
    db.commit()
    
    return {"message": "Checked in successfully", "xp_earned": 50, "loot_boxes_earned": 1}

@router.post("/gamification/lootbox/open", response_model=LootBoxResponse)
def open_lootbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not gamification or gamification.loot_boxes <= 0:
        raise HTTPException(status_code=400, detail="No loot boxes available")
        
    gamification.loot_boxes -= 1
    
    coins_won = random.randint(10, 50)
    gamification.coins += coins_won
    
    tx_coin = GamificationTransaction(
        user_id=current_user.id,
        amount=coins_won,
        currency="coin",
        reason="Opened Loot Box"
    )
    db.add(tx_coin)
    db.commit()
    
    return LootBoxResponse(coins_won=coins_won, new_balance=gamification.coins)

@router.get("/gamification/quests", response_model=list[DailyQuestRead])
def get_daily_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # Get today's quests
    quests = db.scalars(
        select(UserDailyQuest)
        .where(UserDailyQuest.user_id == current_user.id)
        .where(func.date(UserDailyQuest.quest_date) == today)
    ).all()
    
    if not quests:
        # Generate quests
        quests = [
            UserDailyQuest(user_id=current_user.id, quest_date=now, quest_type="practice_1", title="First Steps", description="Practice 1 question today", target_value=1),
            UserDailyQuest(user_id=current_user.id, quest_date=now, quest_type="practice_3", title="Consistent Effort", description="Practice 3 questions today", target_value=3),
            UserDailyQuest(user_id=current_user.id, quest_date=now, quest_type="high_confidence", title="Confident", description="Rate a practice 4 or 5 stars", target_value=1)
        ]
        for q in quests:
            db.add(q)
        db.commit()
        for q in quests:
            db.refresh(q)
            
    return quests

@router.post("/gamification/quests/{quest_id}/claim")
def claim_quest(
    quest_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    quest = db.scalar(select(UserDailyQuest).where(UserDailyQuest.id == quest_id, UserDailyQuest.user_id == current_user.id))
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
        
    if quest.is_claimed:
        raise HTTPException(status_code=400, detail="Quest already claimed")
        
    if quest.current_value < quest.target_value:
        raise HTTPException(status_code=400, detail="Quest not completed yet")
        
    quest.is_claimed = True
    
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if not gamification:
        gamification = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, loot_boxes=0)
        db.add(gamification)
    gamification.loot_boxes += 1
        
    db.commit()
    return {"message": "Quest claimed", "loot_boxes_earned": 1}

@router.get("/gamification/achievements", response_model=list[AchievementRead])
def get_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    achievements = db.scalars(
        select(UserAchievement)
        .where(UserAchievement.user_id == current_user.id)
        .order_by(UserAchievement.unlocked_at.desc())
    ).all()
    return achievements


@router.post("/gamification/reset")
def reset_account_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    from sqlalchemy import delete
    
    # Delete achievements
    db.execute(delete(UserAchievement).where(UserAchievement.user_id == current_user.id))
    # Delete daily quests
    db.execute(delete(UserDailyQuest).where(UserDailyQuest.user_id == current_user.id))
    # Delete transactions
    db.execute(delete(GamificationTransaction).where(GamificationTransaction.user_id == current_user.id))
    # Delete practice plans
    db.execute(delete(PracticePlan).where(PracticePlan.user_id == current_user.id))
    # Delete practice records
    db.execute(delete(PracticeRecord).where(PracticeRecord.user_id == current_user.id))
    # Delete gamification profile
    db.execute(delete(UserGamification).where(UserGamification.user_id == current_user.id))
    
    db.commit()
    return {"message": "Account data reset successfully"}

