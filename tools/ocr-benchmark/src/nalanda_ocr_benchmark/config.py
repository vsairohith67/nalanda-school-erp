from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from pathlib import Path


SCHEMA_VERSION = "nalanda-ocr-benchmark-1.0"
GENERATOR_SEED = 20260830
EXPECTED_CORPUS_MANIFEST_SHA256 = "84c13b92234d3309d51a6bc38883f08cac08034a839d64719eb9219ed9f7ec0c"
PACKAGE_DIR = Path(__file__).resolve().parent
BENCHMARK_DIR = PACKAGE_DIR.parents[1]
REPOSITORY_ROOT = PACKAGE_DIR.parents[3]
DEFAULT_ARTIFACT_ROOT = REPOSITORY_ROOT / ".codex" / "artifacts" / "OCR-BENCHMARK-1A"


@dataclass(frozen=True)
class ResourceLimits:
    max_file_bytes: int = 25 * 1024 * 1024
    max_pages: int = 25
    max_dimension: int = 6_000
    max_pixels_per_page: int = 40_000_000
    max_pixels_per_document: int = 120_000_000
    max_seconds_per_page: int = 120
    max_output_bytes_per_page: int = 2 * 1024 * 1024
    max_manifest_bytes: int = 5 * 1024 * 1024
    max_documents_per_run: int = 64
    max_pages_per_run: int = 128
    max_input_bytes_per_run: int = 512 * 1024 * 1024
    max_pixels_per_run: int = 3_000_000_000
    max_seconds_per_run: int = 4 * 60 * 60

    def to_dict(self) -> dict[str, int]:
        return asdict(self)


LIMITS = ResourceLimits()


def artifact_root() -> Path:
    configured = os.environ.get("OCR_BENCHMARK_ARTIFACT_ROOT")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_ARTIFACT_ROOT


def corpus_root() -> Path:
    return artifact_root() / "corpus-v1"


def results_root() -> Path:
    return artifact_root() / "results"


def georgia_bold_path() -> Path:
    configured = os.environ.get("OCR_GEORGIA_BOLD")
    candidates = [
        Path(configured) if configured else None,
        Path("C:/Windows/Fonts/georgiab.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/Georgia_Bold.ttf"),
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate.resolve()
    raise RuntimeError(
        "GEORGIA_BOLD_REQUIRED: set OCR_GEORGIA_BOLD to a licensed Georgia Bold TTF file"
    )


def font_asset(name: str) -> Path:
    candidate = BENCHMARK_DIR / "assets" / "fonts" / name
    if not candidate.is_file():
        raise RuntimeError(f"BENCHMARK_FONT_MISSING: {candidate}")
    return candidate
