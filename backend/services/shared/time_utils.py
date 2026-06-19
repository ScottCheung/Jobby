from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def parse_datetime_to_utc(value: object) -> datetime | None:
    if value in ("", None):
        return None
    if isinstance(value, datetime):
        return ensure_utc_datetime(value)

    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "pending", "not available"}:
        return None

    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return ensure_utc_datetime(parsed)


def utc_isoformat(value: object) -> str | None:
    parsed = parse_datetime_to_utc(value)
    return parsed.isoformat() if parsed else None
