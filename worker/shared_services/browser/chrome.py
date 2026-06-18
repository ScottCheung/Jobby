import os
import re
import ssl
import sys
import subprocess
import pathlib
import certifi

def _configure_ssl_certificates() -> None:
    '''
    macOS Python.org installs often lack CA certificates, which breaks
    undetected_chromedriver's HTTPS downloads (urllib SSL verify fails).
    '''
    cafile = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", cafile)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", cafile)
    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=cafile)

_configure_ssl_certificates()

from shared_services.utils.helpers import get_default_temp_profile, make_directories
from shared_services.runtime import get_runtime_value
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from shared_services.utils.helpers import find_default_profile_directory, critical_error_log, print_lg
from selenium.common.exceptions import SessionNotCreatedException, WebDriverException
from urllib.error import URLError

UC_CACHE_DIR = os.path.expanduser("~/Library/Application Support/undetected_chromedriver")


def _is_apple_silicon() -> bool:
    import platform
    return sys.platform == "darwin" and platform.machine().lower() in ("arm64", "aarch64")


def _rosetta_installed() -> bool:
    if not _is_apple_silicon():
        return True
    try:
        return subprocess.run(["pgrep", "-q", "oahd"], check=False).returncode == 0
    except Exception:
        return False


def _binary_arch(path: str) -> str | None:
    if not os.path.isfile(path):
        return None
    try:
        output = subprocess.run(
            ["file", "-b", path],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        ).stdout.lower()
        if "arm64" in output:
            return "arm64"
        if "x86_64" in output:
            return "x86_64"
    except Exception:
        pass
    return None


def _get_chrome_version_main() -> int | None:
    chrome_paths = []
    if sys.platform == "darwin":
        chrome_paths.append("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    elif sys.platform.startswith("linux"):
        chrome_paths.extend(["/usr/bin/google-chrome", "/usr/bin/chromium-browser"])
    elif sys.platform.startswith("win"):
        chrome_paths.append(os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"))

    for chrome_path in chrome_paths:
        if not os.path.isfile(chrome_path):
            continue
        try:
            output = subprocess.run(
                [chrome_path, "--version"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            ).stdout
            match = re.search(r"(\d+)\.", output)
            if match:
                return int(match.group(1))
        except Exception:
            continue
    return None


def _apply_stealth_chrome_args(options) -> None:
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)


def _apply_cdp_stealth(driver) -> None:
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """
    })


def _should_use_undetected_chromedriver() -> bool:
    if not bool(get_runtime_value("stealth_mode", True)):
        return False
    if sys.platform == "darwin":
        print_lg(
            "macOS detected. Using standard Selenium startup for stability; "
            "undetected_chromedriver is being skipped because it can hang before LinkedIn opens."
        )
        return False
    if _is_apple_silicon() and not _rosetta_installed():
        print_lg(
            "Apple Silicon detected without Rosetta 2. "
            "Falling back to Selenium stealth mode (install Rosetta for stronger protection):\n"
            "  softwareupdate --install-rosetta --agree-to-license"
        )
        return False
    return True


def _prepare_undetected_cache() -> None:
    cached_driver = os.path.join(UC_CACHE_DIR, "undetected_chromedriver")
    arch = _binary_arch(cached_driver)
    if arch == "x86_64" and _is_apple_silicon() and not _rosetta_installed():
        print_lg("Removing incompatible Intel ChromeDriver cache for Apple Silicon...")
        import shutil
        shutil.rmtree(UC_CACHE_DIR, ignore_errors=True)


def _is_dedicated_bot_profile(profile_dir: str | None) -> bool:
    if not profile_dir:
        return False
    return pathlib.Path(profile_dir).name == "auto-job-apply-profile"


def _cleanup_profile_locks(profile_dir: str | None) -> None:
    if not _is_dedicated_bot_profile(profile_dir):
        return
    lock_names = [
        "SingletonCookie",
        "SingletonLock",
        "SingletonSocket",
        "RunningChromeVersion",
    ]
    for lock_name in lock_names:
        lock_path = os.path.join(profile_dir, lock_name)
        try:
            if os.path.lexists(lock_path):
                os.unlink(lock_path)
        except Exception as error:
            print_lg(f"Failed to remove stale Chrome profile lock {lock_path}", error)


def _build_chrome_options(use_uc: bool):
    if use_uc:
        import undetected_chromedriver as uc
        options = uc.ChromeOptions()
    else:
        from selenium.webdriver.chrome.options import Options
        options = Options()
        if bool(get_runtime_value("stealth_mode", True)):
            _apply_stealth_chrome_args(options)

    if bool(get_runtime_value("run_in_background", False)):
        options.add_argument("--headless=new")
    if bool(get_runtime_value("disable_extensions", False)):
        options.add_argument("--disable-extensions")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-features=DialMediaRouteProvider,OptimizationGuideModelDownloading,SidePanelPinning")
    if os.environ.get("DOCKER"):
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")

    return options


def _create_driver(options, use_uc: bool):
    if use_uc:
        import undetected_chromedriver as uc
        print_lg("Starting Chrome in undetected mode...")
        version_main = _get_chrome_version_main()
        kwargs = {"options": options}
        if version_main:
            kwargs["version_main"] = version_main
        return uc.Chrome(**kwargs)

    from selenium import webdriver
    print_lg("Starting Chrome with Selenium anti-detection options...")
    driver = webdriver.Chrome(options=options)
    if bool(get_runtime_value("stealth_mode", True)):
        _apply_cdp_stealth(driver)
    return driver


def _should_fallback_to_selenium(error: Exception) -> bool:
    if not _should_use_undetected_chromedriver():
        return False
    if isinstance(error, (SessionNotCreatedException, WebDriverException, ConnectionError, TimeoutError)):
        return True
    message = str(error).lower()
    fallback_markers = [
        "cannot connect to chrome",
        "chrome not reachable",
        "session not created",
        "unable to discover open pages",
    ]
    return any(marker in message for marker in fallback_markers)


def createChromeSession(isRetry: bool = False):
    file_name = str(get_runtime_value("file_name", "worker/log/applications.csv"))
    failed_file_name = str(get_runtime_value("failed_file_name", "worker/log/failed.csv"))
    logs_folder_path = str(get_runtime_value("logs_folder_path", "worker/log"))
    default_resume_path = str(get_runtime_value("default_resume_path", "worker/all resumes/default/resume.pdf"))
    generated_resume_path = str(get_runtime_value("generated_resume_path", "worker/all resumes"))
    data_folder_path = str(get_runtime_value("data_folder_path", "worker/data"))
    question_cache_file = str(get_runtime_value("question_cache_file", "worker/data/question_cache.json"))
    applications_json_file = str(get_runtime_value("applications_json_file", "worker/data/applications.json"))
    make_directories([file_name, failed_file_name, logs_folder_path + "/screenshots", default_resume_path, generated_resume_path + "/temp", data_folder_path, question_cache_file, applications_json_file])

    use_uc = _should_use_undetected_chromedriver()
    if use_uc:
        _prepare_undetected_cache()

    options = _build_chrome_options(use_uc)

    profile_dir = None
    if not bool(get_runtime_value("safe_mode", True)):
        profile_dir = find_default_profile_directory()
    if profile_dir:
        print_lg(f"Using existing dedicated bot profile for LinkedIn session: {profile_dir}")
        _cleanup_profile_locks(profile_dir)
        options.add_argument(f"--user-data-dir={profile_dir}")
    else:
        profile_dir = get_default_temp_profile()
        print_lg(f"Using persistent dedicated bot profile: {profile_dir}")
        _cleanup_profile_locks(profile_dir)
        options.add_argument(f"--user-data-dir={profile_dir}")

    try:
        driver = _create_driver(options, use_uc)
    except Exception as error:
        if use_uc and _should_fallback_to_selenium(error):
            print_lg("Undetected Chrome startup failed. Falling back to standard Selenium mode...")
            options = _build_chrome_options(False)
            if profile_dir and not bool(get_runtime_value("safe_mode", True)):
                print_lg(f"Using existing dedicated bot profile for LinkedIn session: {profile_dir}")
                _cleanup_profile_locks(profile_dir)
                options.add_argument(f"--user-data-dir={profile_dir}")
            else:
                profile_dir = get_default_temp_profile()
                print_lg(f"Using persistent dedicated bot profile: {profile_dir}")
                _cleanup_profile_locks(profile_dir)
                options.add_argument(f"--user-data-dir={profile_dir}")
            driver = _create_driver(options, False)
        else:
            raise
    try:
        driver.maximize_window()
    except Exception:
        pass
    wait = WebDriverWait(driver, 5)
    actions = ActionChains(driver)
    return options, driver, actions, wait


def _format_chrome_startup_error(error: Exception) -> str:
    if isinstance(error, TimeoutError):
        return "Couldn't download ChromeDriver. Check your network, or set stealth_mode = False in config/settings.py."

    if isinstance(error, (ssl.SSLCertVerificationError, URLError)) and "CERTIFICATE_VERIFY_FAILED" in str(error):
        return (
            "SSL certificate verification failed while downloading ChromeDriver.\n\n"
            "On macOS, run:\n"
            "  /Applications/Python 3.12/Install Certificates.command\n\n"
            "Or set stealth_mode = False in config/settings.py to use standard Selenium."
        )

    if isinstance(error, OSError) and getattr(error, "errno", None) == 86:
        return (
            "ChromeDriver CPU architecture mismatch on Apple Silicon.\n\n"
            "For best stealth on Mac, install Rosetta 2:\n"
            "  softwareupdate --install-rosetta --agree-to-license\n\n"
            "Then delete the cached driver and retry:\n"
            f"  rm -rf '{UC_CACHE_DIR}'\n\n"
            "Or set stealth_mode = False in config/settings.py."
        )

    return (
        "Failed to start Chrome. Update Google Chrome and retry.\n\n"
        "If issue persists, try safe_mode = True in config/settings.py\n\n"
        "Linkedin: https://www.linkedin.com/in/scottcheung1110/\n"
        "Email: scott5443003@gmail.com"
    )


options, driver, actions, wait = None, None, None, None


def initialize_chrome_session():
    global options, driver, actions, wait
    try:
        options, driver, actions, wait = createChromeSession()
    except SessionNotCreatedException as e:
        critical_error_log("Failed to create Chrome Session, retrying with the same persistent profile", e)
        options, driver, actions, wait = createChromeSession(True)
    except Exception as e:
        msg = _format_chrome_startup_error(e)
        print_lg(msg)
        critical_error_log("In Opening Chrome", e)
        from pyautogui import alert
        alert(msg, "Error in opening chrome")
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        raise
    return options, driver, actions, wait
