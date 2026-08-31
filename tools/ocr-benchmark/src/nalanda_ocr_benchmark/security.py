from __future__ import annotations

import hashlib
import os
import re
from dataclasses import asdict, dataclass
from pathlib import Path

import filetype
import pypdfium2 as pdfium
from PIL import Image, UnidentifiedImageError

from .config import LIMITS, ResourceLimits


@dataclass(frozen=True)
class Admission:
    accepted: bool
    code: str
    media_type: str | None
    pages: int
    pixels: int
    sha256: str
    size: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_beneath(root: Path, relative_path: str) -> Path:
    """Resolve a manifest path without allowing absolute/traversal/symlink escape."""

    if not relative_path or Path(relative_path).is_absolute():
        raise ValueError("CORPUS_PATH_OUTSIDE_ROOT")
    resolved_root = root.resolve()
    candidate = (resolved_root / relative_path).resolve()
    try:
        candidate.relative_to(resolved_root)
    except ValueError as error:
        raise ValueError("CORPUS_PATH_OUTSIDE_ROOT") from error
    return candidate


def safe_document_id(value: object) -> str:
    identifier = str(value)
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", identifier):
        raise ValueError("UNSAFE_DOCUMENT_ID")
    return identifier


def _rejected(path: Path, code: str, media_type: str | None = None) -> Admission:
    return Admission(False, code, media_type, 0, 0, sha256_file(path), path.stat().st_size)


def inspect_input(path: Path, limits: ResourceLimits = LIMITS) -> Admission:
    path = path.resolve()
    if not path.is_file():
        raise ValueError("INPUT_NOT_REGULAR_FILE")
    size = path.stat().st_size
    if size == 0:
        return _rejected(path, "EMPTY_FILE")
    if size > limits.max_file_bytes:
        return _rejected(path, "FILE_TOO_LARGE")
    kind = filetype.guess(str(path))
    media_type = kind.mime if kind else None
    suffix = path.suffix.lower()
    expected = {
        ".jpg": {"image/jpeg"},
        ".jpeg": {"image/jpeg"},
        ".png": {"image/png"},
        ".webp": {"image/webp"},
        ".pdf": {"application/pdf"},
    }
    if suffix not in expected:
        return _rejected(path, "UNSUPPORTED_EXTENSION", media_type)
    if media_type not in expected[suffix]:
        return _rejected(path, "MIME_EXTENSION_MISMATCH", media_type)
    digest = sha256_file(path)
    if media_type.startswith("image/"):
        Image.MAX_IMAGE_PIXELS = limits.max_pixels_per_page
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                width, height = image.size
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            return Admission(False, "DECOMPRESSION_BOMB", media_type, 0, 0, digest, size)
        except (UnidentifiedImageError, OSError, ValueError):
            return Admission(False, "CORRUPT_IMAGE", media_type, 0, 0, digest, size)
        pixels = width * height
        if width > limits.max_dimension or height > limits.max_dimension:
            return Admission(False, "IMAGE_DIMENSION_LIMIT", media_type, 0, pixels, digest, size)
        if pixels > limits.max_pixels_per_page:
            return Admission(False, "IMAGE_PIXEL_LIMIT", media_type, 0, pixels, digest, size)
        return Admission(True, "ACCEPTED", media_type, 1, pixels, digest, size)
    try:
        document = pdfium.PdfDocument(str(path))
        pages = len(document)
        if pages == 0:
            return Admission(False, "PDF_EMPTY", media_type, 0, 0, digest, size)
        if pages > limits.max_pages:
            return Admission(False, "PDF_PAGE_LIMIT", media_type, pages, 0, digest, size)
        total_pixels = 0
        for index in range(pages):
            width_pt, height_pt = document[index].get_size()
            width = int(round(width_pt * 2))
            height = int(round(height_pt * 2))
            pixels = width * height
            if width > limits.max_dimension or height > limits.max_dimension:
                return Admission(False, "PDF_DIMENSION_LIMIT", media_type, pages, total_pixels, digest, size)
            if pixels > limits.max_pixels_per_page:
                return Admission(False, "PDF_PAGE_PIXEL_LIMIT", media_type, pages, total_pixels, digest, size)
            total_pixels += pixels
            if total_pixels > limits.max_pixels_per_document:
                return Admission(False, "PDF_TOTAL_PIXEL_LIMIT", media_type, pages, total_pixels, digest, size)
        return Admission(True, "ACCEPTED", media_type, pages, total_pixels, digest, size)
    except (pdfium.PdfiumError, RuntimeError, ValueError, OSError):
        return Admission(False, "MALFORMED_PDF", media_type, 0, 0, digest, size)


def inspect_batch(paths: list[Path], limits: ResourceLimits = LIMITS) -> list[Admission]:
    """Admit a batch once, rejecting repeated bytes before any OCR engine runs."""

    seen: set[str] = set()
    results: list[Admission] = []
    for path in paths:
        admission = inspect_input(path, limits)
        if admission.accepted and admission.sha256 in seen:
            admission = Admission(
                accepted=False,
                code="DUPLICATE_SHA256",
                media_type=admission.media_type,
                pages=admission.pages,
                pixels=admission.pixels,
                sha256=admission.sha256,
                size=admission.size,
            )
        elif admission.accepted:
            seen.add(admission.sha256)
        results.append(admission)
    return results


def minimal_candidate_environment(extra: dict[str, str] | None = None) -> dict[str, str]:
    allow = [
        "PATH",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
        "CUDA_VISIBLE_DEVICES",
        "TESSDATA_PREFIX",
        "PADDLE_PDX_CACHE_HOME",
        "HF_HOME",
        "TORCH_HOME",
    ]
    environment = {key: os.environ[key] for key in allow if key in os.environ}
    environment.update(
        {
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
            "NO_PROXY": "*",
            "HTTP_PROXY": "",
            "HTTPS_PROXY": "",
            "ALL_PROXY": "",
        }
    )
    if extra:
        environment.update(extra)
    return environment
