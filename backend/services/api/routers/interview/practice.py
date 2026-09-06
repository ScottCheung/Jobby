import math
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.deepseek import DeepSeekError, evaluate_practice_answer
from services.shared.models import (
    AudioRecord,
    GamificationTransaction,
    InterviewQuestion,
    PlanTask,
    PracticeEvaluation,
    PracticePlan,
    PracticeRecord,
    User,
    UserGamification,
    UserQuestion,
)
from services.shared.schemas import (
    PlanTaskBase,
    PlanTaskRead,
    PlanTaskUpdate,
    PracticeEvaluationRead,
    PracticePlanBase,
    PracticePlanRead,
    PracticeRecordCreate,
    PracticeRecordRead,
    PracticeRecordUpdate,
    PracticeTranscriptionRead,
)
from services.shared.settings import get_settings
from services.shared.speech_to_text import (
    SpeechTranscriptionError,
    SpeechTranscriptionUnavailableError,
    transcribe_audio_bytes,
)
from services.shared.storage import StorageError, get_object_storage
from services.shared.time_utils import ensure_utc_datetime, parse_datetime_to_utc

from .gamification import (
    _spend_coins,
    add_economy_transactions,
    enforce_daily_limits,
    evaluate_badges,
    get_gamification_config,
    get_item_quantity,
    get_or_create_gamification,
    get_user_inventory_dict,
    modify_user_inventory_item,
    update_user_daily_quests,
)
from .helpers import _read_uploaded_audio, refresh_question_metrics

router = APIRouter(tags=["Practice"])

@router.get("/practice-records", response_model=list[PracticeRecordRead])
def list_practice_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    records = db.scalars(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.audio_records))
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
    
    user_q = db.scalar(
        select(UserQuestion).where(
            UserQuestion.question_id == payload.question_id,
            UserQuestion.user_id == current_user.id,
        )
    )
    if not user_q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    now = datetime.now(timezone.utc)
    submitted_at = ensure_utc_datetime(payload.submitted_at or payload.date or now)
    started_at = ensure_utc_datetime(payload.started_at) if payload.started_at else None
    duration_seconds = payload.duration_seconds
    if duration_seconds is None and started_at is not None:
        duration_seconds = max(
            0,
            int((submitted_at - started_at).total_seconds()),
        )
    if started_at is None and duration_seconds is not None:
        started_at = submitted_at - timedelta(seconds=duration_seconds)

    record_data = payload.model_dump(exclude={"date"})
    record_data.update(
        {
            "started_at": started_at,
            "submitted_at": submitted_at,
            "duration_seconds": duration_seconds,
        }
    )
    record = PracticeRecord(
        user_id=current_user.id,
        date=ensure_utc_datetime(payload.date) if payload.date else submitted_at,
        **record_data,
    )
    db.add(record)
    user_q.practice_count += 1
    if user_q.first_practiced_at is None:
        user_q.first_practiced_at = submitted_at
    user_q.last_practiced_at = submitted_at
    if duration_seconds:
        user_q.total_practice_seconds += duration_seconds
    
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
        gamification = UserGamification(user_id=current_user.id, xp=0, coins=0, level=1, streak_days=0, inventory={})
        db.add(gamification)
        
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
    loot_boxes_gained = 0
    is_streak_extended = False
    
    if not already_practiced_today:
        config_obj = get_gamification_config(db)
        reward_events = config_obj.config.get("reward_events", [])
        
        # Load practice completed rewards
        practice_event = next((ev for ev in reward_events if ev.get("event_key") == "practice_completed" and ev.get("enabled")), None)
        if practice_event:
            xp_gained = practice_event.get("xp", 10)
            coins_gained = practice_event.get("coins", 2)
            loot_boxes_gained = practice_event.get("loot_boxes", 0)
        else:
            xp_gained = 10
            coins_gained = 2
            loot_boxes_gained = 0
            
        # Update streak days
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
            elif diff > 1:
                streak_cards = get_item_quantity(db, current_user.id, "streak_card")
                if streak_cards > 0:
                    if modify_user_inventory_item(db, current_user.id, "streak_card", -1) is not None:
                        gamification.streak_days += 1
                        is_streak_extended = True
                        db.add(GamificationTransaction(
                            user_id=current_user.id,
                            amount=0,
                            currency="item",
                            reason="Streak saved by Streak Saver Card!"
                        ))
                    else:
                        gamification.streak_days = 1
                        is_streak_extended = True
                else:
                    gamification.streak_days = 1
                    is_streak_extended = True
                
        # Check 2X XP Booster status
        double_xp_active = False
        if gamification.active_boosters and gamification.active_boosters.get("double_xp_until"):
            try:
                until = parse_datetime_to_utc(gamification.active_boosters["double_xp_until"])
                if until > now:
                    double_xp_active = True
            except Exception:
                pass
        if double_xp_active:
            xp_gained *= 2

        # If streak milestone reached, add streak bonus
        streak_xp_bonus = 0
        streak_coin_bonus = 0
        streak_loot_box_bonus = 0
        
        if is_streak_extended and gamification.streak_days % 7 == 0:
            streak_event = next((ev for ev in reward_events if ev.get("event_key") == "streak_bonus_7" and ev.get("enabled")), None)
            if streak_event:
                streak_xp_bonus = streak_event.get("xp", 500)
                streak_coin_bonus = streak_event.get("coins", 0)
                streak_loot_box_bonus = streak_event.get("loot_boxes", 0)
            else:
                streak_xp_bonus = 500
                
        # Apply inflation budget caps on XP and Coins
        total_xp_gain = xp_gained + streak_xp_bonus
        total_coin_gain = coins_gained + streak_coin_bonus
        
        capped_xp_gain, capped_coin_gain = enforce_daily_limits(db, current_user, total_xp_gain, total_coin_gain, config_obj.config)
        
        # Log basic practice transactions if earned after cap
        if capped_xp_gain > 0:
            db.add(GamificationTransaction(
                user_id=current_user.id,
                amount=capped_xp_gain,
                currency="xp",
                reason="Practice Completed" if streak_xp_bonus == 0 else f"Practice Completed & {gamification.streak_days}-Day Streak Bonus",
                reference_id=str(record.id)
            ))
        if capped_coin_gain > 0:
            db.add(GamificationTransaction(
                user_id=current_user.id,
                amount=capped_coin_gain,
                currency="coin",
                reason="Practice Completed" if streak_coin_bonus == 0 else f"Practice Completed & {gamification.streak_days}-Day Streak Bonus",
                reference_id=str(record.id)
            ))
            
        gamification.last_practice_date = now
        gamification.xp += capped_xp_gain
        gamification.coins += capped_coin_gain
        total_boxes = loot_boxes_gained + streak_loot_box_bonus
        if total_boxes > 0:
            modify_user_inventory_item(db, current_user.id, "loot_box", total_boxes)
        
        # Recalculate level
        new_level = int(math.floor(math.sqrt(gamification.xp / 100.0))) + 1
        gamification.level = new_level
        
        # Output actual gains after caps for the schema response
        xp_gained = capped_xp_gain
        coins_gained = capped_coin_gain
        
    # --- Dynamic Update of Daily Quests & Badge Catalog ---
    update_user_daily_quests(db, current_user)
    evaluate_badges(db, current_user)
    
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
    refresh_question_metrics(db, payload.question_id)
    db.commit()
    
    return record_dict


@router.put("/practice-records/{record_id}", response_model=PracticeRecordRead)
def update_practice_record(
    record_id: UUID,
    payload: PracticeRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(
        select(PracticeRecord)
        .options(selectinload(PracticeRecord.audio_records))
        .where(
            PracticeRecord.id == record_id,
            PracticeRecord.user_id == current_user.id,
        )
    )
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")

    updates = payload.model_dump(exclude_unset=True)
    for field in ("started_at", "submitted_at"):
        if updates.get(field) is not None:
            updates[field] = ensure_utc_datetime(updates[field])
    if (
        "duration_seconds" not in updates
        and updates.get("started_at") is not None
        and updates.get("submitted_at") is not None
    ):
        updates["duration_seconds"] = max(
            0,
            int((updates["submitted_at"] - updates["started_at"]).total_seconds()),
        )

    for field, value in updates.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


def _practice_answer_text(record: PracticeRecord) -> str:
    raw = (record.my_answer or "").strip()
    if not raw:
        return ""
    if raw.startswith("["):
        try:
            import json
            segments = json.loads(raw)
            if isinstance(segments, list):
                return " ".join(str(segment.get("text", "")).strip() for segment in segments if isinstance(segment, dict)).strip()
        except (ValueError, TypeError):
            pass
    return raw


@router.get("/practice-records/{record_id}/evaluations", response_model=list[PracticeEvaluationRead])
def list_practice_evaluations(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    return db.scalars(
        select(PracticeEvaluation)
        .where(PracticeEvaluation.practice_record_id == record_id, PracticeEvaluation.user_id == current_user.id)
        .order_by(PracticeEvaluation.created_at.desc())
    ).all()


@router.post("/practice-records/{record_id}/evaluations", response_model=PracticeEvaluationRead, status_code=status.HTTP_201_CREATED)
def create_practice_evaluation(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
):
    record = db.scalar(select(PracticeRecord).where(PracticeRecord.id == record_id, PracticeRecord.user_id == current_user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Practice record not found")
    answer_text = _practice_answer_text(record)
    if not answer_text:
        raise HTTPException(status_code=400, detail="Add or confirm a transcript before requesting AI feedback")
    question = db.get(InterviewQuestion, record.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    try:
        result = evaluate_practice_answer(question.title, answer_text)
    except DeepSeekError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    ai_config = get_gamification_config(db).config.get("ai", {})
    cost = max(0, int(ai_config.get("practice_evaluation_cost", 5)))
    gamification = db.scalar(select(UserGamification).where(UserGamification.user_id == current_user.id))
    if gamification and gamification.active_boosters and gamification.active_boosters.get("vip_until"):
        try:
            vip_until = parse_datetime_to_utc(gamification.active_boosters["vip_until"])
            if vip_until > datetime.now(timezone.utc):
                cost = 0
        except Exception:
            pass
    transaction = _spend_coins(db, current_user, cost, "VIP Member AI evaluation" if cost == 0 else "AI practice evaluation", str(record.id))
    evaluation = PracticeEvaluation(
        practice_record_id=record.id,
        user_id=current_user.id,
        status="completed",
        provider="deepseek",
        model=get_settings().deepseek_model,
        prompt_version="evaluation-v3",
        answer_text=answer_text,
        overall_score=result["overall_score"],
        result=result,
        coins_spent=cost,
        transaction_id=transaction.id if transaction else None,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


@router.post(
    "/practice-transcriptions",
    response_model=PracticeTranscriptionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_practice_transcription(
    file: UploadFile = File(...),
    current_user: User = Depends(get_or_create_current_user),
):
    del current_user
    content, _content_type = _read_uploaded_audio(file)
    try:
        return transcribe_audio_bytes(content)
    except SpeechTranscriptionUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SpeechTranscriptionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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

    content, content_type = _read_uploaded_audio(file)

    extension = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "mp4",
    }[content_type]
    key = f"practice-audio/{current_user.id}/{record_id}/{uuid4()}.{extension}"
    try:
        url_path = get_object_storage().upload(key, content, content_type)
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    audio_rec = AudioRecord(
        practice_record_id=record_id,
        url_path=url_path,
        storage_key=key,
    )
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
        
    for audio in record.audio_records:
        if audio.storage_key:
            try:
                get_object_storage().delete(audio.storage_key)
            except StorageError:
                pass
        else:
            import os
            filename = audio.url_path.split("/")[-1]
            file_path = os.path.join("/app/storage/audio", filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass
                
    db.delete(record)
    db.commit()


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

