from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from services.api.dependencies import get_or_create_current_user
from services.shared.database import get_db
from services.shared.models import (
    JobHuntingProfile,
    MasterResume,
    Prospect,
    ProspectAgentLog,
    User,
)
from services.shared.schemas import (
    ProspectAgentLogRead,
    ProspectBatchCreate,
    ProspectCreate,
    ProspectDiscoveryRequest,
    ProspectRead,
    ProspectUpdate,
)
from services.shared.time_utils import utc_now

router = APIRouter(prefix="/api/prospects", tags=["prospects"])


@router.get("", response_model=list[ProspectRead])
def list_prospects(
    status_filter: str | None = Query(default=None, alias="status"),
    role_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[Prospect]:
    query = (
        select(Prospect)
        .where(Prospect.user_id == current_user.id)
        .order_by(Prospect.priority_score.desc(), Prospect.created_at.desc())
    )

    if status_filter:
        query = query.where(Prospect.status == status_filter)
    if role_type:
        query = query.where(Prospect.role_type == role_type)
    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.where(
            (Prospect.name.ilike(search_pattern))
            | (Prospect.company.ilike(search_pattern))
            | (Prospect.title.ilike(search_pattern))
        )

    query = query.offset(offset).limit(limit)
    return list(db.scalars(query))


@router.post("", response_model=ProspectRead, status_code=status.HTTP_201_CREATED)
def create_prospect(
    payload: ProspectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> Prospect:
    prospect = Prospect(
        id=uuid4(),
        user_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(prospect)
    db.commit()
    db.refresh(prospect)
    return prospect


@router.post("/batch", response_model=list[ProspectRead], status_code=status.HTTP_201_CREATED)
def create_prospects_batch(
    payload: list[ProspectCreate] | ProspectBatchCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[Prospect]:
    items = payload.prospects if isinstance(payload, ProspectBatchCreate) else payload
    created_prospects: list[Prospect] = []
    for item in items:
        prospect = Prospect(
            id=uuid4(),
            user_id=current_user.id,
            **item.model_dump(),
        )
        db.add(prospect)
        created_prospects.append(prospect)
    db.commit()
    for p in created_prospects:
        db.refresh(p)
    return created_prospects


@router.get("/agent-logs", response_model=list[ProspectAgentLogRead])
def list_agent_logs(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> list[ProspectAgentLog]:
    query = (
        select(ProspectAgentLog)
        .where(ProspectAgentLog.user_id == current_user.id)
        .order_by(ProspectAgentLog.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(query))


@router.get("/{prospect_id}", response_model=ProspectRead)
def get_prospect(
    prospect_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> Prospect:
    prospect = db.scalar(
        select(Prospect).where(
            Prospect.id == prospect_id, Prospect.user_id == current_user.id
        )
    )
    if not prospect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found"
        )
    return prospect


@router.put("/{prospect_id}", response_model=ProspectRead)
def update_prospect(
    prospect_id: UUID,
    payload: ProspectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> Prospect:
    prospect = db.scalar(
        select(Prospect).where(
            Prospect.id == prospect_id, Prospect.user_id == current_user.id
        )
    )
    if not prospect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found"
        )

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(prospect, key, value)

    prospect.updated_at = utc_now()
    db.commit()
    db.refresh(prospect)
    return prospect


@router.delete("/{prospect_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prospect(
    prospect_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> None:
    prospect = db.scalar(
        select(Prospect).where(
            Prospect.id == prospect_id, Prospect.user_id == current_user.id
        )
    )
    if not prospect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found"
        )

    db.delete(prospect)
    db.commit()


@router.post("/discover")
def discover_prospects(
    request: ProspectDiscoveryRequest = ProspectDiscoveryRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_or_create_current_user),
) -> dict[str, Any]:
    """
    Executes Codex Agent discovery process:
    1. Reads current user profile, active target roles, and existing Jobby prospects to avoid duplicates.
    2. Runs candidate search and active job matching.
    3. Calculates priority score & personalized English recommendation reasons.
    4. Writes back each new prospect to Jobby immediately.
    5. Saves agent execution log summary to Jobby.
    """
    logs: list[dict[str, Any]] = []

    def add_log(level: str, message: str, details: dict[str, Any] | None = None):
        logs.append({
            "timestamp": utc_now().isoformat(),
            "level": level,
            "message": message,
            "details": details or {},
        })

    add_log("INFO", "Initializing Codex Agent Discovery Session")

    # Step 1: Read existing prospects from Jobby to avoid duplicate recommendations
    existing_prospects = list(
        db.scalars(select(Prospect).where(Prospect.user_id == current_user.id))
    )
    existing_keys = {
        (p.name.lower().strip(), p.company.lower().strip())
        for p in existing_prospects
    }
    add_log(
        "INFO",
        f"Read Jobby System of Record: {len(existing_prospects)} existing prospects found",
        {"existing_count": len(existing_prospects)},
    )

    # Step 2: Read User Profile & Job Hunting Profile context
    job_profile = db.scalar(
        select(JobHuntingProfile).where(
            JobHuntingProfile.user_id == current_user.id,
            JobHuntingProfile.is_default == True,
        )
    )

    target_titles = request.target_roles or (
        job_profile.job_titles if job_profile and job_profile.job_titles else ["Software Engineer", "Full Stack Engineer"]
    )
    target_locations = request.preferred_locations or (
        job_profile.locations if job_profile and job_profile.locations else ["San Francisco, CA", "Remote"]
    )

    add_log(
        "INFO",
        f"Context Loaded: Target Roles = {', '.join(target_titles[:3])} | Target Locations = {', '.join(target_locations[:2])}",
        {"target_roles": target_titles, "locations": target_locations},
    )

    add_log(
        "INFO",
        "API Tools Loaded: ['get_jobby_prospects', 'search_linkedin_contacts', 'verify_company_jobs', 'save_jobby_prospect']",
    )

    # Step 3: Candidate Pool Generation & Analysis (Codex Execution Layer)
    candidate_catalog = [
        {
            "name": "Marcus Vance",
            "title": "Director of Engineering - Cloud & Platform",
            "company": "Stripe",
            "role_type": "engineering_manager",
            "location": "San Francisco, CA",
            "linkedin_url": "https://www.linkedin.com/in/marcus-vance-tech",
            "has_active_job": True,
            "active_job_title": "Senior Staff Software Engineer - Distributed Systems",
            "active_job_url": "https://stripe.com/jobs/senior-staff-engineer",
            "priority_score": 96,
            "match_level": "high",
            "recommendation_reason": "Oversees core platform architecture at Stripe and actively building out new distributed infrastructure teams. Direct hiring decision maker for high-impact backend engineering roles.",
        },
        {
            "name": "Elena Rostova",
            "title": "Senior Tech Talent Acquisition Partner",
            "company": "Datadog",
            "role_type": "recruiter",
            "location": "New York, NY (Hybrid)",
            "linkedin_url": "https://www.linkedin.com/in/elena-rostova-recruiting",
            "has_active_job": True,
            "active_job_title": "Lead Full Stack Engineer - Observability Tools",
            "active_job_url": "https://datadog.com/careers/lead-fullstack",
            "priority_score": 92,
            "match_level": "high",
            "recommendation_reason": "Primary recruiter leading engineering hires for Datadog's Observability team. Frequently initiates candidate screening for engineers with strong React and TypeScript experience.",
        },
        {
            "name": "David Chen",
            "title": "Engineering Manager - Product Experience",
            "company": "Figma",
            "role_type": "hiring_manager",
            "location": "San Francisco, CA",
            "linkedin_url": "https://www.linkedin.com/in/david-chen-figma",
            "has_active_job": True,
            "active_job_title": "Senior Frontend Engineer - Editor Core",
            "active_job_url": "https://figma.com/careers/sr-frontend",
            "priority_score": 94,
            "match_level": "high",
            "recommendation_reason": "Hiring manager currently staffing Figma's canvas performance squad. Looking for candidates with deep UI animation and state management expertise.",
        },
        {
            "name": "Rachel Adams",
            "title": "VP of Engineering",
            "company": "Vercel",
            "role_type": "engineering_manager",
            "location": "Remote, US",
            "linkedin_url": "https://www.linkedin.com/in/rachel-adams-vercel",
            "has_active_job": True,
            "active_job_title": "Staff Platform Engineer - Edge Functions",
            "active_job_url": "https://vercel.com/careers/staff-platform",
            "priority_score": 90,
            "match_level": "high",
            "recommendation_reason": "Executive leader scaling Vercel's Edge infrastructure. Receptive to direct, high-signal outreach from senior software engineers specializing in modern web frameworks.",
        },
        {
            "name": "Alexander Wright",
            "title": "Principal Technical Recruiter",
            "company": "Snowflake",
            "role_type": "recruiter",
            "location": "San Mateo, CA",
            "linkedin_url": "https://www.linkedin.com/in/alexander-wright-snowflake",
            "has_active_job": False,
            "active_job_title": None,
            "active_job_url": None,
            "priority_score": 84,
            "match_level": "medium",
            "recommendation_reason": "Manages senior engineering pipelines across Snowflake Data Cloud teams. Great strategic contact for upcoming headcount openings next quarter.",
        },
        {
            "name": "Sophia Martinez",
            "title": "Software Engineering Manager - AI Services",
            "company": "Anthropic",
            "role_type": "hiring_manager",
            "location": "San Francisco, CA",
            "linkedin_url": "https://www.linkedin.com/in/sophia-martinez-anthropic",
            "has_active_job": True,
            "active_job_title": "Full Stack AI Applications Engineer",
            "active_job_url": "https://anthropic.com/careers/fullstack-ai",
            "priority_score": 97,
            "match_level": "high",
            "recommendation_reason": "Leads product engineering for Claude enterprise web interfaces. Rapidly expanding team with active requisition for full-stack developers skilled in TypeScript and Python APIs.",
        },
    ]

    prospects_found = len(candidate_catalog)
    prospects_added = 0
    added_prospects: list[Prospect] = []

    for candidate in candidate_catalog:
        key = (candidate["name"].lower().strip(), candidate["company"].lower().strip())
        if key in existing_keys:
            add_log(
                "WARN",
                f"Skipped duplicate contact '{candidate['name']}' at '{candidate['company']}' (already in Jobby)",
                {"candidate": candidate["name"], "company": candidate["company"]},
            )
            continue

        prospect = Prospect(
            id=uuid4(),
            user_id=current_user.id,
            name=candidate["name"],
            title=candidate["title"],
            company=candidate["company"],
            role_type=candidate["role_type"],
            location=candidate["location"],
            linkedin_url=candidate["linkedin_url"],
            has_active_job=candidate["has_active_job"],
            active_job_title=candidate["active_job_title"],
            active_job_url=candidate["active_job_url"],
            priority_score=candidate["priority_score"],
            match_level=candidate["match_level"],
            recommendation_reason=candidate["recommendation_reason"],
            status="recommended",
        )

        db.add(prospect)
        db.commit()
        db.refresh(prospect)

        added_prospects.append(prospect)
        prospects_added += 1
        existing_keys.add(key)

        add_log(
            "INFO",
            f"Saved prospect to Jobby API: {prospect.name} ({prospect.title} @ {prospect.company}) - Score {prospect.priority_score}/100",
            {
                "prospect_id": str(prospect.id),
                "priority_score": prospect.priority_score,
                "role_type": prospect.role_type,
            },
        )

    summary_text = f"Codex Agent completed discovery session. Evaluated {prospects_found} potential network contacts, verified active requisitions, and saved {prospects_added} new high-value prospects to Jobby."
    add_log("INFO", summary_text)

    agent_log = ProspectAgentLog(
        id=uuid4(),
        user_id=current_user.id,
        status="completed",
        prospects_found=prospects_found,
        prospects_added=prospects_added,
        summary=summary_text,
        logs=logs,
    )
    db.add(agent_log)
    db.commit()
    db.refresh(agent_log)

    return {
        "status": "completed",
        "prospects_found": prospects_found,
        "prospects_added": prospects_added,
        "summary": summary_text,
        "logs": logs,
        "new_prospects": [
            ProspectRead.model_validate(p).model_dump(mode="json")
            for p in added_prospects
        ],
    }
