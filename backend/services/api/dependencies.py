from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.database import get_db
from services.shared.models import User
from services.shared.settings import get_settings

def get_or_create_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    email = request.headers.get("X-User-Email")
    admin_emails = set(settings.admin_email_list)

    if email:
        normalized_email = email.strip().lower()
        user = db.scalar(select(User).where(User.email == normalized_email))
        if user:
            if normalized_email in admin_emails and user.role != "admin":
                user.role = "admin"
                db.commit()
                db.refresh(user)
            return user

        # Create a new user for this email
        new_user = User(
            email=normalized_email,
            display_name=normalized_email.split("@")[0],
            role="admin" if normalized_email in admin_emails else "user",
            status="active",
            can_use_auto_apply=True,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    # Fallback to default user if no email header
    user = db.scalar(select(User).where(User.email == settings.default_admin_email))
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
