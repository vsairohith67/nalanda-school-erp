from __future__ import annotations

import json
from pathlib import Path

from nalanda_ocr_benchmark.corpus import generate_corpus, verify_corpus


def _hash_map(manifest: dict) -> dict[str, str]:
    return {item["relative_path"]: item["sha256"] for item in manifest["files"]}


def test_corpus_is_byte_deterministic(tmp_path: Path) -> None:
    first = generate_corpus(tmp_path / "first")
    second = generate_corpus(tmp_path / "second")
    assert _hash_map(first) == _hash_map(second)
    assert first["documents"] == second["documents"]


def test_corpus_covers_required_language_and_document_matrix(tmp_path: Path) -> None:
    manifest = generate_corpus(tmp_path / "corpus")
    languages = {item["language"] for item in manifest["documents"]}
    assert {"en", "hi", "te", "en+hi", "en+te", "en+hi+te"}.issubset(languages)
    categories = {item["category"] for item in manifest["documents"]}
    assert {
        "admission-application",
        "student-information",
        "guardian-information",
        "staff-joining",
        "leave-application",
        "transfer-letter",
        "structured-register",
        "table-heavy",
        "handwriting-connected",
        "mixed-printed-handwritten",
        "prompt-injection-like",
        "pdf-multi-page",
        "pdf-native-text",
        "pdf-image-only",
        "pdf-mixed",
    }.issubset(categories)
    assert {item.get("scan_dpi") for item in manifest["documents"]} >= {150, 200, 300, 600, None}
    assert {item.get("scan_mode") for item in manifest["documents"]} >= {"colour", "grayscale", "black-white", None}
    assert len([item for item in manifest["documents"] if item["category"] == "phone-camera-degradation"]) == 18
    assert manifest["printed_text_matrix"]["font_weights"] == ["regular", "bold"]
    assert "two-column" in manifest["printed_text_matrix"]["layouts"]
    assert verify_corpus(tmp_path / "corpus")["ok"]


def test_ground_truth_is_structured_and_synthetic(tmp_path: Path) -> None:
    manifest = generate_corpus(tmp_path / "corpus")
    serialized = json.dumps(manifest, ensure_ascii=False).casefold()
    assert "ocrtest" in serialized
    assert "example.invalid" not in serialized
    assert "aadhaar" not in serialized
    assert "apaar" not in serialized
    for document in manifest["documents"]:
        assert document["synthetic_only"] is True
        for field in document["fields"]:
            assert {"page", "field_id", "field_label", "expected_value", "field_type", "critical", "language"} <= field.keys()


def test_existing_output_is_never_overwritten(tmp_path: Path) -> None:
    target = tmp_path / "corpus"
    generate_corpus(target)
    try:
        generate_corpus(target)
    except RuntimeError as error:
        assert "CORPUS_OUTPUT_EXISTS" in str(error)
    else:
        raise AssertionError("generator overwrote an existing corpus")


def test_corpus_verification_rejects_manifest_or_file_tampering(tmp_path: Path) -> None:
    target = tmp_path / "corpus"
    manifest = generate_corpus(target)
    first = target / manifest["documents"][0]["relative_path"]
    first.write_bytes(first.read_bytes() + b"tamper")
    receipt = verify_corpus(target)
    assert receipt["ok"] is False
    assert any("FILE_INTEGRITY_MISMATCH" in item for item in receipt["mismatches"])
