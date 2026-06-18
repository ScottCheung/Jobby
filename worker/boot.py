from __future__ import annotations

import sys
from pathlib import Path


def bootstrap() -> None:
    worker_root = Path(__file__).resolve().parent
    root = str(worker_root)
    if root not in sys.path:
        sys.path.insert(0, root)
