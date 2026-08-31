from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

from PIL import Image
from pypdf import PdfReader

from nalanda_ocr_benchmark.adapters.paddle import PaddleOCRAdapter, _deduplicate, _predict_with_timeout, _scripts
from nalanda_ocr_benchmark.integrity import candidate_lock
from nalanda_ocr_benchmark.raster import page_images


LANGUAGE = {
    "ENGLISH": "en",
    "HINDI": "hi",
    "TELUGU": "te",
    "ENGLISH_HINDI": "en+hi",
    "ENGLISH_TELUGU": "en+te",
    "ENGLISH_HINDI_TELUGU": "en+hi+te",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rotations(source: Path, count: int) -> list[int]:
    if source.suffix.lower() == ".pdf":
        reader = PdfReader(str(source), strict=True)
        values = [int(page.get("/Rotate", 0) or 0) % 360 for page in reader.pages]
        return values if len(values) == count and all(value in (0, 90, 180, 270) for value in values) else [0] * count
    with Image.open(source) as image:
        orientation = int(image.getexif().get(274, 1))
    return [{3: 180, 6: 90, 8: 270}.get(orientation, 0)]


def script_hint(text: str) -> str:
    has_latin = any("A" <= character.upper() <= "Z" for character in text)
    has_devanagari = any("\u0900" <= character <= "\u097f" for character in text)
    has_telugu = any("\u0c00" <= character <= "\u0c7f" for character in text)
    count = sum((has_latin, has_devanagari, has_telugu))
    if count > 1:
        return "MIXED"
    if has_devanagari:
        return "DEVANAGARI"
    if has_telugu:
        return "TELUGU"
    return "LATIN" if has_latin else "UNKNOWN"


def polygon(block: Any) -> list[list[float]] | None:
    if block.region is None:
        return None
    region = block.region
    return [
        [float(region.x), float(region.y)],
        [float(region.x + region.width), float(region.y)],
        [float(region.x + region.width), float(region.y + region.height)],
        [float(region.x), float(region.y + region.height)],
    ]


def run(source: Path, output: Path, language_profile: str) -> None:
    if source.suffix.lower() not in {".png", ".jpg", ".jpeg", ".pdf"}:
        raise RuntimeError("OCR_SOURCE_TYPE_INVALID")
    if language_profile not in LANGUAGE:
        raise RuntimeError("OCR_LANGUAGE_UNAVAILABLE")
    model_root = Path(os.environ["PADDLE_PDX_CACHE_HOME"]).resolve()
    if not model_root.is_dir():
        raise RuntimeError("OCR_MODEL_MISSING")
    adapter = PaddleOCRAdapter()
    available, reason = adapter.available()
    if not available:
        raise RuntimeError(reason)
    output.mkdir(parents=True, exist_ok=True)
    raster_root = output / "rasters"
    pages = page_images(source, raster_root)
    source_sha256 = sha256_file(source)
    page_rotations = rotations(source, len(pages))
    started = time.perf_counter()
    page_results: list[dict[str, Any]] = []
    for page_number, page_path in enumerate(pages, start=1):
        page_started = time.perf_counter()
        blocks = []
        errors = []
        for script in _scripts(LANGUAGE[language_profile]):
            try:
                outputs = _predict_with_timeout(lambda script=script: adapter._pipeline(script), page_path, 120.0)
                for item in outputs:
                    blocks.extend(adapter._blocks(item.json, page_number))
            except Exception as error:
                errors.append(type(error).__name__)
        if errors and not blocks:
            raise RuntimeError(f"OCR_LANGUAGE_UNAVAILABLE:{','.join(errors)}")
        selected = _deduplicate(blocks)
        page_duration = int((time.perf_counter() - page_started) * 1000)
        with Image.open(page_path) as image:
            image.load()
            width, height = image.size
        raster_sha256 = sha256_file(page_path)
        source_digest = hashlib.sha256(f"{source_sha256}\npage:{page_number}".encode("ascii")).hexdigest()
        page_results.append({
            "pageNumber": page_number,
            "width": width,
            "height": height,
            "sourceRotation": page_rotations[page_number - 1],
            "sourceDigest": source_digest,
            "rasterSha256": raster_sha256,
            "processingDurationMs": page_duration,
            "retryPreprocessing": False,
            "blocks": [{
                "pageNumber": page_number,
                "text": block.text,
                "polygon": polygon(block),
                "recognitionScore": block.confidence,
                "scriptHint": script_hint(block.text),
                "processingDurationMs": page_duration,
                "retryPreprocessing": False,
            } for block in selected],
        })
    locked = candidate_lock("paddleocr")
    result = {
        "contractVersion": "nalanda-ocr-worker-result-1",
        "engineId": "paddleocr",
        "engineRevision": "3.7.0",
        "runtimeRevision": "paddlepaddle-gpu-3.3.1",
        "modelReceipt": [{"name": model["name"], "revision": model["revision"], "weightSha256": model["weight_sha256"]} for model in locked["models"]],
        "sourceSha256": source_sha256,
        "pages": page_results,
        "totalDurationMs": int((time.perf_counter() - started) * 1000),
    }
    encoded = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > 50 * 1024 * 1024:
        raise RuntimeError("OCR_RESULT_OUTPUT_LIMIT")
    target = output / "result.json"
    target.write_bytes(encoded)


def safe_failure_code(error: Exception) -> str:
    message = str(error).lower()
    if "checksum" in message or "hash" in message:
        return "OCR_MODEL_HASH_MISMATCH"
    if "candidate_file_missing" in message or "model" in message and ("missing" in message or "not found" in message):
        return "OCR_MODEL_MISSING"
    if "out of memory" in message or "cuda_error_out_of_memory" in message:
        return "OCR_GPU_OOM"
    if "cuda" in message or "cudnn" in message or "gpu" in message and "support" in message:
        return "OCR_CUDA_UNSUPPORTED"
    if "language" in message or "recognizer" in message:
        return "OCR_LANGUAGE_UNAVAILABLE"
    if "pdf" in message or "raster" in message or "image" in message and "decode" in message:
        return "OCR_RASTERIZATION_FAILED"
    if "cache" in message:
        return "OCR_MODEL_CACHE_CORRUPT"
    if "output" in message or "result" in message:
        return "OCR_OUTPUT_INVALID"
    return "OCR_WORKER_CRASH"


def main() -> None:
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--language", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    try:
        run(Path(args.source).resolve(strict=True), output, args.language)
    except Exception as error:
        output.mkdir(parents=True, exist_ok=True)
        (output / "failure.json").write_text(
            json.dumps({"contractVersion": "nalanda-ocr-worker-failure-1", "failureCode": safe_failure_code(error)}, separators=(",", ":")),
            encoding="utf-8",
        )
        raise


if __name__ == "__main__":
    main()
