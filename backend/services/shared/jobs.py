from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import re
from typing import Any, Mapping
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from services.shared.models import Job, JobApplication, JobExtractionCorrection


CORRECTABLE_JOB_FIELDS = (
    "title",
    "company",
    "location",
    "description",
    "technologies",
)
POSTING_DATE_FIELDS = (
    "first_posted_at",
    "last_posted_at",
    "posting_observed_at",
    "is_reposted",
)
JOB_CONTENT_FIELDS = (*CORRECTABLE_JOB_FIELDS, *POSTING_DATE_FIELDS, "url")
TRACKING_QUERY_KEYS = {
    "campaign",
    "from",
    "gh_src",
    "ref",
    "refid",
    "source",
    "src",
    "trackingid",
    "trk",
}


class JobCorrectionConflictError(ValueError):
    """Raised when a correction was based on a stale canonical job revision."""


@dataclass(frozen=True)
class JobUpsertResult:
    job: Job
    changed_fields: tuple[str, ...]
    correction: JobExtractionCorrection | None = None

    @property
    def changed(self) -> bool:
        return bool(self.changed_fields)


def normalize_job_url(value: str | None) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parts = urlsplit(raw)
    except ValueError:
        return raw
    if not parts.netloc:
        return raw

    scheme = parts.scheme.casefold() or "https"
    hostname = (parts.hostname or "").casefold()
    port = parts.port
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        hostname = f"{hostname}:{port}"

    path = re.sub(r"/{2,}", "/", parts.path or "/")
    if path != "/":
        path = path.rstrip("/")

    query_items = []
    for key, item in parse_qsl(parts.query, keep_blank_values=True):
        normalized_key = key.casefold()
        if normalized_key.startswith("utm_") or normalized_key in TRACKING_QUERY_KEYS:
            continue
        query_items.append((key, item))
    query_items.sort(key=lambda pair: (pair[0].casefold(), pair[1]))
    return urlunsplit((scheme, hostname, path, urlencode(query_items, doseq=True), ""))


def job_url_hash(value: str | None) -> str | None:
    normalized = normalize_job_url(value)
    return sha256(normalized.encode("utf-8")).hexdigest() if normalized else None


def normalize_technologies(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple, set, frozenset)):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        normalized = " ".join(str(item or "").strip().split())
        key = normalized.casefold()
        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)
    return result


def normalize_job_snapshot(snapshot: Mapping[str, Any] | None) -> dict[str, Any]:
    source = dict(snapshot or {})
    url = str(source.get("url") or source.get("job_link") or "").strip() or None
    raw_posted = source.get("date_posted") or source.get("posted_at")
    observed_at = _parse_posted_at(source.get("posting_observed_at"))
    if not observed_at and (
        source.get("first_posted_at") or source.get("last_posted_at") or raw_posted
    ):
        observed_at = datetime.now(timezone.utc)
    first_posted_at = _parse_posted_at(
        source.get("first_posted_at") or raw_posted,
        observed_at=observed_at,
    )
    last_posted_at = _parse_posted_at(
        source.get("last_posted_at") or raw_posted,
        observed_at=observed_at,
    )
    return {
        "platform": str(source.get("platform") or "generic").strip().casefold() or "generic",
        "external_id": str(source.get("external_id") or source.get("job_id") or "").strip() or None,
        "url": url,
        "title": _clean_text(source.get("title")),
        "company": _clean_text(source.get("company")),
        "location": _clean_text(source.get("location") or source.get("work_location")),
        "description": _clean_description(source.get("description") or source.get("job_description")),
        "technologies": normalize_technologies(source.get("technologies")),
        "first_posted_at": first_posted_at or last_posted_at,
        "last_posted_at": last_posted_at or first_posted_at,
        "posting_observed_at": observed_at,
        "is_reposted": bool(source.get("is_reposted")),
        "posting_date_raw": dict(source.get("posting_date_raw") or {}),
    }


def snapshot_from_job(job: Job) -> dict[str, Any]:
    return {
        "platform": job.platform,
        "external_id": job.external_id,
        "url": job.url,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "description": job.description,
        "technologies": list(job.technologies or []),
        "first_posted_at": job.first_posted_at,
        "last_posted_at": job.last_posted_at,
        "posting_observed_at": job.posting_observed_at,
        "is_reposted": job.is_reposted,
    }


def changed_job_fields(
    original: Mapping[str, Any],
    modified: Mapping[str, Any],
    *,
    fields: tuple[str, ...] = CORRECTABLE_JOB_FIELDS,
) -> tuple[str, ...]:
    return tuple(field for field in fields if not _equivalent(field, original.get(field), modified.get(field)))


def upsert_job(
    db: Session,
    *,
    extracted_snapshot: Mapping[str, Any],
    modified_snapshot: Mapping[str, Any] | None = None,
    user_id: UUID | None = None,
    job_application: JobApplication | None = None,
    source: str = "browser_extension",
    idempotency_key: str | None = None,
) -> JobUpsertResult:
    extracted = normalize_job_snapshot(extracted_snapshot)
    modified = normalize_job_snapshot(modified_snapshot) if modified_snapshot is not None else extracted
    identity = modified if modified.get("external_id") or modified.get("url") else extracted

    job = _find_job(
        db,
        platform=identity["platform"],
        external_id=identity.get("external_id"),
        url_hash=job_url_hash(identity.get("url")),
        lock=True,
    )
    created = job is None
    if job is None:
        initial = extracted if modified_snapshot is not None else modified
        job = _new_job(initial, identity)
        try:
            with db.begin_nested():
                db.add(job)
                db.flush()
        except IntegrityError:
            job = _find_job(
                db,
                platform=identity["platform"],
                external_id=identity.get("external_id"),
                url_hash=job_url_hash(identity.get("url")),
                lock=True,
            )
            if job is None:
                raise
            created = False

    changed: list[str] = []
    correction: JobExtractionCorrection | None = None
    intended_corrections = (
        changed_job_fields(extracted, modified) if modified_snapshot is not None else ()
    )

    if modified_snapshot is None:
        changed.extend(_fill_missing_job_fields(job, modified))
    else:
        changed.extend(_fill_missing_job_fields(job, extracted, exclude=set(intended_corrections)))
        if intended_corrections:
            correction = _apply_correction(
                db,
                job=job,
                original_snapshot=extracted,
                modified_snapshot=modified,
                changed_fields=intended_corrections,
                user_id=user_id,
                job_application=job_application,
                source=source,
                idempotency_key=idempotency_key,
                created=created,
            )
            if correction:
                changed.extend(field for field in intended_corrections if field not in changed)

    job.raw_extracted_snapshot = _json_snapshot(extracted)

    if changed and correction is None:
        job.revision = int(job.revision or 1) + (0 if created else 1)

    return JobUpsertResult(job=job, changed_fields=tuple(dict.fromkeys(changed)), correction=correction)


def apply_job_updates(
    db: Session,
    *,
    job: Job,
    updates: Mapping[str, Any],
    user_id: UUID | None,
    job_application: JobApplication | None = None,
    source: str = "application_api",
    idempotency_key: str | None = None,
) -> JobUpsertResult:
    original = snapshot_from_job(job)
    modified = {**original, **dict(updates)}
    fields = changed_job_fields(original, normalize_job_snapshot(modified))
    if not fields:
        return JobUpsertResult(job=job, changed_fields=())
    correction = _apply_correction(
        db,
        job=job,
        original_snapshot=original,
        modified_snapshot=normalize_job_snapshot(modified),
        changed_fields=fields,
        user_id=user_id,
        job_application=job_application,
        source=source,
        idempotency_key=idempotency_key,
        created=False,
    )
    return JobUpsertResult(job=job, changed_fields=fields if correction else (), correction=correction)


def _new_job(initial: Mapping[str, Any], identity: Mapping[str, Any]) -> Job:
    url = identity.get("url") or initial.get("url")
    normalized_url = normalize_job_url(url)
    snapshot = _json_snapshot({**dict(initial), "url": url})
    return Job(
        platform=identity.get("platform") or initial.get("platform") or "generic",
        external_id=identity.get("external_id") or initial.get("external_id"),
        url=url,
        normalized_url=normalized_url,
        url_hash=job_url_hash(url) if not identity.get("external_id") else None,
        title=initial.get("title"),
        company=initial.get("company"),
        location=initial.get("location"),
        description=initial.get("description"),
        technologies=list(initial.get("technologies") or []),
        first_posted_at=initial.get("first_posted_at"),
        last_posted_at=initial.get("last_posted_at"),
        posting_observed_at=initial.get("posting_observed_at"),
        is_reposted=bool(initial.get("is_reposted")),
        raw_extracted_snapshot=snapshot,
        revision=1,
    )


def _find_job(
    db: Session,
    *,
    platform: str,
    external_id: str | None,
    url_hash: str | None,
    lock: bool,
) -> Job | None:
    job = None
    if external_id:
        statement = select(Job).where(Job.platform == platform, Job.external_id == external_id)
        job = db.scalar(statement.with_for_update() if lock else statement)
    if job is None and url_hash:
        statement = select(Job).where(Job.url_hash == url_hash)
        job = db.scalar(statement.with_for_update() if lock else statement)
        if job and external_id and job.external_id not in (None, external_id):
            raise JobCorrectionConflictError("The job URL is already associated with another platform job ID.")
        if job and external_id and not job.external_id:
            job.external_id = external_id
            job.platform = platform
            job.url_hash = None
    return job


def _fill_missing_job_fields(
    job: Job,
    snapshot: Mapping[str, Any],
    *,
    exclude: set[str] | None = None,
) -> list[str]:
    excluded = exclude or set()
    changed: list[str] = []
    for field in JOB_CONTENT_FIELDS:
        if field in excluded:
            continue
        incoming = snapshot.get(field)
        current = getattr(job, field)
        if field == "is_reposted":
            if incoming and not current:
                setattr(job, field, True)
                changed.append(field)
            continue
        if field == "first_posted_at" and incoming and (current is None or incoming < current):
            setattr(job, field, incoming)
            changed.append(field)
        elif field in {"last_posted_at", "posting_observed_at"} and incoming and (
            current is None or incoming > current
        ):
            setattr(job, field, incoming)
            changed.append(field)
        elif _is_empty(field, current) and not _is_empty(field, incoming):
            setattr(job, field, incoming)
            changed.append(field)
    if not job.normalized_url and job.url:
        job.normalized_url = normalize_job_url(job.url)
        job.url_hash = job_url_hash(job.url) if not job.external_id else None
    return changed


def _apply_correction(
    db: Session,
    *,
    job: Job,
    original_snapshot: Mapping[str, Any],
    modified_snapshot: Mapping[str, Any],
    changed_fields: tuple[str, ...],
    user_id: UUID | None,
    job_application: JobApplication | None,
    source: str,
    idempotency_key: str | None,
    created: bool,
) -> JobExtractionCorrection | None:
    actual_changes = []
    for field in changed_fields:
        current = getattr(job, field)
        original = original_snapshot.get(field)
        modified = modified_snapshot.get(field)
        if _equivalent(field, current, modified):
            continue
        if not created and not _equivalent(field, current, original):
            raise JobCorrectionConflictError(
                f"Job field '{field}' changed after it was extracted; refresh before correcting it."
            )
        actual_changes.append(field)

    if not actual_changes:
        requested_before = {field: original_snapshot.get(field) for field in changed_fields}
        requested_after = {field: modified_snapshot.get(field) for field in changed_fields}
        correction_key = idempotency_key or _correction_key(
            job,
            user_id,
            requested_before,
            requested_after,
        )
        existing = db.scalar(
            select(JobExtractionCorrection.id).where(
                JobExtractionCorrection.job_id == job.id,
                JobExtractionCorrection.user_id == user_id,
                JobExtractionCorrection.idempotency_key == correction_key,
            )
        )
        if existing:
            return None
        correction = JobExtractionCorrection(
            job=job,
            job_application_id=job_application.id if job_application else None,
            user_id=user_id,
            base_revision=int(job.revision or 1),
            resulting_revision=int(job.revision or 1),
            original=requested_before,
            modified=requested_after,
            changed_fields=list(changed_fields),
            source=source,
            idempotency_key=correction_key,
        )
        db.add(correction)
        return correction

    base_revision = int(job.revision or 1)
    before = {field: getattr(job, field) for field in actual_changes}
    after = {field: modified_snapshot.get(field) for field in actual_changes}
    for field in actual_changes:
        setattr(job, field, modified_snapshot.get(field))
    job.revision = base_revision + 1

    correction_key = idempotency_key or _correction_key(job, user_id, before, after)
    correction = JobExtractionCorrection(
        job=job,
        job_application_id=job_application.id if job_application else None,
        user_id=user_id,
        base_revision=base_revision,
        resulting_revision=job.revision,
        original=before,
        modified=after,
        changed_fields=actual_changes,
        source=source,
        idempotency_key=correction_key,
    )
    db.add(correction)
    return correction


def _correction_key(
    job: Job,
    user_id: UUID | None,
    original: Mapping[str, Any],
    modified: Mapping[str, Any],
) -> str:
    payload = {
        "job_id": str(job.id),
        "user_id": str(user_id) if user_id else None,
        "original": original,
        "modified": modified,
    }
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(serialized.encode("utf-8")).hexdigest()


def _clean_text(value: Any) -> str | None:
    normalized = " ".join(str(value or "").strip().split())
    return normalized or None


def _clean_description(value: Any) -> str | None:
    normalized = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return normalized or None


def _parse_posted_at(
    value: Any,
    *,
    observed_at: datetime | None = None,
) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        timestamp = float(value) / 1000 if float(value) > 10_000_000_000 else float(value)
        try:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None

    text = str(value).strip()
    if not text:
        return None
    cleaned = re.sub(
        r"^(?:posted\s+(?:on\s+)?|reposted\s+(?:on\s+)?|date\s*:\s*|over\s+|more\s+than\s+)",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    try:
        parsed = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc)
    except ValueError:
        pass

    reference = observed_at or datetime.now(timezone.utc)
    relative = cleaned.casefold()
    plus_days = re.search(r"(\d+)\+\s*(?:days?|d)\b", relative)
    if plus_days:
        return reference - timedelta(days=int(plus_days.group(1)))
    match = re.search(
        r"(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|mo|[hdwy])\b",
        relative,
    )
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        if unit in {"minute", "minutes", "min", "mins"}:
            delta = timedelta(minutes=amount)
        elif unit in {"hour", "hours", "hr", "hrs", "h"}:
            delta = timedelta(hours=amount)
        elif unit in {"day", "days", "d"}:
            delta = timedelta(days=amount)
        elif unit in {"week", "weeks", "wk", "wks", "w"}:
            delta = timedelta(weeks=amount)
        elif unit in {"month", "months", "mos", "mo"}:
            delta = timedelta(days=amount * 30)
        else:
            delta = timedelta(days=amount * 365)
        return reference - delta
    if "yesterday" in relative:
        return reference - timedelta(days=1)
    if re.search(r"\b(today|just\s+(?:posted|now))\b", relative):
        return reference
    return None


def _json_snapshot(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: value.isoformat() if isinstance(value, datetime) else value
        for key, value in snapshot.items()
    }


def _equivalent(field: str, left: Any, right: Any) -> bool:
    if field == "technologies":
        return {item.casefold() for item in normalize_technologies(left)} == {
            item.casefold() for item in normalize_technologies(right)
        }
    if field == "description":
        return _clean_description(left) == _clean_description(right)
    if field in POSTING_DATE_FIELDS:
        return left == right
    return _clean_text(left) == _clean_text(right)


def _is_empty(field: str, value: Any) -> bool:
    if field == "technologies":
        return not normalize_technologies(value)
    if field == "description":
        return _clean_description(value) is None
    if field == "is_reposted":
        return value is None
    if field in POSTING_DATE_FIELDS:
        return value is None
    return _clean_text(value) is None
