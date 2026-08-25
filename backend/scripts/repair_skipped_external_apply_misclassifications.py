from __future__ import annotations

import argparse

from services.shared.database import SessionLocal
from services.shared.models import JobApplication
from services.shared.time_utils import utc_isoformat, utc_now


def should_repair(application: JobApplication) -> bool:
    if str(application.status or "").strip().lower() != "skipped":
        return False
    if str(application.skip_reason or "").strip().lower() != "external application":
        return False

    raw_data = dict(application.raw_data or {})
    raw_external_link = str(raw_data.get("external_application_link") or "").strip()
    job_link = str(application.job_link or raw_data.get("job_link") or "").strip()
    current_stage = str(application.pipeline_stage or "").strip().lower()

    if not raw_external_link or not job_link:
        return False
    if raw_external_link != job_link:
        return False
    if current_stage not in {"", "applied", "skipped"}:
        return False
    return True


def repair(application: JobApplication) -> list[str]:
    raw_data = dict(application.raw_data or {})
    changes: list[str] = []

    application.status = "interrupted"
    changes.append("status")

    application.skip_reason = "Application flow was interrupted before submission"
    changes.append("skip_reason")

    raw_data["status"] = "interrupted"
    raw_data["pipeline_stage"] = "interrupted"
    raw_data["skip_reason"] = "Application flow was interrupted before submission"
    raw_data["application_type"] = raw_data.get("application_type") or "Easy Applied"
    raw_data["external_apply_reclassified_at"] = utc_isoformat(utc_now())
    application.raw_data = raw_data
    changes.extend([
        "raw_data.status",
        "raw_data.pipeline_stage",
        "raw_data.skip_reason",
        "raw_data.external_apply_reclassified_at",
    ])
    return changes


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Repair records incorrectly marked as external application when the flow was interrupted before submission.",
    )
    parser.add_argument("--id", help="Only repair a single application UUID.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes. Without this flag the script runs in dry-run mode.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        query = db.query(JobApplication).filter(JobApplication.deleted_at.is_(None))
        if args.id:
            query = query.filter(JobApplication.id == args.id)

        rows = query.order_by(JobApplication.created_at.desc()).all()
        matched = 0
        changed = 0
        for application in rows:
            if not should_repair(application):
                continue
            matched += 1
            fields_changed = repair(application)
            changed += 1
            print(
                f"{application.id} job_id={application.external_job_id} "
                f"status={application.status} changes={','.join(fields_changed)}"
            )

        if args.apply:
            db.commit()
            print(f"Applied external-apply misclassification repair to {changed} of {matched} matching applications.")
        else:
            db.rollback()
            print(f"Dry run complete: {changed} of {matched} matching applications would be updated.")
            print("Re-run with --apply to persist the repairs.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
