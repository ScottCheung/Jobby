import json
import os
from datetime import datetime

from config.settings import applications_json_file
from modules.helpers import print_lg


class ApplicationLogger:
    def __init__(self, log_path: str = applications_json_file) -> None:
        self.log_path = log_path
        self._applications: list[dict] = []
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.log_path):
            return
        try:
            with open(self.log_path, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                self._applications = data
            elif isinstance(data, dict) and "applications" in data:
                self._applications = data["applications"]
        except Exception as e:
            print_lg(f"Failed to load applications log from {self.log_path}: {e}")

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.log_path) or ".", exist_ok=True)
        tmp_path = f"{self.log_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(self._applications, f, ensure_ascii=False, indent=2, default=str)
        os.replace(tmp_path, self.log_path)

    @property
    def count(self) -> int:
        return len(self._applications)

    def log_application(self, record: dict) -> None:
        record.setdefault("logged_at", datetime.now().isoformat(timespec="seconds"))
        self._applications.append(record)
        self._save()

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
