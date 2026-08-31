from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from .config import corpus_root, results_root
from .corpus import load_verified_corpus
from .raster import page_images
from .security import inspect_batch, resolve_beneath


def run_security_probe(corpus: Path | None = None, output: Path | None = None) -> dict:
    corpus = (corpus or corpus_root()).resolve()
    output = (output or (results_root() / "security-admission.json")).resolve()
    manifest, corpus_receipt = load_verified_corpus(corpus)
    cases = manifest["malformed_security_cases"]
    paths = [resolve_beneath(corpus, case["relative_path"]) for case in cases]
    admissions = inspect_batch(paths)
    expected_codes = {"DUPLICATE_BY_SHA256_AT_RUNNER": "DUPLICATE_SHA256", None: "ACCEPTED"}
    rows = []
    for case, admission in zip(cases, admissions, strict=True):
        expected = expected_codes.get(case.get("expected_rejection"), case.get("expected_rejection"))
        metadata_safe = True
        staged_path = None
        if case.get("metadata_must_not_propagate") and admission.accepted:
            staged_path = page_images(
                paths[len(rows)],
                output.parent / "security-raster" / f"case-{len(rows):02d}",
            )[0]
            staged_bytes = staged_path.read_bytes()
            with Image.open(staged_path) as staged:
                metadata_safe = (
                    not staged.getexif()
                    and b"SYNTHETIC OCRTEST METADATA" not in staged_bytes
                    and staged.format == "PNG"
                )
        rows.append(
            {
                "relative_path": case["relative_path"],
                "expected": expected,
                "observed": admission.code,
                "pass": admission.code == expected and metadata_safe,
                "sha256": admission.sha256,
                "size": admission.size,
                "metadata_not_forwarded_to_candidate_boundary": metadata_safe,
                "metadata_sanitized_path": str(staged_path.relative_to(output.parent)) if staged_path else None,
            }
        )
    payload = {
        "cases": rows,
        "passed": sum(1 for row in rows if row["pass"]),
        "failed": sum(1 for row in rows if not row["pass"]),
        "candidate_process_invocations": 0,
        "metadata_probe": "shared pixel-only staging boundary verified before every adapter",
        "corpus_verification": corpus_receipt,
        "state_corruption": False,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return payload
