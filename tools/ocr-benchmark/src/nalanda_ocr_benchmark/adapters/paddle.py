from __future__ import annotations

import importlib.metadata
import os
import signal
import time
from pathlib import Path
from collections.abc import Callable
from typing import Any

import psutil

from ..config import LIMITS, SCHEMA_VERSION
from ..integrity import verify_paddle_models
from ..raster import page_images
from ..schema import DocumentResult, EngineMetadata, PageResult, SourceRegion, TextBlock
from .base import CandidateAdapter, remaining_page_timeout


RECOGNITION_MODELS = {
    "en": "en_PP-OCRv5_mobile_rec",
    "hi": "devanagari_PP-OCRv5_mobile_rec",
    "te": "te_PP-OCRv5_mobile_rec",
}


class _PageTimeout(TimeoutError):
    pass


def _predict_with_timeout(pipeline_factory: Callable[[], Any], page_path: Path, timeout_seconds: float) -> list[Any]:
    """Bound a native Paddle call when the POSIX container supports SIGALRM."""

    if not hasattr(signal, "SIGALRM"):
        return list(pipeline_factory().predict(str(page_path)))

    def timeout_handler(_signum: int, _frame: object) -> None:
        raise _PageTimeout("PADDLE_PAGE_TIMEOUT")

    previous = signal.signal(signal.SIGALRM, timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, timeout_seconds)
    try:
        return list(pipeline_factory().predict(str(page_path)))
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def _scripts(language: str) -> list[str]:
    tokens = language.split("+")
    non_latin = [token for token in tokens if token in ("hi", "te")]
    return non_latin or ["en"]


def _region(polygon: list[list[float]], page: int) -> SourceRegion:
    xs = [float(point[0]) for point in polygon]
    ys = [float(point[1]) for point in polygon]
    left, right = min(xs), max(xs)
    top, bottom = min(ys), max(ys)
    return SourceRegion(page=page, x=left, y=top, width=right - left, height=bottom - top)


def _intersection_over_union(left: SourceRegion, right: SourceRegion) -> float:
    x1 = max(left.x, right.x)
    y1 = max(left.y, right.y)
    x2 = min(left.x + left.width, right.x + right.width)
    y2 = min(left.y + left.height, right.y + right.height)
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = left.width * left.height + right.width * right.height - intersection
    return intersection / union if union > 0 else 0.0


def _deduplicate(blocks: list[TextBlock]) -> list[TextBlock]:
    selected: list[TextBlock] = []
    for block in sorted(
        blocks,
        key=lambda item: (
            item.region.y if item.region else 0,
            item.region.x if item.region else 0,
            -(item.confidence or 0),
        ),
    ):
        overlapping = next(
            (
                index
                for index, existing in enumerate(selected)
                if block.region
                and existing.region
                and _intersection_over_union(block.region, existing.region) >= 0.55
            ),
            None,
        )
        if overlapping is None:
            selected.append(block)
        elif (block.confidence or 0) > (selected[overlapping].confidence or 0):
            selected[overlapping] = block
    return [
        TextBlock(
            text=block.text,
            region=block.region,
            confidence=block.confidence,
            reading_order=index,
        )
        for index, block in enumerate(
            sorted(
                selected,
                key=lambda item: (
                    item.region.y if item.region else 0,
                    item.region.x if item.region else 0,
                ),
            )
        )
    ]


class PaddleOCRAdapter(CandidateAdapter):
    """Pinned PP-OCRv5 mobile detector with script-specific recognizers.

    The adapter intentionally disables document unwarping and orientation helper
    models. Corpus rotations remain part of the measured OCR challenge instead
    of silently downloading additional models during inference.
    """

    name = "paddleocr"

    def __init__(self) -> None:
        self._pipelines: dict[str, Any] = {}
        self._cold_start_ms = 0.0
        self._version = "unknown"
        self._device = "cpu"
        self._image_id = os.environ.get("OCR_PADDLE_IMAGE_ID", "")

    def available(self) -> tuple[bool, str]:
        cache_root = os.environ.get("PADDLE_PDX_CACHE_HOME")
        if not cache_root or not self._image_id.startswith("sha256:"):
            return False, "PADDLE_PINNED_MODEL_CACHE_REQUIRED"
        try:
            verify_paddle_models(Path(cache_root).resolve())
        except (OSError, RuntimeError) as error:
            return False, str(error)
        try:
            import paddle
            import paddleocr  # noqa: F401
        except ImportError:
            return False, "PADDLEOCR_RUNTIME_NOT_INSTALLED"
        self._version = importlib.metadata.version("paddleocr")
        requested = os.environ.get("OCR_PADDLE_DEVICE", "gpu:0")
        if requested.startswith("gpu") and not paddle.device.is_compiled_with_cuda():
            return False, "PADDLE_GPU_RUNTIME_NOT_COMPILED_WITH_CUDA"
        self._device = requested
        return True, self._version

    def _pipeline(self, script: str):
        if script in self._pipelines:
            return self._pipelines[script]
        from paddleocr import PaddleOCR

        started = time.perf_counter()
        pipeline = PaddleOCR(
            device=self._device,
            enable_mkldnn=False,
            cpu_threads=8,
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name=RECOGNITION_MODELS[script],
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        self._cold_start_ms += (time.perf_counter() - started) * 1000
        self._pipelines[script] = pipeline
        return pipeline

    @staticmethod
    def _blocks(raw: dict[str, Any], page_number: int) -> list[TextBlock]:
        payload = raw.get("res", raw)
        texts = payload.get("rec_texts", [])
        scores = payload.get("rec_scores", [])
        polygons = payload.get("rec_polys", payload.get("dt_polys", []))
        blocks: list[TextBlock] = []
        for index, text in enumerate(texts):
            normalized = str(text).strip()
            if not normalized:
                continue
            polygon = polygons[index] if index < len(polygons) else None
            blocks.append(
                TextBlock(
                    text=normalized,
                    region=_region(polygon, page_number) if polygon else None,
                    confidence=float(scores[index]) if index < len(scores) else None,
                )
            )
        return blocks

    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        pages = page_images(source, run_dir / "raster" / entry["document_id"])
        process = psutil.Process()
        cpu_started = process.cpu_times()
        peak_ram = process.memory_info().rss
        started = time.perf_counter()
        page_results: list[PageResult] = []
        notes = [
            "detector=PP-OCRv5_mobile_det",
            f"recognizers={','.join(RECOGNITION_MODELS[token] for token in _scripts(entry.get('language', 'en')))}",
            "document_orientation=false",
            "document_unwarping=false",
            "textline_orientation=false",
            "mkldnn=false",
            f"runtime_image_id={self._image_id}",
        ]
        for page_number, page_path in enumerate(pages, start=1):
            if remaining_page_timeout(entry) <= 0:
                page_results.extend(
                    PageResult(page=index, omitted=True, error="RUN_WALL_CLOCK_LIMIT")
                    for index in range(page_number, len(pages) + 1)
                )
                break
            combined: list[TextBlock] = []
            errors: list[str] = []
            for script in _scripts(entry.get("language", "en")):
                try:
                    timeout_seconds = remaining_page_timeout(entry)
                    if timeout_seconds <= 0:
                        raise _PageTimeout("RUN_WALL_CLOCK_LIMIT")
                    outputs = _predict_with_timeout(
                        lambda script=script: self._pipeline(script),
                        page_path,
                        timeout_seconds,
                    )
                    for output in outputs:
                        combined.extend(self._blocks(output.json, page_number))
                except Exception as error:  # candidate failure is normalized, not raised
                    errors.append(f"{script}:{type(error).__name__}:{str(error)[:300]}")
                peak_ram = max(peak_ram, process.memory_info().rss)
            blocks = _deduplicate(combined)
            page_results.append(
                PageResult(
                    page=page_number,
                    text_blocks=blocks,
                    omitted=not blocks,
                    error=";".join(errors) if errors and not blocks else None,
                )
            )
            if errors:
                notes.extend(errors)
        elapsed_ms = (time.perf_counter() - started) * 1000
        cpu_finished = process.cpu_times()
        cpu_seconds = (cpu_finished.user + cpu_finished.system) - (cpu_started.user + cpu_started.system)
        cpu_utilization = 100 * cpu_seconds / max(elapsed_ms / 1000, 0.001) / max(1, os.cpu_count() or 1)
        peak_vram = 0
        if self._device.startswith("gpu"):
            try:
                import paddle

                peak_vram = int(paddle.device.cuda.max_memory_allocated())
            except (AttributeError, RuntimeError):
                notes.append("peak_vram_unavailable")
        return DocumentResult(
            document_id=entry["document_id"],
            pages=page_results,
            engine=EngineMetadata(
                candidate=self.name,
                version=self._version,
                revision=None,
                device=self._device.upper(),
                cold_start_ms=self._cold_start_ms,
                elapsed_ms=elapsed_ms,
                peak_ram_bytes=peak_ram,
                peak_vram_bytes=peak_vram,
                cpu_seconds=cpu_seconds,
                cpu_utilization_percent=cpu_utilization,
                offline=True,
                status="OK" if all(page.error is None for page in page_results) else "PARTIAL",
                notes=notes,
            ),
            schema_version=SCHEMA_VERSION,
        )
