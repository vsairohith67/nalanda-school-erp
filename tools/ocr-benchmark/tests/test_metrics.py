from __future__ import annotations

from nalanda_ocr_benchmark.metrics import character_error_rate, evaluate_document, normalize_text, summarize, word_error_rate
from nalanda_ocr_benchmark.schema import DocumentResult, EngineMetadata, PageResult, TextBlock
from nalanda_ocr_benchmark.adapters.tesseract import TesseractAdapter


def test_unicode_normalization_and_error_rates() -> None:
    assert normalize_text("  OCRTEST-0001\n") == "ocrtest-0001"
    assert character_error_rate("abc", "abc") == 0
    assert word_error_rate("one two", "one two") == 0
    assert character_error_rate("abc", "axc") == 1 / 3
    assert word_error_rate("one two", "one three") == 1 / 2


def test_field_and_table_scoring() -> None:
    entry = {
        "document_id": "metric-test",
        "language": "en",
        "category": "test",
        "fields": [
            {"field_id": "student", "field_label": "Student", "expected_value": "STUDENT OCRTEST-0001", "critical": True},
            {"field_id": "optional", "field_label": "Optional", "expected_value": None, "critical": False},
        ],
        "table_cells": [{"text": "CELL OCRTEST"}],
    }
    result = DocumentResult(
        document_id="metric-test",
        pages=[PageResult(page=1, text_blocks=[TextBlock("Student STUDENT OCRTEST-0001 CELL OCRTEST")])],
        engine=EngineMetadata("test", "1", None, "CPU", 1, 2, status="OK"),
        schema_version="test",
    )
    row = evaluate_document(entry, result)
    assert row["normalized_exact_field_accuracy"] == 1
    assert row["critical_field_exact_accuracy"] == 1
    assert row["table_cell_accuracy"] == 1
    assert row["table_cell_f1"] == 1
    assert row["pages"] == 1


def test_summary_keeps_languages_separate() -> None:
    rows = [
        {"status": "OK", "language": "en", "latency_ms": 10, "normalized_exact_field_accuracy": 1},
        {"status": "OK", "language": "te", "latency_ms": 30, "normalized_exact_field_accuracy": 0},
    ]
    result = summarize(rows)
    assert result["exact_field_accuracy_by_language"] == {"en": 1.0, "te": 0.0}
    assert result["latency_p50_ms"] == 20
    assert result["latency_p95_ms"] == 29
    assert result["pages_per_minute"] == 3000


def test_summary_reports_degradation_rotation_scanner_and_pdf_slices() -> None:
    rows = [
        {"status": "OK", "language": "en", "category": "phone-camera-degradation", "degradation": "rotation-090", "latency_ms": 10, "normalized_exact_field_accuracy": 0.5, "scan_dpi": None},
        {"status": "OK", "language": "en", "category": "scanner-matrix", "latency_ms": 20, "normalized_exact_field_accuracy": 0.75, "scan_dpi": 300},
        {"status": "OK", "language": "en", "category": "pdf-native-text", "latency_ms": 30, "normalized_exact_field_accuracy": 1.0, "scan_dpi": None},
    ]
    result = summarize(rows)
    assert result["rotation_robustness"] == 0.5
    assert result["degradation_robustness"] == 0.5
    assert result["scanner_exact_accuracy_by_dpi"] == {"300": 0.75}
    assert result["pdf_exact_field_accuracy"] == 1.0


def test_tesseract_timeout_override_cannot_exceed_admission_limit() -> None:
    assert TesseractAdapter(page_timeout_seconds=15).page_timeout_seconds == 15
    try:
        TesseractAdapter(page_timeout_seconds=121)
    except ValueError as error:
        assert "OUT_OF_BOUNDS" in str(error)
    else:
        raise AssertionError("unbounded timeout was accepted")
