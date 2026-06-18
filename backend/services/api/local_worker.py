import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from services.shared.models import AutomationRun, User


ROOT = Path(__file__).resolve().parents[3]
WORKER_ROOT = ROOT / "worker"
LOG_DIR = ROOT / "storage" / "logs"

_current_process: subprocess.Popen | None = None
_current_run_id: UUID | None = None
_lock = threading.Lock()
HEARTBEAT_SECONDS = 1.0


def is_worker_running() -> bool:
    with _lock:
        return _current_process is not None and _current_process.poll() is None


def get_current_run_id() -> UUID | None:
    with _lock:
        return _current_run_id


def sync_current_worker_state(db: Session) -> None:
    with _lock:
        process = _current_process
        run_id = _current_run_id

    if process is None or run_id is None:
        return

    return_code = process.poll()
    if return_code is None:
        return

    _finalize_run(db, run_id, return_code)
    with _lock:
        if _current_process is process:
            _clear_current_worker()


def start_local_worker(db: Session, user: User) -> AutomationRun:
    global _current_process, _current_run_id

    with _lock:
        if _current_process is not None and _current_process.poll() is None:
            raise RuntimeError("Local worker is already running")

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        run = AutomationRun(
            user_id=user.id,
            status="running",
            started_at=datetime.now(),
            current_message="Local worker process started",
            summary={},
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        log_path = LOG_DIR / f"local_worker_{run.id}.log"
        log_file = log_path.open("a", encoding="utf-8")
        process = subprocess.Popen(
            [sys.executable, str(WORKER_ROOT / "main.py"), "--bot", "linkedin"],
            cwd=WORKER_ROOT,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
        )

        _current_process = process
        _current_run_id = run.id

        heartbeat = threading.Thread(
            target=_heartbeat_worker,
            args=(process, run.id, process.pid, str(log_path)),
            daemon=True,
        )
        heartbeat.start()
        watcher = threading.Thread(target=_watch_worker, args=(process, run.id, log_file), daemon=True)
        watcher.start()

        run.summary = {"pid": process.pid, "log_path": str(log_path)}
        db.commit()
        db.refresh(run)
        return run


def stop_local_worker(db: Session) -> AutomationRun:
    with _lock:
        process = _current_process
        run_id = _current_run_id

    if process is None or run_id is None:
        raise RuntimeError("No local worker is running")

    run = db.get(AutomationRun, run_id)
    if run:
        run.current_message = "Stop requested from user console"
        db.commit()
        db.refresh(run)

    if process.poll() is None:
        process.terminate()
        for _ in range(20):
            if process.poll() is not None:
                break
            time.sleep(0.25)
        if process.poll() is None:
            process.kill()

    return_code = process.poll()
    _finalize_run(db, run_id, return_code if return_code is not None else -9, forced_status="cancelled")

    with _lock:
        if _current_process is process:
            _clear_current_worker()

    run = db.get(AutomationRun, run_id)
    if not run:
        raise RuntimeError("Worker run record was not found after stopping")
    return run


def _watch_worker(process: subprocess.Popen, run_id: UUID, log_file) -> None:
    return_code = process.wait()
    try:
        log_file.close()
    except Exception:
        pass

    from services.shared.database import SessionLocal

    with SessionLocal() as db:
        _finalize_run(db, run_id, return_code)

    with _lock:
        if _current_process is process:
            _clear_current_worker()


def _heartbeat_worker(
    process: subprocess.Popen,
    run_id: UUID,
    pid: int,
    log_path: str,
) -> None:
    from services.shared.database import SessionLocal

    while process.poll() is None:
        with SessionLocal() as db:
            run = db.get(AutomationRun, run_id)
            if run and run.status not in {"success", "failed", "cancelled"}:
                if run.status != "cancel_requested":
                    run.current_message = "Local worker process is running"
                run.summary = {
                    **(run.summary or {}),
                    "pid": pid,
                    "log_path": log_path,
                    "runner": "api_local_worker",
                    "heartbeat_at": datetime.now().isoformat(),
                }
                db.commit()
        time.sleep(HEARTBEAT_SECONDS)


def _finalize_run(db: Session, run_id: UUID, return_code: int, forced_status: str | None = None) -> None:
    run = db.get(AutomationRun, run_id)
    if not run:
        return

    if run.status in {"success", "failed", "cancelled"}:
        return

    run.finished_at = datetime.now()
    if forced_status:
        run.status = forced_status
    else:
        run.status = "success" if return_code == 0 else "failed"
    run.current_message = {
        "success": "Local worker finished",
        "failed": "Local worker exited with an error",
        "cancelled": "Local worker stopped from user console",
    }.get(run.status, "Local worker finished")
    run.error_message = None if run.status in {"success", "cancelled"} else f"Process exited with code {return_code}"
    run.summary = {**(run.summary or {}), "return_code": return_code}
    db.commit()


def _clear_current_worker() -> None:
    global _current_process, _current_run_id
    _current_process = None
    _current_run_id = None
