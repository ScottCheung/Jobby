import hashlib
import re
from datetime import datetime
from difflib import SequenceMatcher

from shared_services.persistence.api_client import BotApiError, api_client
from shared_services.persistence.logging import persistence_log
from shared_services.runtime import get_runtime_value


def normalize_label(label: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", label.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def match_option_in_list(answer: str, options: list[str]) -> str | None:
    if not answer or not options:
        return None

    possible_phrases = []
    if answer == "Decline":
        possible_phrases = ["Decline", "not wish", "don't wish", "Prefer not", "not want"]
    elif answer.lower() == "yes":
        possible_phrases = ["Yes", "Agree", "I do", "I have"]
    elif answer.lower() == "no":
        possible_phrases = ["No", "Disagree", "I don't", "I do not"]
    else:
        possible_phrases = [answer, answer.lower(), answer.upper(), "".join(c for c in answer if c.isalnum())]

    for phrase in possible_phrases:
        for option in options:
            if phrase.lower() in option.lower() or option.lower() in phrase.lower():
                return option
    return None


class QuestionCache:
    def __init__(self) -> None:
        self._data: dict = {"version": 1, "questions": []}
        self.session_manual_learned: list[dict] = []
        self._load()

    def _load(self) -> None:
        try:
            questions = api_client.get_question_cache()
            self._data = {
                "version": 1,
                "questions": [self._from_api_entry(entry) for entry in questions],
            }
        except BotApiError as e:
            api_client.log_unavailable("loading question cache", e)
            raise SystemExit("API data layer is required for question cache")

    @staticmethod
    def _from_api_entry(entry: dict) -> dict:
        return {
            "id": entry.get("id"),
            "label": entry.get("original_label") or entry.get("normalized_label") or "",
            "normalized_label": entry.get("normalized_label") or normalize_label(entry.get("original_label", "")),
            "field_type": entry.get("field_type") or "text",
            "options": entry.get("options"),
            "answer": entry.get("answer"),
            "source": entry.get("source"),
            "times_used": entry.get("times_used") or 0,
            "last_used": entry.get("last_used_at"),
            "companies": entry.get("companies") or [],
        }

    @staticmethod
    def _to_api_entry(entry: dict) -> dict:
        return {
            "platform": "linkedin",
            "original_label": entry.get("label") or entry.get("normalized_label") or "",
            "normalized_label": entry.get("normalized_label") or normalize_label(entry.get("label", "")),
            "field_type": entry.get("field_type") or "text",
            "options": entry.get("options"),
            "answer": entry.get("answer"),
            "source": entry.get("source"),
            "times_used": entry.get("times_used") or 0,
            "last_used_at": entry.get("last_used"),
            "companies": entry.get("companies") or [],
        }

    @property
    def count(self) -> int:
        return len(self._data.get("questions", []))

    def find_answer(
        self,
        label: str,
        field_type: str,
        options: list[str] | None = None,
    ) -> tuple[str, str] | None:
        normalized = normalize_label(label)
        questions = self._data.get("questions", [])

        exact = [
            q for q in questions
            if q.get("normalized_label") == normalized and q.get("field_type") == field_type
        ]
        if exact:
            entry = max(exact, key=lambda q: q.get("times_used", 0))
            answer = self._resolve_cached_answer(entry.get("answer", ""), field_type, options)
            if answer is not None:
                return answer, "cache"

        best_match = None
        best_ratio = 0.0
        for entry in questions:
            if entry.get("field_type") != field_type:
                continue
            ratio = SequenceMatcher(None, normalized, entry.get("normalized_label", "")).ratio()
            threshold = float(get_runtime_value("question_similarity_threshold", 0.85) or 0.85)
            if ratio >= threshold and ratio > best_ratio:
                answer = self._resolve_cached_answer(entry.get("answer", ""), field_type, options)
                if answer is not None:
                    best_ratio = ratio
                    best_match = entry

        if best_match:
            resolved = self._resolve_cached_answer(best_match.get("answer", ""), field_type, options)
            if resolved is not None:
                return resolved, "cache"

        return None

    def _resolve_cached_answer(
        self,
        answer: str,
        field_type: str,
        options: list[str] | None,
    ) -> str | None:
        if field_type in ("select", "radio") and options:
            matched = match_option_in_list(answer, options)
            return matched
        return answer if answer else None

    def save_answer(
        self,
        label: str,
        field_type: str,
        answer: str,
        source: str,
        options: list[str] | None = None,
        company: str | None = None,
    ) -> None:
        if not answer and field_type not in ("checkbox",):
            return

        normalized = normalize_label(label)
        entry_id = hashlib.sha256(f"{normalized}|{field_type}".encode()).hexdigest()[:16]
        now = datetime.now().isoformat(timespec="seconds")
        questions = self._data.setdefault("questions", [])

        existing = next((q for q in questions if q.get("id") == entry_id), None)
        if existing:
            existing["answer"] = answer
            existing["source"] = source
            existing["options"] = options
            existing["times_used"] = existing.get("times_used", 0) + 1
            existing["last_used"] = now
            if company and company not in existing.get("companies", []):
                existing.setdefault("companies", []).append(company)
        else:
            questions.append({
                "id": entry_id,
                "label": label,
                "normalized_label": normalized,
                "field_type": field_type,
                "options": options,
                "answer": answer,
                "source": source,
                "times_used": 1,
                "last_used": now,
                "companies": [company] if company else [],
            })
            if source == "manual":
                self.session_manual_learned.append({
                    "label": label,
                    "answer": answer,
                    "field_type": field_type,
                })

        try:
            api_payload = self._to_api_entry(existing or questions[-1])
            saved_entry = api_client.upsert_question_cache_entry(api_payload)
            saved_local = self._from_api_entry(saved_entry)
            target = existing or questions[-1]
            target.update(saved_local)
        except BotApiError as e:
            api_client.log_unavailable("saving question cache", e)
            raise SystemExit("API data layer is required for question cache")

    def get_session_manual_learned(self) -> list[dict]:
        return list(self.session_manual_learned)
