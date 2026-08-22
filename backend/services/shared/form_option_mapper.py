"""Safe coercion of canonical profile values into a site's control options."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from services.shared.autofill_profile import normalize_alias


def _notice_period_candidates(raw_answer: str) -> list[str]:
    cleaned = str(raw_answer or "").strip()
    if not cleaned:
        return []
    try:
        days = int(cleaned)
    except (ValueError, TypeError):
        return [cleaned]
    candidates = [str(days), f"{days} days", f"{days} day", f"{days}d"]
    if days == 0:
        return candidates + ["immediate", "immediately", "no notice", "none", "0 weeks", "available immediately"]
    weeks, months = round(days / 7), round(days / 30)
    if weeks:
        candidates += [f"{weeks} week", f"{weeks} weeks", f"{weeks} wks", f"{weeks} wk", f"{weeks}w", f"{weeks} week notice", f"{weeks} weeks notice"]
    if months:
        candidates += [f"{months} month", f"{months} months", f"{months} mon", f"{months}m", f"{months} month notice"]
    return candidates


def _special_candidates(raw_answer: str, field_label: str, core_field_key: str | None) -> list[str]:
    candidates = [raw_answer]
    answer = normalize_alias(raw_answer)

    def has_phrase(*phrases: str) -> bool:
        padded_answer = f" {answer} "
        return any(f" {normalize_alias(phrase)} " in padded_answer for phrase in phrases)

    if core_field_key == "employment.notice_period" or "notice" in field_label.lower():
        return candidates + _notice_period_candidates(raw_answer)
    if core_field_key == "employment.work_authorization":
        if has_phrase("yes", "true", "full", "authorized", "citizen", "pr", "permanent", "permit", "work rights", "unrestricted"):
            candidates += ["yes", "y", "true", "1", "authorized", "eligible", "unrestricted work rights", "full working rights"]
            if has_phrase("citizen"):
                candidates += ["citizen", "australian/new zealand citizen", "australian citizen", "citizen / permanent resident"]
            elif has_phrase("pr", "permanent"):
                candidates += ["permanent resident", "permanent", "pr holder", "citizen / permanent resident"]
            elif has_phrase("visa", "permit"):
                candidates += ["valid visa holder", "visa holder", "visa", "temporary visa holder"]
        elif has_phrase("no", "false"):
            candidates += ["no", "n", "false", "0", "requires sponsorship", "no work rights"]
    elif core_field_key == "consent.sms" or "sms" in field_label.lower() or "text message" in field_label.lower():
        candidates += ["false", "no", "0", "no - i do not consent to receiving text messages", "true", "yes", "1", "yes - i consent to receiving text messages"]
    elif core_field_key == "employment.visa_status":
        if has_phrase("work visa", "temporary", "yes", "student", "bridging", "holder", "visa"):
            candidates += ["yes", "y", "true", "1", "temporary visa holder", "work visa", "valid visa holder", "working visa"]
        elif has_phrase("no", "false", "citizen", "pr", "permanent"):
            candidates += ["no", "n", "false", "0", "australian/new zealand citizen", "permanent resident"]
    elif core_field_key == "employment.visa_sponsorship":
        if has_phrase("no", "false", "none", "not required", "don't need", "will not require"):
            candidates += ["no", "n", "false", "0", "no sponsorship required", "will not require sponsorship"]
        elif has_phrase("yes", "true", "required", "need"):
            candidates += ["yes", "y", "true", "1", "sponsorship required"]
    elif core_field_key == "identity.pronouns" or "pronoun" in field_label.lower():
        for signals, choices in [
            (["he/him", "he / him", "male"], ["he/him", "he / him", "he / him / his", "he/him/his", "he", "him", "his", "male"]),
            (["she/her", "she / her", "female"], ["she/her", "she / her", "she / her / hers", "she/her/hers", "she", "her", "hers", "female"]),
            (["they/them", "they / them"], ["they/them", "they / them", "they / them / theirs", "they/them/theirs", "they", "them", "theirs"]),
            (["prefer not to say", "decline", "do not wish"], ["prefer not to say", "decline to state", "do not wish to specify", "prefer not to specify"]),
        ]:
            if has_phrase(*signals):
                candidates += choices
                break
    return candidates


def _option_value(options: list[dict[str, str]], candidates: list[str]) -> str | None:
    normalized = {normalize_alias(candidate) for candidate in candidates if candidate}
    for option in options:
        value = str(option.get("value") or option.get("label") or "")
        label = normalize_alias(option.get("label", ""))
        if label in {"select", "choose", "please select", "-- select --"}:
            continue
        if normalized & {normalize_alias(value), label}:
            return value
    best_option, best_score = None, 0
    for option in options:
        value, label = str(option.get("value") or option.get("label") or ""), normalize_alias(option.get("label", ""))
        if not label or label in {"select", "choose", "please select", "-- select --"}:
            continue
        option_tokens = set(label.split())
        for candidate in normalized:
            candidate_tokens = set(candidate.split())
            if len(candidate_tokens) < 2:
                continue
            overlap = len(candidate_tokens & option_tokens)
            if candidate in label or label in candidate:
                score = 10 + overlap
            elif overlap >= 2 and overlap / len(candidate_tokens) >= 0.75:
                score = overlap
            else:
                continue
            if score > best_score:
                best_option, best_score = value, score
    return best_option


def _format_date(raw_answer: str, field: Any, core_field_key: str | None) -> str:
    field_label = str(getattr(field, "label", "") or "")
    if core_field_key != "employment.date_available" and "available" not in field_label.lower():
        return raw_answer
    label_text = f"{field_label} {getattr(field, 'placeholder', '')}".lower()
    try:
        date_value = datetime.strptime(raw_answer[:10], "%Y-%m-%d")
    except ValueError:
        return raw_answer
    if "mm/dd/yyyy" in label_text or "mm-dd-yyyy" in label_text:
        return date_value.strftime("%m/%d/%Y")
    if "dd/mm/yyyy" in label_text or "dd-mm-yyyy" in label_text:
        return date_value.strftime("%d/%m/%Y")
    return raw_answer


def coerce_form_value(raw_answer: str, field: Any, core_field_key: str | None = None) -> tuple[str | bool | None, str | None]:
    if field.type == "checkbox":
        if raw_answer.casefold() not in {"true", "false"}:
            return None, "Checkbox value is not boolean."
        return raw_answer.casefold() == "true", None
    if field.type in {"select", "radio"}:
        value = _option_value(
            list(getattr(field, "options", None) or []),
            _special_candidates(raw_answer, str(getattr(field, "label", "") or ""), core_field_key),
        )
        if value is not None:
            return value, None
        if getattr(field, "options", None):
            return None, "Value is not one of the available options."
    return _format_date(raw_answer, field, core_field_key), None
