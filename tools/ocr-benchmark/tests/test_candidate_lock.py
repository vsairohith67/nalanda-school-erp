from __future__ import annotations

import json
from pathlib import Path
import subprocess

from nalanda_ocr_benchmark.integrity import (
    LOCK_PATH,
    PADDLE_CONTAINER_LOCK_PATH,
    _candidate_lock_path,
)


def test_candidate_lock_is_complete_and_immutable() -> None:
    root = Path(__file__).resolve().parents[1]
    lock = json.loads((root / "candidates" / "candidate-lock.json").read_text(encoding="utf-8"))
    candidates = {item["id"]: item for item in lock["candidates"]}
    assert set(candidates) == {"unlimited-ocr", "paddleocr", "tesseract", "surya"}
    for candidate in candidates.values():
        assert candidate["code_license"]
        assert candidate["model_weight_license"]
        if candidate["id"] == "tesseract":
            assert candidate["source_revision"] == "5.5.3"
        else:
            assert len(candidate["source_revision"]) == 40
    assert candidates["unlimited-ocr"]["runtime_image"].endswith(
        "sha256:b7a7be708c9a325107cdeddeba095e5637617716b3ab469c19d34759ec1afa39"
    )
    assert candidates["unlimited-ocr"]["trust_remote_code"] is True
    assert "modeling_unlimitedocr.py" in candidates["unlimited-ocr"]["files"]
    assert len(candidates["paddleocr"]["models"]) == 4
    assert all(model["runtime_files"] for model in candidates["paddleocr"]["models"])
    assert candidates["tesseract"]["benchmark_binary_bytes"] > 0
    assert len(candidates["surya"]["runtime_bundle_sha256"]) == 64
    assert "unresolved" in candidates["surya"]["commercial_use"]


def test_unlimited_diagnostics_redact_ephemeral_api_keys() -> None:
    root = Path(__file__).resolve().parents[1]
    secret = "0123456789abcdef0123456789abcdef"
    script = (
        "import {redactDiagnostic} from './scripts/integrity.mjs';"
        f"const value={json.dumps({'api_key': [secret], 'authorization': f'Bearer {secret}'})};"
        f"process.stdout.write(redactDiagnostic(JSON.stringify(value), [{json.dumps(secret)}]));"
    )
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    assert secret not in completed.stdout
    assert "REDACTED_EPHEMERAL_SECRET" in completed.stdout


def test_unlimited_diagnostics_retain_bounded_head_and_tail() -> None:
    root = Path(__file__).resolve().parents[1]
    script = (
        "import {boundedDiagnostic} from './scripts/integrity.mjs';"
        "process.stdout.write(boundedDiagnostic('HEAD'+('x'.repeat(30000))+'TAIL'));"
    )
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    assert len(completed.stdout) == 20_000
    assert completed.stdout.startswith("HEAD")
    assert completed.stdout.endswith("TAIL")
    assert "BOUNDED_DIAGNOSTIC_MIDDLE_REMOVED" in completed.stdout


def test_candidate_lock_path_changes_only_for_the_trusted_paddle_launcher(monkeypatch) -> None:
    monkeypatch.setenv("OCR_TRUSTED_LAUNCHER", "untrusted")
    assert _candidate_lock_path() == LOCK_PATH
    monkeypatch.setenv("OCR_TRUSTED_LAUNCHER", "paddle-docker-network-none-v1")
    assert _candidate_lock_path() == PADDLE_CONTAINER_LOCK_PATH


def test_container_receipt_ignores_python_bytecode() -> None:
    root = Path(__file__).resolve().parents[1]
    command = (
        "import {containerBuildInputDigest} from './scripts/integrity.mjs';"
        "process.stdout.write(containerBuildInputDigest('client'));"
    )
    before = subprocess.run(
        ["node", "--input-type=module", "-e", command],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    cache = root / "src" / "nalanda_ocr_benchmark" / "__pycache__"
    cache.mkdir(exist_ok=True)
    marker = cache / "receipt-regression-test.pyc"
    marker.write_bytes(b"ignored-bytecode")
    try:
        after = subprocess.run(
            ["node", "--input-type=module", "-e", command],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    finally:
        marker.unlink(missing_ok=True)
    assert after == before
