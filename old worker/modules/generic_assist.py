from collections import defaultdict
import os

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from modules.helpers import buffer, print_lg
from modules.persistence.answer_resolver import (
    resolve_ai_answer,
    resolve_custom_answer,
    resolve_keyword_answer,
)
from modules.persistence.question_cache import match_option_in_list


FINAL_STEP_MARKERS = [
    "final review",
    "review your application",
    "submit application",
    "submit your application",
    "final submit",
]

SAFE_NEXT_LABELS = [
    "next",
    "continue",
    "review",
    "review and submit",
    "save and continue",
    "continue application",
]

UNSAFE_SUBMIT_LABELS = [
    "submit",
    "submit application",
    "send application",
    "complete application",
]

UNSAFE_NAVIGATION_LABELS = [
    "delete",
    "remove",
    "discard",
    "cancel application",
]


def _normalized_text(value) -> str:
    return str(value or "").strip()


def _normalized_lower(value) -> str:
    return _normalized_text(value).lower()


def _dedupe_space(value: str) -> str:
    return " ".join(value.split())


def _field_label(element) -> str:
    candidates = [
        element.get_attribute("aria-label"),
        element.get_attribute("placeholder"),
        element.get_attribute("name"),
    ]
    for candidate in candidates:
        text = _normalized_text(candidate)
        if text:
            return _dedupe_space(text)

    element_id = _normalized_text(element.get_attribute("id"))
    if element_id:
        try:
            label = element.find_element(
                By.XPATH,
                f"ancestor-or-self::*[1]//label[@for='{element_id}']",
            )
            text = _normalized_text(label.text)
            if text:
                return _dedupe_space(text)
        except Exception:
            pass

        try:
            label = element.find_element(
                By.XPATH,
                "preceding::label[1]",
            )
            text = _normalized_text(label.text)
            if text:
                return _dedupe_space(text)
        except Exception:
            pass

    try:
        parent_label = element.find_element(By.XPATH, "ancestor::label[1]")
        text = _normalized_text(parent_label.text)
        if text:
            return _dedupe_space(text)
    except Exception:
        pass

    try:
        wrapper_text = element.find_element(
            By.XPATH,
            "ancestor::*[self::div or self::fieldset][1]",
        ).text
        text = _normalized_text(wrapper_text).split("\n")[0]
        if text:
            return _dedupe_space(text)
    except Exception:
        pass

    return ""


def _input_kind(element) -> str:
    tag = _normalized_lower(element.tag_name)
    if tag == "textarea":
        return "textarea"
    if tag == "select":
        return "select"
    if tag == "input":
        input_type = _normalized_lower(element.get_attribute("type")) or "text"
        if input_type in {
            "radio",
            "checkbox",
            "date",
            "email",
            "number",
            "tel",
            "url",
            "file",
            "hidden",
            "submit",
            "button",
        }:
            return input_type
        return "text"
    return tag or "text"


def _safe_clear(element) -> None:
    try:
        element.clear()
    except Exception:
        try:
            element.send_keys(Keys.CONTROL, "a")
            element.send_keys(Keys.BACKSPACE)
        except Exception:
            pass


def _radio_option_label(element) -> str:
    option_candidates = [
        element.get_attribute("value"),
        element.get_attribute("aria-label"),
    ]
    for candidate in option_candidates:
        text = _normalized_text(candidate)
        if text:
            return text

    option_id = _normalized_text(element.get_attribute("id"))
    if option_id:
        try:
            label = element.find_element(
                By.XPATH,
                f"ancestor-or-self::*[1]//label[@for='{option_id}']",
            )
            text = _normalized_text(label.text)
            if text:
                return text
        except Exception:
            pass

    try:
        label = element.find_element(By.XPATH, "ancestor::label[1]")
        text = _normalized_text(label.text)
        if text:
            return text
    except Exception:
        pass

    return ""


def _checkbox_should_select(answer: str) -> bool:
    return _normalized_lower(answer) in {"yes", "true", "1", "agree", "accept"}


def _resolve_textual_answer(
    label: str,
    field_type: str,
    current_context: str,
    question_cache=None,
) -> tuple[str | None, str | None]:
    custom = resolve_custom_answer(label, field_type)
    if custom:
        return custom, "custom"

    if question_cache:
        cached = question_cache.find_answer(label, field_type)
        if cached:
            answer, source = cached
            return answer, source

    keyword = resolve_keyword_answer(label, field_type, current_context)
    if keyword:
        return keyword, "keyword"

    if field_type in {"text", "textarea"}:
        ai_answer = resolve_ai_answer(label, field_type, None)
        if ai_answer:
            return ai_answer, "ai"

    return None, None


def _set_textual_value(element, answer: str) -> bool:
    existing = _normalized_text(element.get_attribute("value"))
    if existing and existing == _normalized_text(answer):
        return False
    _safe_clear(element)
    element.send_keys(answer)
    return True


def _set_file_value(element, answer: str) -> bool:
    path_value = _normalized_text(answer)
    if not path_value:
        return False

    resolved_path = os.path.expanduser(path_value)
    if not os.path.isabs(resolved_path):
        resolved_path = os.path.abspath(resolved_path)

    if not os.path.exists(resolved_path):
        return False

    element.send_keys(resolved_path)
    return True


def _set_select_value(element, answer: str) -> bool:
    from selenium.webdriver.support.ui import Select

    select = Select(element)
    options = [
        _normalized_text(option.text)
        for option in select.options
        if _normalized_text(option.text)
    ]
    matched = match_option_in_list(answer, options)
    if not matched:
        return False
    current = _normalized_text(select.first_selected_option.text)
    if current == matched:
        return False
    select.select_by_visible_text(matched)
    return True


def _fill_simple_fields(driver, question_cache=None, print_func=print_lg) -> list[dict]:
    current_context = driver.current_url or ""
    filled = []
    unresolved = []
    elements = driver.find_elements(By.CSS_SELECTOR, "input, textarea, select")

    for element in elements:
        try:
            if not element.is_displayed() or not element.is_enabled():
                continue

            field_type = _input_kind(element)
            if field_type in {"hidden", "submit", "button", "radio", "checkbox"}:
                continue

            label = _field_label(element)
            if not label:
                continue

            answer, source = _resolve_textual_answer(
                label,
                "textarea" if field_type == "textarea" else "text"
                if field_type in {"email", "number", "tel", "url", "date", "text", "file"}
                else field_type,
                current_context,
                question_cache,
            )
            if not answer:
                unresolved.append(f"{label} ({field_type})")
                continue

            changed = False
            if field_type == "select":
                changed = _set_select_value(element, answer)
            elif field_type == "file":
                changed = _set_file_value(element, answer)
            else:
                changed = _set_textual_value(element, answer)

            if not changed:
                continue

            filled.append(
                {
                    "label": label,
                    "field_type": field_type,
                    "answer": answer,
                    "source": source,
                }
            )
            print_func(f'Filled "{label}" with "{answer}"')
            buffer(1)
        except Exception:
            continue

    for item in unresolved[:8]:
        print_func(f'Unresolved field: {item}')

    return filled


def _fill_choice_groups(driver, question_cache=None, print_func=print_lg) -> list[dict]:
    current_context = driver.current_url or ""
    filled = []
    unresolved = []

    grouped = defaultdict(list)
    elements = driver.find_elements(
        By.CSS_SELECTOR,
        "input[type='radio'], input[type='checkbox']",
    )

    for element in elements:
        try:
            if not element.is_displayed() or not element.is_enabled():
                continue
            field_type = _input_kind(element)
            group_label = _field_label(element)
            if not group_label:
                continue
            group_key = f"{field_type}:{group_label}"
            grouped[group_key].append(element)
        except Exception:
            continue

    for group_key, group_elements in grouped.items():
        field_type, label = group_key.split(":", 1)
        answer, source = _resolve_textual_answer(
            label,
            field_type,
            current_context,
            question_cache,
        )
        if not answer:
            unresolved.append(f"{label} ({field_type})")
            continue

        if field_type == "radio":
            options = []
            option_map = {}
            for element in group_elements:
                option_label = _radio_option_label(element)
                if option_label:
                    options.append(option_label)
                    option_map[option_label] = element
            matched = match_option_in_list(answer, options)
            if matched and matched in option_map:
                target = option_map[matched]
                if not target.is_selected():
                    target.click()
                    filled.append(
                        {
                            "label": label,
                            "field_type": field_type,
                            "answer": matched,
                            "source": source,
                        }
                    )
                    print_func(f'Chose "{matched}" for "{label}"')
                    buffer(1)

        elif field_type == "checkbox" and _checkbox_should_select(answer):
            changed = False
            for element in group_elements:
                if not element.is_selected():
                    element.click()
                    changed = True
                    buffer(1)
            if changed:
                filled.append(
                    {
                        "label": label,
                        "field_type": field_type,
                        "answer": answer,
                        "source": source,
                    }
                )
                print_func(f'Checked "{label}"')

    for item in unresolved[:8]:
        print_func(f'Unresolved choice group: {item}')

    return filled


def fill_generic_form(driver, question_cache=None, print_func=print_lg) -> list[dict]:
    filled = []
    filled.extend(_fill_simple_fields(driver, question_cache, print_func))
    filled.extend(_fill_choice_groups(driver, question_cache, print_func))
    return filled


def collect_current_form_answers(driver) -> list[dict]:
    answers = []
    elements = driver.find_elements(By.CSS_SELECTOR, "input, textarea, select")

    for element in elements:
        try:
            if not element.is_displayed():
                continue

            field_type = _input_kind(element)
            if field_type in {"hidden", "submit", "button"}:
                continue

            label = _field_label(element)
            if not label:
                continue

            if field_type == "select":
                from selenium.webdriver.support.ui import Select

                select = Select(element)
                value = _normalized_text(select.first_selected_option.text)
            elif field_type == "checkbox":
                value = str(bool(element.is_selected()))
            elif field_type == "radio":
                if not element.is_selected():
                    continue
                value = _radio_option_label(element)
            else:
                value = _normalized_text(element.get_attribute("value"))

            if not value:
                continue

            answers.append(
                {
                    "label": label,
                    "field_type": field_type,
                    "answer": value,
                }
            )
        except Exception:
            continue

    return answers


def _button_text(button) -> str:
    return _normalized_lower(
        button.text
        or button.get_attribute("aria-label")
        or button.get_attribute("title")
        or button.get_attribute("value")
    )


def _is_review_stage_label(label: str) -> bool:
    normalized = _normalized_lower(label)
    return normalized in {
        "review and submit",
        "review application",
        "review your application",
    }


def click_primary_next(driver, print_func=print_lg) -> bool:
    buttons = driver.find_elements(
        By.CSS_SELECTOR,
        "button, input[type='button'], input[type='submit']",
    )

    for button in buttons:
        try:
            if not button.is_displayed() or not button.is_enabled():
                continue
            label = _button_text(button)
            if not label:
                continue
            if any(unsafe in label for unsafe in UNSAFE_NAVIGATION_LABELS):
                continue
            if any(unsafe in label for unsafe in UNSAFE_SUBMIT_LABELS) and not _is_review_stage_label(label):
                continue
            if any(safe in label for safe in SAFE_NEXT_LABELS):
                button.click()
                print_func(f'Clicked "{label}"')
                buffer(1)
                return True
        except Exception:
            continue

    return False


def looks_like_final_confirm_page(driver) -> bool:
    try:
        page_text = _normalized_lower(driver.find_element(By.TAG_NAME, "body").text)
    except Exception:
        return False

    return any(marker in page_text for marker in FINAL_STEP_MARKERS)


def detect_submit_controls(driver) -> list[str]:
    detected = []
    buttons = driver.find_elements(
        By.CSS_SELECTOR,
        "button, input[type='submit'], input[type='button']",
    )
    for button in buttons:
        try:
            if not button.is_displayed():
                continue
            label = _button_text(button)
            if label and not _is_review_stage_label(label) and any(marker in label for marker in UNSAFE_SUBMIT_LABELS):
                detected.append(label)
        except Exception:
            continue
    return detected


def click_submit_control(driver, print_func=print_lg) -> bool:
    buttons = driver.find_elements(
        By.CSS_SELECTOR,
        "button, input[type='submit'], input[type='button']",
    )
    for button in buttons:
        try:
            if not button.is_displayed() or not button.is_enabled():
                continue
            label = _button_text(button)
            if label and not _is_review_stage_label(label) and any(marker in label for marker in UNSAFE_SUBMIT_LABELS):
                button.click()
                print_func(f'Clicked submit control "{label}"')
                buffer(1)
                return True
        except Exception:
            continue
    return False
