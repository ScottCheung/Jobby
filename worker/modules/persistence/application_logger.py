from datetime import datetime

from modules.persistence.api_client import BotApiError, api_client
from modules.persistence.logging import persistence_log


class ApplicationLogger:
    def __init__(self) -> None:
        self._applications: list[dict] = []
        self._load()

    def _load(self) -> None:
        try:
            self._applications = api_client.get_applications()
        except BotApiError as e:
            api_client.log_unavailable("loading application history", e)
            raise SystemExit("API data layer is required for application history")

    @property
    def count(self) -> int:
        return len(self._applications)

    def log_application(self, record: dict) -> None:
        record.setdefault("logged_at", datetime.now().isoformat(timespec="seconds"))
        try:
            saved_record = api_client.create_application(self._to_api_payload(record))
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
            "platform": "linkedin",
            "job_id": record.get("job_id"),
            "title": record.get("title"),
            "company": record.get("company"),
            "work_location": record.get("work_location"),
            "work_style": record.get("work_style"),
            "job_description": description,
            "job_link": record.get("job_link"),
            "external_job_link": record.get("external_application_link"),
            "status": status,
            "pipeline_stage": "applied" if status == "submitted" else status,
            "application_type": record.get("application_type"),
            "resume_path": record.get("resume"),
            "date_posted": record.get("date_posted"),
            "date_applied": api_client.parse_datetime(record.get("date_applied")),
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
