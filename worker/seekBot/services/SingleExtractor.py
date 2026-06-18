from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.selenium_manager import SeleniumManager

ROOT = next(
    (parent for parent in Path(__file__).resolve().parents if (parent / "worker").is_dir()),
    Path(__file__).resolve().parents[3],
)
sys.path.append(str(ROOT / "worker"))

from seekBot.services.extractor import (
    extract_seek_job_details,
    extract_seek_job_details_from_html,
)


def _resolve_driver_path() -> str:
    paths = SeleniumManager().binary_paths(["--browser", "chrome"])
    driver_path = str(paths.get("driver_path") or "").strip()
    if not driver_path:
        raise RuntimeError("Unable to resolve local chromedriver path.")
    return driver_path


def _build_options(headless: bool, user_data_dir: str) -> Options:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--disable-sync")
    options.add_argument("--metrics-recording-only")
    options.add_argument("--mute-audio")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,1200")
    options.page_load_strategy = "eager"
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    return options


def _create_driver(headless: bool = False):
    import tempfile

    driver_path = _resolve_driver_path()
    last_error = None

    for _attempt in range(1, 3):
        profile_dir = tempfile.mkdtemp(prefix="seek_extract_profile_")
        try:
            service = Service(executable_path=driver_path)
            options = _build_options(headless=headless, user_data_dir=profile_dir)
            driver = webdriver.Chrome(service=service, options=options)
            driver.set_page_load_timeout(20)
            try:
                driver.maximize_window()
            except Exception:
                pass
            return driver
        except Exception as exc:
            last_error = exc
            time.sleep(1)

    raise last_error or RuntimeError("Unable to start Chrome driver.")


def extract_job(url: str, headless: bool = False) -> dict:
    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
                "Accept-Language": "en-AU,en;q=0.9",
            },
            timeout=15,
        )
        response.raise_for_status()
        result = extract_seek_job_details_from_html(response.text, url)
        description = str(result.get("job_description") or "")
        if result.get("title") != "Unknown" and len(description) > 800:
            return result
    except Exception:
        pass

    driver = None
    try:
        driver = _create_driver(headless=headless)
        return extract_seek_job_details(driver, url)
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Extract structured job details from a SEEK job URL.")
    parser.add_argument("--url", required=True, help="Full SEEK job URL")
    parser.add_argument("--headless", action="store_true", help="Run without showing the browser window")
    args = parser.parse_args()
    print(json.dumps(extract_job(args.url, headless=args.headless), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
