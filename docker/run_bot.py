'''
Docker entrypoint wrapper: inject a pyautogui stub so the bot runs without X11/Tkinter.
'''
import os
import sys
import types

os.environ.setdefault("DOCKER", "1")


def _docker_alert(text: str, title: str = "Alert", button: str = "OK") -> str:
    print(f"\n[{title}]\n{text}\n", flush=True)
    return button


def _docker_confirm(text: str = "", title: str | list[str] = "Confirm", buttons: list[str] | None = None) -> str:
    if isinstance(title, list):
        buttons, title = title, "Confirm"
    buttons = buttons or ["OK"]
    print(f"\n[{title}]\n{text}", flush=True)
    choice = buttons[-1]
    print(f"[Docker] Auto-selected: {choice}", flush=True)
    return choice


def _docker_press(*_args, **_kwargs) -> None:
    pass


_mock_pyautogui = types.ModuleType("pyautogui")
_mock_pyautogui.FAILSAFE = False
_mock_pyautogui.alert = _docker_alert
_mock_pyautogui.confirm = _docker_confirm
_mock_pyautogui.press = _docker_press
sys.modules["pyautogui"] = _mock_pyautogui

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from runAiBot import main

if __name__ == "__main__":
    main()
