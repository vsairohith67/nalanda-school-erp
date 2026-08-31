from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

import psutil
from PIL import Image

from ..config import LIMITS, SCHEMA_VERSION
from ..raster import page_images
from ..schema import DocumentResult, EngineMetadata, PageResult, SourceRegion, TextBlock
from .base import CandidateAdapter, remaining_page_timeout


PROMPT = (
    "OCR this image to HTML. Each block is a div with data-label and data-bbox "
    "(x0 y0 x1 y1, normalized 0-1000)."
)
EXPECTED_REVISION = "6a3a4c30e5e74446d4f8b6afd05b2f2da970f470"
EXPECTED_RUNTIME_BUNDLE_SHA256 = "ca151161dfeb83493c54b30dbfafb7d2e605a6ecfbdbfcf7f1cc9710609b7969"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001, ANN201
        raise urllib.error.HTTPError(req.full_url, code, "REDIRECT_REJECTED", headers, fp)


def _validated_loopback_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urllib.parse.urlsplit(value)
    if (
        parsed.scheme != "http"
        or parsed.hostname != "127.0.0.1"
        or parsed.port != 32137
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        return None
    return "http://127.0.0.1:32137"


def _monitor_gpu_memory(stop: threading.Event, samples: list[int]) -> None:
    while not stop.wait(1):
        try:
            completed = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=memory.used",
                    "--format=csv,noheader,nounits",
                    "--id=0",
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
                shell=False,
            )
            if completed.returncode == 0:
                samples.append(int(completed.stdout.splitlines()[0].strip()) * 1024 * 1024)
        except (OSError, ValueError, subprocess.SubprocessError):
            return


class _BlockParser(HTMLParser):
    def __init__(self, width: int, height: int) -> None:
        super().__init__(convert_charrefs=True)
        self.width = width
        self.height = height
        self.depth = 0
        self.current_bbox: str | None = None
        self.current_text: list[str] = []
        self.blocks: list[tuple[str, SourceRegion | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "div" and self.depth == 0 and attributes.get("data-bbox"):
            self.current_bbox = attributes["data-bbox"]
            self.current_text = []
            self.depth = 1
        elif self.depth:
            self.depth += 1

    def handle_endtag(self, tag: str) -> None:
        if not self.depth:
            return
        self.depth -= 1
        if self.depth == 0:
            text = " ".join("".join(self.current_text).split())
            region = self._region(self.current_bbox)
            if text:
                self.blocks.append((text, region))
            self.current_bbox = None
            self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.depth:
            self.current_text.append(data)

    def _region(self, value: str | None) -> SourceRegion | None:
        if not value:
            return None
        numbers = [float(item) for item in re.findall(r"-?\d+(?:\.\d+)?", value)]
        if len(numbers) != 4:
            return None
        x0, y0, x1, y1 = numbers
        return SourceRegion(
            page=0,
            x=max(0.0, x0) * self.width / 1000,
            y=max(0.0, y0) * self.height / 1000,
            width=max(0.0, x1 - x0) * self.width / 1000,
            height=max(0.0, y1 - y0) * self.height / 1000,
        )


def _extract_blocks(raw: str, page: int, width: int, height: int) -> list[TextBlock]:
    cleaned = re.sub(r"^```(?:html)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    parser = _BlockParser(width, height)
    parser.feed(cleaned)
    if parser.blocks:
        return [
            TextBlock(
                text=text,
                region=SourceRegion(page, region.x, region.y, region.width, region.height) if region else None,
                reading_order=index,
            )
            for index, (text, region) in enumerate(parser.blocks)
        ]
    fallback = " ".join(re.sub(r"<[^>]+>", " ", cleaned).split())
    return [TextBlock(text=fallback, reading_order=0)] if fallback else []


class SuryaServerAdapter(CandidateAdapter):
    name = "surya"

    def __init__(self) -> None:
        self.url = _validated_loopback_url(os.environ.get("OCR_SURYA_URL"))
        self.api_key = os.environ.get("OCR_SURYA_API_KEY")
        self.server_pid = int(os.environ.get("OCR_SURYA_SERVER_PID", "0"))
        self.cold_start_ms = float(os.environ.get("OCR_SURYA_COLD_START_MS", "0"))
        self.revision = os.environ.get("OCR_SURYA_REVISION")
        self.runtime_version = os.environ.get("OCR_SURYA_RUNTIME_VERSION", "unknown")
        self.runtime_bundle_sha256 = os.environ.get("OCR_SURYA_RUNTIME_BUNDLE_SHA256")
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())

    def available(self) -> tuple[bool, str]:
        if not self.url or not self.api_key:
            return False, "SURYA_TRUSTED_LOOPBACK_ENDPOINT_REQUIRED"
        if (
            self.revision != EXPECTED_REVISION
            or self.server_pid <= 0
            or self.runtime_bundle_sha256 != EXPECTED_RUNTIME_BUNDLE_SHA256
        ):
            return False, "SURYA_RUNTIME_IDENTITY_MISMATCH"
        try:
            request = urllib.request.Request(
                f"{self.url.rstrip('/')}/health",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            with self._opener.open(request, timeout=5) as response:
                if response.status != 200:
                    return False, f"SURYA_HEALTH_STATUS:{response.status}"
        except (OSError, urllib.error.URLError) as error:
            return False, f"SURYA_HEALTH_FAILED:{type(error).__name__}"
        return True, self.runtime_version

    def _predict(self, image_path: Path, timeout_seconds: float) -> str:
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        media_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
        payload = {
            "model": "surya-ocr-2-gguf",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{encoded}"}},
                    ],
                }
            ],
            "temperature": 0,
            "max_tokens": 4096,
            "stream": False,
        }
        request = urllib.request.Request(
            f"{self.url.rstrip('/')}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        with self._opener.open(request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read(LIMITS.max_output_bytes_per_page).decode("utf-8"))
        return str(raw["choices"][0]["message"]["content"])

    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        pages = page_images(source, run_dir / "raster" / entry["document_id"])
        started = time.perf_counter()
        peak_ram = 0
        server = psutil.Process(self.server_pid) if self.server_pid and psutil.pid_exists(self.server_pid) else None
        cpu_started = server.cpu_times() if server else None
        page_results: list[PageResult] = []
        vram_samples: list[int] = []
        monitor_stop = threading.Event()
        monitor = threading.Thread(target=_monitor_gpu_memory, args=(monitor_stop, vram_samples), daemon=True)
        monitor.start()
        notes = [
            "model=datalab-to/surya-ocr-2-gguf",
            "prompt=official_HIGH_ACCURACY_BBOX_PROMPT",
            "transport=authenticated_loopback_only",
            "document_output_treated_as_untrusted_text",
            "outbound_network_not_os_denied; no enforced offline claim",
        ]
        try:
            for page_number, page_path in enumerate(pages, start=1):
                timeout_seconds = remaining_page_timeout(entry)
                if timeout_seconds <= 0:
                    page_results.extend(
                        PageResult(page=index, omitted=True, error="RUN_WALL_CLOCK_LIMIT")
                        for index in range(page_number, len(pages) + 1)
                    )
                    break
                try:
                    with Image.open(page_path) as image:
                        width, height = image.size
                    raw = self._predict(page_path, timeout_seconds)
                    blocks = _extract_blocks(raw, page_number, width, height)
                    page_results.append(PageResult(page=page_number, text_blocks=blocks, omitted=not blocks))
                except (KeyError, ValueError, OSError, urllib.error.URLError) as error:
                    page_results.append(
                        PageResult(
                            page=page_number,
                            omitted=True,
                            error=f"SURYA_CONTROLLED_FAILURE:{type(error).__name__}:{str(error)[:300]}",
                        )
                    )
                if server:
                    try:
                        peak_ram = max(peak_ram, server.memory_info().rss)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        server = None
        finally:
            monitor_stop.set()
            monitor.join(timeout=6)
        elapsed_ms = (time.perf_counter() - started) * 1000
        cpu_seconds = None
        cpu_utilization = None
        if server and cpu_started:
            try:
                cpu_finished = server.cpu_times()
                cpu_seconds = (cpu_finished.user + cpu_finished.system) - (cpu_started.user + cpu_started.system)
                cpu_utilization = 100 * cpu_seconds / max(elapsed_ms / 1000, 0.001) / max(1, os.cpu_count() or 1)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return DocumentResult(
            document_id=entry["document_id"],
            pages=page_results,
            engine=EngineMetadata(
                candidate=self.name,
                version="Surya OCR 2 GGUF",
                revision=self.revision,
                device="VULKAN1:RTX_3070_LAPTOP_GPU",
                cold_start_ms=self.cold_start_ms,
                elapsed_ms=elapsed_ms,
                peak_ram_bytes=peak_ram or None,
                peak_vram_bytes=max(vram_samples) if vram_samples else None,
                cpu_seconds=cpu_seconds,
                cpu_utilization_percent=cpu_utilization,
                offline=False,
                status="OK" if all(page.error is None for page in page_results) else "PARTIAL",
                notes=notes,
            ),
            schema_version=SCHEMA_VERSION,
        )
