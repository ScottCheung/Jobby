import json
import time

import pyautogui
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.select import Select

from shared_services.forms.clickers_and_finders import find_by_class, try_xp
from shared_services.runtime import get_runtime_value
from shared_services.utils.helpers import sleep
from linkedinBot.services.linkedin_status import bot_status, sync_status_widget, wait_if_bot_paused
from shared_services.persistence import match_option_in_list, resolve_answer


_driver = None
_actions = None
_question_cache = None
_print_lg = None
_unanswered_questions = None


def bind_context(driver=None, actions=None, question_cache=None, print_func=None, unanswered_questions=None) -> None:
    global _driver, _actions, _question_cache, _print_lg, _unanswered_questions
    if driver is not None:
        _driver = driver
    if actions is not None:
        _actions = actions
    if question_cache is not None:
        _question_cache = question_cache
    if print_func is not None:
        _print_lg = print_func
    if unanswered_questions is not None:
        _unanswered_questions = unanswered_questions


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def answer_common_questions(label: str, answer: str) -> str:
    if 'sponsorship' in label or 'visa' in label:
        answer = str(get_runtime_value("require_visa", "No"))
    return answer


def _extract_select_options(select_el) -> list[str]:
    select = Select(select_el)
    return [option.text for option in select.options]


def capture_manual_answers(modal, company: str) -> None:
    if not bool(get_runtime_value("learn_from_manual_answers", True)):
        return
    all_questions = modal.find_elements(By.XPATH, ".//div[@data-test-form-element]")
    for Question in all_questions:
        select = try_xp(Question, ".//select", False)
        if select:
            label_org = "Unknown"
            try:
                label = Question.find_element(By.TAG_NAME, "label")
                label_org = label.find_element(By.TAG_NAME, "span").text
            except Exception:
                pass
            if label_org.lower() == "phone country code":
                continue
            options = _extract_select_options(select)
            answer = Select(select).first_selected_option.text
            if answer and answer != "Select an option":
                _question_cache.save_answer(label_org, "select", answer, "manual", options=options, company=company)
                _log(f'[manual] saved select "{label_org}" -> "{answer}"')
            continue

        radio = try_xp(Question, './/fieldset[@data-test-form-builder-radio-button-form-component="true"]', False)
        if radio:
            label = try_xp(radio, './/span[@data-test-form-builder-radio-button-form-component__title]', False)
            try:
                label = find_by_class(label, "visually-hidden", 2.0)
            except Exception:
                pass
            label_org = label.text if label else "Unknown"
            options = radio.find_elements(By.TAG_NAME, 'input')
            options_labels = []
            selected = None
            for option in options:
                option_id = option.get_attribute("id")
                option_label = try_xp(radio, f'.//label[@for="{option_id}"]', False)
                text = option_label.text if option_label else "Unknown"
                options_labels.append(text)
                if option.is_selected():
                    selected = text
            if selected:
                _question_cache.save_answer(label_org, "radio", selected, "manual", options=options_labels, company=company)
                _log(f'[manual] saved radio "{label_org}" -> "{selected}"')
            continue

        text = try_xp(Question, ".//input[@type='text']", False)
        if text:
            label = try_xp(Question, ".//label[@for]", False)
            try:
                label = label.find_element(By.CLASS_NAME, 'visually-hidden')
            except Exception:
                pass
            label_org = label.text if label else "Unknown"
            answer = text.get_attribute("value")
            if answer:
                _question_cache.save_answer(label_org, "text", answer, "manual", company=company)
                _log(f'[manual] saved text "{label_org}" -> "{answer}"')
            continue

        text_area = try_xp(Question, ".//textarea", False)
        if text_area:
            label = try_xp(Question, ".//label[@for]", False)
            label_org = label.text if label else "Unknown"
            answer = text_area.get_attribute("value")
            if answer:
                _question_cache.save_answer(label_org, "textarea", answer, "manual", company=company)
                _log(f'[manual] saved textarea "{label_org}" -> "{answer}"')


def show_inpage_overlay(title: str, message: str, buttons: list[str]) -> str:
    escaped_title = json.dumps(title)
    escaped_message = json.dumps(message)
    buttons_json = json.dumps(buttons)

    js_script = f"""
    (function() {{
        const existing = document.getElementById('bot-inpage-sidebar');
        if (existing) {{ existing.remove(); }}

        const sidebar = document.createElement('div');
        sidebar.id = 'bot-inpage-sidebar';
        sidebar.style.cssText = `
            position: fixed;
            top: 40px;
            right: 40px;
            width: 340px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 28px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            z-index: 10000000;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            padding: 20px;
            color: #202124;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            user-select: none;
        `;

        const header = document.createElement('div');
        header.id = 'bot-sidebar-header';
        header.style.cssText = `
            font-size: 16px;
            font-weight: 500;
            color: #1a73e8;
            cursor: move;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f1f3f4;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const titleSpan = document.createElement('span');
        titleSpan.textContent = {escaped_title};
        header.appendChild(titleSpan);

        const dragIndicator = document.createElement('span');
        dragIndicator.innerHTML = '&#9776;';
        dragIndicator.style.cssText = `
            font-size: 24px;
            color: #bdc1c6;
            cursor: move;
        `;
        header.appendChild(dragIndicator);
        sidebar.appendChild(header);

        const msg = document.createElement('div');
        msg.style.cssText = `
            font-size: 13px;
            line-height: 1.5;
            color: #5f6368;
            margin-top: 0;
            margin-bottom: 20px;
            white-space: pre-wrap;
            user-select: text;
        `;
        msg.textContent = {escaped_message};
        sidebar.appendChild(msg);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'bot-btn-container';
        btnContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        window.botSelectedOption = null;
        const btnTexts = {buttons_json};
        btnTexts.forEach((text, index) => {{
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `
                background-color: #dadce0;
                color: #1a73e8;
                border: 1px solid #dadce0;
                padding: 10px 16px;
                font-size: 13px;
                font-weight: 500;
                border-radius: 999px;
                cursor: pointer;
                transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
                outline: none;
                text-align: center;
                box-shadow: none;
            `;
            if (index === btnTexts.length - 1) {{
                btn.style.backgroundColor = '#1a73e8';
                btn.style.color = '#ffffff';
                btn.style.border = '1px solid transparent';
                btn.onmouseover = () => {{
                    btn.style.backgroundColor = '#1557b0';
                    btn.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)';
                }};
                btn.onmouseout = () => {{
                    btn.style.backgroundColor = '#1a73e8';
                    btn.style.boxShadow = 'none';
                }};
            }} else {{
                btn.onmouseover = () => {{
                    btn.style.backgroundColor = '#f8f9fa';
                    btn.style.borderColor = '#1a73e8';
                }};
                btn.onmouseout = () => {{
                    btn.style.backgroundColor = '#ffffff';
                    btn.style.borderColor = '#dadce0';
                }};
            }}

            btn.addEventListener('click', () => {{
                window.botSelectedOption = text;
                sidebar.remove();
            }});
            btnContainer.appendChild(btn);
        }});
        sidebar.appendChild(btnContainer);
        document.body.appendChild(sidebar);

        let isDragging = false;
        let startX, startY, initialX, initialY;
        header.addEventListener('mousedown', (e) => {{
            if (e.target.tagName.toLowerCase() === 'button') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = sidebar.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        }});
        function drag(e) {{
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            sidebar.style.left = (initialX + dx) + 'px';
            sidebar.style.top = (initialY + dy) + 'px';
            sidebar.style.right = 'auto';
            sidebar.style.bottom = 'auto';
        }}
        function stopDrag() {{
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        }}
    }})();
    """

    try:
        _driver.execute_script(js_script)
    except Exception as e:
        _log(f"Error injecting JS sidebar: {e}")
        if len(buttons) == 1:
            pyautogui.alert(message, title, button=buttons[0])
            return buttons[0]
        return pyautogui.confirm(message, title, buttons)

    while True:
        try:
            sync_status_widget(_driver)
            selected = _driver.execute_script("return window.botSelectedOption;")
            if selected is not None:
                _driver.execute_script("window.botSelectedOption = null;")
                return selected
        except Exception:
            return None
        time.sleep(0.5)


def answer_questions(modal, questions_list: set, work_location: str, job_description: str | None = None, company: str = "Unknown") -> tuple[set, bool]:
    has_unanswered = False

    wait_if_bot_paused()
    bot_status("Reading Easy Apply questions...")
    all_questions = modal.find_elements(By.XPATH, ".//div[@data-test-form-element]")

    for Question in all_questions:
        wait_if_bot_paused()
        select = try_xp(Question, ".//select", False)
        if select:
            label_org = "Unknown"
            try:
                label = Question.find_element(By.TAG_NAME, "label")
                label_org = label.find_element(By.TAG_NAME, "span").text
            except Exception:
                pass
            label_lower = label_org.lower()
            select_el = Select(select)
            selected_option = select_el.first_selected_option.text
            options_text = []
            options_display = '"List of phone country codes"'
            if label_lower != "phone country code":
                options_text = _extract_select_options(select)
                options_display = "".join([f' "{option}",' for option in options_text])
            prev_answer = selected_option
            source = "existing"
            answer = prev_answer

            if overwrite_previous_answers or selected_option == "Select an option":
                if 'email' in label_lower or 'phone' in label_lower:
                    answer = prev_answer
                    source = "existing"
                else:
                    resolved, source = resolve_answer(
                        label_org, "select", options_text, work_location,
                        _question_cache, job_description=job_description, prev_answer=prev_answer,
                    )
                    answer = resolved
                    if answer is None:
                        if source == "existing" and prev_answer and prev_answer != "Select an option":
                            answer = prev_answer
                        else:
                            has_unanswered = True
                            _unanswered_questions.add((label_org, "select"))
                            answer = prev_answer if prev_answer != "Select an option" else ""
                    else:
                        try:
                            select_el.select_by_visible_text(answer)
                        except NoSuchElementException:
                            matched = match_option_in_list(answer, options_text)
                            if matched:
                                select_el.select_by_visible_text(matched)
                                answer = matched
                            else:
                                has_unanswered = True
                                _unanswered_questions.add((label_org, "select"))
                                answer = prev_answer
                        if answer and source not in ("existing", "skipped", "unanswered"):
                            _question_cache.save_answer(label_org, "select", answer, source, options=options_text, company=company)

            questions_list.add((f'{label_org} [ {options_display} ]', answer, "select", prev_answer, source))
            continue

        radio = try_xp(Question, './/fieldset[@data-test-form-builder-radio-button-form-component="true"]', False)
        if radio:
            prev_answer = None
            label = try_xp(radio, './/span[@data-test-form-builder-radio-button-form-component__title]', False)
            try:
                label = find_by_class(label, "visually-hidden", 2.0)
            except Exception:
                pass
            label_base = label.text if label else "Unknown"
            label_org = label_base + ' [ '
            options = radio.find_elements(By.TAG_NAME, 'input')
            options_labels = []
            options_plain = []

            for option in options:
                option_id = option.get_attribute("id")
                option_label = try_xp(radio, f'.//label[@for="{option_id}"]', False)
                plain = option_label.text if option_label else "Unknown"
                options_plain.append(plain)
                options_labels.append(f'"{plain}"<{option.get_attribute("value")}>')
                if option.is_selected():
                    prev_answer = options_labels[-1]
                label_org += f' {options_labels[-1]},'
            label_org += ' ]'
            source = "existing"
            answer = prev_answer

            if overwrite_previous_answers or prev_answer is None:
                resolved, source = resolve_answer(
                    label_base, "radio", options_plain, work_location,
                    _question_cache, job_description=job_description, prev_answer=prev_answer,
                )
                if resolved is None:
                    if source == "existing" and prev_answer:
                        answer = prev_answer
                    else:
                        has_unanswered = True
                        _unanswered_questions.add((label_base, "radio"))
                else:
                    found_option = try_xp(radio, f".//label[normalize-space()='{resolved}']", False)
                    if found_option:
                        _actions.move_to_element(found_option).click().perform()
                        answer = resolved
                    else:
                        matched_label = match_option_in_list(resolved, options_plain)
                        found_option = None
                        if matched_label:
                            found_option = try_xp(radio, f".//label[normalize-space()='{matched_label}']", False)
                        if found_option:
                            _actions.move_to_element(found_option).click().perform()
                            answer = matched_label
                        else:
                            has_unanswered = True
                            _unanswered_questions.add((label_base, "radio"))
                            answer = prev_answer
                    if answer and source not in ("existing", "skipped", "unanswered"):
                        _question_cache.save_answer(label_base, "radio", answer if isinstance(answer, str) and not answer.startswith('"') else resolved, source, options=options_plain, company=company)

            questions_list.add((label_org, answer, "radio", prev_answer, source))
            continue

        text = try_xp(Question, ".//input[@type='text']", False)
        if text:
            wait_if_bot_paused()
            do_actions = False
            label = try_xp(Question, ".//label[@for]", False)
            try:
                label = label.find_element(By.CLASS_NAME, 'visually-hidden')
            except Exception:
                pass
            label_org = label.text if label else "Unknown"
            prev_answer = text.get_attribute("value")
            source = "existing"
            answer = prev_answer

            if not prev_answer or overwrite_previous_answers:
                resolved, source = resolve_answer(
                    label_org, "text", None, work_location,
                    _question_cache, job_description=job_description, prev_answer=prev_answer,
                )
                if resolved is None:
                    if source == "existing" and prev_answer:
                        answer = prev_answer
                    else:
                        has_unanswered = True
                        _unanswered_questions.add((label_org, "text"))
                        answer = prev_answer or ""
                else:
                    answer = resolved
                    if 'city' in label_org.lower() or 'location' in label_org.lower() or 'address' in label_org.lower():
                        do_actions = True
                    text.clear()
                    text.send_keys(answer)
                    if do_actions:
                        sleep(2)
                        _actions.send_keys(Keys.ARROW_DOWN)
                        _actions.send_keys(Keys.ENTER).perform()
                    if source not in ("existing", "skipped", "unanswered"):
                        _question_cache.save_answer(label_org, "text", answer, source, company=company)

            questions_list.add((label_org, text.get_attribute("value"), "text", prev_answer, source))
            continue

        text_area = try_xp(Question, ".//textarea", False)
        if text_area:
            wait_if_bot_paused()
            label = try_xp(Question, ".//label[@for]", False)
            label_org = label.text if label else "Unknown"
            prev_answer = text_area.get_attribute("value")
            source = "existing"
            answer = prev_answer

            if not prev_answer or overwrite_previous_answers:
                resolved, source = resolve_answer(
                    label_org, "textarea", None, work_location,
                    _question_cache, job_description=job_description, prev_answer=prev_answer,
                )
                if resolved is None:
                    if source == "existing" and prev_answer:
                        answer = prev_answer
                    else:
                        has_unanswered = True
                        _unanswered_questions.add((label_org, "textarea"))
                        answer = prev_answer or ""
                else:
                    answer = resolved
                    text_area.clear()
                    text_area.send_keys(answer)
                    if source not in ("existing", "skipped", "unanswered"):
                        _question_cache.save_answer(label_org, "textarea", answer, source, company=company)

            questions_list.add((label_org, text_area.get_attribute("value"), "textarea", prev_answer, source))
            continue

        checkbox = try_xp(Question, ".//input[@type='checkbox']", False)
        if checkbox:
            wait_if_bot_paused()
            label = try_xp(Question, ".//span[@class='visually-hidden']", False)
            label_org = label.text if label else "Unknown"
            option_label = try_xp(Question, ".//label[@for]", False)
            option_text = option_label.text if option_label else "Unknown"
            prev_answer = checkbox.is_selected()
            checked = prev_answer
            source = "existing"

            if not prev_answer or overwrite_previous_answers:
                resolved, source = resolve_answer(
                    label_org, "checkbox", None, work_location,
                    _question_cache, job_description=job_description, prev_answer=str(prev_answer),
                )
                should_check = resolved is None or str(resolved).lower() in ("yes", "true", "1", "check", "checked")
                if resolved is not None and str(resolved).lower() in ("no", "false", "0", "uncheck"):
                    should_check = False
                if should_check and not prev_answer:
                    try:
                        _actions.move_to_element(checkbox).click().perform()
                        checked = True
                        _question_cache.save_answer(label_org, "checkbox", str(checked), source if resolved else "keyword", company=company)
                    except Exception as e:
                        _log("Checkbox click failed!", e)

            questions_list.add((f'{label_org} ([X] {option_text})', checked, "checkbox", prev_answer, source))
            continue

    try_xp(_driver, "//button[contains(@aria-label, 'This is today')]")
    return questions_list, has_unanswered
