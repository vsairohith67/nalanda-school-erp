from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .config import BENCHMARK_DIR
from .security import sha256_file


LOCK_PATH = BENCHMARK_DIR / "candidates" / "candidate-lock.json"
PADDLE_CONTAINER_LOCK_PATH = Path("/benchmark/candidates/candidate-lock.json")


def _candidate_lock_path() -> Path:
    if os.environ.get("OCR_TRUSTED_LAUNCHER") == "paddle-docker-network-none-v1":
        return PADDLE_CONTAINER_LOCK_PATH
    return LOCK_PATH


def candidate_lock(candidate_id: str) -> dict[str, Any]:
    payload = json.loads(_candidate_lock_path().read_text(encoding="utf-8"))
    for candidate in payload.get("candidates", []):
        if candidate.get("id") == candidate_id:
            return candidate
    raise RuntimeError(f"CANDIDATE_LOCK_ENTRY_MISSING:{candidate_id}")


def verify_file(path: Path, expected: dict[str, Any], label: str) -> None:
    if not path.is_file():
        raise RuntimeError(f"CANDIDATE_FILE_MISSING:{label}")
    if path.stat().st_size != int(expected["bytes"]):
        raise RuntimeError(f"CANDIDATE_FILE_SIZE_MISMATCH:{label}")
    if sha256_file(path) != str(expected["sha256"]).lower():
        raise RuntimeError(f"CANDIDATE_FILE_SHA256_MISMATCH:{label}")


def verify_tesseract(executable: Path, tessdata: Path | None) -> None:
    locked = candidate_lock("tesseract")
    verify_file(
        executable,
        {
            "bytes": locked["benchmark_binary_bytes"],
            "sha256": locked["benchmark_binary_sha256"],
        },
        "tesseract:executable",
    )
    if tessdata is None or not tessdata.is_dir():
        raise RuntimeError("TESSERACT_PINNED_TESSDATA_REQUIRED")
    for language, digest in locked["traineddata"].items():
        path = tessdata / f"{language}.traineddata"
        if not path.is_file() or sha256_file(path) != digest:
            raise RuntimeError(f"TESSERACT_TRAINEDDATA_INTEGRITY_MISMATCH:{language}")


def verify_paddle_models(cache_root: Path) -> None:
    locked = candidate_lock("paddleocr")
    models_root = cache_root / "official_models"
    for model in locked["models"]:
        model_root = models_root / model["name"]
        expected_files = model["runtime_files"]
        for relative_path, expected in expected_files.items():
            verify_file(model_root / relative_path, expected, f"paddleocr:{model['name']}:{relative_path}")
        observed_runtime_files = {
            path.relative_to(model_root).as_posix()
            for path in model_root.iterdir()
            if path.is_file() and path.name not in {".gitattributes", "README.md"}
        }
        if observed_runtime_files != set(expected_files):
            raise RuntimeError(f"PADDLE_MODEL_FILE_ALLOWLIST_MISMATCH:{model['name']}")
