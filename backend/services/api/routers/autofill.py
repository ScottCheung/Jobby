import re
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.api.routers.helpers import apply_updates
from services.shared.autofill_memory import fallback_mapping_scenes, platform_mapping_scene
from services.shared.autofill_profile import (
    PROFILE_PREFERENCES_KEY,
    core_profile_rows,
    core_profile_values,
    decrypt_profile_value,
    default_core_value_transform,
    delete_core_profile_value,
    encrypt_profile_value,
    ensure_identity_core_values,
    extract_semantic_features,
    form_control_fingerprint,
    match_mapping_rule,
    normalize_alias,
    normalize_scene,
    suggested_custom_core_key,
    transformed_core_value,
    upsert_core_profile_value,
)
from services.shared.database import get_db
from services.shared.models import (
    FieldMappingRule,
    FormTempChange,
    JobHuntingProfile,
    QuestionCacheEntry,
    User,
    UserCoreProfile,
)
from services.shared.realtime import broadcast_sync
from services.shared.schemas import (
    ApplicationFormInstructionsRequest,
    AutofillAnswerBase,
    AutofillAnswerRead,
    FieldMappingRuleBase,
    FieldMappingRuleRead,
    FormAnswerObservationRead,
    FormAnswerObservationRequest,
    FormAnswerObservationResponse,
    FormAutofillInstructionsRequest,
    FormAutofillInstructionsResponse,
    FormTempChangeRead,
    FormTempChangeRequest,
    FormTempFinalizeRequest,
    FormTempFinalizeResponse,
    QuestionCacheEntryBase,
    QuestionCacheEntryRead,
)
from services.shared.time_utils import utc_now

router = APIRouter(prefix="/api", tags=["autofill"])



from services.domain.autofill_matching import (
    _ATS_PLATFORMS,
    _autofill_answer_category,
    _autofill_intent_key,
    _autofill_intent_key_for_field,
    _build_form_autofill_instructions,
    _canonical_autofill_intent_key,
    _coerce_form_value,
    _compatible_form_field_types,
    _field_semantic_features,
    _form_scene,
    _inverse_sponsorship_answer,
    _is_phone_country_field,
    _is_privacy_or_terms_checkbox,
    _is_single_consent_checkbox,
    _match_form_field,
    _match_form_mapping_rule,
    _normalize_form_label,
    _notice_period_candidates,
    _phone_country_code,
    _phone_country_value,
    _sync_job_profile_core_values,
)


@router.post(
    "/form-autofill-instructions",
    response_model=FormAutofillInstructionsResponse,
    response_model_exclude_none=True,
)
def create_form_autofill_instructions(
    payload: FormAutofillInstructionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    """Match an inspected form directly against the user's saved data.

    This deliberately has no application-plan dependency: it is safe to use
    on an open form before a job has been inspected or an apply flow begins.
    """
    platform = payload.platform.strip().lower() or "generic"
    scene = _form_scene(payload.scene, payload.fields)
    return _build_form_autofill_instructions(
        db,
        payload=payload,
        current_user=current_user,
        platform=platform,
        scene=scene,
        dry_run=payload.dry_run,
    )


def _temp_change_response(change: FormTempChange) -> dict[str, Any]:
    return {
        "id": change.id,
        "session_id": change.session_id,
        "alias": change.alias,
        "temp_value": decrypt_profile_value(change.temp_value),
        "core_field_key": change.core_field_key,
        "scene": change.scene,
        "semantic_features": list(change.semantic_features or []),
        "field_type": change.field_type,
        "created_at": change.created_at,
        "updated_at": change.updated_at,
    }


def _upsert_form_temp_change(
    db: Session,
    *,
    payload: FormTempChangeRequest,
    current_user: User,
) -> FormTempChange | None:
    field = payload.field
    fingerprint = form_control_fingerprint(field)
    existing = db.scalar(
        select(FormTempChange).where(
            FormTempChange.user_id == current_user.id,
            FormTempChange.session_id == payload.session_id,
            FormTempChange.control_fingerprint == fingerprint,
        )
    )
    if not payload.temp_value.strip():
        if existing:
            db.delete(existing)
        return None
    scene = platform_mapping_scene(payload.platform, payload.scene)
    features = _field_semantic_features(field)
    match = None if _is_phone_country_field(field) else _match_form_mapping_rule(
        db,
        user_id=current_user.id,
        field=field,
        platform=payload.platform,
        scene=payload.scene,
        semantic_features=features,
    )
    if existing is None:
        existing = FormTempChange(
            user_id=current_user.id,
            session_id=payload.session_id,
            alias=field.label,
            normalized_alias=normalize_alias(field.label),
            temp_value="",
            core_field_key=match.rule.core_field_key if match else None,
            scene=scene,
            semantic_features=features,
            field_type=field.type,
            control_fingerprint=fingerprint,
            is_sensitive=True,
        )
        db.add(existing)
    from services.shared.autofill_profile import encrypt_profile_value
    existing.alias = field.label
    existing.normalized_alias = normalize_alias(field.label)
    existing.temp_value = encrypt_profile_value(payload.temp_value)
    existing.core_field_key = match.rule.core_field_key if match else existing.core_field_key
    existing.scene = scene
    existing.semantic_features = features
    existing.field_type = field.type
    return existing


@router.post("/form-temp-changes", response_model=FormTempChangeRead | None)
def save_form_temp_change(
    payload: FormTempChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any] | None:
    change = _upsert_form_temp_change(db, payload=payload, current_user=current_user)
    db.commit()
    if change is None:
        return None
    db.refresh(change)
    return _temp_change_response(change)


@router.get("/form-temp-changes", response_model=list[FormTempChangeRead])
def list_form_temp_changes(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict[str, Any]]:
    changes = list(db.scalars(
        select(FormTempChange)
        .where(FormTempChange.user_id == current_user.id, FormTempChange.session_id == session_id)
        .order_by(FormTempChange.updated_at.asc())
    ))
    return [_temp_change_response(change) for change in changes]


@router.post("/form-temp-changes/finalize", response_model=FormTempFinalizeResponse)
def finalize_form_temp_changes(
    payload: FormTempFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    try:
        for change in payload.changes:
            normalized = change.model_copy(update={"session_id": payload.session_id})
            _upsert_form_temp_change(db, payload=normalized, current_user=current_user)
        changes = list(db.scalars(
            select(FormTempChange).where(
                FormTempChange.user_id == current_user.id,
                FormTempChange.session_id == payload.session_id,
            )
        ))
        if not changes:
            db.commit()
            return {"status": "empty", "saved_count": 0, "discarded_count": 0}
        if not payload.save:
            discarded_count = len(changes)
            for change in changes:
                db.delete(change)
            db.commit()
            return {"status": "discarded", "saved_count": 0, "discarded_count": discarded_count}
        for change in changes:
            value = decrypt_profile_value(change.temp_value)
            core_key = change.core_field_key or suggested_custom_core_key(change.alias)
            upsert_core_profile_value(
                db, user_id=current_user.id, core_field_key=core_key, value=value,
                value_type="boolean" if change.field_type == "checkbox" else "text",
                is_sensitive=change.is_sensitive,
            )
            rule = db.scalar(
                select(FieldMappingRule).where(
                    FieldMappingRule.user_id == current_user.id,
                    FieldMappingRule.is_user_defined.is_(True),
                    FieldMappingRule.normalized_alias == change.normalized_alias,
                    FieldMappingRule.scene == change.scene,
                )
            )
            if rule is None:
                db.add(FieldMappingRule(
                    user_id=current_user.id,
                    core_field_key=core_key,
                    alias=change.alias,
                    normalized_alias=change.normalized_alias,
                    scene=change.scene,
                    semantic_features=change.semantic_features or [],
                    field_type=change.field_type,
                    value_transform=default_core_value_transform(core_key),
                    is_user_defined=True,
                    confidence=100,
                ))
            else:
                rule.core_field_key = core_key
                rule.alias = change.alias
                rule.semantic_features = change.semantic_features or []
                rule.field_type = change.field_type
                rule.confidence = 100
        saved_count = len(changes)
        for change in changes:
            db.delete(change)
        db.commit()
        return {"status": "saved", "saved_count": saved_count, "discarded_count": 0}
    except Exception:
        db.rollback()
        raise


@router.get("/field-mapping-rules", response_model=list[FieldMappingRuleRead])
def list_field_mapping_rules(
    include_system: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[FieldMappingRule]:
    condition = or_(FieldMappingRule.user_id == current_user.id, FieldMappingRule.user_id.is_(None)) if include_system else FieldMappingRule.user_id == current_user.id
    return list(db.scalars(select(FieldMappingRule).where(condition).order_by(FieldMappingRule.is_user_defined.desc(), FieldMappingRule.confidence.desc(), FieldMappingRule.alias)))


@router.post("/field-mapping-rules", response_model=FieldMappingRuleRead, status_code=status.HTTP_201_CREATED)
def create_field_mapping_rule(
    payload: FieldMappingRuleBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> FieldMappingRule:
    rule = FieldMappingRule(
        user_id=current_user.id,
        core_field_key=payload.core_field_key.strip(),
        alias=payload.alias.strip(),
        normalized_alias=normalize_alias(payload.alias),
        scene=normalize_scene(payload.scene),
        semantic_features=payload.semantic_features,
        field_type=payload.field_type,
        value_transform=payload.value_transform,
        is_user_defined=True,
        confidence=payload.confidence,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/field-mapping-rules/{rule_id}", response_model=FieldMappingRuleRead)
def update_field_mapping_rule(
    rule_id: UUID,
    payload: FieldMappingRuleBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> FieldMappingRule:
    rule = db.get(FieldMappingRule, rule_id)
    if not rule or rule.user_id != current_user.id or not rule.is_user_defined:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User mapping rule not found")
    rule.core_field_key = payload.core_field_key.strip()
    rule.alias = payload.alias.strip()
    rule.normalized_alias = normalize_alias(payload.alias)
    rule.scene = normalize_scene(payload.scene)
    rule.semantic_features = payload.semantic_features
    rule.field_type = payload.field_type
    rule.value_transform = payload.value_transform
    rule.confidence = payload.confidence
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/field-mapping-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field_mapping_rule(
    rule_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    rule = db.get(FieldMappingRule, rule_id)
    if not rule or rule.user_id != current_user.id or not rule.is_user_defined:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User mapping rule not found")
    db.delete(rule)
    db.commit()


@router.post("/form-autofill-observations", response_model=FormAnswerObservationResponse)
def observe_manual_form_answer(
    payload: FormAnswerObservationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, str | None]:
    """Record a manual answer without immediately promoting it to AI Memory."""
    answer = (payload.answer or getattr(payload, "temp_value", "")).strip()
    if not answer or payload.field.type in {"password", "file", "unknown"}:
        return {"status": "ignored", "intent_key": None}
    # Older extension builds do not carry a stable form session or an explicit
    # save/cancel action, so accepting their observations would create orphaned
    # temporary data. They must upgrade before learning can be enabled.
    return {"status": "ignored", "intent_key": _autofill_intent_key(payload.field.label)}


@router.get("/form-autofill-observations", response_model=list[FormAnswerObservationRead])
def list_form_answer_observations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict[str, Any]]:
    """Compatibility view over unconfirmed session changes."""
    changes = list(db.scalars(
        select(FormTempChange)
        .where(FormTempChange.user_id == current_user.id)
        .order_by(FormTempChange.updated_at.desc())
    ))
    return [
        {
            **_temp_change_response(change),
            "platform": "generic",
            "company_scope": "",
            "original_label": change.alias,
            "answer": decrypt_profile_value(change.temp_value),
            "intent_key": change.core_field_key,
            "times_seen": 1,
            "status": "observed",
            "last_seen_at": change.updated_at,
        }
        for change in changes
    ]


@router.delete("/form-autofill-observations/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form_answer_observation(
    observation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    observation = db.get(FormTempChange, observation_id)
    if not observation or observation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form answer observation not found")
    db.delete(observation)
    db.commit()



@router.get("/autofill-answers", response_model=list[AutofillAnswerRead])
def list_autofill_answers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[dict[str, Any]]:
    rows = core_profile_rows(db, current_user.id)
    result: list[dict[str, Any]] = []
    needle = search.strip().casefold() if search and search.strip() else ""
    for row in rows:
        if row.core_field_key == PROFILE_PREFERENCES_KEY:
            continue
        value = decrypt_profile_value(row.field_value)
        if needle and needle not in row.core_field_key.casefold() and needle not in value.casefold():
            continue
        result.append({
            "id": row.id,
            "user_id": row.user_id,
            "intent_key": row.core_field_key,
            "value": value,
            "value_type": row.value_type,
            "authority": "user",
            "version": row.version,
            "last_confirmed_at": row.updated_at,
            "times_used": 0,
            "last_used_at": None,
            "active": True,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        })
    return result


@router.post("/autofill-answers", response_model=AutofillAnswerRead, status_code=status.HTTP_201_CREATED)
def create_autofill_answer(
    payload: AutofillAnswerBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    payload.intent_key = _canonical_autofill_intent_key(payload.intent_key)
    answer = upsert_core_profile_value(
        db,
        user_id=current_user.id,
        core_field_key=payload.intent_key,
        value=payload.value,
        value_type=payload.value_type,
    )
    db.commit()
    db.refresh(answer)
    return {
        "id": answer.id, "user_id": answer.user_id, "intent_key": answer.core_field_key,
        "value": payload.value, "value_type": answer.value_type, "authority": "user", "version": answer.version,
        "last_confirmed_at": answer.updated_at, "times_used": 0, "last_used_at": None, "active": True,
        "created_at": answer.created_at, "updated_at": answer.updated_at,
    }


@router.put("/autofill-answers/{answer_id}", response_model=AutofillAnswerRead)
def update_autofill_answer(
    answer_id: UUID,
    payload: AutofillAnswerBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    payload.intent_key = _canonical_autofill_intent_key(payload.intent_key)
    answer = db.get(UserCoreProfile, answer_id)
    if not answer or answer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Autofill answer not found")
    if answer.core_field_key != payload.intent_key:
        delete_core_profile_value(db, user_id=current_user.id, core_field_key=answer.core_field_key)
        answer = upsert_core_profile_value(db, user_id=current_user.id, core_field_key=payload.intent_key, value=payload.value, value_type=payload.value_type)
    else:
        upsert_core_profile_value(db, user_id=current_user.id, core_field_key=payload.intent_key, value=payload.value, value_type=payload.value_type)
    db.commit()
    db.refresh(answer)
    return {
        "id": answer.id, "user_id": answer.user_id, "intent_key": answer.core_field_key,
        "value": payload.value, "value_type": answer.value_type, "authority": "user", "version": answer.version,
        "last_confirmed_at": answer.updated_at, "times_used": 0, "last_used_at": None, "active": payload.active,
        "created_at": answer.created_at, "updated_at": answer.updated_at,
    }


@router.delete("/autofill-answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autofill_answer(
    answer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    answer = db.get(UserCoreProfile, answer_id)
    if not answer or answer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Autofill answer not found")
    db.delete(answer)
    db.commit()


@router.get("/question-cache", response_model=list[QuestionCacheEntryRead])
def list_question_cache(
    limit: int | None = Query(default=None),
    offset: int | None = Query(default=None),
    search: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[QuestionCacheEntry]:
    query = select(QuestionCacheEntry).where(QuestionCacheEntry.user_id == current_user.id)
    if platform and platform.strip():
        query = query.where(QuestionCacheEntry.platform == platform.strip().lower())
    if search:
        search_query = f"%{search.strip().lower()}%"
        query = query.where(
            QuestionCacheEntry.original_label.ilike(search_query) |
            QuestionCacheEntry.answer.ilike(search_query)
        )
    stmt = query.order_by(QuestionCacheEntry.last_used_at.desc().nullslast(), QuestionCacheEntry.created_at.desc())
    if offset is not None:
        stmt = stmt.offset(offset)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))



@router.post("/question-cache/upsert", response_model=QuestionCacheEntryRead)
def upsert_question_cache_entry(
    payload: QuestionCacheEntryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> QuestionCacheEntry:
    entry = db.scalar(
        select(QuestionCacheEntry).where(
            QuestionCacheEntry.user_id == current_user.id,
            QuestionCacheEntry.platform == payload.platform,
            QuestionCacheEntry.normalized_label == payload.normalized_label,
            QuestionCacheEntry.field_type == payload.field_type,
        )
    )
    if not entry:
        entry = QuestionCacheEntry(user_id=current_user.id)
        db.add(entry)

    apply_updates(entry, payload.model_dump())
    db.commit()
    db.refresh(entry)
    broadcast_sync("question_cache_upserted", QuestionCacheEntryRead.model_validate(entry).model_dump(mode="json"))
    return entry


@router.post("/question-cache", response_model=QuestionCacheEntryRead, status_code=status.HTTP_201_CREATED)
def create_question_cache_entry(
    payload: QuestionCacheEntryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> QuestionCacheEntry:
    entry = QuestionCacheEntry(user_id=current_user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    broadcast_sync("question_cache_created", QuestionCacheEntryRead.model_validate(entry).model_dump(mode="json"))
    return entry


@router.put("/question-cache/{entry_id}", response_model=QuestionCacheEntryRead)
def update_question_cache_entry(
    entry_id: UUID,
    payload: QuestionCacheEntryBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> QuestionCacheEntry:
    entry = db.get(QuestionCacheEntry, entry_id)
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question cache entry not found")

    apply_updates(entry, payload.model_dump())
    db.commit()
    db.refresh(entry)
    broadcast_sync("question_cache_updated", QuestionCacheEntryRead.model_validate(entry).model_dump(mode="json"))
    return entry


@router.delete("/question-cache/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question_cache_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    entry = db.get(QuestionCacheEntry, entry_id)
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question cache entry not found")

    db.delete(entry)
    db.commit()
    broadcast_sync("question_cache_deleted", {"id": str(entry_id)})

