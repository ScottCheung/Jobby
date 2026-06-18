import argparse
import json
import os
import ssl
import sys
import tempfile
import time
from pathlib import Path

import certifi
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.selenium_manager import SeleniumManager


cafile = certifi.where()
os.environ.setdefault("SSL_CERT_FILE", cafile)
os.environ.setdefault("REQUESTS_CA_BUNDLE", cafile)
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=cafile)

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from modules.seek_job_extractor import extract_seek_job_details, extract_seek_job_details_from_html


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
    print("[seek extractor] Starting Chrome driver...", flush=True)
    started_at = time.time()
    driver_path = _resolve_driver_path()
    last_error = None

    for attempt in range(1, 3):
        profile_dir = tempfile.mkdtemp(prefix="seek_extract_profile_")
        try:
            print(f"[seek extractor] Launch attempt {attempt}...", flush=True)
            service = Service(executable_path=driver_path)
            options = _build_options(headless=headless, user_data_dir=profile_dir)
            driver = webdriver.Chrome(service=service, options=options)
            driver.set_page_load_timeout(20)
            try:
                driver.maximize_window()
            except Exception:
                pass
            print(f"[seek extractor] Chrome driver ready in {time.time() - started_at:.1f}s", flush=True)
            return driver
        except Exception as exc:
            last_error = exc
            print(f"[seek extractor] Launch attempt {attempt} failed: {exc}", flush=True)
            time.sleep(1)

    raise last_error or RuntimeError("Unable to start Chrome driver.")


def _extract_via_http(job_url: str) -> dict | None:
    print("[seek extractor] Trying direct page fetch...", flush=True)
    response = requests.get(
        job_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
            "Accept-Language": "en-AU,en;q=0.9",
        },
        timeout=15,
    )
    response.raise_for_status()
    result = extract_seek_job_details_from_html(response.text, job_url)
    description = str(result.get("job_description") or "")
    if result.get("title") != "Unknown" and len(description) > 800:
        print("[seek extractor] Direct fetch succeeded.", flush=True)
        return result
    print("[seek extractor] Direct fetch incomplete, falling back to browser.", flush=True)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract structured job details from a single SEEK job URL",
    )
    parser.add_argument("--url", required=True, help="Full SEEK job URL")
    parser.add_argument(
        "--keep-open",
        action="store_true",
        help="Keep the browser open after printing extracted data",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run without showing the browser window",
    )
    args = parser.parse_args()

    driver = None
    try:
        result = None
        try:
            result = _extract_via_http(args.url)
        except Exception as exc:
            print(f"[seek extractor] Direct fetch failed: {exc}", flush=True)

        if result is None:
            driver = _create_driver(headless=args.headless)
            print("[seek extractor] Opening job page...", flush=True)
            result = extract_seek_job_details(driver, args.url)
        print("[seek extractor] Extraction finished.", flush=True)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.keep_open:
            input("\nPress Enter to close the browser...")
    except Exception as exc:
        print(f"[seek extractor] Failed: {exc}", file=sys.stderr, flush=True)
        raise
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    main()
