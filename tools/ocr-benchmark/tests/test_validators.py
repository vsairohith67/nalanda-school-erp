from __future__ import annotations

from nalanda_ocr_benchmark.validators import validate_candidate


def test_validators_flag_without_correcting() -> None:
    assert validate_candidate("date", "2026-08-30") == "VALID_FORMAT"
    assert validate_candidate("date", "01/02/2026") == "AMBIGUOUS"
    assert validate_candidate("date", "31/02/2026") == "INVALID_FORMAT"
    assert validate_candidate("phone", "00000 00001") == "VALID_FORMAT"
    assert validate_candidate("phone", "00000 0000X") == "INVALID_FORMAT"
    assert validate_candidate("date", None) == "MISSING"
    assert validate_candidate("class", "CLASS S", allowed_values=["CLASS 5"]) == "INVALID_FORMAT"
