

# Imports
import os
import csv
import re
import time
import pyautogui

# Set CSV field size limit to prevent field size errors
csv.field_size_limit(1000000)  # Set to 1MB instead of default 131KB

from random import choice, shuffle
from datetime import datetime

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.select import Select
from selenium.webdriver.remote.webelement import WebElement
from selenium.common.exceptions import NoSuchElementException, ElementClickInterceptedException, NoSuchWindowException, ElementNotInteractableException, WebDriverException

from config.personals import *
from config.questions import *
from config.search import *
from config.secrets import use_AI, username, password, ai_provider
from config.settings import *

from modules.open_chrome import *
from modules.helpers import *
original_buffer = buffer
_print_lg = print_lg
STATUS_WIDGET_VERSION = "2026-06-15-inline-status-v3"
_last_status_sync = 0.0
_last_status_message = None
_last_widget_sync = 0.0
_bot_pause_announced = False

def _clean_status_text(message) -> str | None:
    text = str(message or "").strip()
    if not text:
        return None
    text = re.sub(r"^\[Status\]\s*", "", text).strip()
    text = re.sub(r"\s+", " ", text)
    if not text or set(text) <= {"_", "-", "#", "@", ">"}:
        return None
    if len(text) > 220:
        text = text[:217].rstrip() + "..."
    return text

def sync_status_widget(driver) -> None:
    # Inject the lightweight LinkedIn status widget only on LinkedIn pages.
    global _last_widget_sync
    try:
        if "linkedin.com" not in driver.current_url:
            return
    except Exception:
        return

    now = time.time()
    if now - _last_widget_sync < 0.75:
        return

    try:
        is_init = driver.execute_script(
            "return window.linkedinBotStatusInitialized === true && window.linkedinBotStatusVersion === arguments[0];",
            STATUS_WIDGET_VERSION
        )
    except Exception:
        is_init = False

    if is_init:
        _last_widget_sync = now
        return

    js_file = os.path.join("modules", "javascript", "status_injector.js")
    if not os.path.exists(js_file):
        return

    with open(js_file, "r", encoding="utf-8") as f:
        js_code = f.read()

    try:
        driver.execute_script(
            "window.linkedinBotStatusInitialized = true; window.linkedinBotStatusVersion = arguments[0];\n" + js_code,
            STATUS_WIDGET_VERSION
        )
        _last_widget_sync = now
    except Exception as e:
        _print_lg(f"[Status] Error injecting LinkedIn status widget: {e}")

def update_linkedin_status(message, force: bool = False) -> None:
    global _last_status_sync, _last_status_message
    status_text = _clean_status_text(message)
    if not status_text:
        return
    now = time.time()
    if not force and now - _last_status_sync < 0.35:
        return
    if status_text == _last_status_message and now - _last_status_sync < 0.5:
        return
    try:
        if 'driver' not in globals() or driver is None:
            return
        if "linkedin.com" not in driver.current_url:
            return
        sync_status_widget(driver)
        driver.execute_script(
            "if (window.updateLinkedInBotStatus) window.updateLinkedInBotStatus(arguments[0]);",
            status_text,
        )
        _last_status_sync = now
        _last_status_message = status_text
    except Exception:
        pass

def bot_status(message: str) -> None:
    update_linkedin_status(f"[Status] {message}", force=True)

def is_linkedin_bot_paused() -> bool:
    try:
        if 'driver' not in globals() or driver is None:
            return False
        if "linkedin.com" not in driver.current_url:
            return False
        sync_status_widget(driver)
        return bool(driver.execute_script("return !!window.linkedinBotPaused;"))
    except Exception:
        return False

def wait_if_bot_paused() -> None:
    global _bot_pause_announced
    while is_linkedin_bot_paused():
        if not _bot_pause_announced:
            bot_status("Paused. Click resume when you are ready.")
            _bot_pause_announced = True
        time.sleep(0.5)
    if _bot_pause_announced:
        _bot_pause_announced = False
        bot_status("Resumed. Continuing automation.")

def wait_for_filter_action(message: str) -> str:
    try:
        sync_status_widget(driver)
        driver.execute_script(
            "if (window.showLinkedInBotFilterRecovery) window.showLinkedInBotFilterRecovery(arguments[0]);",
            message,
        )
        while True:
            action = driver.execute_script("return window.linkedinBotFilterAction || null;")
            if action in ("retry", "skip"):
                driver.execute_script("window.linkedinBotFilterAction = null;")
                return action
            wait_if_bot_paused()
            time.sleep(0.5)
    except Exception:
        return "skip"

def set_status_widget_compact(compact: bool) -> None:
    try:
        if 'driver' not in globals() or driver is None:
            return
        if "linkedin.com" not in driver.current_url:
            return
        sync_status_widget(driver)
        driver.execute_script(
            "if (window.setLinkedInBotStatusCompact) window.setLinkedInBotStatusCompact(arguments[0]);",
            compact,
        )
    except Exception:
        pass

def set_status_widget_hidden(hidden: bool) -> None:
    try:
        if 'driver' not in globals() or driver is None:
            return
        if "linkedin.com" not in driver.current_url:
            return
        sync_status_widget(driver)
        driver.execute_script(
            """
            const root = document.getElementById('linkedin-bot-status-root');
            if (root) root.style.display = arguments[0] ? 'none' : '';
            """,
            hidden,
        )
    except Exception:
        pass

def filters_modal_open() -> bool:
    try:
        return bool(driver.execute_script(
            """
            const showButton = document.querySelector('button[data-test-reusables-filters-modal-show-results-button="true"]');
            const visibleShowButton = !!(showButton && showButton.offsetParent !== null);
            const dialog = document.querySelector('[role="dialog"]');
            const visibleDialog = !!(dialog && dialog.offsetParent !== null && /filter/i.test(dialog.innerText || ''));
            return visibleShowButton || visibleDialog;
            """
        ))
    except Exception:
        return False

def search_results_visible() -> bool:
    try:
        return bool(driver.execute_script(
            """
            return !!document.querySelector(
              '.jobs-search-results-list, .jobs-search-results, .scaffold-layout__list, .jobs-search-two-pane__wrapper'
            );
            """
        ))
    except Exception:
        return False

def show_results_submission_finished() -> bool:
    for _ in range(6):
        wait_if_bot_paused()
        if not filters_modal_open():
            return True
        time.sleep(0.35)
    return False

def short_filter_error(error: Exception) -> str:
    message = str(error or "").strip()
    if not message or message.lower().startswith("stacktrace"):
        return "LinkedIn did not confirm the filter click. This is often a temporary page animation or ChromeDriver timing issue."
    first_line = message.splitlines()[0].strip()
    return first_line[:220]

def click_show_results_button() -> None:
    wait_if_bot_paused()
    set_status_widget_compact(True)
    if not filters_modal_open() and search_results_visible():
        bot_status("Search filters already appear applied. Continuing.")
        return
    locators = [
        (By.CSS_SELECTOR, 'button[data-test-reusables-filters-modal-show-results-button="true"]'),
        (By.XPATH, '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "apply current filters to show")]'),
        (By.XPATH, '//button[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "show results")]'),
    ]
    last_error = None
    try:
        for attempt in range(3):
            for by, selector in locators:
                try:
                    button = WebDriverWait(driver, 4).until(EC.presence_of_element_located((by, selector)))
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", button)
                    time.sleep(0.25)
                    wait_if_bot_paused()
                    set_status_widget_hidden(True)
                    try:
                        if attempt == 0:
                            WebDriverWait(driver, 4).until(EC.element_to_be_clickable((by, selector))).click()
                        elif attempt == 1:
                            actions.move_to_element(button).pause(0.1).click().perform()
                        else:
                            driver.execute_script("arguments[0].click();", button)
                    finally:
                        set_status_widget_hidden(False)
                    if show_results_submission_finished():
                        bot_status("Search filters submitted.")
                        return
                except Exception as e:
                    set_status_widget_hidden(False)
                    last_error = e
            if show_results_submission_finished():
                bot_status("Search filters submitted.")
                return
            time.sleep(0.6)
    finally:
        set_status_widget_hidden(False)
    if last_error:
        raise last_error
    if search_results_visible():
        bot_status("Could not confirm the filter button click, but results are visible. Continuing.")
        return
    raise NoSuchElementException("Show results button was not found.")

def print_lg(*msgs: str | dict, end: str = "\n", pretty: bool = False, flush: bool = False, from_critical: bool = False) -> None:
    _print_lg(*msgs, end=end, pretty=pretty, flush=flush, from_critical=from_critical)
    if pretty:
        return
    for message in msgs:
        update_linkedin_status(message)

def buffer(speed: int=0) -> None:
    wait_if_bot_paused()
    original_buffer(speed)
    wait_if_bot_paused()
    try:
        if 'driver' in globals() and driver is not None:
            now = time.time()
            if now - _last_widget_sync > 2.0:
                sync_status_widget(driver)
    except Exception:
        pass

from modules.clickers_and_finders import *
from modules.validator import validate_config
from modules.persistence import QuestionCache, ApplicationLogger, resolve_answer, match_option_in_list
from modules.persistence import answer_resolver as answer_resolver_module
from config.custom_questions import custom_questions

if use_AI:
    from modules.ai.openaiConnections import ai_create_openai_client, ai_extract_skills, ai_answer_question, ai_close_openai_client
    from modules.ai.deepseekConnections import deepseek_create_client, deepseek_extract_skills, deepseek_answer_question
    from modules.ai.geminiConnections import gemini_create_client, gemini_extract_skills, gemini_answer_question

from typing import Literal


pyautogui.FAILSAFE = False
# if use_resume_generator:    from resume_generator import is_logged_in_GPT, login_GPT, open_resume_chat, create_custom_resume


#< Global Variables and logics

if run_in_background == True:
    pause_at_failed_question = False
    pause_before_submit = False
    run_non_stop = False

first_name = first_name.strip()
middle_name = middle_name.strip()
last_name = last_name.strip()
full_name = first_name + " " + middle_name + " " + last_name if middle_name else first_name + " " + last_name

useNewResume = True
unanswered_questions = set()

question_cache = QuestionCache()
application_logger = ApplicationLogger()

tabs_count = 1
easy_applied_count = 0
external_jobs_count = 0
failed_count = 0
skip_count = 0
dailyEasyApplyLimitReached = False

re_experience = re.compile(r'[(]?\s*(\d+)\s*[)]?\s*[-to]*\s*\d*[+]*\s*year[s]?', re.IGNORECASE)

desired_salary_lakhs = str(round(desired_salary / 100000, 2))
desired_salary_monthly = str(round(desired_salary/12, 2))
desired_salary = str(desired_salary)

current_ctc_lakhs = str(round(current_ctc / 100000, 2))
current_ctc_monthly = str(round(current_ctc/12, 2))
current_ctc = str(current_ctc)

notice_period_months = str(notice_period//30)
notice_period_weeks = str(notice_period//7)
notice_period = str(notice_period)

aiClient = None
answer_resolver_module.full_name = full_name
answer_resolver_module.desired_salary = desired_salary
answer_resolver_module.desired_salary_lakhs = desired_salary_lakhs
answer_resolver_module.desired_salary_monthly = desired_salary_monthly
answer_resolver_module.current_ctc = current_ctc
answer_resolver_module.current_ctc_lakhs = current_ctc_lakhs
answer_resolver_module.current_ctc_monthly = current_ctc_monthly
answer_resolver_module.notice_period = notice_period
answer_resolver_module.notice_period_months = notice_period_months
answer_resolver_module.notice_period_weeks = notice_period_weeks
##> ------ Dheeraj Deshwal : dheeraj9811 Email:dheeraj20194@iiitd.ac.in/dheerajdeshwal9811@gmail.com - Feature ------
about_company_for_ai = None # TODO extract about company for AI
##<

#>


#< Login Functions
def is_logged_in_LN() -> bool:
    '''
    Function to check if user is logged-in in LinkedIn
    * Returns: `True` if user is logged-in or `False` if not
    '''
    if driver.current_url == "https://www.linkedin.com/feed/": return True
    if try_linkText(driver, "Sign in"): return False
    if try_xp(driver, '//button[@type="submit" and contains(text(), "Sign in")]'):  return False
    if try_linkText(driver, "Join now"): return False
    print_lg("Didn't find Sign in link, so assuming user is logged in!")
    return True


def login_LN() -> None:
    '''
    Function to login for LinkedIn
    * Tries to login using given `username` and `password` from `secrets.py`
    * If failed, tries to login using saved LinkedIn profile button if available
    * If both failed, asks user to login manually
    '''
    # Find the username and password fields and fill them with user credentials
    driver.get("https://www.linkedin.com/login")
    if username == "username@example.com" and password == "example_password":
        pyautogui.alert("User did not configure username and password in secrets.py, hence can't login automatically! Please login manually!", "Login Manually","Okay")
        print_lg("User did not configure username and password in secrets.py, hence can't login automatically! Please login manually!")
        manual_login_retry(is_logged_in_LN, 2)
        return
    try:
        wait.until(EC.presence_of_element_located((By.LINK_TEXT, "Forgot password?")))
        try:
            text_input_by_ID(driver, "username", username, 1)
        except Exception as e:
            print_lg("Couldn't find username field.")
            # print_lg(e)
        try:
            text_input_by_ID(driver, "password", password, 1)
        except Exception as e:
            print_lg("Couldn't find password field.")
            # print_lg(e)
        # Find the login submit button and click it
        driver.find_element(By.XPATH, '//button[@type="submit" and contains(text(), "Sign in")]').click()
    except Exception as e1:
        try:
            profile_button = find_by_class(driver, "profile__details")
            profile_button.click()
        except Exception as e2:
            # print_lg(e1, e2)
            print_lg("Couldn't Login!")

    try:
        # Wait until successful redirect, indicating successful login
        wait.until(EC.url_to_be("https://www.linkedin.com/feed/")) # wait.until(EC.presence_of_element_located((By.XPATH, '//button[normalize-space(.)="Start a post"]')))
        return print_lg("Login successful!")
    except Exception as e:
        print_lg("Seems like login attempt failed! Possibly due to wrong credentials or already logged in! Try logging in manually!")
        # print_lg(e)
        manual_login_retry(is_logged_in_LN, 2)
#>



def get_applied_job_ids() -> set[str]:
    '''
    Function to get a `set` of applied job's Job IDs
    * Returns a set of Job IDs from existing applied jobs history csv file
    '''
    job_ids: set[str] = set()
    try:
        with open(file_name, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            for row in reader:
                job_ids.add(row[0])
    except FileNotFoundError:
        print_lg(f"The CSV file '{file_name}' does not exist.")
    return job_ids



def set_search_location() -> None:
    '''
    Function to set search location
    '''
    if search_location.strip():
        try:
            wait_if_bot_paused()
            bot_status(f'Setting search location: "{search_location.strip()}"')
            print_lg(f'Setting search location as: "{search_location.strip()}"')
            search_location_ele = try_xp(driver, ".//input[@aria-label='City, state, or zip code'and not(@disabled)]", False) #  and not(@aria-hidden='true')]")
            text_input(actions, search_location_ele, search_location, "Search Location")
        except ElementNotInteractableException:
            try_xp(driver, ".//label[@class='jobs-search-box__input-icon jobs-search-box__keywords-label']")
            actions.send_keys(Keys.TAB, Keys.TAB).perform()
            actions.key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL).perform()
            actions.send_keys(search_location.strip()).perform()
            sleep(2)
            actions.send_keys(Keys.ENTER).perform()
            try_xp(driver, ".//button[@aria-label='Cancel']")
        except Exception as e:
            try_xp(driver, ".//button[@aria-label='Cancel']")
            bot_status("Failed to update search location. Continuing with current location.")
            print_lg("Failed to update search location, continuing with default location!", e)


def apply_filters(retry_count: int = 0) -> None:
    '''
    Function to apply job search filters
    '''
    wait_if_bot_paused()
    bot_status("Applying LinkedIn search filters...")
    set_search_location()

    try:
        recommended_wait = 1 if click_gap < 1 else 0

        wait_if_bot_paused()
        bot_status("Opening LinkedIn filter panel...")
        wait.until(EC.presence_of_element_located((By.XPATH, '//button[normalize-space()="All filters"]'))).click()
        buffer(recommended_wait)

        bot_status(f'Applying sort "{sort_by}" and date "{date_posted}"...')
        wait_span_click(driver, sort_by)
        wait_span_click(driver, date_posted)
        buffer(recommended_wait)

        bot_status("Applying experience and company filters...")
        multi_sel_noWait(driver, experience_level) 
        multi_sel_noWait(driver, companies, actions)
        if experience_level or companies: buffer(recommended_wait)

        bot_status("Applying job type and workplace filters...")
        multi_sel_noWait(driver, job_type)
        multi_sel_noWait(driver, on_site)
        if job_type or on_site: buffer(recommended_wait)

        if easy_apply_only:
            bot_status("Enabling Easy Apply filter...")
            boolean_button_click(driver, actions, "Easy Apply")
        
        bot_status("Applying location and industry filters...")
        multi_sel_noWait(driver, location)
        multi_sel_noWait(driver, industry)
        if location or industry: buffer(recommended_wait)

        bot_status("Applying function and title filters...")
        multi_sel_noWait(driver, job_function)
        multi_sel_noWait(driver, job_titles)
        if job_function or job_titles: buffer(recommended_wait)

        bot_status("Applying additional filters...")
        if under_10_applicants: boolean_button_click(driver, actions, "Under 10 applicants")
        if in_your_network: boolean_button_click(driver, actions, "In your network")
        if fair_chance_employer: boolean_button_click(driver, actions, "Fair Chance Employer")

        wait_span_click(driver, salary)
        buffer(recommended_wait)
        
        multi_sel_noWait(driver, benefits)
        multi_sel_noWait(driver, commitments)
        if benefits or commitments: buffer(recommended_wait)

        wait_if_bot_paused()
        bot_status("Submitting search filters and waiting for results...")
        click_show_results_button()

        global pause_after_filters
        if pause_after_filters and "Turn off Pause after search" == show_inpage_overlay("Please check your results", "These are your configured search results and filter. It is safe to change them while this dialog is open, any changes later could result in errors and skipping this search run.", ["Turn off Pause after search", "Look's good, Continue"]):
            pause_after_filters = False

    except Exception as e:
        bot_status(f"Filter setup failed: {short_filter_error(e)}")
        print_lg("Setting the preferences failed!")
        if retry_count < 2:
            action = wait_for_filter_action(short_filter_error(e))
            if action == "retry":
                bot_status("Retrying LinkedIn filters...")
                print_lg("Retrying search filters...")
                apply_filters(retry_count + 1)
                return
            bot_status("Skipping filter retry. Continuing with current results.")
            print_lg("Skipping filter retry and continuing with current results.")
            return
        show_inpage_overlay("Error applying filters", f"Faced error while applying filters. Please make sure correct filters are selected, click on show results and click on any button of this dialog. Can't turn off Pause after search when error occurs! ERROR: {short_filter_error(e)}", ["Continue anyway", "Looks good, Continue"])
        # print_lg(e)



def get_page_info() -> tuple[WebElement | None, int | None]:
    '''
    Function to get pagination element and current page number
    '''
    try:
        pagination_element = try_find_by_classes(driver, ["jobs-search-pagination__pages", "artdeco-pagination", "artdeco-pagination__pages"])
        scroll_to_view(driver, pagination_element)
        current_page = int(pagination_element.find_element(By.XPATH, "//button[contains(@class, 'active')]").text)
    except Exception as e:
        print_lg("Failed to find Pagination element, hence couldn't scroll till end!")
        pagination_element = None
        current_page = None
        print_lg(e)
    return pagination_element, current_page



def get_job_main_details(job: WebElement, blacklisted_companies: set, rejected_jobs: set) -> tuple[str, str, str, str, str, bool]:
    '''
    # Function to get job main details.
    Returns a tuple of (job_id, title, company, work_location, work_style, skip)
    * job_id: Job ID
    * title: Job title
    * company: Company name
    * work_location: Work location of this job
    * work_style: Work style of this job (Remote, On-site, Hybrid)
    * skip: A boolean flag to skip this job
    '''
    skip = False
    job_details_button = job.find_element(By.TAG_NAME, 'a')  # job.find_element(By.CLASS_NAME, "job-card-list__title")  # Problem in India
    scroll_to_view(driver, job_details_button, True)
    job_id = job.get_dom_attribute('data-occludable-job-id')
    title = job_details_button.text
    title = title[:title.find("\n")]
    # company = job.find_element(By.CLASS_NAME, "job-card-container__primary-description").text
    # work_location = job.find_element(By.CLASS_NAME, "job-card-container__metadata-item").text
    other_details = job.find_element(By.CLASS_NAME, 'artdeco-entity-lockup__subtitle').text
    index = other_details.find(' · ')
    company = other_details[:index]
    work_location = other_details[index+3:]
    work_style = work_location[work_location.rfind('(')+1:work_location.rfind(')')]
    work_location = work_location[:work_location.rfind('(')].strip()
    
    # Skip if previously rejected due to blacklist or already applied
    if company in blacklisted_companies:
        print_lg(f'Skipping "{title} | {company}" job (Blacklisted Company). Job ID: {job_id}!')
        skip = True
    elif job_id in rejected_jobs: 
        print_lg(f'Skipping previously rejected "{title} | {company}" job. Job ID: {job_id}!')
        skip = True
    try:
        if job.find_element(By.CLASS_NAME, "job-card-container__footer-job-state").text == "Applied":
            skip = True
            print_lg(f'Already applied to "{title} | {company}" job. Job ID: {job_id}!')
    except: pass
    try: 
        if not skip: job_details_button.click()
    except Exception as e:
        print_lg(f'Failed to click "{title} | {company}" job on details button. Job ID: {job_id}!') 
        # print_lg(e)
        discard_job()
        job_details_button.click() # To pass the error outside
    buffer(click_gap)
    return (job_id,title,company,work_location,work_style,skip)


# Function to check for Blacklisted words in About Company
def check_blacklist(rejected_jobs: set, job_id: str, company: str, blacklisted_companies: set) -> tuple[set, set, WebElement] | ValueError:
    jobs_top_card = try_find_by_classes(driver, ["job-details-jobs-unified-top-card__primary-description-container","job-details-jobs-unified-top-card__primary-description","jobs-unified-top-card__primary-description","jobs-details__main-content"])
    about_company_org = find_by_class(driver, "jobs-company__box")
    scroll_to_view(driver, about_company_org)
    about_company_org = about_company_org.text
    about_company = about_company_org.lower()
    skip_checking = False
    for word in about_company_good_words:
        if word.lower() in about_company:
            print_lg(f'Found the word "{word}". So, skipped checking for blacklist words.')
            skip_checking = True
            break
    if not skip_checking:
        for word in about_company_bad_words: 
            if word.lower() in about_company: 
                rejected_jobs.add(job_id)
                blacklisted_companies.add(company)
                raise ValueError(f'\n"{about_company_org}"\n\nContains "{word}".')
    buffer(click_gap)
    scroll_to_view(driver, jobs_top_card)
    return rejected_jobs, blacklisted_companies, jobs_top_card



# Function to extract years of experience required from About Job
def extract_years_of_experience(text: str) -> int:
    # Extract all patterns like '10+ years', '5 years', '3-5 years', etc.
    matches = re.findall(re_experience, text)
    if len(matches) == 0: 
        print_lg(f'\n{text}\n\nCouldn\'t find experience requirement in About the Job!')
        return 0
    return max([int(match) for match in matches if int(match) <= 12])



def get_job_description(
) -> tuple[
    str | Literal['Unknown'],
    int | Literal['Unknown'],
    bool,
    str | None,
    str | None
    ]:
    '''
    # Job Description
    Function to extract job description from About the Job.
    ### Returns:
    - `jobDescription: str | 'Unknown'`
    - `experience_required: int | 'Unknown'`
    - `skip: bool`
    - `skipReason: str | None`
    - `skipMessage: str | None`
    '''
    try:
        ##> ------ Dheeraj Deshwal : dheeraj9811 Email:dheeraj20194@iiitd.ac.in/dheerajdeshwal9811@gmail.com - Feature ------
        jobDescription = "Unknown"
        ##<
        experience_required = "Unknown"
        found_masters = 0
        jobDescription = find_by_class(driver, "jobs-box__html-content").text
        jobDescriptionLow = jobDescription.lower()
        skip = False
        skipReason = None
        skipMessage = None
        for word in bad_words:
            if word.lower() in jobDescriptionLow:
                skipMessage = f'\n{jobDescription}\n\nContains bad word "{word}". Skipping this job!\n'
                skipReason = "Found a Bad Word in About Job"
                skip = True
                break
        if not skip and security_clearance == False and ('polygraph' in jobDescriptionLow or 'clearance' in jobDescriptionLow or 'secret' in jobDescriptionLow):
            skipMessage = f'\n{jobDescription}\n\nFound "Clearance" or "Polygraph". Skipping this job!\n'
            skipReason = "Asking for Security clearance"
            skip = True
        if not skip:
            if did_masters and 'master' in jobDescriptionLow:
                print_lg(f'Found the word "master" in \n{jobDescription}')
                found_masters = 2
            experience_required = extract_years_of_experience(jobDescription)
            if current_experience > -1 and experience_required > current_experience + found_masters:
                skipMessage = f'\n{jobDescription}\n\nExperience required {experience_required} > Current Experience {current_experience + found_masters}. Skipping this job!\n'
                skipReason = "Required experience is high"
                skip = True
    except Exception as e:
        if jobDescription == "Unknown":    print_lg("Unable to extract job description!")
        else:
            experience_required = "Error in extraction"
            print_lg("Unable to extract years of experience required!")
            # print_lg(e)
    finally:
        return jobDescription, experience_required, skip, skipReason, skipMessage
        


# Function to upload resume
def upload_resume(modal: WebElement, resume: str) -> tuple[bool, str]:
    try:
        modal.find_element(By.NAME, "file").send_keys(os.path.abspath(resume))
        return True, os.path.basename(default_resume_path)
    except: return False, "Previous resume"

# Function to answer common questions for Easy Apply (legacy import path; logic lives in answer_resolver)
def answer_common_questions(label: str, answer: str) -> str:
    if 'sponsorship' in label or 'visa' in label: answer = require_visa
    return answer


def _extract_select_options(select_el) -> list[str]:
    select = Select(select_el)
    return [option.text for option in select.options]


def capture_manual_answers(modal: WebElement, company: str) -> None:
    if not learn_from_manual_answers:
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
                question_cache.save_answer(label_org, "select", answer, "manual", options=options, company=company)
                print_lg(f'[manual] saved select "{label_org}" -> "{answer}"')
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
                question_cache.save_answer(label_org, "radio", selected, "manual", options=options_labels, company=company)
                print_lg(f'[manual] saved radio "{label_org}" -> "{selected}"')
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
                question_cache.save_answer(label_org, "text", answer, "manual", company=company)
                print_lg(f'[manual] saved text "{label_org}" -> "{answer}"')
            continue

        text_area = try_xp(Question, ".//textarea", False)
        if text_area:
            label = try_xp(Question, ".//label[@for]", False)
            label_org = label.text if label else "Unknown"
            answer = text_area.get_attribute("value")
            if answer:
                question_cache.save_answer(label_org, "textarea", answer, "manual", company=company)
                print_lg(f'[manual] saved textarea "{label_org}" -> "{answer}"')
            continue


def show_inpage_overlay(title: str, message: str, buttons: list[str]) -> str:
    import json
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
        driver.execute_script(js_script)
    except Exception as e:
        print_lg(f"Error injecting JS sidebar: {e}")
        import pyautogui
        if len(buttons) == 1:
            pyautogui.alert(message, title, button=buttons[0])
            return buttons[0]
        else:
            return pyautogui.confirm(message, title, buttons)
            
    while True:
        try:
            sync_status_widget(driver)
            selected = driver.execute_script("return window.botSelectedOption;")
            if selected is not None:
                driver.execute_script("window.botSelectedOption = null;")
                return selected
        except Exception:
            return None
        time.sleep(0.5)


# Function to answer the questions for Easy Apply
def answer_questions(modal: WebElement, questions_list: set, work_location: str, job_description: str | None = None, company: str = "Unknown") -> tuple[set, bool]:
    global unanswered_questions
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
                        question_cache, job_description=job_description, prev_answer=prev_answer,
                    )
                    answer = resolved
                    if answer is None:
                        if source == "existing" and prev_answer and prev_answer != "Select an option":
                            answer = prev_answer
                        else:
                            has_unanswered = True
                            unanswered_questions.add((label_org, "select"))
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
                                unanswered_questions.add((label_org, "select"))
                                answer = prev_answer
                        if answer and source not in ("existing", "skipped", "unanswered"):
                            question_cache.save_answer(label_org, "select", answer, source, options=options_text, company=company)

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
                    question_cache, job_description=job_description, prev_answer=prev_answer,
                )
                if resolved is None:
                    if source == "existing" and prev_answer:
                        answer = prev_answer
                    else:
                        has_unanswered = True
                        unanswered_questions.add((label_base, "radio"))
                else:
                    found_option = try_xp(radio, f".//label[normalize-space()='{resolved}']", False)
                    if found_option:
                        actions.move_to_element(found_option).click().perform()
                        answer = resolved
                    else:
                        matched_label = match_option_in_list(resolved, options_plain)
                        found_option = None
                        if matched_label:
                            found_option = try_xp(radio, f".//label[normalize-space()='{matched_label}']", False)
                        if found_option:
                            actions.move_to_element(found_option).click().perform()
                            answer = matched_label
                        else:
                            has_unanswered = True
                            unanswered_questions.add((label_base, "radio"))
                            answer = prev_answer
                    if answer and source not in ("existing", "skipped", "unanswered"):
                        question_cache.save_answer(label_base, "radio", answer if isinstance(answer, str) and not answer.startswith('"') else resolved, source, options=options_plain, company=company)

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
                    question_cache, job_description=job_description, prev_answer=prev_answer,
                )
                if resolved is None:
                    if source == "existing" and prev_answer:
                        answer = prev_answer
                    else:
                        has_unanswered = True
                        unanswered_questions.add((label_org, "text"))
                        answer = prev_answer or ""
                else:
                    answer = resolved
                    if 'city' in label_org.lower() or 'location' in label_org.lower() or 'address' in label_org.lower():
                        do_actions = True
                    text.clear()
                    text.send_keys(answer)
                    if do_actions:
                        sleep(2)
                        actions.send_keys(Keys.ARROW_DOWN)
                        actions.send_keys(Keys.ENTER).perform()
                    if source not in ("existing", "skipped", "unanswered"):
                        question_cache.save_answer(label_org, "text", answer, source, company=company)

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
                    question_cache, job_description=job_description, prev_answer=prev_answer,
                )
                if resolved is None:
                    if source == "existing" and prev_answer:
                        answer = prev_answer
                    else:
                        has_unanswered = True
                        unanswered_questions.add((label_org, "textarea"))
                        answer = prev_answer or ""
                else:
                    answer = resolved
                    text_area.clear()
                    text_area.send_keys(answer)
                    if source not in ("existing", "skipped", "unanswered"):
                        question_cache.save_answer(label_org, "textarea", answer, source, company=company)

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
                    question_cache, job_description=job_description, prev_answer=str(prev_answer),
                )
                should_check = resolved is None or str(resolved).lower() in ("yes", "true", "1", "check", "checked")
                if resolved is not None and str(resolved).lower() in ("no", "false", "0", "uncheck"):
                    should_check = False
                if should_check and not prev_answer:
                    try:
                        actions.move_to_element(checkbox).click().perform()
                        checked = True
                        question_cache.save_answer(label_org, "checkbox", str(checked), source if resolved else "keyword", company=company)
                    except Exception as e:
                        print_lg("Checkbox click failed!", e)

            questions_list.add((f'{label_org} ([X] {option_text})', checked, "checkbox", prev_answer, source))
            continue

    try_xp(driver, "//button[contains(@aria-label, 'This is today')]")
    return questions_list, has_unanswered




def external_apply(pagination_element: WebElement, job_id: str, job_link: str, resume: str, date_listed, application_link: str, screenshot_name: str) -> tuple[bool, str, int]:
    '''
    Function to open new tab and save external job application links
    '''
    global tabs_count, dailyEasyApplyLimitReached
    wait_if_bot_paused()
    bot_status(f"Checking external application link for job {job_id}...")
    if easy_apply_only:
        try:
            if "exceeded the daily application limit" in driver.find_element(By.CLASS_NAME, "artdeco-inline-feedback__message").text: dailyEasyApplyLimitReached = True
        except: pass
        bot_status(f"Skipping job {job_id}: Easy Apply did not start.")
        print_lg("Easy apply failed I guess!")
        if pagination_element != None: return True, application_link, tabs_count
    try:
        wait_if_bot_paused()
        bot_status(f"Opening external application for job {job_id}...")
        wait.until(EC.element_to_be_clickable((By.XPATH, ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3')]"))).click() # './/button[contains(span, "Apply") and not(span[contains(@class, "disabled")])]'
        wait_span_click(driver, "Continue", 1, True, False)
        windows = driver.window_handles
        tabs_count = len(windows)
        driver.switch_to.window(windows[-1])
        application_link = driver.current_url
        bot_status(f"Captured external application link for job {job_id}.")
        print_lg('Got the external application link "{}"'.format(application_link))
        if close_tabs and driver.current_window_handle != linkedIn_tab: driver.close()
        driver.switch_to.window(linkedIn_tab)
        return False, application_link, tabs_count
    except Exception as e:
        # print_lg(e)
        bot_status(f"Failed to open external application for job {job_id}.")
        print_lg("Failed to apply!")
        failed_job(job_id, job_link, resume, date_listed, "Probably didn't find Apply button or unable to switch tabs.", e, application_link, screenshot_name)
        global failed_count
        failed_count += 1
        return True, application_link, tabs_count



def follow_company(modal: WebDriver = driver) -> None:
    '''
    Function to follow or un-follow easy applied companies based om `follow_companies`
    '''
    try:
        follow_checkbox_input = try_xp(modal, ".//input[@id='follow-company-checkbox' and @type='checkbox']", False)
        if follow_checkbox_input and follow_checkbox_input.is_selected() != follow_companies:
            try_xp(modal, ".//label[@for='follow-company-checkbox']")
    except Exception as e:
        print_lg("Failed to update follow companies checkbox!", e)
    


#< Failed attempts logging
def failed_job(job_id: str, job_link: str, resume: str, date_listed, error: str, exception: Exception, application_link: str, screenshot_name: str,
               title: str = "Unknown", company: str = "Unknown", search_term: str = "Unknown", work_location: str = "Unknown",
               questions_list: set | None = None, work_style: str = "Unknown") -> None:
    '''
    Function to update failed jobs list in excel
    '''
    try:
        with open(failed_file_name, 'a', newline='', encoding='utf-8') as file:
            fieldnames = ['Job ID', 'Job Link', 'Resume Tried', 'Date listed', 'Date Tried', 'Assumed Reason', 'Stack Trace', 'External Job link', 'Screenshot Name']
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            if file.tell() == 0: writer.writeheader()
            writer.writerow({'Job ID':truncate_for_csv(job_id), 'Job Link':truncate_for_csv(job_link), 'Resume Tried':truncate_for_csv(resume), 'Date listed':truncate_for_csv(date_listed), 'Date Tried':datetime.now(), 'Assumed Reason':truncate_for_csv(error), 'Stack Trace':truncate_for_csv(exception), 'External Job link':truncate_for_csv(application_link), 'Screenshot Name':truncate_for_csv(screenshot_name)})
            file.close()
    except Exception as e:
        print_lg("Failed to update failed jobs list!", e)
        pyautogui.alert("Failed to update the excel of failed jobs!\nProbably because of 1 of the following reasons:\n1. The file is currently open or in use by another program\n2. Permission denied to write to the file\n3. Failed to find the file", "Failed Logging")

    try:
        application_logger.log_application({
            "job_id": job_id,
            "title": title,
            "company": company,
            "job_link": job_link,
            "external_application_link": application_link,
            "application_type": "easy_apply" if application_link == "Easy Applied" else "external",
            "status": "failed",
            "search_term": search_term,
            "work_location": work_location,
            "work_style": work_style,
            "resume": resume,
            "date_posted": str(date_listed),
            "date_applied": None,
            "questions": ApplicationLogger.format_questions(questions_list),
            "screenshot": screenshot_name,
            "error": str(error),
            "stack_trace": str(exception),
        })
    except Exception as e:
        print_lg("Failed to update JSON application log for failed job!", e)


def screenshot(driver: WebDriver, job_id: str, failedAt: str) -> str:
    '''
    Function to to take screenshot for debugging
    - Returns screenshot name as String
    '''
    screenshot_name = "{} - {} - {}.png".format( job_id, failedAt, str(datetime.now()) )
    path = logs_folder_path+"/screenshots/"+screenshot_name.replace(":",".")
    # special_chars = {'*', '"', '\\', '<', '>', ':', '|', '?'}
    # for char in special_chars:  path = path.replace(char, '-')
    driver.save_screenshot(path.replace("//","/"))
    return screenshot_name
#>



def submitted_jobs(job_id: str, title: str, company: str, work_location: str, work_style: str, description: str, experience_required: int | Literal['Unknown', 'Error in extraction'], 
                   skills: list[str] | Literal['In Development'], hr_name: str | Literal['Unknown'], hr_link: str | Literal['Unknown'], resume: str, 
                   reposted: bool, date_listed: datetime | Literal['Unknown'], date_applied:  datetime | Literal['Pending'], job_link: str, application_link: str, 
                   questions_list: set | None, connect_request: Literal['In Development'], search_term: str = "Unknown") -> None:
    '''
    Function to create or update the Applied jobs CSV file, once the application is submitted successfully
    '''
    try:
        with open(file_name, mode='a', newline='', encoding='utf-8') as csv_file:
            fieldnames = ['Job ID', 'Title', 'Company', 'Work Location', 'Work Style', 'About Job', 'Experience required', 'Skills required', 'HR Name', 'HR Link', 'Resume', 'Re-posted', 'Date Posted', 'Date Applied', 'Job Link', 'External Job link', 'Questions Found', 'Connect Request']
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            if csv_file.tell() == 0: writer.writeheader()
            writer.writerow({'Job ID':truncate_for_csv(job_id), 'Title':truncate_for_csv(title), 'Company':truncate_for_csv(company), 'Work Location':truncate_for_csv(work_location), 'Work Style':truncate_for_csv(work_style), 
                            'About Job':truncate_for_csv(description), 'Experience required': truncate_for_csv(experience_required), 'Skills required':truncate_for_csv(skills), 
                                'HR Name':truncate_for_csv(hr_name), 'HR Link':truncate_for_csv(hr_link), 'Resume':truncate_for_csv(resume), 'Re-posted':truncate_for_csv(reposted), 
                                'Date Posted':truncate_for_csv(date_listed), 'Date Applied':truncate_for_csv(date_applied), 'Job Link':truncate_for_csv(job_link), 
                                'External Job link':truncate_for_csv(application_link), 'Questions Found':truncate_for_csv(questions_list), 'Connect Request':truncate_for_csv(connect_request)})
        csv_file.close()
    except Exception as e:
        print_lg("Failed to update submitted jobs list!", e)
        pyautogui.alert("Failed to update the excel of applied jobs!\nProbably because of 1 of the following reasons:\n1. The file is currently open or in use by another program\n2. Permission denied to write to the file\n3. Failed to find the file", "Failed Logging")

    try:
        application_logger.log_application({
            "job_id": job_id,
            "title": title,
            "company": company,
            "job_link": job_link,
            "external_application_link": application_link,
            "application_type": "easy_apply" if application_link == "Easy Applied" else "external",
            "status": "submitted",
            "search_term": search_term,
            "work_location": work_location,
            "work_style": work_style,
            "experience_required": experience_required,
            "skills": skills,
            "description": description,
            "hr_name": hr_name,
            "hr_link": hr_link,
            "resume": resume,
            "reposted": reposted,
            "date_posted": str(date_listed),
            "date_applied": str(date_applied),
            "questions": ApplicationLogger.format_questions(questions_list),
            "connect_request": connect_request,
            "screenshot": None,
            "error": None,
        })
    except Exception as e:
        print_lg("Failed to update JSON application log!", e)



# Function to discard the job application
def discard_job() -> None:
    actions.send_keys(Keys.ESCAPE).perform()
    wait_span_click(driver, 'Discard', 2)






# Function to apply to jobs
def apply_to_jobs(search_terms: list[str]) -> None:
    applied_jobs = get_applied_job_ids()
    rejected_jobs = set()
    blacklisted_companies = set()
    global current_city, failed_count, skip_count, easy_applied_count, external_jobs_count, tabs_count, pause_before_submit, pause_at_failed_question, useNewResume
    current_city = current_city.strip()

    if randomize_search_order:  shuffle(search_terms)
    for searchTerm in search_terms:
        wait_if_bot_paused()
        bot_status(f'Searching LinkedIn jobs for "{searchTerm}"...')
        driver.get(f"https://www.linkedin.com/jobs/search/?keywords={searchTerm}")
        print_lg("\n________________________________________________________________________________________________________________________\n")
        print_lg(f'\n>>>> Now searching for "{searchTerm}" <<<<\n\n')

        apply_filters()

        current_count = 0
        try:
            while current_count < switch_number:
                # Wait until job listings are loaded
                wait_if_bot_paused()
                bot_status(f'Waiting for job listings for "{searchTerm}"...')
                wait.until(EC.presence_of_all_elements_located((By.XPATH, "//li[@data-occludable-job-id]")))

                bot_status("Reading current results page...")
                pagination_element, current_page = get_page_info()

                # Find all job listings in current page
                buffer(3)
                job_listings = driver.find_elements(By.XPATH, "//li[@data-occludable-job-id]")  
                bot_status(f"Found {len(job_listings)} jobs on this page. Reviewing them now.")

            
                for job in job_listings:
                    wait_if_bot_paused()
                    if keep_screen_awake: pyautogui.press('shiftright')
                    if current_count >= switch_number: break
                    print_lg("\n-@-\n")

                    bot_status("Opening the next job card...")
                    job_id,title,company,work_location,work_style,skip = get_job_main_details(job, blacklisted_companies, rejected_jobs)
                    
                    if skip:
                        bot_status(f'Skipping "{title}" at {company}: blacklisted or previously rejected.')
                        continue
                    # Redundant fail safe check for applied jobs!
                    try:
                        if job_id in applied_jobs or find_by_class(driver, "jobs-s-apply__application-link", 2):
                            bot_status(f'Skipping "{title}" at {company}: already applied.')
                            print_lg(f'Already applied to "{title} | {company}" job. Job ID: {job_id}!')
                            continue
                    except Exception as e:
                        bot_status(f'Checking application options for "{title}" at {company}.')
                        print_lg(f'Trying to Apply to "{title} | {company}" job. Job ID: {job_id}')

                    job_link = "https://www.linkedin.com/jobs/view/"+job_id
                    application_link = "Easy Applied"
                    date_applied = "Pending"
                    hr_link = "Unknown"
                    hr_name = "Unknown"
                    connect_request = "In Development" # Still in development
                    date_listed = "Unknown"
                    skills = "Needs an AI" # Still in development
                    resume = "Pending"
                    reposted = False
                    questions_list = None
                    screenshot_name = "Not Available"

                    try:
                        wait_if_bot_paused()
                        bot_status(f'Checking blacklist rules for "{title}" at {company}...')
                        rejected_jobs, blacklisted_companies, jobs_top_card = check_blacklist(rejected_jobs,job_id,company,blacklisted_companies)
                    except ValueError as e:
                        bot_status(f'Skipping "{title}" at {company}: blacklist match.')
                        print_lg(e, 'Skipping this job!\n')
                        failed_job(job_id, job_link, resume, date_listed, "Found Blacklisted words in About Company", e, "Skipped", screenshot_name,
                                   title=title, company=company, search_term=searchTerm, work_location=work_location, work_style=work_style)
                        skip_count += 1
                        continue
                    except Exception as e:
                        bot_status(f'Could not inspect company details for "{title}". Continuing.')
                        print_lg("Failed to scroll to About Company!")
                        # print_lg(e)



                    # Hiring Manager info
                    try:
                        wait_if_bot_paused()
                        bot_status(f'Checking hiring manager info for "{title}"...')
                        hr_info_card = WebDriverWait(driver,2).until(EC.presence_of_element_located((By.CLASS_NAME, "hirer-card__hirer-information")))
                        hr_link = hr_info_card.find_element(By.TAG_NAME, "a").get_attribute("href")
                        hr_name = hr_info_card.find_element(By.TAG_NAME, "span").text
                        # if connect_hr:
                        #     driver.switch_to.new_window('tab')
                        #     driver.get(hr_link)
                        #     wait_span_click("More")
                        #     wait_span_click("Connect")
                        #     wait_span_click("Add a note")
                        #     message_box = driver.find_element(By.XPATH, "//textarea")
                        #     message_box.send_keys(connect_request_message)
                        #     if close_tabs: driver.close()
                        #     driver.switch_to.window(linkedIn_tab) 
                        # def message_hr(hr_info_card):
                        #     if not hr_info_card: return False
                        #     hr_info_card.find_element(By.XPATH, ".//span[normalize-space()='Message']").click()
                        #     message_box = driver.find_element(By.XPATH, "//div[@aria-label='Write a message…']")
                        #     message_box.send_keys()
                        #     try_xp(driver, "//button[normalize-space()='Send']")        
                    except Exception as e:
                        bot_status(f'No hiring manager info found for "{title}".')
                        print_lg(f'HR info was not given for "{title}" with Job ID: {job_id}!')
                        # print_lg(e)


                    # Calculation of date posted
                    try:
                        bot_status(f'Checking posting date for "{title}"...')
                        # try: time_posted_text = find_by_class(driver, "jobs-unified-top-card__posted-date", 2).text
                        # except: 
                        time_posted_text = jobs_top_card.find_element(By.XPATH, './/span[contains(normalize-space(), " ago")]').text
                        print("Time Posted: " + time_posted_text)
                        if time_posted_text.__contains__("Reposted"):
                            reposted = True
                            time_posted_text = time_posted_text.replace("Reposted", "")
                        date_listed = calculate_date_posted(time_posted_text.strip())
                    except Exception as e:
                        bot_status(f'Could not calculate posting date for "{title}".')
                        print_lg("Failed to calculate the date posted!",e)


                    wait_if_bot_paused()
                    bot_status(f'Reading description for "{title}" and checking skip rules...')
                    description, experience_required, skip, reason, message = get_job_description()
                    if skip:
                        bot_status(f'Skipping "{title}" at {company}: {reason}.')
                        print_lg(message)
                        failed_job(job_id, job_link, resume, date_listed, reason, message, "Skipped", screenshot_name,
                                   title=title, company=company, search_term=searchTerm, work_location=work_location, work_style=work_style)
                        rejected_jobs.add(job_id)
                        skip_count += 1
                        continue

                    
                    if use_AI and description != "Unknown":
                        ##> ------ Yang Li : MARKYangL - Feature ------
                        try:
                            wait_if_bot_paused()
                            bot_status(f'Extracting skills with {ai_provider} for "{title}"...')
                            if ai_provider.lower() == "openai":
                                skills = ai_extract_skills(aiClient, description)
                            elif ai_provider.lower() == "deepseek":
                                skills = deepseek_extract_skills(aiClient, description)
                            elif ai_provider.lower() == "gemini":
                                skills = gemini_extract_skills(aiClient, description)
                            else:
                                skills = "In Development"
                            print_lg(f"Extracted skills using {ai_provider} AI")
                        except Exception as e:
                            bot_status(f'Failed to extract skills for "{title}". Continuing.')
                            print_lg("Failed to extract skills:", e)
                            skills = "Error extracting skills"
                        ##<

                    uploaded = False
                    # Case 1: Easy Apply Button
                    # First try the classic button with "Easy" in aria-label
                    wait_if_bot_paused()
                    bot_status(f'Looking for Easy Apply on "{title}"...')
                    is_easy_apply = try_xp(driver, ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3') and contains(@aria-label, 'Easy')]")
                    # Fallback 1: check if apply link contains Easy Apply URL pattern
                    if not is_easy_apply:
                        try:
                            apply_link_el = driver.find_element(By.XPATH, ".//a[contains(@href, 'openSDUIApplyFlow=true')]")
                            if apply_link_el:
                                wait_if_bot_paused()
                                bot_status(f'Opening Easy Apply flow for "{title}"...')
                                apply_link_el.click()
                                is_easy_apply = True
                                print_lg("Detected Easy Apply via URL pattern (openSDUIApplyFlow)")
                        except:
                            pass
                    # Fallback 2: click any Apply button and check if Easy Apply modal appears
                    if not is_easy_apply:
                        try:
                            apply_btn = driver.find_element(By.XPATH, ".//button[contains(@class,'jobs-apply-button')]")
                            if apply_btn:
                                wait_if_bot_paused()
                                bot_status(f'Clicking apply button for "{title}"...')
                                tabs_before = len(driver.window_handles)
                                apply_btn.click()
                                buffer(click_gap)
                                tabs_after = len(driver.window_handles)
                                if tabs_after > tabs_before:
                                    # New tab opened — external apply, close it and go back
                                    driver.switch_to.window(driver.window_handles[-1])
                                    if close_tabs and driver.current_window_handle != linkedIn_tab: driver.close()
                                    driver.switch_to.window(linkedIn_tab)
                                    bot_status(f'Skipping "{title}": external application opened in a new tab.')
                                    print_lg("External apply detected via new tab, skipping")
                                else:
                                    try:
                                        find_by_class(driver, "jobs-easy-apply-modal")
                                        is_easy_apply = True
                                        bot_status(f'Easy Apply modal detected for "{title}".')
                                        print_lg("Detected Easy Apply via modal appearance after click")
                                    except:
                                        # Modal didn't appear — dismiss
                                        try: actions.send_keys(Keys.ESCAPE).perform()
                                        except: pass
                        except:
                            pass
                    if is_easy_apply:
                        try: 
                            try:
                                errored = ""
                                wait_if_bot_paused()
                                bot_status(f'Starting Easy Apply for "{title}" at {company}...')
                                modal = find_by_class(driver, "jobs-easy-apply-modal")
                                wait_span_click(modal, "Next", 1)
                                # if description != "Unknown":
                                #     resume = create_custom_resume(description)
                                resume = "Previous resume"
                                next_button = True
                                questions_list = set()
                                next_counter = 0
                                while next_button:
                                    wait_if_bot_paused()
                                    next_counter += 1
                                    if next_counter >= 15: 
                                        if pause_at_failed_question:
                                            bot_status(f'Manual help needed for "{title}": repeated unanswered questions.')
                                            screenshot(driver, job_id, "Needed manual intervention for failed question")
                                            show_inpage_overlay("Help Needed", "Couldn't answer one or more questions.\nPlease click \"Continue\" once done.\nDO NOT CLICK Back, Next or Review button in LinkedIn.\n\n\n\n\nYou can turn off \"Pause at failed question\" setting in config.py", ["Continue"])
                                            capture_manual_answers(modal, company)
                                            next_counter = 1
                                            continue
                                        if questions_list: print_lg("Stuck for one or some of the following questions...", questions_list)
                                        bot_status(f'Skipping "{title}": stuck on application questions.')
                                        screenshot_name = screenshot(driver, job_id, "Failed at questions")
                                        errored = "stuck"
                                        raise Exception("Seems like stuck in a continuous loop of next, probably because of new questions.")
                                    bot_status(f'Answering application questions for "{title}"...')
                                    questions_list, has_unanswered = answer_questions(modal, questions_list, work_location, job_description=description, company=company)
                                    if has_unanswered:
                                        if pause_at_failed_question:
                                            bot_status(f'Manual help needed for "{title}": unanswered question remains.')
                                            screenshot(driver, job_id, "Needed manual intervention for unanswered question")
                                            show_inpage_overlay("Help Needed", "Couldn't answer one or more questions.\nPlease fill them in, then click \"Continue\".\nDO NOT CLICK Back, Next or Review button in LinkedIn.\n\n\n\n\nYou can turn off \"Pause at failed question\" setting in config.py", ["Continue"])
                                            capture_manual_answers(modal, company)
                                            next_counter = 1
                                            continue
                                        bot_status(f'Unanswered questions remain for "{title}".')
                                        print_lg(f"Unanswered questions remain: {unanswered_questions}")
                                    if useNewResume and not uploaded:
                                        bot_status(f'Uploading resume for "{title}"...')
                                        uploaded, resume = upload_resume(modal, default_resume_path)
                                    try: next_button = modal.find_element(By.XPATH, './/span[normalize-space(.)="Review"]') 
                                    except NoSuchElementException:  next_button = modal.find_element(By.XPATH, './/button[contains(span, "Next")]')
                                    wait_if_bot_paused()
                                    bot_status(f'Moving to the next Easy Apply step for "{title}"...')
                                    try: next_button.click()
                                    except ElementClickInterceptedException: break    # Happens when it tries to click Next button in About Company photos section
                                    buffer(click_gap)

                            except NoSuchElementException: errored = "nose"
                            finally:
                                if questions_list and errored != "stuck": 
                                    print_lg("Answered the following questions...", questions_list)
                                    print("\n\n" + "\n".join(str(question) for question in questions_list) + "\n\n")
                                wait_span_click(driver, "Review", 1, scrollTop=True)
                                cur_pause_before_submit = pause_before_submit
                                if errored != "stuck" and cur_pause_before_submit:
                                    bot_status(f'Waiting for your confirmation before submitting "{title}".')
                                    decision = show_inpage_overlay("Confirm your information", '1. Please verify your information.\n2. If you edited something, please return to this final screen.\n3. DO NOT CLICK "Submit Application" in LinkedIn.\n\n\n\n\nYou can turn off "Pause before submit" setting in config.py\nTo TEMPORARILY disable pausing, click "Disable Pause"', ["Disable Pause", "Discard Application", "Submit Application"])
                                    if decision == "Discard Application": raise Exception("Job application discarded by user!")
                                    pause_before_submit = False if "Disable Pause" == decision else True
                                    # try_xp(modal, ".//span[normalize-space(.)='Review']")
                                wait_if_bot_paused()
                                bot_status(f'Checking follow-company option for "{title}"...')
                                follow_company(modal)
                                wait_if_bot_paused()
                                bot_status(f'Submitting application for "{title}" at {company}...')
                                if wait_span_click(driver, "Submit application", 2, scrollTop=True): 
                                    date_applied = datetime.now()
                                    bot_status(f'Application submitted for "{title}". Closing confirmation dialog...')
                                    if not wait_span_click(driver, "Done", 2): actions.send_keys(Keys.ESCAPE).perform()
                                elif errored != "stuck" and cur_pause_before_submit and "Yes" in show_inpage_overlay("Failed to find Submit Application!", "You submitted the application manually, didn't you?", ["No", "Yes"]):
                                    date_applied = datetime.now()
                                    bot_status(f'Manual submission confirmed for "{title}".')
                                    wait_span_click(driver, "Done", 2)
                                else:
                                    bot_status(f'Failed to submit "{title}". Discarding this application.')
                                    print_lg("Since, Submit Application failed, discarding the job application...")
                                    # if screenshot_name == "Not Available":  screenshot_name = screenshot(driver, job_id, "Failed to click Submit application")
                                    # else:   screenshot_name = [screenshot_name, screenshot(driver, job_id, "Failed to click Submit application")]
                                    if errored == "nose": raise Exception("Failed to click Submit application 😑")


                        except Exception as e:
                            bot_status(f'Failed Easy Apply for "{title}" at {company}. Reason: {e}')
                            print_lg("Failed to Easy apply!")
                            # print_lg(e)
                            critical_error_log("Somewhere in Easy Apply process",e)
                            failed_job(job_id, job_link, resume, date_listed, "Problem in Easy Applying", e, application_link, screenshot_name,
                                       title=title, company=company, search_term=searchTerm, work_location=work_location, work_style=work_style, questions_list=questions_list)
                            failed_count += 1
                            discard_job()
                            continue
                    else:
                        # Case 2: Apply externally
                        wait_if_bot_paused()
                        bot_status(f'No Easy Apply for "{title}". Checking external apply path...')
                        skip, application_link, tabs_count = external_apply(pagination_element, job_id, job_link, resume, date_listed, application_link, screenshot_name)
                        if dailyEasyApplyLimitReached:
                            bot_status("Daily Easy Apply limit reached. Stopping this run.")
                            print_lg("\n###############  Daily application limit for Easy Apply is reached!  ###############\n")
                            return
                        if skip:
                            bot_status(f'Skipping "{title}": no usable application path found.')
                            continue

                    wait_if_bot_paused()
                    bot_status(f'Saving application result for "{title}" at {company}...')
                    submitted_jobs(job_id, title, company, work_location, work_style, description, experience_required, skills, hr_name, hr_link, resume, reposted, date_listed, date_applied, job_link, application_link, questions_list, connect_request, search_term=searchTerm)
                    if uploaded:   useNewResume = False

                    bot_status(f'Finished "{title}" at {company}. Moving to the next job.')
                    print_lg(f'Successfully saved "{title} | {company}" job. Job ID: {job_id} info')
                    current_count += 1
                    if application_link == "Easy Applied": easy_applied_count += 1
                    else:   external_jobs_count += 1
                    applied_jobs.add(job_id)



                # Switching to next page
                if pagination_element == None:
                    bot_status("No more result pages found for this search.")
                    print_lg("Couldn't find pagination element, probably at the end page of results!")
                    break
                try:
                    wait_if_bot_paused()
                    bot_status(f"Moving to results page {current_page+1}...")
                    pagination_element.find_element(By.XPATH, f"//button[@aria-label='Page {current_page+1}']").click()
                    print_lg(f"\n>-> Now on Page {current_page+1} \n")
                except NoSuchElementException:
                    bot_status(f"Could not find results page {current_page+1}. Ending this search.")
                    print_lg(f"\n>-> Didn't find Page {current_page+1}. Probably at the end page of results!\n")
                    break

        except (NoSuchWindowException, WebDriverException) as e:
            print_lg("Browser window closed or session is invalid. Ending application process.", e)
            raise e # Re-raise to be caught by main
        except Exception as e:
            print_lg("Failed to find Job listings!")
            critical_error_log("In Applier", e)
            try:
                print_lg(driver.page_source, pretty=True)
            except Exception as page_source_error:
                print_lg(f"Failed to get page source, browser might have crashed. {page_source_error}")
            # print_lg(e)

        
def run(total_runs: int) -> int:
    if dailyEasyApplyLimitReached:
        return total_runs
    print_lg("\n########################################################################################################################\n")
    print_lg(f"Date and Time: {datetime.now()}")
    print_lg(f"Cycle number: {total_runs}")
    print_lg(f"Currently looking for jobs posted within '{date_posted}' and sorting them by '{sort_by}'")
    apply_to_jobs(search_terms)
    print_lg("########################################################################################################################\n")
    if not dailyEasyApplyLimitReached:
        print_lg("Sleeping for 10 min...")
        sleep(300)
        print_lg("Few more min... Gonna start with in next 5 min...")
        sleep(300)
    buffer(3)
    return total_runs + 1



chatGPT_tab = False
linkedIn_tab = False

def main() -> None:
    total_runs = 99
    try:
        global linkedIn_tab, tabs_count, useNewResume, aiClient
        alert_title = "Error Occurred. Closing Browser!"
        validate_config()
        print_lg(f"Question cache loaded: {question_cache.count} saved answers")
        print_lg(f"Custom question rules: {len(custom_questions)}")
        print_lg(f"Application JSON log: {application_logger.count} records at {applications_json_file}")
        
        if not os.path.exists(default_resume_path):
            pyautogui.alert(text='Your default resume "{}" is missing! Please update it\'s folder path "default_resume_path" in config.py\n\nOR\n\nAdd a resume with exact name and path (check for spelling mistakes including cases).\n\n\nFor now the bot will continue using your previous upload from LinkedIn!'.format(default_resume_path), title="Missing Resume", button="OK")
            useNewResume = False
        
        # Login to LinkedIn
        tabs_count = len(driver.window_handles)
        driver.get("https://www.linkedin.com/login")
        if not is_logged_in_LN(): login_LN()
        
        linkedIn_tab = driver.current_window_handle

        # # Login to ChatGPT in a new tab for resume customization
        # if use_resume_generator:
        #     try:
        #         driver.switch_to.new_window('tab')
        #         driver.get("https://chat.openai.com/")
        #         if not is_logged_in_GPT(): login_GPT()
        #         open_resume_chat()
        #         global chatGPT_tab
        #         chatGPT_tab = driver.current_window_handle
        #     except Exception as e:
        #         print_lg("Opening OpenAI chatGPT tab failed!")
        if use_AI:
            if ai_provider == "openai":
                aiClient = ai_create_openai_client()
            ##> ------ Yang Li : MARKYangL - Feature ------
            # Create DeepSeek client
            elif ai_provider == "deepseek":
                aiClient = deepseek_create_client()
            elif ai_provider == "gemini":
                aiClient = gemini_create_client()
            ##<
            answer_resolver_module.aiClient = aiClient

            try:
                about_company_for_ai = " ".join([word for word in (first_name+" "+last_name).split() if len(word) > 3])
                print_lg(f"Extracted about company info for AI: '{about_company_for_ai}'")
            except Exception as e:
                print_lg("Failed to extract about company info!", e)
        
        # Start applying to jobs
        driver.switch_to.window(linkedIn_tab)
        total_runs = run(total_runs)
        while(run_non_stop):
            if cycle_date_posted:
                date_options = ["Any time", "Past month", "Past week", "Past 24 hours"]
                global date_posted
                date_posted = date_options[date_options.index(date_posted)+1 if date_options.index(date_posted)+1 > len(date_options) else -1] if stop_date_cycle_at_24hr else date_options[0 if date_options.index(date_posted)+1 >= len(date_options) else date_options.index(date_posted)+1]
            if alternate_sortby:
                global sort_by
                sort_by = "Most recent" if sort_by == "Most relevant" else "Most relevant"
                total_runs = run(total_runs)
                sort_by = "Most recent" if sort_by == "Most relevant" else "Most relevant"
            total_runs = run(total_runs)
            if dailyEasyApplyLimitReached:
                break
        

    except (NoSuchWindowException, WebDriverException) as e:
        print_lg("Browser window closed or session is invalid. Exiting.", e)
    except Exception as e:
        critical_error_log("In Applier Main", e)
        pyautogui.alert(e,alert_title)
    finally:
        summary = "Total runs: {}\nJobs Easy Applied: {}\nExternal job links collected: {}\nTotal applied or collected: {}\nFailed jobs: {}\nIrrelevant jobs skipped: {}\n".format(total_runs,easy_applied_count,external_jobs_count,easy_applied_count + external_jobs_count,failed_count,skip_count)
        print_lg(summary)
        print_lg("\n\nTotal runs:                     {}".format(total_runs))
        print_lg("Jobs Easy Applied:              {}".format(easy_applied_count))
        print_lg("External job links collected:   {}".format(external_jobs_count))
        print_lg("                              ----------")
        print_lg("Total applied or collected:     {}".format(easy_applied_count + external_jobs_count))
        print_lg("\nFailed jobs:                    {}".format(failed_count))
        print_lg("Irrelevant jobs skipped:        {}\n".format(skip_count))
        if unanswered_questions:
            print_lg("\n\nUnanswered questions this session:\n  {}  \n\n".format(";\n".join(str(question) for question in unanswered_questions)))
        manual_learned = question_cache.get_session_manual_learned()
        if manual_learned:
            print_lg("\n\nNew questions learned from manual input:\n  {}  \n\n".format(";\n".join(f'{q["label"]} -> {q["answer"]}' for q in manual_learned)))
        quotes = choice([
            "Never quit. You're one step closer than before. - Scott Cheung",
            "All the best with your future interviews, you've got this. - Scott Cheung", 
            "Keep up with the progress. You got this. - Scott Cheung", 
            "If you're tired, learn to take rest but never give up. - Scott Cheung",
            "Success is not final, failure is not fatal, It is the courage to continue that counts. - Winston Churchill (Not a sponsor)",
            "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle. - Christian D. Larson (Not a sponsor)",
            "Every job is a self-portrait of the person who does it. Autograph your work with excellence. - Jessica Guidobono (Not a sponsor)",
            "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. - Steve Jobs (Not a sponsor)",
            "Opportunities don't happen, you create them. - Chris Grosser (Not a sponsor)",
            "The road to success and the road to failure are almost exactly the same. The difference is perseverance. - Colin R. Davis (Not a sponsor)",
            "Obstacles are those frightful things you see when you take your eyes off your goal. - Henry Ford (Not a sponsor)",
            "The only limit to our realization of tomorrow will be our doubts of today. - Franklin D. Roosevelt (Not a sponsor)",
            ])
        sponsors = "Be the first to have your name here!"
        timeSaved = (easy_applied_count * 80) + (external_jobs_count * 20) + (skip_count * 10)
        timeSavedMsg = ""
        if timeSaved > 0:
            timeSaved += 60
            timeSavedMsg = f"In this run, you saved approx {round(timeSaved/60)} mins ({timeSaved} secs), please consider supporting the project."
        msg = f"{quotes}\n\n\n{timeSavedMsg}\nYou can also get your quote and name shown here, or prioritize your bug reports by supporting the project at:\n\nhttps://github.com/sponsors/GodsScion\n\n\nSummary:\n{summary}\n\n\nBest regards,\nScott Cheung\nhttps://www.linkedin.com/in/saivigneshgolla/\n\nTop Sponsors:\n{sponsors}"
        pyautogui.alert(msg, "Exiting..")
        print_lg(msg,"Closing the browser...")
        if tabs_count >= 10:
            msg = "NOTE: IF YOU HAVE MORE THAN 10 TABS OPENED, PLEASE CLOSE OR BOOKMARK THEM!\n\nOr it's highly likely that application will just open browser and not do anything next time!" 
            pyautogui.alert(msg,"Info")
            print_lg("\n"+msg)
        ##> ------ Yang Li : MARKYangL - Feature ------
        if use_AI and aiClient:
            try:
                if ai_provider.lower() == "openai":
                    ai_close_openai_client(aiClient)
                elif ai_provider.lower() == "deepseek":
                    ai_close_openai_client(aiClient)
                elif ai_provider.lower() == "gemini":
                    pass # Gemini client does not need to be closed
                print_lg(f"Closed {ai_provider} AI client.")
            except Exception as e:
                print_lg("Failed to close AI client:", e)
        ##<
        try:
            if driver:
                driver.quit()
        except WebDriverException as e:
            print_lg("Browser already closed.", e)
        except Exception as e: 
            critical_error_log("When quitting...", e)


if __name__ == "__main__":
    main()
