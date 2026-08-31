from __future__ import annotations

import re
import statistics
import unicodedata
from collections import Counter
from typing import Iterable, Sequence

from rapidfuzz.distance import Levenshtein

from .schema import DocumentResult


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return re.sub(r"\s+", " ", normalized).strip()


def character_error_rate(expected: str, actual: str) -> float:
    reference = normalize_text(expected)
    hypothesis = normalize_text(actual)
    return Levenshtein.distance(reference, hypothesis) / max(1, len(reference))


def word_error_rate(expected: str, actual: str) -> float:
    reference = normalize_text(expected).split()
    hypothesis = normalize_text(actual).split()
    return Levenshtein.distance(reference, hypothesis) / max(1, len(reference))


def exact_value_present(value: str, actual: str) -> bool:
    expected = normalize_text(value)
    return bool(expected) and expected in normalize_text(actual)


def field_scores(ground_truth_fields: Sequence[dict], actual_text: str) -> dict[str, float]:
    expected = [field for field in ground_truth_fields if field.get("expected_value")]
    matched = [field for field in expected if exact_value_present(field["expected_value"], actual_text)]
    critical = [field for field in expected if field.get("critical")]
    critical_matched = [field for field in critical if exact_value_present(field["expected_value"], actual_text)]
    precision = len(matched) / max(1, len(expected))
    recall = len(matched) / max(1, len(expected))
    return {
        "normalized_exact_field_accuracy": recall,
        "critical_field_exact_accuracy": len(critical_matched) / max(1, len(critical)),
        "field_precision": precision,
        "field_recall": recall,
        "field_f1": 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall),
    }


def reading_order_accuracy(expected_values: Sequence[str], actual: str) -> float:
    haystack = normalize_text(actual)
    positions = [haystack.find(normalize_text(value)) for value in expected_values if normalize_text(value)]
    visible = [position for position in positions if position >= 0]
    if not positions:
        return 1.0
    if len(visible) < 2:
        return len(visible) / len(positions)
    ordered_pairs = sum(1 for left, right in zip(visible, visible[1:]) if left < right)
    return (ordered_pairs / max(1, len(visible) - 1)) * (len(visible) / len(positions))


def evaluate_document(entry: dict, result: DocumentResult) -> dict[str, object]:
    actual_text = "\n".join(
        block.text for page in result.pages for block in page.text_blocks if block.text
    )
    expected_fields = entry.get("fields", [])
    expected_values = [field["expected_value"] for field in expected_fields if field.get("expected_value")]
    expected_text = "\n".join(
        f"{field.get('field_label', '')} {field.get('expected_value', '')}" for field in expected_fields
    )
    scores: dict[str, object] = {
        "document_id": entry["document_id"],
        "language": entry.get("language", "unknown"),
        "category": entry.get("category", "unknown"),
        "degradation": entry.get("degradation"),
        "scan_dpi": entry.get("scan_dpi"),
        "scan_mode": entry.get("scan_mode"),
        "character_error_rate": character_error_rate(expected_text, actual_text),
        "word_error_rate": word_error_rate(expected_text, actual_text),
        "reading_order_accuracy": reading_order_accuracy(expected_values, actual_text),
        "page_omission_rate": sum(1 for page in result.pages if page.omitted) / max(1, len(result.pages)),
        "latency_ms": result.engine.elapsed_ms,
        "pages": len(result.pages),
        "cold_start_ms": result.engine.cold_start_ms,
        "peak_ram_bytes": result.engine.peak_ram_bytes,
        "peak_vram_bytes": result.engine.peak_vram_bytes,
        "cpu_seconds": result.engine.cpu_seconds,
        "cpu_utilization_percent": result.engine.cpu_utilization_percent,
        "device": result.engine.device,
        "status": result.engine.status,
    }
    scores.update(field_scores(expected_fields, actual_text))
    blank_fields = [field for field in expected_fields if field.get("expected_value") in (None, "")]
    predicted = {field.field_id: field.value for page in result.pages for field in page.fields}

    def blank_field_has_text(field: dict) -> bool:
        if predicted.get(field["field_id"]):
            return True
        page_number = int(field.get("page", 1))
        page = next((item for item in result.pages if item.page == page_number), None)
        if not page:
            return False
        region = field.get("bounding_region")
        if not region:
            return any(block.text.strip() for block in page.text_blocks)
        left = float(region["x"])
        top = float(region["y"])
        right = left + float(region["width"])
        bottom = top + float(region["height"])
        for block in page.text_blocks:
            if not block.text.strip() or not block.region:
                continue
            center_x = block.region.x + block.region.width / 2
            center_y = block.region.y + block.region.height / 2
            if left <= center_x <= right and top <= center_y <= bottom:
                return True
        return False

    hallucinated = [field for field in blank_fields if blank_field_has_text(field)]
    scores["hallucination_rate"] = len(hallucinated) / max(1, len(blank_fields))
    scores["critical_field_hallucination_rate"] = len(
        [field for field in hallucinated if field.get("critical")]
    ) / max(1, len([field for field in blank_fields if field.get("critical")]))
    table_cells = [cell for cell in entry.get("table_cells", []) if cell.get("text")]
    table_matches = [cell for cell in table_cells if exact_value_present(cell["text"], actual_text)]
    scores["table_cell_accuracy"] = len(table_matches) / max(1, len(table_cells))
    scores["table_cell_precision"] = len(table_matches) / max(1, len(table_cells))
    scores["table_cell_recall"] = len(table_matches) / max(1, len(table_cells))
    scores["table_cell_f1"] = len(table_matches) / max(1, len(table_cells))
    handwritten_fields = [field for field in expected_fields if field.get("expected_value") and field.get("handwritten")]
    typed_fields = [field for field in expected_fields if field.get("expected_value") and not field.get("handwritten")]
    scores["handwritten_field_accuracy"] = (
        sum(exact_value_present(field["expected_value"], actual_text) for field in handwritten_fields)
        / len(handwritten_fields)
        if handwritten_fields
        else None
    )
    scores["typed_field_accuracy"] = (
        sum(exact_value_present(field["expected_value"], actual_text) for field in typed_fields) / len(typed_fields)
        if typed_fields
        else None
    )
    confidences = [
        float(block.confidence)
        for page in result.pages
        for block in page.text_blocks
        if block.confidence is not None
    ]
    scores["mean_confidence"] = statistics.fmean(confidences) if confidences else None
    return scores


def percentile(values: Sequence[float], percentile_value: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile_value
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def summarize(rows: Iterable[dict[str, object]]) -> dict[str, object]:
    materialized = list(rows)
    numeric_keys = [
        "character_error_rate",
        "word_error_rate",
        "normalized_exact_field_accuracy",
        "critical_field_exact_accuracy",
        "field_precision",
        "field_recall",
        "field_f1",
        "table_cell_accuracy",
        "table_cell_precision",
        "table_cell_recall",
        "table_cell_f1",
        "reading_order_accuracy",
        "page_omission_rate",
        "hallucination_rate",
        "critical_field_hallucination_rate",
        "handwritten_field_accuracy",
        "typed_field_accuracy",
    ]
    summary: dict[str, object] = {
        "documents": len(materialized),
        "status_counts": dict(Counter(str(row.get("status")) for row in materialized)),
    }
    for key in numeric_keys:
        values = [float(row[key]) for row in materialized if row.get(key) is not None]
        summary[key] = statistics.fmean(values) if values else None
    latencies = [float(row["latency_ms"]) for row in materialized if row.get("latency_ms") is not None]
    summary["latency_p50_ms"] = percentile(latencies, 0.50)
    summary["latency_p95_ms"] = percentile(latencies, 0.95)
    summary["warm_latency_p50_ms"] = percentile(latencies[1:], 0.50) if len(latencies) > 1 else None
    page_count = sum(int(row.get("pages", 1)) for row in materialized)
    summary["pages"] = page_count
    summary["pages_per_minute"] = 0.0 if not latencies or sum(latencies) == 0 else 60_000 * page_count / sum(latencies)
    cold_starts = [float(row["cold_start_ms"]) for row in materialized if row.get("cold_start_ms") is not None]
    summary["cold_start_ms"] = max(cold_starts) if cold_starts else None
    ram_values = [int(row["peak_ram_bytes"]) for row in materialized if row.get("peak_ram_bytes") is not None]
    vram_values = [int(row["peak_vram_bytes"]) for row in materialized if row.get("peak_vram_bytes") is not None]
    summary["peak_ram_bytes"] = max(ram_values) if ram_values else None
    summary["peak_vram_bytes"] = max(vram_values) if vram_values else None
    cpu_values = [float(row["cpu_utilization_percent"]) for row in materialized if row.get("cpu_utilization_percent") is not None]
    summary["mean_cpu_utilization_percent"] = statistics.fmean(cpu_values) if cpu_values else None
    by_language: dict[str, list[float]] = {}
    for row in materialized:
        by_language.setdefault(str(row.get("language", "unknown")), []).append(
            float(row.get("normalized_exact_field_accuracy", 0.0))
        )
    summary["exact_field_accuracy_by_language"] = {
        language: statistics.fmean(values) for language, values in sorted(by_language.items())
    }
    by_category: dict[str, list[dict[str, object]]] = {}
    for row in materialized:
        by_category.setdefault(str(row.get("category", "unknown")), []).append(row)
    summary["by_category"] = {
        category: {
            "documents": len(items),
            "exact_field_accuracy": statistics.fmean(
                float(item.get("normalized_exact_field_accuracy", 0)) for item in items
            ),
            "critical_field_accuracy": statistics.fmean(
                float(item.get("critical_field_exact_accuracy", 0)) for item in items
            ),
            "latency_p95_ms": percentile([float(item.get("latency_ms", 0)) for item in items], 0.95),
        }
        for category, items in sorted(by_category.items())
    }
    degraded = [row for row in materialized if row.get("category") == "phone-camera-degradation"]
    rotations = [row for row in degraded if str(row.get("degradation", "")).startswith("rotation-")]
    summary["degradation_robustness"] = (
        statistics.fmean(float(row.get("normalized_exact_field_accuracy", 0)) for row in degraded)
        if degraded
        else None
    )
    summary["rotation_robustness"] = (
        statistics.fmean(float(row.get("normalized_exact_field_accuracy", 0)) for row in rotations)
        if rotations
        else None
    )
    scanner_rows = [row for row in materialized if row.get("scan_dpi") is not None]
    summary["scanner_exact_accuracy_by_dpi"] = {
        str(dpi): statistics.fmean(
            float(row.get("normalized_exact_field_accuracy", 0))
            for row in scanner_rows
            if int(row["scan_dpi"]) == dpi
        )
        for dpi in sorted({int(row["scan_dpi"]) for row in scanner_rows})
    }
    pdf_rows = [row for row in materialized if str(row.get("category", "")).startswith("pdf-")]
    summary["pdf_exact_field_accuracy"] = (
        statistics.fmean(float(row.get("normalized_exact_field_accuracy", 0)) for row in pdf_rows)
        if pdf_rows
        else None
    )
    confidence_rows = [row for row in materialized if row.get("mean_confidence") is not None]
    summary["confidence_coverage"] = len(confidence_rows) / max(1, len(materialized))
    confidence_buckets: dict[str, list[float]] = {"0.00-0.59": [], "0.60-0.79": [], "0.80-0.89": [], "0.90-1.00": []}
    for row in confidence_rows:
        confidence = float(row["mean_confidence"])
        if confidence < 0.60:
            bucket = "0.00-0.59"
        elif confidence < 0.80:
            bucket = "0.60-0.79"
        elif confidence < 0.90:
            bucket = "0.80-0.89"
        else:
            bucket = "0.90-1.00"
        confidence_buckets[bucket].append(float(row.get("normalized_exact_field_accuracy", 0)))
    summary["confidence_calibration"] = {
        bucket: {"documents": len(values), "exact_field_accuracy": statistics.fmean(values) if values else None}
        for bucket, values in confidence_buckets.items()
    }
    return summary
