from datetime import datetime

from shared_services.persistence.api_client import BotApiError, api_client
from shared_services.persistence.logging import persistence_log


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
            "status": "cancelled",
            "skip_reason": reason,
        })

    def log_application(self, record: dict) -> None:
        record.setdefault("logged_at", datetime.now().isoformat(timespec="seconds"))
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
        if status in {"processing", "submitted", "cancelled"} and date_applied is None:
            date_applied = datetime.now().isoformat()
        raw_data = dict(record)
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
            "pipeline_stage": "applied" if status == "submitted" else status,
            "application_type": record.get("application_type"),
            "resume_path": record.get("resume"),
            "date_posted": record.get("date_posted"),
            "date_applied": date_applied,
            "questions": record.get("questions") or [],
            "skip_reason": record.get("skip_reason") or record.get("error"),
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
