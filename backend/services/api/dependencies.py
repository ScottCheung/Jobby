import json
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.database import get_db
from services.shared.models import User
from services.shared.settings import get_settings


def _bearer_token(request: Request) -> str | None:
    value = request.headers.get("Authorization", "").strip()
    scheme, _, token = value.partition(" ")
    if scheme.casefold() != "bearer" or not token.strip():
        return None
    return token.strip()


def _supabase_email(access_token: str) -> str | None:
    settings = get_settings()
    if not settings.supabase_url:
        return None
    api_key = settings.supabase_service_role_key or settings.supabase_anon_key
    if not api_key:
        return None

    request = UrlRequest(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
            "apikey": api_key,
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None
    email = payload.get("email") if isinstance(payload, dict) else None
    return str(email).strip().lower() if email else None


def get_or_create_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    token = _bearer_token(request)
    email = _supabase_email(token) if token else None
    if not email:
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
