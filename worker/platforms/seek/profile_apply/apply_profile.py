from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys


ROOT = next(
    (parent for parent in Path(__file__).resolve().parents if (parent / "worker").is_dir()),
    Path(__file__).resolve().parents[3],
)
sys.path.append(str(ROOT / "worker"))

_LEGACY_FILE = Path(__file__).with_name("11.py")
_SPEC = spec_from_file_location("seek_apply_profile_legacy", _LEGACY_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"Unable to load legacy SEEK apply implementation from {_LEGACY_FILE}")

_MODULE = module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

run = _MODULE.run
