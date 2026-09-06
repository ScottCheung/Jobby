import json
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.shared.autofill_profile import (
    LEGACY_PROFILE_KEYS,
    PROFILE_PREFERENCES_KEY,
    core_profile_values,
    delete_core_profile_value,
    ensure_identity_core_values,
    profile_api_payload,
    upsert_core_profile_value,
)
from services.shared.database import get_db
from services.shared.time_utils import utc_now
from services.shared.media import MediaError, optimize_avatar_to_webp
from services.shared.models import User
from services.shared.schemas import UserProfileBase, UserProfileRead, UserRead
from services.shared.settings import get_settings
from services.shared.storage import StorageError, get_object_storage

router = APIRouter(prefix="/api", tags=["users"])
settings = get_settings()


def profile_response(_profile: object | None, user: User, db: Session) -> dict:
    """Return a compatibility envelope assembled from encrypted KV rows."""
    ensure_identity_core_values(db, user)
    return profile_api_payload(db, user)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_or_create_current_user)) -> User:
    return current_user


@router.post("/me/avatar", response_model=UserRead)
def upload_current_user_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> User:
    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(status_code=400, detail="Use a PNG, JPEG, WebP, or GIF image")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(content) > settings.image_upload_max_bytes:
        raise HTTPException(status_code=400, detail="Image must be 12 MB or smaller")
    try:
        optimized = optimize_avatar_to_webp(content)
    except MediaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        public_url = get_object_storage().upload(
            f"user-avatars/{current_user.id}/avatar.webp",
            optimized,
            "image/webp",
        )
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # The stable storage key is overwritten, so version the public URL to avoid
    # clients retaining the previous image under its long-lived cache policy.
    current_user.avatar_url = f"{public_url}?v={int(utc_now().timestamp())}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserRead)
def remove_current_user_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> User:
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/profile", response_model=UserProfileRead)
def read_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    ensure_identity_core_values(db, current_user)
    db.commit()
    return profile_response(None, current_user, db)


@router.put("/profile", response_model=UserProfileRead)
def update_profile(
    payload: UserProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict:
    values = payload.model_dump(exclude_unset=True)
    preferred_name = (values.pop("preferred_name", None) or "").strip()
    if preferred_name:
        current_user.display_name = preferred_name[:255]
        upsert_core_profile_value(
            db, user_id=current_user.id, core_field_key="identity.preferred_name", value=preferred_name
        )
        if not values.get("first_name") and not core_profile_values(db, current_user.id).get("identity.first_name"):
            parts = preferred_name.split()
            values["first_name"] = parts[0]
            if not values.get("last_name") and not core_profile_values(db, current_user.id).get("identity.last_name") and len(parts) > 1:
                values["last_name"] = " ".join(parts[1:])
    fields = values.pop("fields", []) or []
    provided_core_keys = {field.get("core_field_key", "").strip().casefold() for field in fields}
    for field in fields:
        field_key = field.get("core_field_key", "").strip()
        field_value = field.get("value")
        if not field_key:
            continue
        if field_value is None or not str(field_value).strip():
            delete_core_profile_value(db, user_id=current_user.id, core_field_key=field_key)
        else:
            upsert_core_profile_value(
                db,
                user_id=current_user.id,
                core_field_key=field_key,
                value=str(field_value),
                value_type=field.get("value_type", "text"),
                is_sensitive=True,
            )
    for legacy_name, field_value in values.items():
        if legacy_name == "extra_data":
            if isinstance(field_value, dict):
                upsert_core_profile_value(
                    db,
                    user_id=current_user.id,
                    core_field_key=PROFILE_PREFERENCES_KEY,
                    value=json.dumps(field_value),
                    value_type="json",
                    is_sensitive=False,
                )
            continue
        core_key = LEGACY_PROFILE_KEYS.get(legacy_name)
        if not core_key:
            continue
        if core_key in provided_core_keys:
            continue
        if field_value is None or not str(field_value).strip():
            delete_core_profile_value(db, user_id=current_user.id, core_field_key=core_key)
        else:
            upsert_core_profile_value(db, user_id=current_user.id, core_field_key=core_key, value=str(field_value))
    ensure_identity_core_values(db, current_user)
    db.commit()
    db.refresh(current_user)
    return profile_response(None, current_user, db)
