from __future__ import annotations

import os
import sys


WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

