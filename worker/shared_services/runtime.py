from __future__ import annotations

import os
import ssl

import certifi
import pyautogui

RUNTIME_STATE: dict = {}


def configure_ssl_certificates() -> None:
    cafile = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", cafile)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", cafile)
    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=cafile)


def install_headless_dialog_shims() -> None:
    value = os.getenv("AUTO_JOB_DISABLE_PYAUTOGUI_DIALOGS", "1")
    dialogs_disabled = value.strip().lower() not in {"0", "false", "no", "off"}
    if not dialogs_disabled:
        return

    def silent_alert(text="", title="", button="OK"):
        print(f"[pyautogui.alert suppressed] {title}: {text}")
        return button

    def silent_confirm(text="", title="", buttons=("OK", "Cancel")):
        choices = list(buttons) if buttons else ["OK"]
        selected = choices[-1]
        print(
            f"[pyautogui.confirm suppressed] {title}: {text} -> auto-selected: {selected}"
        )
        return selected

    pyautogui.alert = silent_alert
    pyautogui.confirm = silent_confirm


def bootstrap_runtime() -> None:
    configure_ssl_certificates()
    install_headless_dialog_shims()


def set_runtime_state(values: dict) -> None:
    RUNTIME_STATE.update(values)


def get_runtime_state() -> dict:
    return RUNTIME_STATE


def get_runtime_value(name: str, default=None):
    return RUNTIME_STATE.get(name, default)
