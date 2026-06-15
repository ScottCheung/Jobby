import csv

import pyautogui
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from config.secrets import password, username
from modules.clickers_and_finders import find_by_class, try_linkText, try_xp
from modules.helpers import manual_login_retry, text_input_by_ID


_driver = None
_wait = None
_print_lg = None


def bind_context(driver=None, wait=None, print_func=None) -> None:
    global _driver, _wait, _print_lg
    if driver is not None:
        _driver = driver
    if wait is not None:
        _wait = wait
    if print_func is not None:
        _print_lg = print_func


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def is_logged_in() -> bool:
    if _driver.current_url == "https://www.linkedin.com/feed/":
        return True
    if try_linkText(_driver, "Sign in"):
        return False
    if try_xp(_driver, '//button[@type="submit" and contains(text(), "Sign in")]'):
        return False
    if try_linkText(_driver, "Join now"):
        return False
    _log("Didn't find Sign in link, so assuming user is logged in!")
    return True


def login() -> None:
    _driver.get("https://www.linkedin.com/login")
    if username == "username@example.com" and password == "example_password":
        pyautogui.alert("User did not configure username and password in secrets.py, hence can't login automatically! Please login manually!", "Login Manually", "Okay")
        _log("User did not configure username and password in secrets.py, hence can't login automatically! Please login manually!")
        manual_login_retry(is_logged_in, 2)
        return
    try:
        _wait.until(EC.presence_of_element_located((By.LINK_TEXT, "Forgot password?")))
        try:
            text_input_by_ID(_driver, "username", username, 1)
        except Exception:
            _log("Couldn't find username field.")
        try:
            text_input_by_ID(_driver, "password", password, 1)
        except Exception:
            _log("Couldn't find password field.")
        _driver.find_element(By.XPATH, '//button[@type="submit" and contains(text(), "Sign in")]').click()
    except Exception:
        try:
            profile_button = find_by_class(_driver, "profile__details")
            profile_button.click()
        except Exception:
            _log("Couldn't Login!")

    try:
        _wait.until(EC.url_to_be("https://www.linkedin.com/feed/"))
        _log("Login successful!")
    except Exception:
        _log("Seems like login attempt failed! Possibly due to wrong credentials or already logged in! Try logging in manually!")
        manual_login_retry(is_logged_in, 2)


def get_applied_job_ids(file_name: str) -> set[str]:
    job_ids: set[str] = set()
    try:
        with open(file_name, "r", encoding="utf-8") as file:
            reader = csv.reader(file)
            for row in reader:
                job_ids.add(row[0])
    except FileNotFoundError:
        _log(f"The CSV file '{file_name}' does not exist.")
    return job_ids
