from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from services.shared.database import SessionLocal
from services.shared.models import JobApplication


def normalized_text(value: str | None) -> str:
    return " ".join(str(value or "").strip().lower().split())


def duplicate_key(application: JobApplication) -> tuple[str, str, str] | None:
    job_id = str(application.external_job_id or "").strip()
    title = normalized_text(application.title)
    company = normalized_text(application.company)

    if job_id:
        return ("job_id", job_id, "")
    if title and company:
        return ("title_company", title, company)
    return None


def application_score(application: JobApplication) -> tuple[int, int, int, float]:
    is_final_status = int(application.status in {"submitted", "skipped", "cancelled"})
    has_date_applied = int(application.date_applied is not None)
    metadata_count = sum(
        int(bool(value))
        for value in (
            application.job_description,
            application.work_location,
            application.job_link,
            application.external_job_link,
            application.questions,
            application.skip_reason,
            application.screenshot_path,
        )
    )
    updated_ts = (application.updated_at or application.created_at or datetime.min).timestamp()
    return (is_final_status, has_date_applied, metadata_count, updated_ts)


def merge_missing_fields(target: JobApplication, source: JobApplication) -> None:
    merge_fields = [
        "title",
        "company",
        "work_location",
        "job_description",
        "job_link",
        "external_job_link",
        "application_type",
        "resume_path",
        "first_posted_at",
        "last_posted_at",
        "posting_observed_at",
        "is_reposted",
        "date_applied",
        "skip_reason",
        "screenshot_path",
        "contact_name",
        "contact_email",
        "last_contacted_at",
        "next_action",
        "next_action_at",
        "notes",
    ]
    for field in merge_fields:
        if getattr(target, field) in (None, "", [], {}):
            source_value = getattr(source, field)
            if source_value not in (None, "", [], {}):
                setattr(target, field, source_value)

    if (not target.questions) and source.questions:
        target.questions = source.questions

    target.raw_data = {
        **(source.raw_data or {}),
        **(target.raw_data or {}),
        "deduped_at": datetime.now().isoformat(),
        "deduped_duplicate_id": str(source.id),
    }


def main() -> None:
    db = SessionLocal()
    try:
        rows = (
            db.query(JobApplication)
            .filter(JobApplication.deleted_at.is_(None))
            .order_by(JobApplication.created_at.desc())
            .all()
        )

        groups: dict[tuple[str, str, str], list[JobApplication]] = defaultdict(list)
        for row in rows:
            key = duplicate_key(row)
            if key is None:
                continue
            groups[key].append(row)

        updated_count = 0
        deleted_count = 0
        group_count = 0

        for applications in groups.values():
            if len(applications) < 2:
                continue

            group_count += 1
            ranked = sorted(applications, key=application_score, reverse=True)
            keeper = ranked[0]
            duplicates = ranked[1:]

            for duplicate in duplicates:
                merge_missing_fields(keeper, duplicate)
                duplicate.deleted_at = datetime.now()
                deleted_count += 1

            updated_count += 1

        db.commit()
        print(
            f"Deduped {deleted_count} records across {group_count} groups; "
            f"kept/merged {updated_count} primary records."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
