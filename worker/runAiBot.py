import os

import pyautogui


def _dialogs_disabled() -> bool:
    value = os.getenv("AUTO_JOB_DISABLE_PYAUTOGUI_DIALOGS", "1")
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _install_headless_dialog_shims() -> None:
    if not _dialogs_disabled():
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


_install_headless_dialog_shims()

from modules.run_ai_bot import main


if __name__ == "__main__":
    main()
