import json
import os
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from shared_services.persistence.logging import persistence_log


class BotApiError(RuntimeError):
    pass


class BotApiClient:
    def __init__(
        self,
        base_url: str | None = None,
        timeout_seconds: int | None = None,
        enabled: bool | None = None,
    ) -> None:
        resolved_base_url = (
            base_url
            or os.getenv("AUTO_JOB_API_BASE_URL", "")
            or os.getenv("AUTO_JOB_API_URL", "")
            or "http://127.0.0.1:8000"
        )
        self.base_url = resolved_base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds if timeout_seconds is not None else int(os.getenv("AUTO_JOB_API_TIMEOUT_SECONDS", "30"))
        if enabled is None:
            enabled = os.getenv("AUTO_JOB_USE_API_DATA_LAYER", "1").strip().lower() not in {"0", "false", "no", "off"}
        self.enabled = enabled
        self._warned_unavailable = False

    def is_enabled(self) -> bool:
        return bool(self.enabled and self.base_url)

    def request(self, method: str, path: str, payload: dict | None = None, query: dict | None = None) -> Any:
        if not self.is_enabled():
            raise BotApiError("API data layer is disabled")

        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"

        data = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            headers["Content-Type"] = "application/json"

        try:
            request = Request(url, data=data, headers=headers, method=method.upper())
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read()
                if not body:
                    return None
                return json.loads(body.decode("utf-8"))
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise BotApiError(f"API {method} {path} failed with {error.code}: {detail}") from error
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            raise BotApiError(f"API {method} {path} failed: {error}") from error

    def log_unavailable(self, context: str, error: Exception) -> None:
        if self._warned_unavailable:
            return
        self._warned_unavailable = True
        persistence_log(f"API data layer unavailable while {context}: {error}.")

    def get_question_cache(self) -> list[dict]:
        return self.request("GET", "/api/question-cache")

    def upsert_question_cache_entry(self, payload: dict) -> dict:
        return self.request("POST", "/api/question-cache/upsert", payload=payload)

    def get_applications(self) -> list[dict]:
        return self.request("GET", "/api/applications")

    def create_application(self, payload: dict) -> dict:
        persistence_log(
            "Creating application via API:",
            payload.get("job_id"),
            payload.get("title"),
            payload.get("company"),
            payload.get("status"),
        )
        return self.request("POST", "/api/applications", payload=payload)

    def get_worker_config(self) -> dict:
        return self.request("GET", "/api/worker/config")

    @staticmethod
    def parse_datetime(value: Any) -> str | None:
        if value in ("", None):
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        text = str(value).strip()
        if not text or text.lower() in {"none", "null", "pending", "not available"}:
            return None
        try:
            return datetime.fromisoformat(text).isoformat()
        except ValueError:
            return None


api_client = BotApiClient()
