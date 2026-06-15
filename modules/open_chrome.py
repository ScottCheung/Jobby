import os
import re
import ssl
import sys
import subprocess
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

from modules.helpers import get_default_temp_profile, make_directories
from config.settings import run_in_background, stealth_mode, disable_extensions, safe_mode, file_name, failed_file_name, logs_folder_path, generated_resume_path, data_folder_path, question_cache_file, applications_json_file
from config.questions import default_resume_path
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from modules.helpers import find_default_profile_directory, critical_error_log, print_lg
from selenium.common.exceptions import SessionNotCreatedException
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
    if not stealth_mode:
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


def _build_chrome_options(use_uc: bool):
    if use_uc:
        import undetected_chromedriver as uc
        options = uc.ChromeOptions()
    else:
        from selenium.webdriver.chrome.options import Options
        options = Options()
        if stealth_mode:
            _apply_stealth_chrome_args(options)

    if run_in_background:
        options.add_argument("--headless=new")
    if disable_extensions:
        options.add_argument("--disable-extensions")
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
    if stealth_mode:
        _apply_cdp_stealth(driver)
    return driver


def createChromeSession(isRetry: bool = False):
    make_directories([file_name, failed_file_name, logs_folder_path + "/screenshots", default_resume_path, generated_resume_path + "/temp", data_folder_path, question_cache_file, applications_json_file])

    use_uc = _should_use_undetected_chromedriver()
    if use_uc:
        _prepare_undetected_cache()

    options = _build_chrome_options(use_uc)

    print_lg("IF YOU HAVE MORE THAN 10 TABS OPENED, PLEASE CLOSE OR BOOKMARK THEM! Or it's highly likely that application will just open browser and not do anything!")
    profile_dir = find_default_profile_directory()
    if isRetry:
        print_lg("Will login with a guest profile, browsing history will not be saved in the browser!")
    elif profile_dir and not safe_mode:
        options.add_argument(f"--user-data-dir={profile_dir}")
    else:
        print_lg("Logging in with a guest profile, Web history will not be saved!")
        options.add_argument(f"--user-data-dir={get_default_temp_profile()}")

    driver = _create_driver(options, use_uc)
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
        "GitHub: https://github.com/GodsScion/Auto_job_applier_linkedIn\n"
        "Discord: https://discord.gg/fFp7uUzWCY"
    )


try:
    options, driver, actions, wait = None, None, None, None
    options, driver, actions, wait = createChromeSession()
except SessionNotCreatedException as e:
    critical_error_log("Failed to create Chrome Session, retrying with guest profile", e)
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
    exit(1)
