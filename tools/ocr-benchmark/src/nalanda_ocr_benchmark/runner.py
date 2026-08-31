from __future__ import annotations

import json
import os
import time
from pathlib import Path

from .adapters import PaddleOCRAdapter, SuryaServerAdapter, TesseractAdapter, UnlimitedOCRServerAdapter, UnavailableAdapter
from .config import LIMITS, SCHEMA_VERSION, corpus_root, results_root
from .corpus import load_verified_corpus
from .metrics import evaluate_document, summarize
from .schema import DocumentResult, EngineMetadata, PageResult
from .security import inspect_input, resolve_beneath, safe_document_id, sha256_file


def adapter_for(candidate: str):
    if candidate == "tesseract":
        adapter = TesseractAdapter()
    elif candidate == "paddleocr":
        if os.environ.get("OCR_TRUSTED_LAUNCHER") != "paddle-docker-network-none-v1":
            return UnavailableAdapter(candidate, "PADDLE_TRUSTED_CONTAINER_LAUNCHER_REQUIRED")
        adapter = PaddleOCRAdapter()
    elif candidate == "unlimited-ocr":
        if os.environ.get("OCR_TRUSTED_LAUNCHER") != "unlimited-docker-internal-v1":
            return UnavailableAdapter(candidate, "UNLIMITED_TRUSTED_CONTAINER_LAUNCHER_REQUIRED")
        adapter = UnlimitedOCRServerAdapter()
    elif candidate == "surya":
        if os.environ.get("OCR_TRUSTED_LAUNCHER") != "surya-loopback-v1":
            return UnavailableAdapter(candidate, "SURYA_TRUSTED_LOOPBACK_LAUNCHER_REQUIRED")
        adapter = SuryaServerAdapter()
    else:
        raise ValueError(f"UNKNOWN_CANDIDATE:{candidate}")
    available, reason = adapter.available()
    return adapter if available else UnavailableAdapter(candidate, reason)


def _failure(entry: dict, candidate: str, code: str, pages: int, elapsed_ms: float = 0.0) -> DocumentResult:
    return DocumentResult(
        document_id=entry["document_id"],
        pages=[PageResult(page=index + 1, omitted=True, error=code) for index in range(max(1, pages))],
        engine=EngineMetadata(candidate, "unknown", None, "unknown", 0.0, elapsed_ms, status="FAILED", notes=[code]),
        schema_version=SCHEMA_VERSION,
    )


def run_candidate(candidate: str, corpus: Path | None = None, output: Path | None = None) -> dict:
    corpus = (corpus or corpus_root()).resolve()
    manifest, corpus_receipt = load_verified_corpus(corpus)
    output = (output or (results_root() / candidate)).resolve()
    output.mkdir(parents=True, exist_ok=True)
    raw_dir = output / "normalized"
    raw_dir.mkdir(parents=True, exist_ok=True)
    adapter = adapter_for(candidate)
    run_started = time.perf_counter()
    run_deadline = run_started + LIMITS.max_seconds_per_run
    rows: list[dict[str, object]] = []
    result_files: list[dict[str, object]] = []
    for raw_entry in manifest["documents"]:
        entry = dict(raw_entry)
        entry["document_id"] = safe_document_id(entry.get("document_id"))
        source = resolve_beneath(corpus, entry["relative_path"])
        admission = inspect_input(source)
        entry["_admitted_pages"] = admission.pages
        entry["_run_deadline_monotonic"] = run_deadline
        started = time.perf_counter()
        if not admission.accepted:
            result = _failure(entry, candidate, f"ADMISSION_REJECTED:{admission.code}", admission.pages)
        elif time.perf_counter() - run_started > LIMITS.max_seconds_per_run:
            result = _failure(entry, candidate, "RUN_WALL_CLOCK_LIMIT", admission.pages)
        else:
            try:
                result = adapter.process(entry, source, output)
            except Exception as error:
                result = _failure(
                    entry,
                    candidate,
                    f"CONTROLLED_FAILURE:{type(error).__name__}:{str(error)[:500]}",
                    admission.pages,
                    (time.perf_counter() - started) * 1000,
                )
        result_path = raw_dir / f"{entry['document_id']}.json"
        result_path.write_text(json.dumps(result.to_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        result_files.append({"relative_path": result_path.relative_to(output).as_posix(), "sha256": sha256_file(result_path), "size": result_path.stat().st_size})
        rows.append(evaluate_document(entry, result))
    metrics_path = output / "raw-metrics.jsonl"
    metrics_path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows), encoding="utf-8")
    summary = summarize(rows)
    summary.update({"candidate": candidate, "schema_version": SCHEMA_VERSION, "corpus_manifest_sha256": corpus_receipt["manifest_sha256"]})
    summary_path = output / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    run_manifest = {
        "candidate": candidate,
        "schema_version": SCHEMA_VERSION,
        "corpus_manifest_sha256": summary["corpus_manifest_sha256"],
        "normalized_results": result_files,
        "metrics_sha256": sha256_file(metrics_path),
        "summary_sha256": sha256_file(summary_path),
        "network_during_inference": "DISABLED_WHERE_CONFIGURED; SEE CANDIDATE EVIDENCE",
        "operational_database_access": "NONE",
        "corpus_verification": corpus_receipt,
    }
    (output / "run-manifest.json").write_text(json.dumps(run_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary


def run_all(corpus: Path | None = None) -> dict[str, dict]:
    return {candidate: run_candidate(candidate, corpus=corpus) for candidate in ("tesseract", "paddleocr", "unlimited-ocr", "surya")}


def rescore_candidate(candidate: str, corpus: Path | None = None, output: Path | None = None) -> dict:
    corpus = (corpus or corpus_root()).resolve()
    manifest, corpus_receipt = load_verified_corpus(corpus)
    output = (output or (results_root() / candidate)).resolve()
    run_manifest_path = resolve_beneath(output, "run-manifest.json")
    if not run_manifest_path.is_file() or run_manifest_path.stat().st_size > LIMITS.max_manifest_bytes:
        raise RuntimeError(f"RUN_MANIFEST_MISSING_OR_TOO_LARGE:{candidate}")
    run_manifest = json.loads(run_manifest_path.read_text(encoding="utf-8"))
    if (
        run_manifest.get("candidate") != candidate
        or run_manifest.get("schema_version") != SCHEMA_VERSION
        or run_manifest.get("corpus_manifest_sha256") != corpus_receipt["manifest_sha256"]
    ):
        raise RuntimeError(f"RUN_MANIFEST_IDENTITY_MISMATCH:{candidate}")
    normalized_receipts = {
        item["relative_path"]: item
        for item in run_manifest.get("normalized_results", [])
        if isinstance(item, dict) and isinstance(item.get("relative_path"), str)
    }
    rows: list[dict[str, object]] = []
    for entry in manifest["documents"]:
        document_id = safe_document_id(entry.get("document_id"))
        result_path = resolve_beneath(output / "normalized", f"{document_id}.json")
        if not result_path.is_file():
            raise RuntimeError(f"NORMALIZED_RESULT_MISSING:{candidate}:{document_id}")
        if result_path.stat().st_size > LIMITS.max_output_bytes_per_page * LIMITS.max_pages:
            raise RuntimeError(f"NORMALIZED_RESULT_TOO_LARGE:{candidate}:{document_id}")
        relative_result = result_path.relative_to(output).as_posix()
        receipt = normalized_receipts.get(relative_result)
        if (
            receipt is None
            or receipt.get("size") != result_path.stat().st_size
            or receipt.get("sha256") != sha256_file(result_path)
        ):
            raise RuntimeError(f"NORMALIZED_RESULT_INTEGRITY_MISMATCH:{candidate}:{document_id}")
        result = DocumentResult.from_dict(json.loads(result_path.read_text(encoding="utf-8")))
        if result.document_id != document_id or result.engine.candidate != candidate:
            raise RuntimeError(f"NORMALIZED_RESULT_IDENTITY_MISMATCH:{candidate}:{document_id}")
        rows.append(evaluate_document(entry, result))
    metrics_path = output / "raw-metrics.jsonl"
    metrics_path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows), encoding="utf-8")
    summary = summarize(rows)
    summary.update({"candidate": candidate, "schema_version": SCHEMA_VERSION, "corpus_manifest_sha256": corpus_receipt["manifest_sha256"]})
    summary_path = output / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    run_manifest["metrics_sha256"] = sha256_file(metrics_path)
    run_manifest["summary_sha256"] = sha256_file(summary_path)
    run_manifest["rescored_with_schema"] = SCHEMA_VERSION
    run_manifest_path.write_text(
        json.dumps(run_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return summary
