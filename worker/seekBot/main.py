import sys
from pathlib import Path


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from shared_services.runtime import bootstrap_runtime


def run() -> None:
    bootstrap_runtime()
    from seekBot.services.seek_flow import run_seek_flow
    run_seek_flow()


def main() -> None:
    run()


if __name__ == "__main__":
    main()
