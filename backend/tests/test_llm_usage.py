from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.shared import deepseek, llm_usage


def _usage(**overrides):
    values = {
        "provider": "deepseek",
        "model": "deepseek-v4-flash",
        "input_tokens": 100_000,
        "output_tokens": 100_000,
        "total_tokens": 200_000,
        "cached_input_tokens": 20_000,
    }
    values.update(overrides)
    return llm_usage.LLMUsage(**values)


def test_normalizes_deepseek_usage_fields() -> None:
    usage = llm_usage.normalize_usage(
        "deepseek",
        "deepseek-v4-flash",
        {
            "prompt_tokens": 120,
            "completion_tokens": 30,
            "total_tokens": 150,
            "prompt_cache_hit_tokens": 40,
            "prompt_cache_miss_tokens": 80,
        },
    )

    assert usage.input_tokens == 120
    assert usage.output_tokens == 30
    assert usage.total_tokens == 150
    assert usage.cached_input_tokens == 40


def test_calculates_cached_and_uncached_cost_with_decimal() -> None:
    usage = _usage()

    cost = llm_usage.calculate_llm_cost(
        usage.provider,
        usage.model,
        usage,
        at=datetime(2026, 9, 8, 12, tzinfo=timezone.utc),
    )

    assert cost == Decimal("0.08374000")


def test_unknown_retired_model_price_is_not_estimated() -> None:
    assert llm_usage.calculate_llm_cost(
        "deepseek",
        "deepseek-chat",
        _usage(),
        at=datetime(2026, 9, 8, 12, tzinfo=timezone.utc),
    ) is None


def test_usage_summary_aggregates_database_values() -> None:
    class Result:
        def one(self):
            return (2, 300, 50, 350, 40, 2, Decimal("0.01230000"), 3000)

    class FakeSession:
        def execute(self, _statement):
            return Result()

    summary = llm_usage.get_llm_usage_summary("generation-1", db=FakeSession())

    assert summary is not None
    assert summary.calls == 2
    assert summary.total_tokens == 350
    assert summary.estimated_cost_usd == Decimal("0.01230000")
    assert summary.duration_ms == 3000


def test_completed_provider_response_records_once() -> None:
    response = MagicMock()
    response.json.return_value = {
        "model": "deepseek-v4-flash",
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 8,
            "total_tokens": 20,
            "prompt_cache_hit_tokens": 3,
        },
        "choices": [{"message": {"content": '{"ok": true}'}}],
    }
    settings = SimpleNamespace(
        deepseek_api_key="test-key",
        deepseek_base_url="https://ai.example.test",
        deepseek_model="deepseek-chat",
    )

    with (
        patch.object(deepseek, "get_settings", return_value=settings),
        patch.object(deepseek.httpx, "post", return_value=response),
        patch.object(deepseek, "record_llm_usage") as record,
    ):
        assert deepseek._complete([], operation="resume_tailor", correlation_id="generation-1") == {"ok": True}

    record.assert_called_once()
    assert record.call_args.kwargs["operation"] == "resume_tailor"
    assert record.call_args.kwargs["correlation_id"] == "generation-1"
    assert record.call_args.kwargs["usage"].total_tokens == 20
    assert record.call_args.kwargs["usage"].model == "deepseek-v4-flash"


def test_same_correlation_id_can_be_aggregated_from_multiple_calls() -> None:
    records = []

    class FakeSession:
        def add(self, record):
            records.append(record)

        def commit(self):
            return None

        def rollback(self):
            return None

        def close(self):
            return None

    with patch.object(llm_usage, "SessionLocal", return_value=FakeSession()):
        assert llm_usage.record_llm_usage(
            operation="resume_tailor",
            correlation_id="generation-1",
            usage=_usage(input_tokens=100, output_tokens=20, total_tokens=120),
            duration_ms=1000,
        )
        assert llm_usage.record_llm_usage(
            operation="resume_tailor",
            correlation_id="generation-1",
            usage=_usage(input_tokens=200, output_tokens=30, total_tokens=230),
            duration_ms=2000,
        )

    matching = [record for record in records if record.correlation_id == "generation-1"]
    assert len(matching) == 2
    assert sum(record.total_tokens for record in matching) == 350
    assert sum(record.duration_ms for record in matching) == 3000


def test_usage_recording_failure_does_not_raise() -> None:
    db = MagicMock()
    db.commit.side_effect = RuntimeError("database unavailable")

    with patch.object(llm_usage, "SessionLocal", return_value=db):
        assert not llm_usage.record_llm_usage(
            operation="resume_tailor",
            correlation_id="generation-1",
            usage=_usage(),
            duration_ms=100,
        )

    db.rollback.assert_called_once()
    db.close.assert_called_once()
