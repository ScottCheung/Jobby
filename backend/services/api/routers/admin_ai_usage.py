from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.models import LLMUsageRecord, User


router = APIRouter(prefix="/api/admin/ai-usage", tags=["admin"])
_RANGES = {"1d": 1, "7d": 7, "30d": 30}


def _start_for_range(value: str) -> datetime:
    days = _RANGES.get(value)
    if days is None:
        raise HTTPException(status_code=400, detail="range must be one of: 1d, 7d, 30d")
    return datetime.now(timezone.utc) - timedelta(days=days)


def _require_admin(current_user: User) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _number(value: Decimal | int | float | None) -> float | None:
    return float(value) if value is not None else None


@router.get("/summary")
def ai_usage_summary(
    range: str = Query(default="7d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    _require_admin(current_user)
    start = _start_for_range(range)
    filters = (LLMUsageRecord.created_at >= start,)
    totals = db.execute(
        select(
            func.count(LLMUsageRecord.id),
            func.coalesce(func.sum(LLMUsageRecord.total_tokens), 0),
            func.coalesce(func.sum(LLMUsageRecord.duration_ms), 0),
            func.avg(LLMUsageRecord.duration_ms),
            func.count(LLMUsageRecord.estimated_cost_usd),
            func.coalesce(func.sum(LLMUsageRecord.estimated_cost_usd), 0),
            func.count(LLMUsageRecord.reasoning_tokens),
            func.coalesce(func.sum(LLMUsageRecord.reasoning_tokens), 0),
            func.coalesce(func.sum(LLMUsageRecord.output_tokens), 0),
        ).where(*filters)
    ).one()
    calls = int(totals[0] or 0)
    daily_rows = db.execute(
        select(
            func.date(LLMUsageRecord.created_at).label("day"),
            func.count(LLMUsageRecord.id),
            func.coalesce(func.sum(LLMUsageRecord.total_tokens), 0),
            func.count(LLMUsageRecord.estimated_cost_usd),
            func.coalesce(func.sum(LLMUsageRecord.estimated_cost_usd), 0),
        )
        .where(*filters)
        .group_by(func.date(LLMUsageRecord.created_at))
        .order_by(func.date(LLMUsageRecord.created_at))
    ).all()
    feature_rows = db.execute(
        select(
            LLMUsageRecord.operation,
            func.count(LLMUsageRecord.id),
            func.coalesce(func.sum(LLMUsageRecord.total_tokens), 0),
            func.count(LLMUsageRecord.estimated_cost_usd),
            func.coalesce(func.sum(LLMUsageRecord.estimated_cost_usd), 0),
        )
        .where(*filters)
        .group_by(LLMUsageRecord.operation)
        .order_by(desc(func.coalesce(func.sum(LLMUsageRecord.estimated_cost_usd), 0)))
    ).all()

    return {
        "cost_usd": _number(totals[5]) if int(totals[4] or 0) == calls else None,
        "calls": calls,
        "total_tokens": int(totals[1] or 0),
        "avg_duration_ms": round(float(totals[3] or 0)),
        "reasoning_output_ratio": (
            float(totals[7]) / int(totals[8])
            if calls and int(totals[6] or 0) == calls and int(totals[8] or 0)
            else None
        ),
        "daily": [
            {
                "date": row[0].isoformat(),
                "calls": int(row[1] or 0),
                "total_tokens": int(row[2] or 0),
                "cost_usd": _number(row[4]) if int(row[3] or 0) == int(row[1] or 0) else None,
            }
            for row in daily_rows
        ],
        "by_feature": [
            {
                "feature": row[0],
                "calls": int(row[1] or 0),
                "total_tokens": int(row[2] or 0),
                "cost_usd": _number(row[4]) if int(row[3] or 0) == int(row[1] or 0) else None,
            }
            for row in feature_rows
        ],
    }


@router.get("/calls")
def ai_usage_calls(
    range: str = Query(default="7d"),
    feature: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    _require_admin(current_user)
    start = _start_for_range(range)
    filters = [LLMUsageRecord.created_at >= start]
    if feature:
        filters.append(LLMUsageRecord.operation == feature)

    total = int(db.scalar(select(func.count(LLMUsageRecord.id)).where(*filters)) or 0)
    rows = db.execute(
        select(LLMUsageRecord, User.display_name, User.email)
        .outerjoin(User, User.id == LLMUsageRecord.user_id)
        .where(*filters)
        .order_by(LLMUsageRecord.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    items = []
    for record, display_name, email in rows:
        items.append(
            {
                "id": str(record.id),
                "feature": record.operation,
                "user": display_name or email,
                "user_email": email,
                "provider": record.provider,
                "model": record.model,
                "input_tokens": record.input_tokens,
                "output_tokens": record.output_tokens,
                "cached_input_tokens": record.cached_input_tokens or 0,
                "reasoning_tokens": record.reasoning_tokens,
                "answer_tokens": (
                    max(record.output_tokens - record.reasoning_tokens, 0)
                    if record.reasoning_tokens is not None
                    else None
                ),
                "total_tokens": record.total_tokens,
                "reasoning_effort": record.reasoning_effort,
                "cost_usd": _number(record.estimated_cost_usd),
                "duration_ms": record.duration_ms,
                "slow": record.duration_ms >= 90_000,
                "generation_id": record.correlation_id,
                "status": "completed",
                "created_at": record.created_at.isoformat(),
            }
        )
    return {"items": items, "total": total, "limit": limit, "offset": offset}
