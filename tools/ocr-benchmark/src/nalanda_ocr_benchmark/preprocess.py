from __future__ import annotations

import json
import statistics
import time
from pathlib import Path

import cv2
import numpy as np

from .adapters.tesseract import TesseractAdapter
from .config import LIMITS, corpus_root, results_root
from .corpus import load_verified_corpus
from .metrics import evaluate_document
from .security import resolve_beneath, safe_document_id


VARIANTS = ("raw", "contrast-denoise", "adaptive-threshold", "deskew-contrast", "upscale-sharpen")


def _deskew(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    coordinates = np.column_stack(np.where(binary > 0))
    if len(coordinates) < 100:
        return image
    angle = cv2.minAreaRect(coordinates[:, ::-1].astype(np.float32))[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) > 12:
        return image
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
    return cv2.warpAffine(image, matrix, (width, height), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))


def transform(image: np.ndarray, variant: str) -> np.ndarray:
    if variant == "raw":
        return image
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if variant == "contrast-denoise":
        denoised = cv2.fastNlMeansDenoising(gray, h=7, templateWindowSize=7, searchWindowSize=21)
        enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(denoised)
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    if variant == "adaptive-threshold":
        denoised = cv2.medianBlur(gray, 3)
        binary = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            35,
            13,
        )
        return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    if variant == "deskew-contrast":
        deskewed = _deskew(image)
        deskewed_gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
        enhanced = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8)).apply(deskewed_gray)
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    if variant == "upscale-sharpen":
        height, width = image.shape[:2]
        scale = min(1.5, 6000 / max(height, width))
        enlarged = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        blurred = cv2.GaussianBlur(enlarged, (0, 0), 1.2)
        return cv2.addWeighted(enlarged, 1.6, blurred, -0.6, 0)
    raise ValueError(f"UNKNOWN_PREPROCESS_VARIANT:{variant}")


def run_preprocessing_experiment(corpus: Path | None = None, output: Path | None = None) -> dict:
    corpus = (corpus or corpus_root()).resolve()
    output = (output or (results_root() / "preprocessing-tesseract")).resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest, corpus_receipt = load_verified_corpus(corpus)
    entries = [
        entry
        for entry in manifest["documents"]
        if entry.get("category") in ("phone-camera-degradation", "scanner-matrix")
        and entry["relative_path"].lower().endswith((".png", ".jpg", ".jpeg"))
    ]
    # A preprocessing study should not spend ten full 120-second production
    # budgets proving the same sideways-page failure across five variants.
    adapter = TesseractAdapter(page_timeout_seconds=15)
    available, reason = adapter.available()
    if not available:
        raise RuntimeError(reason)
    all_rows: list[dict[str, object]] = []
    run_deadline = time.perf_counter() + LIMITS.max_seconds_per_run
    for variant in VARIANTS:
        for raw_entry in entries:
            if time.perf_counter() >= run_deadline:
                raise RuntimeError("PREPROCESS_RUN_WALL_CLOCK_LIMIT")
            entry = dict(raw_entry)
            entry["_run_deadline_monotonic"] = run_deadline
            safe_document_id(entry.get("document_id"))
            source = resolve_beneath(corpus, entry["relative_path"])
            if variant == "raw":
                candidate_source = source
            else:
                image = cv2.imread(str(source), cv2.IMREAD_COLOR)
                if image is None:
                    raise RuntimeError(f"PREPROCESS_IMAGE_READ_FAILED:{source}")
                candidate_source = output / "images" / variant / f"{entry['document_id']}.png"
                candidate_source.parent.mkdir(parents=True, exist_ok=True)
                if not cv2.imwrite(str(candidate_source), transform(image, variant), [cv2.IMWRITE_PNG_COMPRESSION, 9]):
                    raise RuntimeError(f"PREPROCESS_IMAGE_WRITE_FAILED:{candidate_source}")
            result = adapter.process(entry, candidate_source, output / "runs" / variant)
            row = evaluate_document(entry, result)
            row["variant"] = variant
            all_rows.append(row)
    raw_metrics_path = output / "raw-metrics.jsonl"
    raw_metrics_path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in all_rows),
        encoding="utf-8",
    )
    summaries: dict[str, dict[str, float | int]] = {}
    for variant in VARIANTS:
        rows = [row for row in all_rows if row["variant"] == variant]
        summaries[variant] = {
            "documents": len(rows),
            "field_exact_accuracy": statistics.fmean(float(row["normalized_exact_field_accuracy"]) for row in rows),
            "critical_field_exact_accuracy": statistics.fmean(float(row["critical_field_exact_accuracy"]) for row in rows),
            "character_error_rate": statistics.fmean(float(row["character_error_rate"]) for row in rows),
            "table_cell_accuracy": statistics.fmean(float(row["table_cell_accuracy"]) for row in rows),
            "latency_p50_ms": statistics.median(float(row["latency_ms"]) for row in rows),
        }
    raw_accuracy = float(summaries["raw"]["field_exact_accuracy"])
    ranked = sorted(
        (
            {
                "variant": variant,
                **values,
                "field_accuracy_delta_vs_raw": float(values["field_exact_accuracy"]) - raw_accuracy,
            }
            for variant, values in summaries.items()
        ),
        key=lambda item: (-float(item["field_exact_accuracy"]), float(item["character_error_rate"])),
    )
    payload = {
        "candidate": "tesseract",
        "scope": "all 18 phone-camera degradations and all 12 scanner variants",
        "documents_per_variant": len(entries),
        "variants": summaries,
        "ranked": ranked,
        "selection_rule": "preprocessing is recommended only when measured field accuracy improves without unsafe crop/orientation assumptions",
        "page_timeout_seconds": 15,
        "corpus_verification": corpus_receipt,
    }
    (output / "summary.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return payload
