import hashlib
import json
import os
import re
from datetime import datetime
from difflib import SequenceMatcher

from config.settings import question_cache_file, question_similarity_threshold
from modules.helpers import print_lg


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
    def __init__(self, cache_path: str = question_cache_file) -> None:
        self.cache_path = cache_path
        self._data: dict = {"version": 1, "questions": []}
        self.session_manual_learned: list[dict] = []
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.cache_path):
            return
        try:
            with open(self.cache_path, encoding="utf-8") as f:
                self._data = json.load(f)
            if "questions" not in self._data:
                self._data["questions"] = []
        except Exception as e:
            print_lg(f"Failed to load question cache from {self.cache_path}: {e}")

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.cache_path) or ".", exist_ok=True)
        tmp_path = f"{self.cache_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, self.cache_path)

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
            if ratio >= question_similarity_threshold and ratio > best_ratio:
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

        self._save()

    def get_session_manual_learned(self) -> list[dict]:
        return list(self.session_manual_learned)
