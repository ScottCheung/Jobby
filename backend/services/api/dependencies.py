from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.database import get_db
from services.shared.models import User
from services.shared.settings import get_settings


def get_or_create_current_user(db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    user = db.scalar(select(User).order_by(User.created_at.asc()).limit(1))
    if user:
        return user

    user = User(
        email=settings.default_admin_email,
        display_name=settings.default_admin_name,
        role="admin",
        status="active",
        can_use_auto_apply=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


CurrentUser = Depends(get_or_create_current_user)


def parse_uuid(value: str) -> UUID:
    return UUID(value)
