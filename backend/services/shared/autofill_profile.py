from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
from functools import lru_cache
from typing import Any
from uuid import UUID, uuid4

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from services.shared.models import FieldMappingRule, User, UserCoreProfile
from services.shared.settings import get_settings
from services.shared.time_utils import utc_now


PROFILE_PREFERENCES_KEY = "system.preferences"

LEGACY_PROFILE_KEYS = {
    "preferred_name": "identity.preferred_name",
    "first_name": "identity.first_name",
    "middle_name": "identity.middle_name",
    "last_name": "identity.last_name",
    "title": "identity.title",
    "email": "identity.email",
    "phone_number": "identity.phone",
    "current_city": "address.city",
    "street": "address.street",
    "state": "address.state",
    "zipcode": "address.postal_code",
    "country": "address.country",
    "pronouns": "identity.pronouns",
    "ethnicity": "demographic.ethnicity",
    "gender": "demographic.gender",
    "gender_identity": "demographic.gender_identity",
    "disability_status": "demographic.disability_status",
    "veteran_status": "demographic.veteran_status",
}

CORE_FIELD_LABELS = {
    "identity.preferred_name": "Preferred name",
    "identity.first_name": "First name",
    "identity.middle_name": "Middle name",
    "identity.last_name": "Last name",
    "identity.title": "Title",
    "identity.pronouns": "Pronouns",
    "identity.full_name": "Full name",
    "identity.legal_full_name": "Legal full name",
    "identity.email": "Email",
    "application.password": "Password",
    "identity.phone": "Phone number",
    "address.street": "Address Line 1",
    "address.suburb": "Suburb",
    "address.city": "City",
    "address.state": "State / province",
    "address.postal_code": "Postcode",
    "address.country": "Country",
    "employment.current_location": "Current location",
    "employment.citizenship": "Citizenship",
    "employment.work_authorization": "Work authorization",
    "employment.visa_status": "Visa status",
    "employment.visa_type": "Visa type",
    "employment.visa_expiry": "Visa expiry date",
    "employment.visa_sponsorship": "Visa sponsorship required",
    "employment.work_restrictions": "Work hour restrictions",
    "employment.security_clearance": "Security clearance",
    "employment.police_check_consent": "Police check consent",
    "employment.wwcc_status": "Working with children check (WWCC)",
    "employment.drivers_license": "Driver license status",
    "employment.relocation": "Relocation",
    "employment.office_attendance": "Office attendance",
    "employment.notice_period": "Notice period (days)",
    "employment.date_available": "Date available",
    "employment.linkedin_url": "LinkedIn URL",
    "employment.website": "Personal website",
    "employment.portfolio_url": "Portfolio URL",
    "employment.github_url": "GitHub URL",
    "employment.recent_employer": "Most recent employer",
    "experience.years": "Years of experience",
    "compensation.desired_base_salary": "Desired base salary",
    "compensation.desired_day_rate": "Desired day rate",
    "compensation.current_salary": "Current salary",
    "demographic.ethnicity": "Ethnicity",
    "demographic.gender": "Gender",
    "demographic.gender_identity": "Gender identity",
    "demographic.disability_status": "Disability status",
    "demographic.veteran_status": "Veteran status",
}

# These aliases are kept in code as a compatibility fallback for installations
# that have not yet applied the mapping-rule migration. Database rules still
# take priority, so users can override them with their own mappings.
BUILT_IN_SYSTEM_MAPPING_RULES = (
    ("identity.full_name", "Name", ["name"]),
    ("identity.phone", "Mobile Phone", ["mobile", "phone"]),
    ("identity.phone", "Phone", ["phone"]),
    ("identity.phone", "Telephone", ["telephone"]),
    ("application.password", "Password", ["password"]),
    ("application.password", "New Password", ["new", "password"]),
    ("application.password", "Verify New Password", ["verify", "new", "password"]),
    ("application.password", "Confirm Password", ["confirm", "password"]),
    ("identity.phone", "Contact number", ["contact", "number"]),
    ("demographic.gender_identity", "Gender (please specify)", ["gender", "please", "specify"]),
    ("demographic.gender_identity", "Please specify gender", ["please", "specify", "gender"]),
    ("address.state", "State", ["state"]),
    ("address.state", "State / Province", ["state", "province"]),
    ("address.state", "Province", ["province"]),
    ("address.state", "Region", ["region"]),
    ("employment.date_available", "Date Available", ["date", "available"]),
    ("employment.date_available", "Available Date", ["available", "date"]),
    ("employment.date_available", "Available From", ["available", "from"]),
    ("employment.date_available", "Earliest Start Date", ["earliest", "start", "date"]),
    ("employment.date_available", "Availability Date", ["availability", "date"]),
    ("employment.date_available", "When can you start", ["when", "start"]),
    ("employment.notice_period", "Notice Period", ["notice", "period"]),
    ("employment.notice_period", "Notice Time", ["notice", "time"]),
    ("employment.notice_period", "Notice", ["notice"]),
    ("compensation.desired_base_salary", "Salary Expectation", ["salary", "expectation"]),
    ("compensation.desired_base_salary", "Salary Expectation (AUD/year)", ["salary", "expectation", "aud", "year"]),
    ("compensation.desired_day_rate", "Day Rate Expectation", ["day", "rate", "expectation"]),
    ("compensation.desired_day_rate", "Day Rate Expectation (AUD/day)", ["day", "rate", "expectation", "aud", "day"]),
    ("compensation.desired_day_rate", "Daily Rate", ["daily", "rate"]),
    ("compensation.desired_day_rate", "Day Rate", ["day", "rate"]),
    ("address.suburb", "Suburb", ["suburb"]),
    ("address.suburb", "Town / Suburb", ["town", "suburb"]),
    ("address.suburb", "Locality", ["locality"]),
    ("address.postal_code", "Postcode", ["postcode"]),
    ("address.postal_code", "Post code", ["post", "code"]),
    ("address.postal_code", "Postal code", ["postal", "code"]),
    ("employment.work_authorization", "Do you currently have full working rights", ["full", "working", "rights"]),
    ("employment.work_authorization", "Work rights", ["work", "rights"]),
    ("employment.work_authorization", "Right to work", ["right", "to", "work"]),
    ("employment.visa_status", "Are you currently on a work visa", ["on", "a", "work", "visa"]),
    ("employment.visa_status", "Do you have a valid working visa", ["valid", "working", "visa"]),
    ("employment.visa_status", "Work visa status", ["work", "visa", "status"]),
    ("employment.visa_type", "Please provide details of your visa", ["details", "of", "your", "visa"]),
    ("identity.pronouns", "Pronouns", ["pronouns"]),
    ("identity.pronouns", "Preferred Pronouns", ["preferred", "pronouns"]),
    ("identity.pronouns", "Your Pronouns", ["your", "pronouns"]),
    ("identity.pronouns", "Gender Pronouns", ["gender", "pronouns"]),
)

STOP_WORDS = {
    "a", "an", "and", "are", "do", "enter", "for", "is", "of", "please", "the", "to", "what", "your",
}


@lru_cache(maxsize=1)
def _profile_cipher() -> Fernet:
    material = get_settings().autofill_encryption_key.get_secret_value().encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(material).digest())
    return Fernet(key)


def encrypt_profile_value(value: str) -> str:
    return "fernet:v1:" + _profile_cipher().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_profile_value(value: str) -> str:
    if not value.startswith("fernet:v1:"):
        return value
    try:
        return _profile_cipher().decrypt(value.removeprefix("fernet:v1:").encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Stored profile value could not be decrypted") from exc


def normalize_alias(value: str) -> str:
    normalized = re.sub(r"[^\w]+", " ", str(value or "").casefold(), flags=re.UNICODE)
    return " ".join(normalized.split())


def normalize_scene(value: str | None) -> str:
    return normalize_alias(value or "generic").replace(" ", "_")[:100] or "generic"


def extract_semantic_features(*values: str) -> list[str]:
    words: list[str] = []
    for value in values:
        for word in normalize_alias(value).split():
            if len(word) > 1 and word not in STOP_WORDS and word not in words:
                words.append(word)
    return words[:50]


def form_control_fingerprint(field: Any) -> str:
    identity = "|".join(
        [
            str(field.type or ""),
            normalize_alias(getattr(field, "name", None) or ""),
            normalize_alias(getattr(field, "id", None) or ""),
            normalize_alias(field.label),
        ]
    )
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def core_profile_rows(db: Session, user_id: UUID) -> list[UserCoreProfile]:
    return list(
        db.scalars(
            select(UserCoreProfile)
            .where(UserCoreProfile.user_id == user_id)
            .order_by(UserCoreProfile.core_field_key)
        )
    )


def core_profile_values(db: Session, user_id: UUID) -> dict[str, str]:
    return {row.core_field_key: decrypt_profile_value(row.field_value) for row in core_profile_rows(db, user_id)}


def upsert_core_profile_value(
    db: Session,
    *,
    user_id: UUID,
    core_field_key: str,
    value: str,
    value_type: str = "text",
    is_sensitive: bool = True,
) -> UserCoreProfile:
    key = core_field_key.strip().casefold()[:150]
    if not key:
        raise ValueError("core_field_key is required")
    row = db.scalar(
        select(UserCoreProfile).where(
            UserCoreProfile.user_id == user_id,
            UserCoreProfile.core_field_key == key,
        )
    )
    encrypted = encrypt_profile_value(value)
    if row is None:
        row = UserCoreProfile(
            user_id=user_id,
            core_field_key=key,
            field_value=encrypted,
            value_type=value_type,
            is_sensitive=is_sensitive,
        )
        db.add(row)
    else:
        if decrypt_profile_value(row.field_value) != value or row.value_type != value_type:
            row.version += 1
        row.field_value = encrypted
        row.value_type = value_type
        row.is_sensitive = is_sensitive
    return row


def delete_core_profile_value(db: Session, *, user_id: UUID, core_field_key: str) -> None:
    row = db.scalar(
        select(UserCoreProfile).where(
            UserCoreProfile.user_id == user_id,
            UserCoreProfile.core_field_key == core_field_key,
        )
    )
    if row is not None:
        db.delete(row)


def ensure_identity_core_values(db: Session, user: User) -> None:
    values = core_profile_values(db, user.id)
    if not values.get("identity.email") and user.email:
        upsert_core_profile_value(
            db, user_id=user.id, core_field_key="identity.email", value=user.email
        )
    if not values.get("identity.preferred_name") and user.display_name:
        upsert_core_profile_value(
            db,
            user_id=user.id,
            core_field_key="identity.preferred_name",
            value=user.display_name,
        )

    # Older profile versions stored personal extras and learned answers outside
    # the canonical identity namespace. Promote a saved salutation once so a
    # form labelled `Title` can use the same source as every other identity
    # field. Do not overwrite an explicit canonical value.
    if not values.get("identity.title"):
        title_value: str | None = None
        for legacy_key in (
            "identity.salutation",
            "identity.prefix",
            "learned.title",
            "learned.salutation",
            "custom.title",
        ):
            candidate = str(values.get(legacy_key) or "").strip()
            if candidate:
                title_value = candidate
                break
        if not title_value:
            raw_preferences = values.get(PROFILE_PREFERENCES_KEY, "")
            try:
                preferences = json.loads(raw_preferences) if raw_preferences else {}
            except json.JSONDecodeError:
                preferences = {}
            if isinstance(preferences, dict):
                for key in ("title", "salutation", "prefix", "honorific"):
                    candidate = str(preferences.get(key) or "").strip()
                    if candidate:
                        title_value = candidate
                        break
        if title_value:
            upsert_core_profile_value(
                db,
                user_id=user.id,
                core_field_key="identity.title",
                value=title_value,
            )


def profile_api_payload(db: Session, user: User) -> dict[str, Any]:
    rows = core_profile_rows(db, user.id)
    values = {row.core_field_key: decrypt_profile_value(row.field_value) for row in rows}
    raw_preferences = values.get(PROFILE_PREFERENCES_KEY, "{}")
    try:
        extra_data = json.loads(raw_preferences) if raw_preferences else {}
    except json.JSONDecodeError:
        extra_data = {}
    visible_rows = [row for row in rows if row.core_field_key != PROFILE_PREFERENCES_KEY]
    now = utc_now()
    payload: dict[str, Any] = {
        "id": visible_rows[0].id if visible_rows else user.id,
        "user_id": user.id,
        "fields": [
            {
                "id": row.id,
                "core_field_key": row.core_field_key,
                "label": CORE_FIELD_LABELS.get(
                    row.core_field_key,
                    row.core_field_key.removeprefix("custom.").replace(".", " ").replace("_", " ").title(),
                ),
                "value": values[row.core_field_key],
                "value_type": row.value_type,
                "is_sensitive": row.is_sensitive,
                "version": row.version,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in visible_rows
        ],
        "extra_data": extra_data if isinstance(extra_data, dict) else {},
        "created_at": min((row.created_at for row in rows), default=user.created_at or now),
        "updated_at": max((row.updated_at for row in rows), default=user.updated_at or now),
    }
    for legacy_name, core_key in LEGACY_PROFILE_KEYS.items():
        payload[legacy_name] = values.get(core_key)
    payload["preferred_name"] = values.get("identity.preferred_name") or user.display_name
    return payload


@dataclass(frozen=True)
class MappingMatch:
    rule: FieldMappingRule
    score: float


def _mapping_score(
    rule: FieldMappingRule,
    *,
    alias: str,
    scene: str,
    semantic_features: list[str],
    field_type: str,
) -> float:
    normalized = normalize_alias(alias)
    similarity = SequenceMatcher(None, normalized, rule.normalized_alias).ratio()
    if normalized == rule.normalized_alias:
        alias_score = 70.0
    elif normalized in rule.normalized_alias or rule.normalized_alias in normalized:
        alias_score = 48.0
    elif similarity >= 0.62:
        alias_score = similarity * 55.0
    else:
        alias_score = 0.0

    requested_features = set(semantic_features)
    rule_features = {normalize_alias(str(item)) for item in (rule.semantic_features or [])}
    rule_features.discard("")
    feature_score = 0.0
    if requested_features and rule_features:
        feature_score = 20.0 * len(requested_features & rule_features) / len(requested_features | rule_features)

    scene_score = 15.0 if rule.scene == scene else 5.0 if rule.scene == "generic" else 0.0
    type_score = 5.0 if not rule.field_type or rule.field_type == field_type else -10.0
    confidence_score = max(0, min(rule.confidence, 100)) / 10.0
    return alias_score + feature_score + scene_score + type_score + confidence_score


def _built_in_system_rules() -> list[FieldMappingRule]:
    now = utc_now()
    return [
        FieldMappingRule(
            id=uuid4(),
            core_field_key=core_field_key,
            alias=alias,
            normalized_alias=normalize_alias(alias),
            scene="generic",
            semantic_features=features,
            value_transform=default_core_value_transform(core_field_key),
            is_user_defined=False,
            confidence=90,
            times_used=0,
            created_at=now,
            updated_at=now,
        )
        for core_field_key, alias, features in BUILT_IN_SYSTEM_MAPPING_RULES
    ]


def match_mapping_rule(
    db: Session,
    *,
    user_id: UUID,
    alias: str,
    scene: str,
    semantic_features: list[str],
    field_type: str,
) -> MappingMatch | None:
    normalized_scene = normalize_scene(scene)
    normalized_alias = normalize_alias(alias)
    rules = list(
        db.scalars(
            select(FieldMappingRule).where(
                or_(
                    (FieldMappingRule.user_id == user_id) & FieldMappingRule.is_user_defined.is_(True),
                    (FieldMappingRule.user_id.is_(None)) & FieldMappingRule.is_user_defined.is_(False),
                )
            )
        )
    )
    user_rules = [rule for rule in rules if rule.user_id == user_id and rule.is_user_defined]
    system_rules = [rule for rule in rules if rule.user_id is None and not rule.is_user_defined]
    for candidates in (user_rules, system_rules):
        scored = [
            MappingMatch(
                rule,
                _mapping_score(
                    rule,
                    alias=alias,
                    scene=normalized_scene,
                    semantic_features=semantic_features,
                    field_type=field_type,
                ),
            )
            for rule in candidates
            if not (
                "please specify" in normalized_alias
                and rule.core_field_key == "demographic.gender"
            )
        ]
        scored = [candidate for candidate in scored if candidate.score >= 65]
        if scored:
            return max(scored, key=lambda item: (item.score, item.rule.confidence, item.rule.updated_at))

    fallback_matches = [
        MappingMatch(
            rule,
            _mapping_score(
                rule,
                alias=alias,
                scene=normalized_scene,
                semantic_features=semantic_features,
                field_type=field_type,
            ),
        )
        for rule in _built_in_system_rules()
    ]
    fallback_matches = [candidate for candidate in fallback_matches if candidate.score >= 65]
    if fallback_matches:
        return max(fallback_matches, key=lambda item: (item.score, item.rule.confidence, item.rule.updated_at))
    return None


def transformed_core_value(rule: FieldMappingRule, values: dict[str, str]) -> str | None:
    direct = values.get(rule.core_field_key)
    if direct:
        return direct
    transform = rule.value_transform or {}
    if transform.get("operation") != "join":
        return None
    source_keys = transform.get("source_keys")
    if not isinstance(source_keys, list):
        return None
    parts = [values.get(str(key), "").strip() for key in source_keys]
    parts = [part for part in parts if part]
    if not parts:
        if rule.core_field_key in {"identity.full_name", "identity.legal_full_name"}:
            return values.get("identity.preferred_name")
        return None
    return str(transform.get("separator", " ")).join(parts)


def default_core_value_transform(core_field_key: str) -> dict[str, Any]:
    if core_field_key in {"identity.full_name", "identity.legal_full_name"}:
        return {
            "operation": "join",
            "source_keys": ["identity.first_name", "identity.middle_name", "identity.last_name"],
            "separator": " ",
        }
    return {}


def suggested_custom_core_key(alias: str) -> str:
    slug = normalize_alias(alias).replace(" ", "_")[:100]
    if slug:
        return f"custom.{slug}"
    return f"custom.{hashlib.sha256(alias.encode('utf-8')).hexdigest()[:16]}"


def utc_timestamp() -> datetime:
    return utc_now()
