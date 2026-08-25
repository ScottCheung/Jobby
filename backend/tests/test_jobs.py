from __future__ import annotations

from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from services.shared.jobs import (
    JobCorrectionConflictError,
    apply_job_updates,
    changed_job_fields,
    job_url_hash,
    normalize_job_snapshot,
    normalize_job_url,
    upsert_job,
)
from services.shared.models import Job, JobApplication, JobExtractionCorrection
from services.shared.schemas import JobApplicationRead


class FakeSession:
    def __init__(self, scalar_results=()):
        self.scalar_results = iter(scalar_results)
        self.added = []

    def scalar(self, _statement):
        return next(self.scalar_results, None)

    def add(self, value):
        self.added.append(value)

    def flush(self):
        return None

    def begin_nested(self):
        return nullcontext()


def make_job(**overrides) -> Job:
    values = {
        "id": uuid4(),
        "platform": "seek",
        "external_id": "job-42",
        "url": "https://www.seek.com.au/job/42",
        "title": "Software Enginer",
        "company": "Example Pty Ltd",
        "location": "Sydney",
        "description": "Build APIs",
        "technologies": ["Python"],
        "revision": 1,
    }
    values.update(overrides)
    return Job(**values)


def test_normalize_job_url_removes_tracking_and_fragment() -> None:
    first = "HTTPS://WWW.SEEK.COM.AU/job/42/?utm_source=email&b=2&a=1#details"
    second = "https://www.seek.com.au/job/42?a=1&b=2"

    assert normalize_job_url(first) == second
    assert job_url_hash(first) == job_url_hash(second)


def test_relative_posting_date_is_frozen_against_observation_time() -> None:
    observed_at = datetime(2026, 8, 26, 10, tzinfo=timezone.utc)

    snapshot = normalize_job_snapshot({
        "date_posted": "Posted 2 days ago",
        "posting_observed_at": observed_at,
    })

    assert snapshot["first_posted_at"] == observed_at - timedelta(days=2)
    assert snapshot["last_posted_at"] == observed_at - timedelta(days=2)
    assert snapshot["posting_observed_at"] == observed_at


def test_older_than_relative_posting_date_is_frozen() -> None:
    observed_at = datetime(2026, 8, 26, 10, tzinfo=timezone.utc)

    snapshot = normalize_job_snapshot({
        "date_posted": "posted onPosted 30+ Days Ago",
        "posting_observed_at": observed_at,
    })

    assert snapshot["last_posted_at"] == observed_at - timedelta(days=30)


def test_repost_updates_latest_date_without_losing_first_date() -> None:
    first_seen = datetime(2026, 7, 1, tzinfo=timezone.utc)
    job = make_job(
        first_posted_at=first_seen,
        last_posted_at=first_seen,
        posting_observed_at=datetime(2026, 7, 2, tzinfo=timezone.utc),
        is_reposted=False,
    )
    db = FakeSession([job])

    result = upsert_job(
        db,
        extracted_snapshot={
            "platform": "seek",
            "external_id": "job-42",
            "first_posted_at": first_seen,
            "last_posted_at": datetime(2026, 8, 24, 6, 30, tzinfo=timezone.utc),
            "posting_observed_at": datetime(2026, 8, 26, 10, tzinfo=timezone.utc),
            "is_reposted": True,
            "posting_date_raw": {"label": "Reposted 2 days ago"},
        },
    )

    assert result.job.first_posted_at == first_seen
    assert result.job.last_posted_at == datetime(2026, 8, 24, 6, 30, tzinfo=timezone.utc)
    assert result.job.is_reposted is True
    assert result.job.raw_extracted_snapshot["posting_date_raw"]["label"] == "Reposted 2 days ago"


def test_changed_job_fields_ignores_whitespace_and_technology_order() -> None:
    original = {
        "title": "Software Engineer",
        "company": "Example Co",
        "technologies": ["Python", "React"],
    }
    modified = {
        "title": " Software   Engineer ",
        "company": "Example Pty Ltd",
        "technologies": ["react", "python"],
    }

    assert changed_job_fields(original, modified) == ("company",)


def test_apply_job_updates_appends_an_audit_record_and_increments_revision() -> None:
    db = FakeSession()
    job = make_job()
    application = JobApplication(id=uuid4(), user_id=uuid4(), job=job)
    user_id = application.user_id

    result = apply_job_updates(
        db,
        job=job,
        updates={"title": "Software Engineer", "company": "Example Pty Ltd"},
        user_id=user_id,
        job_application=application,
        source="browser_extension",
    )

    assert result.changed_fields == ("title",)
    assert job.title == "Software Engineer"
    assert job.revision == 2
    assert len(db.added) == 1
    correction = db.added[0]
    assert isinstance(correction, JobExtractionCorrection)
    assert correction.original == {"title": "Software Enginer"}
    assert correction.modified == {"title": "Software Engineer"}
    assert correction.changed_fields == ["title"]
    assert correction.job_application_id == application.id


def test_apply_job_updates_does_not_log_a_noop() -> None:
    db = FakeSession()
    job = make_job(title="Software Engineer")

    result = apply_job_updates(
        db,
        job=job,
        updates={"title": " Software  Engineer "},
        user_id=uuid4(),
    )

    assert result.changed is False
    assert job.revision == 1
    assert db.added == []


def test_new_job_keeps_raw_extraction_and_applies_user_correction() -> None:
    db = FakeSession([None])

    result = upsert_job(
        db,
        extracted_snapshot={
            "platform": "seek",
            "external_id": "new-job-42",
            "title": "Software Enginer",
            "company": "Example Pty Ltd",
            "technologies": ["Python"],
        },
        modified_snapshot={
            "platform": "seek",
            "external_id": "new-job-42",
            "title": "Software Engineer",
            "company": "Example Pty Ltd",
            "technologies": ["Python", "PostgreSQL"],
        },
        user_id=uuid4(),
    )

    assert result.job.raw_extracted_snapshot["title"] == "Software Enginer"
    assert result.job.title == "Software Engineer"
    assert result.job.technologies == ["Python", "PostgreSQL"]
    assert result.job.revision == 2
    assert result.changed_fields == ("title", "technologies")
    assert isinstance(result.correction, JobExtractionCorrection)


def test_upsert_rejects_a_stale_user_correction() -> None:
    job = make_job(title="Principal Engineer")
    db = FakeSession([job])

    with pytest.raises(JobCorrectionConflictError, match="refresh before correcting"):
        upsert_job(
            db,
            extracted_snapshot={
                "platform": "seek",
                "external_id": "job-42",
                "title": "Software Enginer",
                "company": "Example Pty Ltd",
            },
            modified_snapshot={
                "platform": "seek",
                "external_id": "job-42",
                "title": "Software Engineer",
                "company": "Example Pty Ltd",
            },
            user_id=uuid4(),
        )


def test_retried_correction_does_not_append_duplicate_history() -> None:
    user_id = uuid4()
    job = make_job(title="Software Engineer", revision=2)
    db = FakeSession([job, uuid4()])

    result = upsert_job(
        db,
        extracted_snapshot={
            "platform": "seek",
            "external_id": "job-42",
            "title": "Software Enginer",
            "company": "Example Pty Ltd",
        },
        modified_snapshot={
            "platform": "seek",
            "external_id": "job-42",
            "title": "Software Engineer",
            "company": "Example Pty Ltd",
        },
        user_id=user_id,
    )

    assert result.changed is False
    assert result.correction is None
    assert db.added == []


def test_two_applications_can_reference_one_shared_job() -> None:
    job = make_job()
    first = JobApplication(user_id=uuid4(), job=job)
    second = JobApplication(user_id=uuid4(), job=job)

    assert first.job is second.job
    assert first.external_job_id == second.external_job_id == "job-42"
    assert first.job_id is None
    assert second.job_id is None


def test_application_read_keeps_legacy_flattened_job_fields() -> None:
    now = datetime.now(timezone.utc)
    job = make_job()
    application = JobApplication(
        id=uuid4(),
        user_id=uuid4(),
        job_id=job.id,
        job=job,
        status="draft",
        raw_data={},
        created_at=now,
        updated_at=now,
    )

    payload = JobApplicationRead.model_validate(application).model_dump(mode="json")

    assert payload["job_id"] == "job-42"
    assert payload["title"] == "Software Enginer"
    assert payload["company"] == "Example Pty Ltd"
    assert payload["job_link"] == "https://www.seek.com.au/job/42"
