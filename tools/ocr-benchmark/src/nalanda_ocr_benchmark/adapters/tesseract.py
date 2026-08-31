from __future__ import annotations

import csv
import io
import os
import shutil
import time
from pathlib import Path

from ..config import LIMITS, SCHEMA_VERSION, artifact_root
from ..integrity import verify_tesseract
from ..raster import page_images
from ..schema import DocumentResult, EngineMetadata, PageResult, SourceRegion, TextBlock
from ..security import minimal_candidate_environment
from .base import CandidateAdapter, remaining_page_timeout
from .process import run_bounded


LANGUAGES = {"en": "eng", "hi": "hin", "te": "tel"}


def _language_argument(language: str) -> str:
    selected: list[str] = []
    for token in language.split("+"):
        mapped = LANGUAGES.get(token)
        if mapped and mapped not in selected:
            selected.append(mapped)
    return "+".join(selected or ["eng"])


class TesseractAdapter(CandidateAdapter):
    name = "tesseract"

    def __init__(self, *, page_timeout_seconds: float = LIMITS.max_seconds_per_page) -> None:
        standard_windows = Path("C:/Program Files/Tesseract-OCR/tesseract.exe")
        self.executable = (
            os.environ.get("TESSERACT_CMD")
            or shutil.which("tesseract")
            or (str(standard_windows) if standard_windows.is_file() else None)
        )
        configured_tessdata = os.environ.get("TESSDATA_PREFIX")
        pinned_tessdata = artifact_root() / "models" / "tessdata_best-e12c65a"
        self.tessdata_prefix = (
            Path(configured_tessdata).resolve()
            if configured_tessdata
            else (pinned_tessdata.resolve() if pinned_tessdata.is_dir() else None)
        )
        self._version: str | None = None
        self._cold_start_ms = 0.0
        self._started = False
        if page_timeout_seconds <= 0 or page_timeout_seconds > LIMITS.max_seconds_per_page:
            raise ValueError("TESSERACT_TIMEOUT_OUT_OF_BOUNDS")
        self.page_timeout_seconds = page_timeout_seconds

    def available(self) -> tuple[bool, str]:
        if not self.executable:
            return False, "TESSERACT_EXECUTABLE_NOT_FOUND"
        try:
            executable_path = Path(self.executable).resolve(strict=True)
            verify_tesseract(executable_path, self.tessdata_prefix)
            self.executable = str(executable_path)
        except (OSError, RuntimeError) as error:
            return False, str(error)
        evidence = run_bounded(
            [self.executable, "--version"],
            cwd=Path.cwd(),
            environment=minimal_candidate_environment(
                {"TESSDATA_PREFIX": str(self.tessdata_prefix)} if self.tessdata_prefix else None
            ),
            timeout_seconds=15,
            max_output_bytes=64 * 1024,
        )
        if evidence.returncode != 0:
            return False, f"TESSERACT_VERSION_FAILED:{evidence.returncode}"
        self._version = evidence.stdout.splitlines()[0].strip() if evidence.stdout else "unknown"
        return True, self._version

    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        pages = page_images(source, run_dir / "raster" / entry["document_id"])
        results: list[PageResult] = []
        elapsed = 0.0
        peak_ram = 0
        cpu_seconds = 0.0
        notes: list[str] = []
        for page_number, page_path in enumerate(pages, start=1):
            timeout_seconds = remaining_page_timeout(entry, self.page_timeout_seconds)
            if timeout_seconds <= 0:
                results.extend(
                    PageResult(page=index, omitted=True, error="RUN_WALL_CLOCK_LIMIT")
                    for index in range(page_number, len(pages) + 1)
                )
                break
            evidence = run_bounded(
                [
                    str(self.executable),
                    str(page_path),
                    "stdout",
                    "-l",
                    _language_argument(entry.get("language", "en")),
                    "--psm",
                    "6",
                    "tsv",
                ],
                cwd=run_dir,
                environment=minimal_candidate_environment(
                    {"TESSDATA_PREFIX": str(self.tessdata_prefix)} if self.tessdata_prefix else None
                ),
                timeout_seconds=timeout_seconds,
                max_output_bytes=LIMITS.max_output_bytes_per_page,
            )
            if not self._started:
                self._cold_start_ms = evidence.elapsed_ms
                self._started = True
            elapsed += evidence.elapsed_ms
            peak_ram = max(peak_ram, evidence.peak_ram_bytes)
            cpu_seconds += evidence.cpu_seconds
            if evidence.timed_out:
                results.append(PageResult(page=page_number, omitted=True, error="TIMEOUT"))
                continue
            if evidence.output_limited:
                results.append(PageResult(page=page_number, omitted=True, error="OUTPUT_LIMIT"))
                continue
            if evidence.returncode != 0:
                error = " ".join(evidence.stderr.split())[:500]
                results.append(PageResult(page=page_number, omitted=True, error=f"TESSERACT_FAILED:{error}"))
                continue
            blocks: list[TextBlock] = []
            reader = csv.DictReader(io.StringIO(evidence.stdout), delimiter="\t")
            grouped: dict[tuple[str, str, str], list[dict[str, str]]] = {}
            for row in reader:
                text = (row.get("text") or "").strip()
                if not text:
                    continue
                key = (row.get("block_num", "0"), row.get("par_num", "0"), row.get("line_num", "0"))
                grouped.setdefault(key, []).append(row)
            for order, words in enumerate(grouped.values()):
                text = " ".join((word.get("text") or "").strip() for word in words).strip()
                left = min(int(word.get("left", 0)) for word in words)
                top = min(int(word.get("top", 0)) for word in words)
                right = max(int(word.get("left", 0)) + int(word.get("width", 0)) for word in words)
                bottom = max(int(word.get("top", 0)) + int(word.get("height", 0)) for word in words)
                confidences = [float(word["conf"]) for word in words if word.get("conf") not in (None, "", "-1")]
                blocks.append(
                    TextBlock(
                        text=text,
                        region=SourceRegion(page_number, left, top, right - left, bottom - top),
                        confidence=(sum(confidences) / len(confidences) / 100) if confidences else None,
                        reading_order=order,
                    )
                )
            results.append(PageResult(page=page_number, text_blocks=blocks, omitted=not blocks))
        notes.append(f"cpu_seconds={cpu_seconds:.3f}")
        cpu_utilization = (
            100 * cpu_seconds / max(elapsed / 1000, 0.001) / max(1, os.cpu_count() or 1)
        )
        return DocumentResult(
            document_id=entry["document_id"],
            pages=results,
            engine=EngineMetadata(
                candidate=self.name,
                version=self._version or "unknown",
                revision=None,
                device="CPU",
                cold_start_ms=self._cold_start_ms,
                elapsed_ms=elapsed,
                peak_ram_bytes=peak_ram,
                peak_vram_bytes=0,
                cpu_seconds=cpu_seconds,
                cpu_utilization_percent=cpu_utilization,
                offline=True,
                status="OK" if all(page.error is None for page in results) else "PARTIAL",
                notes=notes,
            ),
            schema_version=SCHEMA_VERSION,
        )
