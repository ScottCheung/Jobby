import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
WORKER_ROOT = ROOT / "worker"
API_BASE_URL = os.getenv("AUTO_JOB_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
POLL_SECONDS = float(os.getenv("AUTO_JOB_AGENT_POLL_SECONDS", "1"))
LOG_DIR = ROOT / "storage" / "logs"


def request(method: str, path: str, payload: dict | None = None) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = Request(f"{API_BASE_URL}{path}", data=data, headers=headers, method=method)
    with urlopen(req, timeout=10) as response:
        body = response.read()
        if not body:
            return None
        return json.loads(body.decode("utf-8"))


def update_run(run_id: str, **values: Any) -> dict:
    return request("PUT", f"/api/automation-runs/{run_id}", values)


def latest_run() -> dict | None:
    return request("GET", "/api/automation-runs/latest")


def run_bot(run: dict) -> None:
    run_id = run["id"]
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"host_worker_{run_id}.log"

    with log_path.open("a", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            [sys.executable, str(WORKER_ROOT / "runAiBot.py")],
            cwd=WORKER_ROOT,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
        )
        update_run(
            run_id,
            status="running",
            started_at=datetime.now().isoformat(),
            current_message="Host worker agent started worker/runAiBot.py",
            summary={**(run.get("summary") or {}), "pid": process.pid, "log_path": str(log_path)},
        )
        print(f"Started run {run_id} with pid {process.pid}. Log: {log_path}")

        cancelled = False
        while process.poll() is None:
            time.sleep(POLL_SECONDS)
            try:
                current = request("GET", f"/api/automation-runs/{run_id}")
            except Exception as error:
                print(f"Could not refresh run {run_id}: {error}")
                continue

            try:
                current_status = current.get("status") or "running"
                update_run(
                    run_id,
                    status=current_status,
                    current_message=
                        current.get("current_message")
                        if current_status == "cancel_requested"
                        else "Host worker agent is running Python worker/runAiBot.py",
                    summary={
                        **(current.get("summary") or {}),
                        "pid": process.pid,
                        "log_path": str(log_path),
                        "runner": "host_worker_agent",
                        "heartbeat_at": datetime.now().isoformat(),
                    },
                )
            except Exception as error:
                print(f"Could not heartbeat run {run_id}: {error}")

            if current.get("status") in {"cancel_requested", "cancelled"}:
                cancelled = True
                process.terminate()
                for _ in range(20):
                    if process.poll() is not None:
                        break
                    time.sleep(0.25)
                if process.poll() is None:
                    process.kill()

        return_code = process.poll()
        status = "cancelled" if cancelled else "success" if return_code == 0 else "failed"
        failure_reason = _extract_failure_reason(log_path) if status == "failed" else None
        update_run(
            run_id,
            status=status,
            finished_at=datetime.now().isoformat(),
            current_message={
                "success": "Host worker finished",
                "failed": failure_reason or "Host worker exited with an error",
                "cancelled": "Host worker stopped from user console",
            }[status],
            error_message=None if status in {"success", "cancelled"} else (failure_reason or f"Process exited with code {return_code}"),
            summary={**(run.get("summary") or {}), "return_code": return_code, "log_path": str(log_path)},
        )
        print(f"Finished run {run_id} as {status}.")


def _extract_failure_reason(log_path: Path) -> str | None:
    try:
        text = log_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    for needle in (
        "API data layer is required for worker configuration",
        "API data layer is required for application history",
        "API data layer is required for question cache",
        "API data layer unavailable",
    ):
        if needle in text:
            return needle
    return None


def main() -> None:
    print(f"Host worker agent listening for pending runs at {API_BASE_URL}")
    while True:
        try:
            run = latest_run()
            if run and run.get("status") == "pending":
                run_bot(run)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"API unavailable: {error}")
        except KeyboardInterrupt:
            print("Host worker agent stopped.")
            raise
        except Exception as error:
            print(f"Host worker agent error: {error}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
