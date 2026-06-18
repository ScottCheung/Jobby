

# Imports
import os
import csv
import time
import signal
import atexit
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
from selenium.common.exceptions import NoSuchElementException, ElementClickInterceptedException, NoSuchWindowException, WebDriverException

from config.personals import *
from config.questions import *
from config.search import *
from config.secrets import use_AI, username, password, ai_provider
from config.settings import *

import modules.open_chrome as open_chrome
from modules.open_chrome import *
from modules.helpers import *
import modules.linkedin.linkedin_status as linkedin_status
from modules.linkedin.linkedin_status import *
import modules.linkedin.linkedin_auth as linkedin_auth
import modules.linkedin.linkedin_filters as linkedin_filters
import modules.linkedin.linkedin_job_details as linkedin_job_details
import modules.linkedin.linkedin_apply as linkedin_apply
import modules.linkedin.linkedin_jobs as linkedin_jobs
import modules.linkedin.linkedin_flow as linkedin_flow
import modules.linkedin.linkedin_runtime as linkedin_runtime
original_buffer = buffer
_print_lg = print_lg
STATUS_WIDGET_VERSION = linkedin_status.WIDGET_VERSION
driver = None
actions = None
wait = None
options = None
linkedin_status.bind_context(driver, actions)

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
            sync_status_widget(driver)
    except Exception:
        pass

from modules.clickers_and_finders import *
from modules.validator import validate_config
from modules.persistence import QuestionCache, ApplicationLogger, resolve_answer, match_option_in_list
from modules.persistence import answer_resolver as answer_resolver_module
from modules.persistence.worker_config import apply_api_worker_config
from config.custom_questions import custom_questions

unanswered_questions = set()
question_cache = QuestionCache()
application_logger = ApplicationLogger()
apply_api_worker_config(globals())

linkedin_auth.bind_context(driver, wait, print_lg)
linkedin_filters.bind_context(driver, actions, wait, buffer, print_lg)
linkedin_job_details.bind_context(driver, print_lg)
linkedin_apply.bind_context(driver, actions, question_cache, print_lg, unanswered_questions)
linkedin_jobs.bind_context(driver, actions, buffer, print_lg, None)
linkedin_flow.bind_context(driver, actions, wait, print_lg, application_logger)
linkedin_jobs.bind_context(discard_job_func=linkedin_flow.discard_job)
linkedin_runtime.bind_context(driver, print_lg, buffer, sleep)

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

tabs_count = 1
easy_applied_count = 0
external_jobs_count = 0
failed_count = 0
skip_count = 0
dailyEasyApplyLimitReached = False

def sync_stats_to_status() -> None:
    update_bot_stats(
        submitted=easy_applied_count + external_jobs_count,
        skipped=skip_count,
        failed=failed_count
    )

def _as_float(value, default: float = 0.0) -> float:
    if value in ("", None):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value, default: int = 0) -> int:
    if value in ("", None):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


desired_salary_number = _as_float(desired_salary)
desired_salary_lakhs = str(round(desired_salary_number / 100000, 2))
desired_salary_monthly = str(round(desired_salary_number / 12, 2))
desired_salary = str(int(desired_salary_number) if desired_salary_number.is_integer() else desired_salary_number)

current_ctc_number = _as_float(current_ctc)
current_ctc_lakhs = str(round(current_ctc_number / 100000, 2))
current_ctc_monthly = str(round(current_ctc_number / 12, 2))
current_ctc = str(int(current_ctc_number) if current_ctc_number.is_integer() else current_ctc_number)

notice_period_number = _as_int(notice_period)
notice_period_months = str(notice_period_number // 30)
notice_period_weeks = str(notice_period_number // 7)
notice_period = str(notice_period_number)

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


def get_applied_job_ids() -> set[str]:
    '''
    Function to get a `set` of applied job's Job IDs
    * Returns a set of Job IDs from existing applied jobs history csv file
    '''
    return linkedin_auth.get_applied_job_ids(file_name)






# Function to apply to jobs
def apply_to_jobs(search_terms: list[str]) -> None:
    applied_jobs = get_applied_job_ids()
    rejected_jobs = set()
    blacklisted_companies = set()
    global current_city, failed_count, skip_count, easy_applied_count, external_jobs_count, tabs_count
    global pause_before_submit, pause_at_failed_question, useNewResume, dailyEasyApplyLimitReached
    linkedin_apply.bind_context(driver, actions, question_cache, print_lg, unanswered_questions)
    linkedin_flow.set_runtime_state(linkedin_tab=linkedIn_tab, tabs_count=tabs_count, daily_easy_apply_limit_reached=dailyEasyApplyLimitReached)
    current_city = current_city.strip()

    if randomize_search_order:  shuffle(search_terms)
    for searchTerm in search_terms:
        wait_if_bot_paused()
        bot_status(f'Searching LinkedIn jobs for "{searchTerm}"...')
        driver.get(f"https://www.linkedin.com/jobs/search/?keywords={searchTerm}")
        print_lg("\n________________________________________________________________________________________________________________________\n")
        print_lg(f'\n>>>> Now searching for "{searchTerm}" <<<<\n\n')

        linkedin_filters.set_runtime_filter_values(sort_by, date_posted)
        linkedin_filters.apply_filters(linkedin_apply.show_inpage_overlay)

        current_count = 0
        try:
            while current_count < switch_number:
                # Wait until job listings are loaded
                wait_if_bot_paused()
                bot_status(f'Waiting for job listings for "{searchTerm}"...')
                wait.until(EC.presence_of_all_elements_located((By.XPATH, "//li[@data-occludable-job-id]")))

                bot_status("Reading current results page...")
                pagination_element, current_page = linkedin_filters.get_page_info()

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
                    job_id,title,company,work_location,work_style,skip = linkedin_jobs.get_job_main_details(job, blacklisted_companies, rejected_jobs)
                    
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
                        rejected_jobs, blacklisted_companies, jobs_top_card = linkedin_jobs.check_blacklist(rejected_jobs,job_id,company,blacklisted_companies)
                    except ValueError as e:
                        bot_status(f'Skipping "{title}" at {company}: blacklist match.')
                        print_lg(e, 'Skipping this job!\n')
                        linkedin_flow.failed_job(job_id, job_link, resume, date_listed, "Found Blacklisted words in About Company", e, "Skipped", screenshot_name,
                                                 title=title, company=company, search_term=searchTerm, work_location=work_location, work_style=work_style)
                        skip_count += 1
                        sync_stats_to_status()
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
                    description, experience_required, skip, reason, message = linkedin_job_details.get_job_description()
                    if skip:
                        bot_status(f'Skipping "{title}" at {company}: {reason}.')
                        print_lg(message)
                        linkedin_flow.failed_job(job_id, job_link, resume, date_listed, reason, message, "Skipped", screenshot_name,
                                                 title=title, company=company, search_term=searchTerm, work_location=work_location, work_style=work_style,
                                                 description=description)
                        rejected_jobs.add(job_id)
                        skip_count += 1
                        sync_stats_to_status()
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
                                            linkedin_flow.screenshot(job_id, "Needed manual intervention for failed question")
                                            linkedin_apply.show_inpage_overlay("Help Needed", "Couldn't answer one or more questions.\nPlease click \"Continue\" once done.\nDO NOT CLICK Back, Next or Review button in LinkedIn.\n\n\n\n\nYou can turn off \"Pause at failed question\" setting in config.py", ["Continue"])
                                            linkedin_apply.capture_manual_answers(modal, company)
                                            next_counter = 1
                                            continue
                                        if questions_list: print_lg("Stuck for one or some of the following questions...", questions_list)
                                        bot_status(f'Skipping "{title}": stuck on application questions.')
                                        screenshot_name = linkedin_flow.screenshot(job_id, "Failed at questions")
                                        errored = "stuck"
                                        raise Exception("Seems like stuck in a continuous loop of next, probably because of new questions.")
                                    bot_status(f'Answering application questions for "{title}"...')
                                    questions_list, has_unanswered = linkedin_apply.answer_questions(modal, questions_list, work_location, job_description=description, company=company)
                                    if has_unanswered:
                                        if pause_at_failed_question:
                                            bot_status(f'Manual help needed for "{title}": unanswered question remains.')
                                            linkedin_flow.screenshot(job_id, "Needed manual intervention for unanswered question")
                                            linkedin_apply.show_inpage_overlay("Help Needed", "Couldn't answer one or more questions.\nPlease fill them in, then click \"Continue\".\nDO NOT CLICK Back, Next or Review button in LinkedIn.\n\n\n\n\nYou can turn off \"Pause at failed question\" setting in config.py", ["Continue"])
                                            linkedin_apply.capture_manual_answers(modal, company)
                                            next_counter = 1
                                            continue
                                        bot_status(f'Unanswered questions remain for "{title}".')
                                        print_lg(f"Unanswered questions remain: {unanswered_questions}")
                                    if useNewResume and not uploaded:
                                        bot_status(f'Uploading resume for "{title}"...')
                                        uploaded, resume = linkedin_job_details.upload_resume(modal, default_resume_path)
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
                                    decision = linkedin_apply.show_inpage_overlay("Confirm your information", '1. Please verify your information.\n2. If you edited something, please return to this final screen.\n3. DO NOT CLICK "Submit Application" in LinkedIn.\n\n\n\n\nYou can turn off "Pause before submit" setting in config.py\nTo TEMPORARILY disable pausing, click "Disable Pause"', ["Disable Pause", "Discard Application", "Submit Application"])
                                    if decision == "Discard Application": raise Exception("Job application discarded by user!")
                                    pause_before_submit = False if "Disable Pause" == decision else True
                                    # try_xp(modal, ".//span[normalize-space(.)='Review']")
                                wait_if_bot_paused()
                                bot_status(f'Checking follow-company option for "{title}"...')
                                linkedin_jobs.follow_company(modal)
                                wait_if_bot_paused()
                                bot_status(f'Submitting application for "{title}" at {company}...')
                                if wait_span_click(driver, "Submit application", 2, scrollTop=True): 
                                    date_applied = datetime.now()
                                    bot_status(f'Application submitted for "{title}". Closing confirmation dialog...')
                                    if not wait_span_click(driver, "Done", 2): actions.send_keys(Keys.ESCAPE).perform()
                                elif errored != "stuck" and cur_pause_before_submit and "Yes" in linkedin_apply.show_inpage_overlay("Failed to find Submit Application!", "You submitted the application manually, didn't you?", ["No", "Yes"]):
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
                            linkedin_flow.failed_job(job_id, job_link, resume, date_listed, "Problem in Easy Applying", e, application_link, screenshot_name,
                                                     title=title, company=company, search_term=searchTerm, work_location=work_location, work_style=work_style,
                                                     questions_list=questions_list, description=description)
                            failed_count += 1
                            sync_stats_to_status()
                            linkedin_flow.discard_job()
                            continue
                    else:
                        # Case 2: Apply externally
                        wait_if_bot_paused()
                        bot_status(f'No Easy Apply for "{title}". Checking external apply path...')
                        skip, application_link, tabs_count, dailyEasyApplyLimitReached = linkedin_flow.external_apply(pagination_element, job_id, job_link, resume, date_listed, application_link, screenshot_name)
                        if dailyEasyApplyLimitReached:
                            bot_status("Daily Easy Apply limit reached. Stopping this run.")
                            print_lg("\n###############  Daily application limit for Easy Apply is reached!  ###############\n")
                            return
                        if skip:
                            bot_status(f'Skipping "{title}": no usable application path found.')
                            continue

                    wait_if_bot_paused()
                    bot_status(f'Saving application result for "{title}" at {company}...')
                    linkedin_flow.submitted_jobs(job_id, title, company, work_location, work_style, description, experience_required, skills, hr_name, hr_link, resume, reposted, date_listed, date_applied, job_link, application_link, questions_list, connect_request, search_term=searchTerm)
                    if uploaded:   useNewResume = False

                    bot_status(f'Finished "{title}" at {company}. Moving to the next job.')
                    print_lg(f'Successfully saved "{title} | {company}" job. Job ID: {job_id} info')
                    current_count += 1
                    if application_link == "Easy Applied": easy_applied_count += 1
                    else:   external_jobs_count += 1
                    sync_stats_to_status()
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
    return linkedin_runtime.run_cycle(total_runs, dailyEasyApplyLimitReached, date_posted, sort_by, search_terms, apply_to_jobs)



chatGPT_tab = False
linkedIn_tab = False


def _shutdown_browser(*_args) -> None:
    try:
        linkedin_runtime.close_driver()
    except Exception as error:
        critical_error_log("When quitting...", error)


def _handle_termination(signum, frame) -> None:
    _shutdown_browser()
    raise KeyboardInterrupt


atexit.register(_shutdown_browser)

for _sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(_sig, _handle_termination)
    except Exception:
        pass

def main() -> None:
    total_runs = 99
    interrupted = False
    bot_status("Starting LinkedIn automation...", status="starting")
    try:
        global linkedIn_tab, tabs_count, useNewResume, aiClient, driver, actions, wait, options
        alert_title = "Error Occurred. Closing Browser!"
        options, driver, actions, wait = open_chrome.initialize_chrome_session()
        linkedin_status.bind_context(driver, actions)
        linkedin_auth.bind_context(driver, wait, print_lg)
        linkedin_filters.bind_context(driver, actions, wait, buffer, print_lg)
        linkedin_job_details.bind_context(driver, print_lg)
        linkedin_apply.bind_context(driver, actions, question_cache, print_lg, unanswered_questions)
        linkedin_jobs.bind_context(driver, actions, buffer, print_lg, None)
        linkedin_flow.bind_context(driver, actions, wait, print_lg, application_logger)
        linkedin_jobs.bind_context(discard_job_func=linkedin_flow.discard_job)
        linkedin_runtime.bind_context(driver, print_lg, buffer, sleep)
        validate_config()
        print_lg(f"Question cache loaded: {question_cache.count} saved answers")
        print_lg(f"Custom question rules: {len(custom_questions)}")
        print_lg(f"Application JSON log: {application_logger.count} records at {applications_json_file}")
        
        if not os.path.exists(default_resume_path):
            pyautogui.alert(text='Your default resume "{}" is missing! Please update it\'s folder path "default_resume_path" in config.py\n\nOR\n\nAdd a resume with exact name and path (check for spelling mistakes including cases).\n\n\nFor now the bot will continue using your previous upload from LinkedIn!'.format(default_resume_path), title="Missing Resume", button="OK")
            useNewResume = False
        
        # Login to LinkedIn
        print_lg("Opening LinkedIn login page...")
        tabs_count = len(driver.window_handles)
        driver.get("https://www.linkedin.com/login")
        print_lg(f"Current page after startup: {driver.current_url}")
        if not linkedin_auth.is_logged_in():
            print_lg("LinkedIn session not detected. Starting login flow...")
            linkedin_auth.login()
        else:
            print_lg("LinkedIn session already available.")

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
                global date_posted
                date_posted = linkedin_runtime.advance_date_posted(date_posted, stop_date_cycle_at_24hr)
            if alternate_sortby:
                global sort_by
                sort_by = linkedin_runtime.toggle_sort(sort_by)
                total_runs = run(total_runs)
                sort_by = linkedin_runtime.toggle_sort(sort_by)
            total_runs = run(total_runs)
            if dailyEasyApplyLimitReached:
                break
        

    except KeyboardInterrupt:
        interrupted = True
        print_lg("Interrupted by user. Closing browser...")
        bot_status("Interrupted by user.", status="cancelled")
    except (NoSuchWindowException, WebDriverException) as e:
        print_lg("Browser window closed or session is invalid. Exiting.", e)
        bot_status("Browser closed or invalid session.", status="failed")
    except Exception as e:
        critical_error_log("In Applier Main", e)
        bot_status(f"Fatal error: {str(e)}", status="failed")
        pyautogui.alert(e,alert_title)
    finally:
        if not interrupted:
            manual_learned = question_cache.get_session_manual_learned()
            linkedin_runtime.show_final_summary(total_runs, easy_applied_count, external_jobs_count, failed_count, skip_count, unanswered_questions, manual_learned, tabs_count)
            bot_status("LinkedIn automation completed.", status="success")
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
        _shutdown_browser()


if __name__ == "__main__":
    main()
