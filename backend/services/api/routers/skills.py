from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.models import Skill, User, UserSkill
from services.shared.schemas import UserSkillCreate, UserSkillRead

router = APIRouter(prefix="/api", tags=["skills"])


def _skill_identity(db: Session, raw_name: str) -> tuple[str, str]:
    name = raw_name.strip()
    catalog_skill = db.scalar(
        select(Skill).where(Skill.name == name.casefold())
    )
    display_name = (
        str(catalog_skill.canonical_name).strip()
        if catalog_skill and str(catalog_skill.canonical_name).strip()
        else name
    )
    return display_name, display_name.casefold()


def _get_user_profile_skills(db: Session, current_user: User) -> list[str]:
    return list(
        db.scalars(
            select(UserSkill.skill_name)
            .where(
                UserSkill.user_id == current_user.id,
                UserSkill.source == "plugin",
            )
            .order_by(UserSkill.created_at.asc())
        ).all()
    )


@router.get("/skills/version")
def get_skills_version(db: Session = Depends(get_db)) -> dict:
    latest = db.scalar(select(Skill.updated_at).order_by(Skill.updated_at.desc()).limit(1))
    return {"version": latest.isoformat() if latest else None}


@router.get("/skills")
def get_skills(db: Session = Depends(get_db)) -> dict:
    latest = db.scalar(select(Skill.updated_at).order_by(Skill.updated_at.desc()).limit(1))
    version_str = latest.isoformat() if latest else None

    skills = db.scalars(select(Skill)).all()
    index_map = {s.name: s.canonical_name for s in skills}

    return {
        "version": version_str,
        "index": index_map,
    }


@router.get("/user-skills", response_model=list[UserSkillRead])
def list_user_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[UserSkill]:
    return list(
        db.scalars(
            select(UserSkill)
            .where(
                UserSkill.user_id == current_user.id,
                UserSkill.source == "plugin",
            )
            .order_by(UserSkill.created_at.asc())
        ).all()
    )


@router.post(
    "/user-skills",
    response_model=UserSkillRead,
    status_code=status.HTTP_201_CREATED,
)
def add_user_skill(
    payload: UserSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> UserSkill:
    raw_name = payload.skill_name.strip()
    if not raw_name:
        raise HTTPException(status_code=422, detail="skill_name cannot be blank")
    display_name, canonical_name = _skill_identity(db, raw_name)
    existing = db.scalar(
        select(UserSkill).where(
            UserSkill.user_id == current_user.id,
            func.lower(UserSkill.canonical_name) == canonical_name,
        )
    )
    if existing:
        existing.skill_name = display_name
        existing.canonical_name = canonical_name
        existing.category = payload.category or existing.category or "Plugin Skills"
        existing.source = "plugin"
        skill = existing
    else:
        skill = UserSkill(
            user_id=current_user.id,
            skill_name=display_name,
            canonical_name=canonical_name,
            category=payload.category or "Plugin Skills",
            source="plugin",
        )
        db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.delete("/user-skills")
def delete_user_skill(
    skill_name: str = Query(..., min_length=1, max_length=255),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    raw_name = skill_name.strip()
    if not raw_name:
        raise HTTPException(status_code=422, detail="skill_name cannot be blank")
    _, canonical_name = _skill_identity(db, raw_name)
    skill = db.scalar(
        select(UserSkill).where(
            UserSkill.user_id == current_user.id,
            UserSkill.source == "plugin",
            func.lower(UserSkill.canonical_name) == canonical_name,
        )
    )
    if not skill:
        raise HTTPException(status_code=404, detail="Profile skill not found")
    deleted = {
        "id": str(skill.id),
        "skill_name": skill.skill_name,
        "canonical_name": skill.canonical_name,
    }
    db.delete(skill)
    db.commit()
    return {"success": True, "skill": deleted}
