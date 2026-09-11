"""Generate the owner-approved, brand-neutral QR posters used by the portal."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "generate-qr-poster-candidates.py"


def load_poster_module():
    spec = spec_from_file_location("qr_poster_candidates", SOURCE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load poster generator: {SOURCE}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


if __name__ == "__main__":
    poster = load_poster_module()
    poster.TMP.mkdir(parents=True, exist_ok=True)
    poster.ACTIVE_OUTPUT.mkdir(parents=True, exist_ok=True)
    for department, label in (("retail", "Розница"), ("wholesale", "Опт")):
        poster.build_wayfinding(department, label, activate=True)
