from __future__ import annotations

import os
import sys


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SERVICES_ROOT = os.path.join(BACKEND_ROOT, "services")

for p in (BACKEND_ROOT, SERVICES_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

