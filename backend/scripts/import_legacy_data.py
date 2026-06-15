import csv
import importlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.database import SessionLocal
from services.shared.models import (
    JobApplication,
    JobPreference,
    PlatformAccount,
    QuestionCacheEntry,
    RuntimeSettings,
    SearchProfile,
    User,
    UserProfile,
)
from services.shared.settings import get_settings


ROOT = Path(__file__).resolve().parents[1]


def normalize_label(label: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", label.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def load_module(module_name: str) -> Any | None:
    try:
        return importlib.import_module(module_name)
    except Exception as exc:
        print(f"Skip {module_name}: {exc}")
        return None


def get_attr(module: Any | None, name: str, default: Any = None) -> Any:
    if module is None:
        return default
    return getattr(module, name, default)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Skip {path}: {exc}")
        return default


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "not available"}:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def as_number(value: Any) -> Any:
    if value in ("", None):
        return None
    return value


def normalize_application_status(value: Any, failed_reason: Any = None) -> str:
    if failed_reason:
        return "skipped"
    status = str(value or "").strip().lower()
    if status in {"applied", "apply", "success", "succeeded", "submitted"}:
        return "submitted"
    if status in {"cancelled", "canceled", "stopped"}:
        return "cancelled"
    if status in {"failed", "fail", "error", "skipped", "skiped", "skip"}:
        return "skipped"
    return status or "submitted"


def get_or_create_user(db: Session) -> User:
    settings = get_settings()
    user = db.scalar(select(User).where(User.email == settings.default_admin_email))
    if user:
        return user
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
    db.flush()
    return user


def get_or_create_platform_account(db: Session, user: User) -> PlatformAccount:
    account = db.scalar(
        select(PlatformAccount)
        .where(PlatformAccount.user_id == user.id, PlatformAccount.platform == "linkedin")
        .order_by(PlatformAccount.created_at.asc())
        .limit(1)
    )
    if account:
        return account

    account = PlatformAccount(
        user_id=user.id,
        platform="linkedin",
        account_name="LinkedIn",
        status="active",
        extra_data={},
    )
    db.add(account)
    db.flush()
    return account


def import_profile(db: Session, user: User) -> None:
    personals = load_module("config.personals")
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if not profile:
        profile = UserProfile(user_id=user.id, extra_data={})
        db.add(profile)

    for field in (
        "first_name",
        "middle_name",
        "last_name",
        "phone_number",
        "current_city",
        "street",
        "state",
        "zipcode",
        "country",
        "ethnicity",
        "gender",
        "gender_identity",
        "disability_status",
        "veteran_status",
    ):
        setattr(profile, field, get_attr(personals, field))


def import_job_preferences(db: Session, user: User) -> None:
    questions = load_module("config.questions")
    preferences = db.scalar(select(JobPreference).where(JobPreference.user_id == user.id))
    if not preferences:
        preferences = JobPreference(user_id=user.id, extra_data={})
        db.add(preferences)

    mapping = {
        "years_of_experience": "years_of_experience",
        "require_visa": "require_visa",
        "website": "website",
        "linkedIn": "linkedin_url",
        "us_citizenship": "us_citizenship",
        "desired_salary": "desired_salary",
        "current_ctc": "current_ctc",
        "notice_period": "notice_period",
        "linkedin_headline": "linkedin_headline",
        "linkedin_summary": "linkedin_summary",
        "cover_letter": "cover_letter",
        "recent_employer": "recent_employer",
        "confidence_level": "confidence_level",
    }
    for source, target in mapping.items():
        setattr(preferences, target, as_number(get_attr(questions, source)))

    preferences.extra_data = {
        "default_resume_path": get_attr(questions, "default_resume_path"),
        "user_information_all": get_attr(questions, "user_information_all"),
    }


def import_search_profile(db: Session, user: User, account: PlatformAccount) -> None:
    search = load_module("config.search")
    profile = db.scalar(
        select(SearchProfile)
        .where(SearchProfile.user_id == user.id, SearchProfile.platform == "linkedin", SearchProfile.is_default.is_(True))
        .limit(1)
    )
    if not profile:
        profile = SearchProfile(user_id=user.id, platform_account_id=account.id, platform="linkedin", is_default=True)
        db.add(profile)

    profile.name = "Default LinkedIn Search"
    profile.platform_account_id = account.id
    profile.search_terms = get_attr(search, "search_terms", [])
    profile.search_location = get_attr(search, "search_location")
    profile.filters = {
        "switch_number": get_attr(search, "switch_number"),
        "randomize_search_order": get_attr(search, "randomize_search_order"),
        "sort_by": get_attr(search, "sort_by"),
        "date_posted": get_attr(search, "date_posted"),
        "salary": get_attr(search, "salary"),
        "easy_apply_only": get_attr(search, "easy_apply_only"),
        "experience_level": get_attr(search, "experience_level", []),
        "job_type": get_attr(search, "job_type", []),
        "on_site": get_attr(search, "on_site", []),
        "companies": get_attr(search, "companies", []),
        "location": get_attr(search, "location", []),
        "industry": get_attr(search, "industry", []),
        "job_function": get_attr(search, "job_function", []),
        "job_titles": get_attr(search, "job_titles", []),
        "benefits": get_attr(search, "benefits", []),
        "commitments": get_attr(search, "commitments", []),
        "under_10_applicants": get_attr(search, "under_10_applicants"),
        "in_your_network": get_attr(search, "in_your_network"),
        "fair_chance_employer": get_attr(search, "fair_chance_employer"),
        "pause_after_filters": get_attr(search, "pause_after_filters"),
    }
    profile.blacklist_rules = {
        "about_company_bad_words": get_attr(search, "about_company_bad_words", []),
        "bad_words": get_attr(search, "bad_words", []),
        "security_clearance": get_attr(search, "security_clearance"),
        "did_masters": get_attr(search, "did_masters"),
        "current_experience": get_attr(search, "current_experience"),
    }
    profile.whitelist_rules = {
        "about_company_good_words": get_attr(search, "about_company_good_words", []),
    }


def import_runtime_settings(db: Session, user: User, account: PlatformAccount) -> None:
    settings_module = load_module("config.settings")
    questions = load_module("config.questions")
    runtime = db.scalar(select(RuntimeSettings).where(RuntimeSettings.user_id == user.id).limit(1))
    if not runtime:
        runtime = RuntimeSettings(user_id=user.id, platform_account_id=account.id, settings={})
        db.add(runtime)

    runtime.platform_account_id = account.id
    runtime.run_in_background = bool(get_attr(settings_module, "run_in_background", False))
    runtime.safe_mode = bool(get_attr(settings_module, "safe_mode", True))
    runtime.stealth_mode = bool(get_attr(settings_module, "stealth_mode", True))
    runtime.click_gap = int(get_attr(settings_module, "click_gap", 2))
    runtime.pause_before_submit = bool(get_attr(questions, "pause_before_submit", True))
    runtime.pause_at_failed_question = bool(get_attr(questions, "pause_at_failed_question", True))
    runtime.overwrite_previous_answers = bool(get_attr(questions, "overwrite_previous_answers", False))
    runtime.learn_from_manual_answers = bool(get_attr(settings_module, "learn_from_manual_answers", True))
    runtime.question_similarity_threshold = get_attr(settings_module, "question_similarity_threshold", 0.85)
    runtime.settings = {
        "close_tabs": get_attr(settings_module, "close_tabs"),
        "follow_companies": get_attr(settings_module, "follow_companies"),
        "run_non_stop": get_attr(settings_module, "run_non_stop"),
        "alternate_sortby": get_attr(settings_module, "alternate_sortby"),
        "cycle_date_posted": get_attr(settings_module, "cycle_date_posted"),
        "stop_date_cycle_at_24hr": get_attr(settings_module, "stop_date_cycle_at_24hr"),
        "disable_extensions": get_attr(settings_module, "disable_extensions"),
        "smooth_scroll": get_attr(settings_module, "smooth_scroll"),
        "keep_screen_awake": get_attr(settings_module, "keep_screen_awake"),
        "show_ai_error_alerts": get_attr(settings_module, "showAiErrorAlerts"),
    }


def import_question_cache(db: Session, user: User, account: PlatformAccount) -> int:
    data = read_json(ROOT / "data/question_cache.json", {"questions": []})
    count = 0
    for item in data.get("questions", []):
        normalized = item.get("normalized_label") or normalize_label(item.get("label", ""))
        field_type = item.get("field_type") or "text"
        if not normalized:
            continue

        entry = db.scalar(
            select(QuestionCacheEntry).where(
                QuestionCacheEntry.user_id == user.id,
                QuestionCacheEntry.platform == "linkedin",
                QuestionCacheEntry.normalized_label == normalized,
                QuestionCacheEntry.field_type == field_type,
            )
        )
        if not entry:
            entry = QuestionCacheEntry(user_id=user.id, platform_account_id=account.id, platform="linkedin")
            db.add(entry)

        entry.original_label = item.get("label") or normalized
        entry.normalized_label = normalized
        entry.field_type = field_type
        entry.options = item.get("options")
        entry.answer = item.get("answer")
        entry.source = item.get("source")
        entry.times_used = int(item.get("times_used") or 0)
        entry.last_used_at = parse_datetime(item.get("last_used"))
        entry.companies = item.get("companies") or []
        count += 1
    return count


def upsert_application(db: Session, user: User, account: PlatformAccount, record: dict[str, Any]) -> None:
    job_id = record.get("job_id") or record.get("Job ID")
    application = None
    if job_id:
        application = db.scalar(
            select(JobApplication)
            .where(JobApplication.user_id == user.id, JobApplication.platform == "linkedin", JobApplication.job_id == str(job_id))
            .limit(1)
        )
    if not application:
        application = JobApplication(user_id=user.id, platform_account_id=account.id, platform="linkedin")
        db.add(application)

    application.platform_account_id = account.id
    application.job_id = str(job_id) if job_id else None
    application.title = record.get("title") or record.get("Title")
    application.company = record.get("company") or record.get("Company")
    application.work_location = record.get("work_location") or record.get("Work Location")
    application.work_style = record.get("work_style") or record.get("Work Style")
    application.job_description = record.get("job_description") or record.get("description") or record.get("About Job")
    application.job_link = record.get("job_link") or record.get("Job Link")
    application.external_job_link = record.get("external_application_link") or record.get("External Job link")
    application.status = normalize_application_status(record.get("status"), record.get("Assumed Reason"))
    application.pipeline_stage = record.get("pipeline_stage") or ("skipped" if application.status == "skipped" else "applied")
    application.interview_stage = record.get("interview_stage")
    application.next_action = record.get("next_action")
    application.next_action_at = parse_datetime(record.get("next_action_at"))
    application.notes = record.get("notes")
    application.contact_name = record.get("contact_name")
    application.contact_email = record.get("contact_email")
    application.last_contacted_at = parse_datetime(record.get("last_contacted_at"))
    application.application_type = record.get("application_type")
    application.resume_path = record.get("resume") or record.get("Resume") or record.get("Resume Tried")
    application.date_posted = record.get("date_posted") or record.get("Date Posted") or record.get("Date listed")
    application.date_applied = parse_datetime(record.get("date_applied") or record.get("Date Applied") or record.get("Date Tried"))
    application.questions = record.get("questions") or record.get("Questions Found") or []
    application.skip_reason = record.get("skip_reason") or record.get("error") or record.get("Assumed Reason")
    application.screenshot_path = record.get("screenshot") or record.get("Screenshot Name")
    application.raw_data = record


def import_applications_json(db: Session, user: User, account: PlatformAccount) -> int:
    data = read_json(ROOT / "data/applications_history.json", [])
    if isinstance(data, dict):
        data = data.get("applications", [])
    count = 0
    for record in data:
        if isinstance(record, dict):
            upsert_application(db, user, account, record)
            count += 1
    return count


def import_applications_csv(db: Session, user: User, account: PlatformAccount, path: Path) -> int:
    if not path.exists():
        return 0
    count = 0
    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            upsert_application(db, user, account, dict(row))
            count += 1
    return count


def main() -> None:
    with SessionLocal() as db:
        user = get_or_create_user(db)
        account = get_or_create_platform_account(db, user)

        import_profile(db, user)
        import_job_preferences(db, user)
        import_search_profile(db, user, account)
        import_runtime_settings(db, user, account)
        question_count = import_question_cache(db, user, account)
        json_application_count = import_applications_json(db, user, account)
        applied_csv_count = import_applications_csv(db, user, account, ROOT / "all excels/all_applied_applications_history.csv")
        failed_csv_count = import_applications_csv(db, user, account, ROOT / "all excels/all_failed_applications_history.csv")

        db.commit()

    print("Legacy data import completed.")
    print(f"Question cache rows processed: {question_count}")
    print(f"JSON application rows processed: {json_application_count}")
    print(f"Applied CSV rows processed: {applied_csv_count}")
    print(f"Failed CSV rows processed: {failed_csv_count}")


if __name__ == "__main__":
    main()
