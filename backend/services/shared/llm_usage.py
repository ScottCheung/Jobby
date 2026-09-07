from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Any, Mapping
from uuid import uuid4

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
    "deepseek-chat": (
        ModelPricing(Decimal("0.007"), Decimal("0.22"), Decimal("0.66")),
        ModelPricing(Decimal("0.014"), Decimal("0.44"), Decimal("1.32")),
    ),
    "deepseek-reasoner": (
        ModelPricing(Decimal("0.007"), Decimal("0.22"), Decimal("0.66")),
        ModelPricing(Decimal("0.014"), Decimal("0.44"), Decimal("1.32")),
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


def record_llm_usage(
    *,
    operation: str,
    correlation_id: str | None,
    usage: LLMUsage,
    duration_ms: int,
) -> bool:
    db = None
    try:
        db = SessionLocal()
        db.add(
            LLMUsageRecord(
                operation=operation,
                correlation_id=correlation_id or str(uuid4()),
                provider=usage.provider,
                model=usage.model,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                total_tokens=usage.total_tokens,
                cached_input_tokens=usage.cached_input_tokens,
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
