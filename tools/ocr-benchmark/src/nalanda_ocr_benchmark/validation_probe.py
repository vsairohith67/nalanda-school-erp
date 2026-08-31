from __future__ import annotations

import json
from pathlib import Path

from .config import results_root
from .validators import validate_candidate


def run_validation_probe(output: Path | None = None) -> dict:
    cases = [
        ("date", "2026-08-30", None, "VALID_FORMAT"),
        ("date", "01/02/2026", None, "AMBIGUOUS"),
        ("date", "31/02/2026", None, "INVALID_FORMAT"),
        ("phone", "00000 00001", None, "VALID_FORMAT"),
        ("phone", "00000 0000X", None, "INVALID_FORMAT"),
        ("email", "ocrtest@example.invalid", None, "VALID_FORMAT"),
        ("identifier", "OCRTEST-0001", None, "VALID_FORMAT"),
        ("class", "CLASS 5", ["CLASS 4", "CLASS 5", "CLASS 6"], "VALID_FORMAT"),
        ("class", "CLASS S", ["CLASS 4", "CLASS 5", "CLASS 6"], "INVALID_FORMAT"),
        ("date", None, None, "MISSING"),
    ]
    rows = []
    for field_type, value, allowed, expected in cases:
        observed = validate_candidate(field_type, value, allowed_values=allowed)
        rows.append(
            {
                "field_type": field_type,
                "input": value,
                "expected": expected,
                "observed": observed,
                "pass": observed == expected,
                "value_was_rewritten": False,
            }
        )
    payload = {
        "cases": rows,
        "passed": sum(1 for row in rows if row["pass"]),
        "failed": sum(1 for row in rows if not row["pass"]),
        "authoritative_correction_performed": False,
    }
    target = output or (results_root() / "field-validation.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return payload
