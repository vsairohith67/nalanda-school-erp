from __future__ import annotations

from pathlib import Path

from PIL import Image

from nalanda_ocr_benchmark.config import ResourceLimits
import sys

from nalanda_ocr_benchmark.adapters.process import run_bounded
from nalanda_ocr_benchmark.adapters.base import remaining_page_timeout
from nalanda_ocr_benchmark.raster import page_images
from nalanda_ocr_benchmark.security import inspect_batch, inspect_input, minimal_candidate_environment, resolve_beneath, safe_document_id


def test_candidate_environment_drops_credentials(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "file:operational.db")
    monkeypatch.setenv("HF_TOKEN", "secret")
    monkeypatch.setenv("GITHUB_TOKEN", "secret")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "secret")
    environment = minimal_candidate_environment()
    assert "DATABASE_URL" not in environment
    assert "HF_TOKEN" not in environment
    assert "GITHUB_TOKEN" not in environment
    assert "AWS_SECRET_ACCESS_KEY" not in environment
    assert environment["HF_HUB_OFFLINE"] == "1"


def test_extension_mime_mismatch_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "fake.jpg"
    path.write_bytes(b"%PDF-1.4\n%%EOF")
    result = inspect_input(path)
    assert result.accepted is False
    assert result.code == "MIME_EXTENSION_MISMATCH"


def test_dimension_limit_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "large.png"
    Image.new("RGB", (101, 20), "white").save(path)
    limits = ResourceLimits(
        max_file_bytes=1024 * 1024,
        max_pages=2,
        max_dimension=100,
        max_pixels_per_page=100_000,
        max_pixels_per_document=200_000,
        max_seconds_per_page=1,
        max_output_bytes_per_page=1024,
    )
    result = inspect_input(path, limits)
    assert result.accepted is False
    assert result.code == "IMAGE_DIMENSION_LIMIT"


def test_corrupt_images_fail_closed(tmp_path: Path) -> None:
    for name, payload in (("corrupt.jpg", b"\xff\xd8\xffbroken"), ("corrupt.png", b"\x89PNG\r\n\x1a\nbroken")):
        path = tmp_path / name
        path.write_bytes(payload)
        result = inspect_input(path)
        assert result.accepted is False
        assert result.code in {"CORRUPT_IMAGE", "MIME_EXTENSION_MISMATCH"}


def test_batch_admission_rejects_duplicate_bytes(tmp_path: Path) -> None:
    first = tmp_path / "first.png"
    second = tmp_path / "second.png"
    Image.new("RGB", (10, 10), "white").save(first)
    second.write_bytes(first.read_bytes())
    admissions = inspect_batch([first, second])
    assert admissions[0].code == "ACCEPTED"
    assert admissions[1].code == "DUPLICATE_SHA256"


def test_manifest_path_cannot_escape_corpus_root(tmp_path: Path) -> None:
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    inside = corpus / "page.png"
    Image.new("RGB", (10, 10), "white").save(inside)
    assert resolve_beneath(corpus, "page.png") == inside.resolve()
    for value in ("../outside.png", str((tmp_path / "outside.png").resolve())):
        try:
            resolve_beneath(corpus, value)
        except ValueError as error:
            assert "OUTSIDE_ROOT" in str(error)
        else:
            raise AssertionError("manifest path escaped corpus root")


def test_document_id_cannot_escape_output_directory() -> None:
    assert safe_document_id("admission-english--rotation-090") == "admission-english--rotation-090"
    for value in ("../escape", "nested/page", "", "A" * 129):
        try:
            safe_document_id(value)
        except ValueError as error:
            assert "UNSAFE_DOCUMENT_ID" in str(error)
        else:
            raise AssertionError("unsafe document ID was accepted")


def test_candidate_boundary_strips_exif_metadata(tmp_path: Path) -> None:
    source = tmp_path / "source.jpg"
    exif = Image.Exif()
    exif[0x010E] = "SYNTHETIC OCRTEST METADATA"
    Image.new("RGB", (32, 32), "white").save(source, exif=exif)
    staged = page_images(source, tmp_path / "staged")[0]
    with Image.open(staged) as image:
        assert image.format == "PNG"
        assert not image.getexif()
    assert b"SYNTHETIC OCRTEST METADATA" not in staged.read_bytes()


def test_bounded_process_drains_and_stops_excess_output(tmp_path: Path) -> None:
    evidence = run_bounded(
        [sys.executable, "-c", "import sys; sys.stdout.buffer.write(b'x' * 2000000)"],
        cwd=tmp_path,
        environment=minimal_candidate_environment(),
        timeout_seconds=10,
        max_output_bytes=1024,
    )
    assert evidence.output_limited is True
    assert len(evidence.stdout.encode("utf-8")) <= 1024


def test_page_timeout_never_exceeds_remaining_run_budget(monkeypatch) -> None:
    monkeypatch.setattr("nalanda_ocr_benchmark.adapters.base.time.perf_counter", lambda: 100.0)
    assert remaining_page_timeout({"_run_deadline_monotonic": 103.5}, 120) == 3.5
    assert remaining_page_timeout({"_run_deadline_monotonic": 99.0}, 120) == 0.0
    assert remaining_page_timeout({}, 15) == 15.0
