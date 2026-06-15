from types import ModuleType
from typing import Any

from modules.persistence.api_client import BotApiError, api_client
from modules.persistence.logging import persistence_log


def _set_if_present(module: ModuleType, key: str, value: Any) -> None:
    if value is not None and hasattr(module, key):
        setattr(module, key, value)


def _to_int(value: Any, default: int = 0) -> int:
    if value in ("", None):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float = 0.0) -> float:
    if value in ("", None):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _apply_profile(profile: dict, modules: list[ModuleType], globals_dict: dict) -> None:
    for key, value in profile.items():
        if key in {"id", "user_id", "created_at", "updated_at", "extra_data"}:
            continue
        globals_dict[key] = value
        for module in modules:
            _set_if_present(module, key, value)


def _apply_job_preferences(preferences: dict, modules: list[ModuleType], globals_dict: dict) -> None:
    mapping = {
        "linkedin_url": "linkedIn",
        "resume_path": "default_resume_path",
        "user_information_all": "user_information_all",
    }
    for key, value in preferences.items():
        if key in {"id", "user_id", "created_at", "updated_at", "extra_data"}:
            continue
        target = mapping.get(key, key)
        if target in {"desired_salary", "current_ctc"}:
            value = _to_float(value)
        elif target == "notice_period":
            value = _to_int(value)
        globals_dict[target] = value
        for module in modules:
            _set_if_present(module, target, value)

    extra_data = preferences.get("extra_data") or {}
    for key, value in extra_data.items():
        globals_dict[key] = value
        for module in modules:
            _set_if_present(module, key, value)


def _apply_search_profile(search_profile: dict, modules: list[ModuleType], globals_dict: dict) -> None:
    globals_dict["search_terms"] = search_profile.get("search_terms") or []
    globals_dict["search_location"] = search_profile.get("search_location") or ""

    for module in modules:
        _set_if_present(module, "search_terms", globals_dict["search_terms"])
        _set_if_present(module, "search_location", globals_dict["search_location"])

    merged = {}
    merged.update(search_profile.get("filters") or {})
    merged.update(search_profile.get("blacklist_rules") or {})
    merged.update(search_profile.get("whitelist_rules") or {})

    for key, value in merged.items():
        globals_dict[key] = value
        for module in modules:
            _set_if_present(module, key, value)


def _apply_runtime_settings(runtime_settings: dict, modules: list[ModuleType], globals_dict: dict) -> None:
    for key, value in runtime_settings.items():
        if key in {"id", "user_id", "platform_account_id", "created_at", "updated_at", "settings"}:
            continue
        if key == "question_similarity_threshold":
            try:
                value = float(value)
            except (TypeError, ValueError):
                pass
        globals_dict[key] = value
        for module in modules:
            _set_if_present(module, key, value)

    extra_settings = runtime_settings.get("settings") or {}
    for key, value in extra_settings.items():
        globals_dict[key] = value
        for module in modules:
            _set_if_present(module, key, value)


def apply_api_worker_config(globals_dict: dict) -> bool:
    if not api_client.is_enabled():
        raise SystemExit("API data layer is required for worker configuration")

    try:
        worker_config = api_client.get_worker_config()
    except BotApiError as error:
        api_client.log_unavailable("loading worker configuration", error)
        raise SystemExit("API data layer is required for worker configuration")

    import config.personals as personals
    import config.questions as questions
    import config.search as search
    import config.settings as settings

    modules = [personals, questions, search, settings]
    for module_name in (
        "modules.open_chrome",
        "modules.clickers_and_finders",
        "modules.linkedin.linkedin_apply",
        "modules.linkedin.linkedin_filters",
        "modules.linkedin.linkedin_flow",
        "modules.linkedin.linkedin_job_details",
        "modules.linkedin.linkedin_jobs",
        "modules.persistence.answer_resolver",
        "modules.persistence.question_cache",
    ):
        try:
            module = __import__(module_name, fromlist=["*"])
            modules.append(module)
        except Exception:
            continue

    if worker_config.get("profile"):
        _apply_profile(worker_config["profile"], modules, globals_dict)
    if worker_config.get("job_preferences"):
        _apply_job_preferences(worker_config["job_preferences"], modules, globals_dict)
    if worker_config.get("search_profile"):
        _apply_search_profile(worker_config["search_profile"], modules, globals_dict)
    if worker_config.get("runtime_settings"):
        _apply_runtime_settings(worker_config["runtime_settings"], modules, globals_dict)

    if globals_dict.get("run_in_background") is True:
        globals_dict["pause_at_failed_question"] = False
        globals_dict["pause_before_submit"] = False
        globals_dict["run_non_stop"] = False
        for module in modules:
            _set_if_present(module, "pause_at_failed_question", False)
            _set_if_present(module, "pause_before_submit", False)
            _set_if_present(module, "run_non_stop", False)

    first_name = str(globals_dict.get("first_name") or "").strip()
    middle_name = str(globals_dict.get("middle_name") or "").strip()
    last_name = str(globals_dict.get("last_name") or "").strip()
    globals_dict["first_name"] = first_name
    globals_dict["middle_name"] = middle_name
    globals_dict["last_name"] = last_name
    globals_dict["full_name"] = f"{first_name} {middle_name} {last_name}".replace("  ", " ").strip()

    persistence_log("Worker configuration loaded from API data layer.")
    return True
