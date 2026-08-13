from selenium.common.exceptions import ElementNotInteractableException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC

from shared_services.forms.clickers_and_finders import (
    boolean_button_click,
    multi_sel_noWait,
    scroll_to_view,
    text_input,
    try_find_by_classes,
    try_xp,
    wait_span_click,
)
from shared_services.runtime import get_runtime_state, get_runtime_value, set_runtime_state
from shared_services.utils.helpers import sleep
from linkedinBot.services.linkedin_status import (
    bot_status,
    click_show_results_button,
    short_filter_error,
    wait_for_filter_action,
    wait_if_bot_paused,
)


_driver = None
_actions = None
_wait = None
_buffer = None
_print_lg = None


def bind_context(driver=None, actions=None, wait=None, buffer_func=None, print_func=None) -> None:
    global _driver, _actions, _wait, _buffer, _print_lg
    if driver is not None:
        _driver = driver
    if actions is not None:
        _actions = actions
    if wait is not None:
        _wait = wait
    if buffer_func is not None:
        _buffer = buffer_func
    if print_func is not None:
        _print_lg = print_func


def set_runtime_filter_values(sort_by_value: str, date_posted_value: str) -> None:
    set_runtime_state({"sort_by": sort_by_value, "date_posted": date_posted_value})


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def _wait_between(speed: int = 0) -> None:
    if _buffer:
        _buffer(speed)


def set_search_location() -> None:
    '''
    Function to set search location
    '''
    search_location = str(get_runtime_value("search_location", ""))
    if search_location.strip():
        try:
            wait_if_bot_paused()
            bot_status(f'Setting search location: "{search_location.strip()}"')
            _log(f'Setting search location as: "{search_location.strip()}"')
            search_location_ele = try_xp(_driver, ".//input[@aria-label='City, state, or zip code'and not(@disabled)]", False)
            text_input(_actions, search_location_ele, search_location, "Search Location")
        except ElementNotInteractableException:
            try_xp(_driver, ".//label[@class='jobs-search-box__input-icon jobs-search-box__keywords-label']")
            _actions.send_keys(Keys.TAB, Keys.TAB).perform()
            _actions.key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL).perform()
            _actions.send_keys(search_location.strip()).perform()
            sleep(2)
            _actions.send_keys(Keys.ENTER).perform()
            try_xp(_driver, ".//button[@aria-label='Cancel']")
        except Exception as e:
            try_xp(_driver, ".//button[@aria-label='Cancel']")
            bot_status("Failed to update search location. Continuing with current location.")
            _log("Failed to update search location, continuing with default location!", e)


def apply_filters(show_inpage_overlay, retry_count: int = 0) -> bool:
    '''
    Function to apply job search filters
    '''
    wait_if_bot_paused()
    bot_status("Applying LinkedIn search filters...")
    set_search_location()

    try:
        click_gap = int(get_runtime_value("click_gap", 2))
        runtime = get_runtime_state()
        recommended_wait = 1 if click_gap < 1 else 0

        wait_if_bot_paused()
        bot_status("Opening LinkedIn filter panel...")
        _wait.until(EC.presence_of_element_located((By.XPATH, '//button[normalize-space()="All filters"]'))).click()
        _wait_between(recommended_wait)

        bot_status(f'Applying sort "{runtime.get("sort_by", "")}" and date "{runtime.get("date_posted", "")}"...')
        wait_span_click(_driver, str(runtime.get("sort_by", "")))
        wait_span_click(_driver, str(runtime.get("date_posted", "")))
        _wait_between(recommended_wait)

        bot_status("Applying experience and company filters...")
        multi_sel_noWait(_driver, list(runtime.get("experience_level", []) or []))
        multi_sel_noWait(_driver, list(runtime.get("companies", []) or []), _actions)
        if runtime.get("experience_level") or runtime.get("companies"):
            _wait_between(recommended_wait)

        bot_status("Applying job type and workplace filters...")
        multi_sel_noWait(_driver, list(runtime.get("job_type", []) or []))
        multi_sel_noWait(_driver, list(runtime.get("on_site", []) or []))
        if runtime.get("job_type") or runtime.get("on_site"):
            _wait_between(recommended_wait)

        if bool(runtime.get("easy_apply_only", False)):
            bot_status("Enabling Easy Apply filter...")
            boolean_button_click(_driver, _actions, "Easy Apply")

        bot_status("Applying location and industry filters...")
        multi_sel_noWait(_driver, list(runtime.get("location", []) or []))
        multi_sel_noWait(_driver, list(runtime.get("industry", []) or []))
        if runtime.get("location") or runtime.get("industry"):
            _wait_between(recommended_wait)

        bot_status("Applying function and title filters...")
        multi_sel_noWait(_driver, list(runtime.get("job_function", []) or []))
        multi_sel_noWait(_driver, list(runtime.get("job_titles", []) or []))
        if runtime.get("job_function") or runtime.get("job_titles"):
            _wait_between(recommended_wait)

        bot_status("Applying additional filters...")
        if bool(runtime.get("under_10_applicants", False)):
            boolean_button_click(_driver, _actions, "Under 10 applicants")
        if bool(runtime.get("in_your_network", False)):
            boolean_button_click(_driver, _actions, "In your network")
        if bool(runtime.get("fair_chance_employer", False)):
            boolean_button_click(_driver, _actions, "Fair Chance Employer")

        wait_span_click(_driver, str(runtime.get("salary", "")))
        _wait_between(recommended_wait)

        multi_sel_noWait(_driver, list(runtime.get("benefits", []) or []))
        multi_sel_noWait(_driver, list(runtime.get("commitments", []) or []))
        if runtime.get("benefits") or runtime.get("commitments"):
            _wait_between(recommended_wait)

        wait_if_bot_paused()
        bot_status("Submitting search filters and waiting for results...")
        click_show_results_button()

        if bool(runtime.get("pause_after_filters", False)) and "Turn off Pause after search" == show_inpage_overlay("Please check your results", "These are your configured search results and filter. It is safe to change them while this dialog is open, any changes later could result in errors and skipping this search run.", ["Turn off Pause after search", "Look's good, Continue"]):
            set_runtime_state({"pause_after_filters": False})
        return True

    except Exception as e:
        bot_status(f"Filter setup failed: {short_filter_error(e)}")
        _log("Setting the preferences failed!")
        if retry_count < 2:
            action = wait_for_filter_action(short_filter_error(e))
            if action == "retry":
                bot_status("Retrying LinkedIn filters...")
                _log("Retrying search filters...")
                return apply_filters(show_inpage_overlay, retry_count + 1)
            bot_status("Skipping filter retry. Stopping this search run.")
            _log("Skipping filter retry and stopping because filter results are not trustworthy.")
            return False
        show_inpage_overlay("Error applying filters", f"Faced error while applying filters. Please make sure correct filters are selected, click on show results and click on any button of this dialog. Can't turn off Pause after search when error occurs! ERROR: {short_filter_error(e)}", ["Continue anyway", "Looks good, Continue"])
        return False


def get_page_info() -> tuple[WebElement | None, int | None]:
    '''
    Function to get pagination element and current page number
    '''
    try:
        pagination_element = try_find_by_classes(_driver, ["jobs-search-pagination__pages", "artdeco-pagination", "artdeco-pagination__pages"])
        scroll_to_view(_driver, pagination_element)
        current_page = int(pagination_element.find_element(By.XPATH, "//button[contains(@class, 'active')]").text)
    except Exception as e:
        _log("Failed to find Pagination element, hence couldn't scroll till end!")
        pagination_element = None
        current_page = None
        _log(e)
    return pagination_element, current_page
