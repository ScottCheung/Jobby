from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Any, Mapping
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from services.shared.database import SessionLocal
from services.shared.models import LLMUsageRecord


logger = logging.getLogger(__name__)

_MILLION = Decimal("1000000")
_COST_QUANTUM = Decimal("0.00000001")


@dataclass(frozen=True)
class LLMUsage:
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cached_input_tokens: int | None = None
    reasoning_tokens: int | None = None


@dataclass(frozen=True)
class LLMUsageSummary:
    calls: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cached_input_tokens: int
    estimated_cost_usd: Decimal | None
    duration_ms: int
    model: str | None = None
    operation: str | None = None
    reasoning_tokens: int | None = None
    answer_tokens: int | None = None
    reasoning_effort: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "calls": self.calls,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "cached_input_tokens": self.cached_input_tokens,
            "estimated_cost_usd": self.estimated_cost_usd,
            "duration_ms": self.duration_ms,
            "model": self.model,
            "operation": self.operation,
            "reasoning_tokens": self.reasoning_tokens,
            "answer_tokens": self.answer_tokens,
            "reasoning_effort": self.reasoning_effort,
        }


@dataclass(frozen=True)
class ModelPricing:
    cached_input_per_million: Decimal
    input_per_million: Decimal
    output_per_million: Decimal


_DEEPSEEK_PRICING = {
    "deepseek-v4-flash": (
        ModelPricing(Decimal("0.007"), Decimal("0.22"), Decimal("0.66")),
        ModelPricing(Decimal("0.014"), Decimal("0.44"), Decimal("1.32")),
    ),
    "deepseek-v4-pro": (
        ModelPricing(Decimal("0.022"), Decimal("0.66"), Decimal("1.98")),
        ModelPricing(Decimal("0.044"), Decimal("1.32"), Decimal("3.96")),
    ),
}


def _token_count(value: Any) -> int | None:
    try:
        count = int(value)
    except (TypeError, ValueError):
        return None
    return count if count >= 0 else None


def normalize_usage(provider: str, model: str, raw_usage: Mapping[str, Any]) -> LLMUsage:
    input_tokens = _token_count(raw_usage.get("input_tokens", raw_usage.get("prompt_tokens")))
    output_tokens = _token_count(raw_usage.get("output_tokens", raw_usage.get("completion_tokens")))
    total_tokens = _token_count(raw_usage.get("total_tokens"))
    cached_input_tokens = _token_count(
        raw_usage.get(
            "cached_input_tokens",
            raw_usage.get("prompt_cache_hit_tokens", raw_usage.get("cache_read_input_tokens")),
        )
    )
    completion_details = raw_usage.get("completion_tokens_details")
    reasoning_tokens = _token_count(completion_details.get("reasoning_tokens")) if isinstance(completion_details, Mapping) else None

    if input_tokens is None or output_tokens is None:
        raise ValueError("LLM usage did not include input and output token counts")
    if total_tokens is None:
        total_tokens = input_tokens + output_tokens

    return LLMUsage(
        provider=provider,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        cached_input_tokens=cached_input_tokens,
        reasoning_tokens=reasoning_tokens,
    )


def _is_peak_pricing(at: datetime) -> bool:
    hour = at.astimezone(timezone.utc).hour
    return 1 <= hour < 4 or 6 <= hour < 10


def calculate_llm_cost(
    provider: str,
    model: str,
    usage: LLMUsage,
    *,
    at: datetime | None = None,
) -> Decimal | None:
    if provider.casefold() != "deepseek":
        return None
    model_pricing = _DEEPSEEK_PRICING.get(model.casefold())
    if not model_pricing:
        return None

    pricing = model_pricing[1 if _is_peak_pricing(at or datetime.now(timezone.utc)) else 0]
    cached_tokens = usage.cached_input_tokens or 0
    uncached_tokens = max(usage.input_tokens - cached_tokens, 0)
    cost = (
        Decimal(cached_tokens) * pricing.cached_input_per_million
        + Decimal(uncached_tokens) * pricing.input_per_million
        + Decimal(usage.output_tokens) * pricing.output_per_million
    ) / _MILLION
    return cost.quantize(_COST_QUANTUM, rounding=ROUND_HALF_UP)


def get_llm_usage_summary(
    correlation_id: str,
    *,
    db: Session | None = None,
) -> LLMUsageSummary | None:
    owns_session = db is None
    session = db or SessionLocal()
    try:
        row = session.execute(
            select(
                func.count(LLMUsageRecord.id),
                func.coalesce(func.sum(LLMUsageRecord.input_tokens), 0),
                func.coalesce(func.sum(LLMUsageRecord.output_tokens), 0),
                func.coalesce(func.sum(LLMUsageRecord.total_tokens), 0),
                func.coalesce(func.sum(LLMUsageRecord.cached_input_tokens), 0),
                func.count(LLMUsageRecord.estimated_cost_usd),
                func.sum(LLMUsageRecord.estimated_cost_usd),
                func.coalesce(func.sum(LLMUsageRecord.duration_ms), 0),
                func.min(LLMUsageRecord.model),
                func.max(LLMUsageRecord.model),
                func.min(LLMUsageRecord.operation),
                func.max(LLMUsageRecord.operation),
                func.count(LLMUsageRecord.reasoning_tokens),
                func.coalesce(func.sum(LLMUsageRecord.reasoning_tokens), 0),
                func.count(LLMUsageRecord.reasoning_effort),
                func.min(LLMUsageRecord.reasoning_effort),
                func.max(LLMUsageRecord.reasoning_effort),
            ).where(LLMUsageRecord.correlation_id == correlation_id)
        ).one()
        calls = int(row[0] or 0)
        if not calls:
            return None
        model = row[8] if len(row) > 9 and row[8] == row[9] else None
        if len(row) > 9 and row[8] != row[9]:
            model = "multiple"
        operation = row[10] if len(row) > 11 and row[10] == row[11] else None
        if len(row) > 11 and row[10] != row[11]:
            operation = "multiple"
        reasoning_tokens = int(row[13] or 0) if len(row) > 13 and int(row[12] or 0) == calls else None
        answer_tokens = max(int(row[2] or 0) - reasoning_tokens, 0) if reasoning_tokens is not None else None
        reasoning_effort = None
        if len(row) > 16 and int(row[14] or 0):
            reasoning_effort = row[15] if int(row[14] or 0) == calls and row[15] == row[16] else "multiple"
        return LLMUsageSummary(
            calls=calls,
            input_tokens=int(row[1] or 0),
            output_tokens=int(row[2] or 0),
            total_tokens=int(row[3] or 0),
            cached_input_tokens=int(row[4] or 0),
            estimated_cost_usd=row[6] if int(row[5] or 0) == calls else None,
            duration_ms=int(row[7] or 0),
            model=model,
            operation=operation,
            reasoning_tokens=reasoning_tokens,
            answer_tokens=answer_tokens,
            reasoning_effort=reasoning_effort,
        )
    except Exception:
        logger.warning("Could not read LLM usage correlation_id=%s", correlation_id, exc_info=True)
        return None
    finally:
        if owns_session:
            session.close()


def record_llm_usage(
    *,
    operation: str,
    correlation_id: str | None,
    usage: LLMUsage,
    duration_ms: int,
    user_id: UUID | None = None,
    reasoning_effort: str | None = None,
) -> bool:
    db = None
    try:
        db = SessionLocal()
        db.add(
            LLMUsageRecord(
                user_id=user_id,
                operation=operation,
                correlation_id=correlation_id or str(uuid4()),
                provider=usage.provider,
                model=usage.model,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                total_tokens=usage.total_tokens,
                cached_input_tokens=usage.cached_input_tokens,
                reasoning_tokens=usage.reasoning_tokens,
                reasoning_effort=reasoning_effort,
                estimated_cost_usd=calculate_llm_cost(usage.provider, usage.model, usage),
                duration_ms=max(0, int(duration_ms)),
            )
        )
        db.commit()
        return True
    except Exception:
        if db is not None:
            db.rollback()
        logger.warning(
            "Could not persist LLM usage operation=%s correlation_id=%s",
            operation,
            correlation_id,
            exc_info=True,
        )
        return False
    finally:
        if db is not None:
            db.close()
