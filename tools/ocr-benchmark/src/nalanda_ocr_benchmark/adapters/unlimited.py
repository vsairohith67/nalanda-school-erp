from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from ..config import LIMITS, SCHEMA_VERSION
from ..raster import page_images
from ..schema import DocumentResult, EngineMetadata, PageResult, TextBlock
from .base import CandidateAdapter, remaining_page_timeout


PROMPT = "<image>document parsing."
EXPECTED_REVISION = "07dea832e22aefee32ad281d4b80551282e1c168"
EXPECTED_IMAGE_DIGEST = "sha256:b7a7be708c9a325107cdeddeba095e5637617716b3ab469c19d34759ec1afa39"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001, ANN201
        raise urllib.error.HTTPError(req.full_url, code, "REDIRECT_REJECTED", headers, fp)


def _validated_internal_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urllib.parse.urlsplit(value)
    if (
        parsed.scheme != "http"
        or parsed.port != 8000
        or not parsed.hostname
        or not re.fullmatch(r"nalanda-ocr-unlimited-server-\d+-[0-9a-f]{8}", parsed.hostname)
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        return None
    return f"http://{parsed.hostname}:8000"


def _clean_grounded_output(raw: str) -> str:
    value = re.sub(r"<\|det\|>.*?<\|/det\|>", " ", raw, flags=re.DOTALL)
    value = value.replace("<|ref|>", "").replace("<|/ref|>", "")
    value = re.sub(r"<\|[^>]+\|>", " ", value)
    return "\n".join(line.rstrip() for line in value.splitlines()).strip()


class UnlimitedOCRServerAdapter(CandidateAdapter):
    name = "unlimited-ocr"

    def __init__(self) -> None:
        self.url = _validated_internal_url(os.environ.get("OCR_UNLIMITED_URL"))
        self.api_key = os.environ.get("OCR_UNLIMITED_API_KEY")
        self.cold_start_ms = float(os.environ.get("OCR_UNLIMITED_COLD_START_MS", "0"))
        self.revision = os.environ.get("OCR_UNLIMITED_REVISION")
        self.image_digest = os.environ.get("OCR_UNLIMITED_IMAGE_DIGEST", "unknown")
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())

    def available(self) -> tuple[bool, str]:
        if not self.url or not self.api_key:
            return False, "UNLIMITED_OCR_TRUSTED_INTERNAL_ENDPOINT_REQUIRED"
        if self.revision != EXPECTED_REVISION or self.image_digest != EXPECTED_IMAGE_DIGEST:
            return False, "UNLIMITED_OCR_RUNTIME_IDENTITY_MISMATCH"
        try:
            request = urllib.request.Request(
                f"{self.url.rstrip('/')}/health",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            with self._opener.open(request, timeout=5) as response:
                if response.status != 200:
                    return False, f"UNLIMITED_OCR_HEALTH_STATUS:{response.status}"
        except (OSError, urllib.error.URLError) as error:
            return False, f"UNLIMITED_OCR_HEALTH_FAILED:{type(error).__name__}"
        return True, "Unlimited-OCR 3B"

    def _predict(self, image_path: Path, timeout_seconds: float) -> str:
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        media_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
        payload = {
            "model": "Unlimited-OCR",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{encoded}"}},
                    ],
                }
            ],
            "max_tokens": 8192,
            "temperature": 0.0,
            "skip_special_tokens": False,
            "vllm_xargs": {"ngram_size": 35, "window_size": 128},
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
        return _clean_grounded_output(str(raw["choices"][0]["message"]["content"]))

    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        pages = page_images(source, run_dir / "raster" / entry["document_id"])
        started = time.perf_counter()
        page_results: list[PageResult] = []
        notes = [
            "prompt=<image>document parsing.",
            "skip_special_tokens=false",
            "ngram_size=35",
            "window_size=128",
            "runtime_network=docker_internal_only_no_outbound",
            "runtime_filesystem=model_ro_artifacts_rw_no_repository_or_database_mount",
            "custom_code_containerized=true",
            f"runtime_image={self.image_digest}",
        ]
        for page_number, page_path in enumerate(pages, start=1):
            timeout_seconds = remaining_page_timeout(entry)
            if timeout_seconds <= 0:
                page_results.extend(
                    PageResult(page=index, omitted=True, error="RUN_WALL_CLOCK_LIMIT")
                    for index in range(page_number, len(pages) + 1)
                )
                break
            try:
                text = self._predict(page_path, timeout_seconds)
                blocks = [TextBlock(text=text, reading_order=0)] if text else []
                page_results.append(PageResult(page=page_number, text_blocks=blocks, omitted=not blocks))
            except (KeyError, ValueError, OSError, urllib.error.URLError) as error:
                page_results.append(
                    PageResult(
                        page=page_number,
                        omitted=True,
                        error=f"UNLIMITED_CONTROLLED_FAILURE:{type(error).__name__}:{str(error)[:300]}",
                    )
                )
        elapsed_ms = (time.perf_counter() - started) * 1000
        return DocumentResult(
            document_id=entry["document_id"],
            pages=page_results,
            engine=EngineMetadata(
                candidate=self.name,
                version="Unlimited-OCR 3B",
                revision=self.revision,
                device="CUDA:RTX_3070_LAPTOP_GPU",
                cold_start_ms=self.cold_start_ms,
                elapsed_ms=elapsed_ms,
                peak_ram_bytes=None,
                peak_vram_bytes=None,
                offline=True,
                status="OK" if all(page.error is None for page in page_results) else "PARTIAL",
                notes=notes,
            ),
            schema_version=SCHEMA_VERSION,
        )
