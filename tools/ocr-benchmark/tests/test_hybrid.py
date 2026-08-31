from __future__ import annotations

import json
from pathlib import Path

import nalanda_ocr_benchmark.hybrid as hybrid
from nalanda_ocr_benchmark.security import sha256_file


def _write_rows(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
    (path.parent / "run-manifest.json").write_text(
        json.dumps(
            {
                "candidate": path.parent.name,
                "metrics_sha256": sha256_file(path),
            }
        ),
        encoding="utf-8",
    )


def test_hybrid_uses_only_production_observable_selector(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(hybrid, "results_root", lambda: tmp_path)
    common = {
        "document_id": "doc-1",
        "status": "OK",
        "page_omission_rate": 0,
        "normalized_exact_field_accuracy": 0,
        "critical_field_exact_accuracy": 0,
        "critical_field_hallucination_rate": 0,
        "latency_ms": 10,
    }
    _write_rows(tmp_path / "tesseract" / "raw-metrics.jsonl", [{**common, "mean_confidence": 0.9}])
    _write_rows(tmp_path / "surya" / "raw-metrics.jsonl", [{**common, "normalized_exact_field_accuracy": 1, "latency_ms": 20}])
    result = hybrid.simulate_hybrid("tesseract", "surya")
    assert result["fallback_rate"] == 0
    assert result["normalized_exact_field_accuracy"] == 0
    assert "production-observable" in result["selection_rule"]
