from shared_services.runtime import get_runtime_value


__validation_file_path = "API worker config"


def check_int(var: int, var_name: str, min_value: int = 0) -> bool | TypeError | ValueError:
    if not isinstance(var, int):
        raise TypeError(f'The variable "{var_name}" in "{__validation_file_path}" must be an Integer!')
    if var < min_value:
        raise ValueError(f'The variable "{var_name}" in "{__validation_file_path}" expects an Integer greater than or equal to `{min_value}`!')
    return True


def check_boolean(var: bool, var_name: str) -> bool | ValueError:
    if var in (True, False):
        return True
    raise ValueError(f'The variable "{var_name}" in "{__validation_file_path}" expects a Boolean input `True` or `False`.')


def check_string(var: str, var_name: str, options: list | None = None, min_length: int = 0) -> bool | TypeError | ValueError:
    options = options or []
    if not isinstance(var, str):
        raise TypeError(f'Invalid input for {var_name}. Expecting a String!')
    if min_length > 0 and len(var) < min_length:
        raise ValueError(f'Invalid input for {var_name}. Expecting a String of length at least {min_length}!')
    if options and var not in options:
        raise ValueError(f'Invalid input for {var_name}. Expecting a value from {options}, not {var}!')
    return True


def check_list(var: list, var_name: str, options: list | None = None, min_length: int = 0) -> bool | TypeError | ValueError:
    options = options or []
    if not isinstance(var, list):
        raise TypeError(f'Invalid input for {var_name}. Expecting a List!')
    if len(var) < min_length:
        raise ValueError(f'Invalid input for {var_name}. Expecting a List of length at least {min_length}!')
    for element in var:
        if not isinstance(element, str):
            raise TypeError(f'Invalid input for {var_name}. All elements in the list must be strings!')
        if options and element not in options:
            raise ValueError(f'Invalid input for {var_name}. Expecting all elements to be values from {options}. This "{element}" is NOT in options!')
    return True


def validate_personals() -> None:
    check_string(str(get_runtime_value("first_name", "")), "first_name", min_length=1)
    check_string(str(get_runtime_value("middle_name", "")), "middle_name")
    check_string(str(get_runtime_value("last_name", "")), "last_name", min_length=1)
    check_string(str(get_runtime_value("phone_number", "")), "phone_number", min_length=1)


def validate_questions() -> None:
    check_string(str(get_runtime_value("default_resume_path", "")), "default_resume_path")
    check_string(str(get_runtime_value("require_visa", "No")), "require_visa", ["Yes", "No"])
    check_boolean(bool(get_runtime_value("pause_before_submit", True)), "pause_before_submit")
    check_boolean(bool(get_runtime_value("pause_at_failed_question", True)), "pause_at_failed_question")
    check_boolean(bool(get_runtime_value("overwrite_previous_answers", False)), "overwrite_previous_answers")


def validate_custom_questions() -> None:
    custom_questions = get_runtime_value("custom_questions", [])
    if not isinstance(custom_questions, list):
        raise TypeError("Invalid input for custom_questions. Expecting a List!")
    allowed_field_types = ["text", "textarea", "select", "radio", "checkbox"]
    for i, rule in enumerate(custom_questions):
        if not isinstance(rule, dict):
            raise TypeError(f"custom_questions[{i}] must be a dict!")
        if "answer" not in rule:
            raise ValueError(f'custom_questions[{i}] must include an "answer" key.')
        if not rule.get("keywords") and not rule.get("label"):
            raise ValueError(f'custom_questions[{i}] must include "keywords" or "label".')
        field_types = rule.get("field_types", [])
        if field_types:
            check_list(field_types, f"custom_questions[{i}].field_types", allowed_field_types)


def validate_search() -> None:
    check_list(list(get_runtime_value("search_terms", [])), "search_terms", min_length=1)
    check_string(str(get_runtime_value("search_location", "")), "search_location")
    check_int(int(get_runtime_value("switch_number", 1) or 1), "switch_number", 1)
    check_boolean(bool(get_runtime_value("randomize_search_order", False)), "randomize_search_order")


def validate_settings() -> None:
    check_string(str(get_runtime_value("file_name", "worker/log/applications.csv")), "file_name", min_length=1)
    check_string(str(get_runtime_value("failed_file_name", "worker/log/failed.csv")), "failed_file_name", min_length=1)
    check_string(str(get_runtime_value("logs_folder_path", "worker/log")), "logs_folder_path", min_length=1)
    check_int(int(get_runtime_value("click_gap", 2) or 2), "click_gap", 0)
    check_boolean(bool(get_runtime_value("run_in_background", False)), "run_in_background")
    threshold = float(get_runtime_value("question_similarity_threshold", 0.85) or 0.85)
    if not 0 < threshold <= 1:
        raise ValueError('The variable "question_similarity_threshold" in "API worker config" must be between 0 and 1!')


def validate_config() -> bool:
    validate_personals()
    validate_questions()
    validate_custom_questions()
    validate_search()
    validate_settings()
    return True
