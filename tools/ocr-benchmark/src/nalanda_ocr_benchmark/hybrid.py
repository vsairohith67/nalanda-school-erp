from __future__ import annotations

import json
import statistics
from pathlib import Path

from .config import LIMITS, results_root
from .security import sha256_file


CANDIDATES = {"tesseract", "paddleocr", "unlimited-ocr", "surya"}


def _read_rows(candidate: str) -> dict[str, dict]:
    if candidate not in CANDIDATES:
        raise ValueError("HYBRID_CANDIDATE_INVALID")
    candidate_root = results_root() / candidate
    path = candidate_root / "raw-metrics.jsonl"
    manifest_path = candidate_root / "run-manifest.json"
    if (
        not path.is_file()
        or not manifest_path.is_file()
        or path.stat().st_size > LIMITS.max_output_bytes_per_page * LIMITS.max_documents_per_run
    ):
        raise RuntimeError(f"HYBRID_EVIDENCE_MISSING_OR_TOO_LARGE:{candidate}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("candidate") != candidate or manifest.get("metrics_sha256") != sha256_file(path):
        raise RuntimeError(f"HYBRID_EVIDENCE_INTEGRITY_MISMATCH:{candidate}")
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return {row["document_id"]: row for row in rows}


def simulate_hybrid(primary: str, fallback: str, output: Path | None = None) -> dict:
    primary_rows = _read_rows(primary)
    fallback_rows = _read_rows(fallback)
    selected: list[dict] = []
    fallback_count = 0
    for document_id in sorted(set(primary_rows) & set(fallback_rows)):
        first = primary_rows[document_id]
        use_primary = (
            first.get("status") == "OK"
            and first.get("mean_confidence") is not None
            and float(first["mean_confidence"]) >= 0.85
            and float(first.get("page_omission_rate", 1)) == 0
        )
        chosen = dict(first if use_primary else fallback_rows[document_id])
        chosen["selected_engine"] = primary if use_primary else fallback
        chosen["cascade_latency_ms"] = float(first.get("latency_ms", 0)) + (0 if use_primary else float(fallback_rows[document_id].get("latency_ms", 0)))
        if not use_primary:
            fallback_count += 1
        selected.append(chosen)
    result = {
        "primary": primary,
        "fallback": fallback,
        "documents": len(selected),
        "fallback_rate": fallback_count / max(1, len(selected)),
        "normalized_exact_field_accuracy": statistics.fmean(float(row.get("normalized_exact_field_accuracy", 0)) for row in selected) if selected else 0,
        "critical_field_exact_accuracy": statistics.fmean(float(row.get("critical_field_exact_accuracy", 0)) for row in selected) if selected else 0,
        "critical_field_hallucination_rate": statistics.fmean(float(row.get("critical_field_hallucination_rate", 0)) for row in selected) if selected else 0,
        "latency_p50_ms": statistics.median(float(row["cascade_latency_ms"]) for row in selected) if selected else 0,
        "maintenance_burden": "TWO_RUNTIME_CASCADE_PLUS_HUMAN_REVIEW",
        "selection_rule": "production-observable rule: primary status OK, mean engine confidence>=0.85, and no omitted page; otherwise fallback",
        "confidence_warning": "engine confidence is not assumed calibrated; cascade evidence must be read with each candidate's calibration table",
    }
    target = output or (results_root() / f"hybrid-{primary}-plus-{fallback}.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result
