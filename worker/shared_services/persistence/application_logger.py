from shared_services.persistence.api_client import BotApiError, api_client
from shared_services.persistence.logging import persistence_log
from shared_services.time_utils import utc_isoformat, utc_now


FAILURE_SKIP_REASONS = {
    "problem in easy applying",
    "processing cancelled",
    "processing cancelled because the worker was interrupted",
    "processing cancelled because the browser session ended",
}


class ApplicationLogger:
    def __init__(self) -> None:
        self._applications: list[dict] = []
        self._application_ids_by_job_key: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        try:
            self._applications = api_client.get_applications()
            self._rebuild_index()
        except BotApiError as e:
            api_client.log_unavailable("loading application history", e)
            raise SystemExit("API data layer is required for application history")

    @property
    def count(self) -> int:
        return len(self._applications)

    def _job_key(self, record: dict) -> str | None:
        job_id = str(record.get("job_id") or "").strip()
        if job_id:
            return f"job_id:{job_id}"
        job_link = str(record.get("job_link") or "").strip()
        if job_link:
            return f"job_link:{job_link}"
        return None

    def _rebuild_index(self) -> None:
        self._application_ids_by_job_key = {}
        for item in self._applications:
            key = self._job_key(item)
            if key and item.get("id"):
                self._application_ids_by_job_key[key] = str(item["id"])

    def _remember_saved_record(self, saved_record: dict) -> None:
        saved_id = str(saved_record.get("id") or "")
        if not saved_id:
            return
        key = self._job_key(saved_record)
        if key:
            self._application_ids_by_job_key[key] = saved_id

    def _get_existing_record(self, application_id: str) -> dict | None:
        return next(
            (item for item in self._applications if str(item.get("id")) == application_id),
            None,
        )

    def create_processing_application(self, record: dict) -> dict:
        processing_payload = self._to_api_payload({
            **record,
            "status": "processing",
        })
        try:
            saved_record = api_client.create_application(processing_payload)
            self._applications.append(saved_record)
            self._remember_saved_record(saved_record)
            return saved_record
        except BotApiError as e:
            api_client.log_unavailable("creating processing application", e)
            raise SystemExit("API data layer is required for application history")

    def update_application(self, record: dict) -> dict:
        key = self._job_key(record)
        application_id = self._application_ids_by_job_key.get(key or "")
        if not application_id:
            return self.create_processing_application(record)

        existing = self._get_existing_record(application_id)
        incoming_status = self.normalize_status(record.get("status"))
        existing_status = self.normalize_status((existing or {}).get("status"))
        if existing and existing_status == "submitted" and incoming_status != "submitted":
            annotated = self.annotate_existing_application({
                **record,
                "status": incoming_status,
                "skip_reason": record.get("skip_reason") or f"Ignored {incoming_status} update for already submitted application",
            })
            if annotated is not None:
                return annotated

        payload = self._to_api_payload(record)
        try:
            saved_record = api_client.update_application(application_id, payload)
            self._applications = [
                saved_record if str(item.get("id")) == application_id else item
                for item in self._applications
            ]
            self._remember_saved_record(saved_record)
            return saved_record
        except BotApiError as e:
            api_client.log_unavailable("updating application history", e)
            raise SystemExit("API data layer is required for application history")

    def touch_processing_application(self, record: dict) -> dict:
        key = self._job_key(record)
        application_id = self._application_ids_by_job_key.get(key or "")
        if not application_id:
            return self.create_processing_application(record)

        payload = {
            "status": "processing",
            "title": record.get("title"),
            "company": record.get("company"),
            "work_location": record.get("work_location"),
            "work_style": record.get("work_style"),
            "job_description": record.get("description") or record.get("job_description"),
            "job_link": record.get("job_link"),
            "external_job_link": record.get("external_application_link"),
            "application_type": record.get("application_type"),
            "resume_path": record.get("resume"),
            "date_posted": record.get("date_posted"),
            "raw_data": dict(record),
        }
        try:
            saved_record = api_client.update_application(application_id, payload)
            self._applications = [
                saved_record if str(item.get("id")) == application_id else item
                for item in self._applications
            ]
            self._remember_saved_record(saved_record)
            return saved_record
        except BotApiError as e:
            api_client.log_unavailable("touching processing application", e)
            raise SystemExit("API data layer is required for application history")

    def cancel_processing_application(self, record: dict, reason: str = "Processing cancelled") -> dict:
        return self.update_application({
            **record,
            "status": "interrupted",
            "skip_reason": reason,
        })

    def annotate_existing_application(self, record: dict) -> dict | None:
        key = self._job_key(record)
        application_id = self._application_ids_by_job_key.get(key or "")
        if not application_id:
            return None

        existing = next(
            (item for item in self._applications if str(item.get("id")) == application_id),
            None,
        )
        if not existing:
            return None

        raw_data = dict(existing.get("raw_data") or {})
        duplicate_scans = list(raw_data.get("duplicate_scans") or [])
        duplicate_scans.append({
            "at": record.get("logged_at"),
            "reason": record.get("skip_reason") or record.get("error") or "Duplicate scan",
            "status_seen": record.get("status"),
            "search_term": record.get("search_term"),
        })

        payload = {
            "raw_data": {
                **raw_data,
                "duplicate_scans": duplicate_scans,
                "last_duplicate_scan_at": record.get("logged_at"),
                "last_duplicate_scan_reason": record.get("skip_reason") or record.get("error"),
            },
        }
        try:
            saved_record = api_client.update_application(application_id, payload)
            self._applications = [
                saved_record if str(item.get("id")) == application_id else item
                for item in self._applications
            ]
            self._remember_saved_record(saved_record)
            return saved_record
        except BotApiError as e:
            api_client.log_unavailable("annotating duplicate application history", e)
            raise SystemExit("API data layer is required for application history")

    def log_application(self, record: dict) -> None:
        record.setdefault("logged_at", utc_isoformat(utc_now()))
        if (
            self.normalize_status(record.get("status")) == "skipped"
            and str(record.get("skip_reason") or "").strip().lower() == "already applied"
        ):
            if self.annotate_existing_application(record) is not None:
                return
        try:
            saved_record = self.update_application(record)
            if not any(str(item.get("id")) == str(saved_record.get("id")) for item in self._applications):
                self._applications.append(saved_record)
            return
        except BotApiError as e:
            api_client.log_unavailable("saving application history", e)
            raise SystemExit("API data layer is required for application history")

    @staticmethod
    def _to_api_payload(record: dict) -> dict:
        status = ApplicationLogger.normalize_status(record.get("status"))
        description = record.get("description") or record.get("job_description")
        if isinstance(description, str) and description.strip().lower() == "unknown":
            description = None
        date_applied = api_client.parse_datetime(record.get("date_applied"))
        if status in {"submitted", "cancelled"} and date_applied is None:
            date_applied = utc_isoformat(utc_now())
        raw_data = dict(record)
        skip_reason = record.get("skip_reason") or record.get("error")
        if status == "submitted":
            normalized_reason = str(skip_reason or "").strip().lower()
            if normalized_reason in FAILURE_SKIP_REASONS:
                skip_reason = None
            raw_data.pop("error", None)
            raw_data.pop("skip_reason", None)
        if description and not raw_data.get("job_description"):
            raw_data["job_description"] = description
        persistence_log(
            "Prepared application payload:",
            record.get("job_id"),
            record.get("title"),
            f"job_description_length={len(description) if isinstance(description, str) else 0}",
        )
        return {
            "platform": record.get("platform") or "linkedin",
            "job_id": record.get("job_id"),
            "title": record.get("title"),
            "company": record.get("company"),
            "work_location": record.get("work_location"),
            "work_style": None,
            "job_description": description,
            "job_link": record.get("job_link"),
            "external_job_link": record.get("external_application_link"),
            "status": status,
            "pipeline_stage": record.get("pipeline_stage") or ("applied" if status == "submitted" else status),
            "application_type": record.get("application_type"),
            "resume_path": record.get("resume"),
            "date_posted": record.get("date_posted"),
            "date_applied": date_applied,
            "questions": record.get("questions") or [],
            "skip_reason": skip_reason,
            "screenshot_path": record.get("screenshot"),
            "raw_data": raw_data,
        }

    @staticmethod
    def normalize_status(value: object) -> str:
        status = str(value or "").strip().lower()
        if status in {"applied", "apply", "success", "succeeded", "submitted"}:
            return "submitted"
        if status in {"cancelled", "canceled", "stopped"}:
            return "cancelled"
        if status in {"interrupted", "needs_review", "timed_out", "timeout"}:
            return "interrupted"
        if status in {"failed", "fail", "error", "skipped", "skiped", "skip"}:
            return "skipped"
        if status in {"processing", "running", "in_progress", "pending"}:
            return "processing"
        return status or "submitted"

    @staticmethod
    def format_questions(questions_list: set | list | None) -> list[dict]:
        if not questions_list:
            return []
        formatted = []
        for item in questions_list:
            if isinstance(item, dict):
                formatted.append(item)
                continue
            if isinstance(item, (list, tuple)) and len(item) >= 3:
                label, answer, field_type = item[0], item[1], item[2]
                prev_answer = item[3] if len(item) > 3 else None
                source = item[4] if len(item) > 4 else "unknown"
                formatted.append({
                    "label": label,
                    "answer": answer,
                    "field_type": field_type,
                    "prev_answer": prev_answer,
                    "source": source,
                })
        return formatted
