from __future__ import annotations

import importlib.util
from pathlib import Path


def load_runtime_module():
    runtime_path = Path(__file__).with_name("runtime.py")
    spec = importlib.util.spec_from_file_location("worker_shared_runtime", runtime_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load shared runtime from {runtime_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
