from __future__ import annotations

import re
from datetime import datetime
from typing import Literal, Sequence


ValidatorState = Literal["VALID_FORMAT", "INVALID_FORMAT", "AMBIGUOUS", "MISSING"]


def validate_candidate(
    field_type: str,
    value: str | None,
    *,
    allowed_values: Sequence[str] | None = None,
) -> ValidatorState:
    """Validate format only; never rewrite or factually endorse an OCR value."""

    if value is None or not value.strip():
        return "MISSING"
    candidate = value.strip()
    if allowed_values is not None:
        matches = [item for item in allowed_values if item.casefold() == candidate.casefold()]
        return "VALID_FORMAT" if len(matches) == 1 else "INVALID_FORMAT"
    if field_type == "date":
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate):
            try:
                datetime.strptime(candidate, "%Y-%m-%d")
                return "VALID_FORMAT"
            except ValueError:
                return "INVALID_FORMAT"
        if re.fullmatch(r"\d{2}[-/]\d{2}[-/]\d{4}", candidate):
            day, month, _year = [int(item) for item in re.split(r"[-/]", candidate)]
            try:
                datetime.strptime(candidate.replace("/", "-"), "%d-%m-%Y")
            except ValueError:
                return "INVALID_FORMAT"
            return "AMBIGUOUS" if day <= 12 and month <= 12 else "VALID_FORMAT"
        return "INVALID_FORMAT"
    if field_type == "phone":
        digits = re.sub(r"[ -]", "", candidate)
        return "VALID_FORMAT" if re.fullmatch(r"\d{10}", digits) else "INVALID_FORMAT"
    if field_type == "email":
        return (
            "VALID_FORMAT"
            if re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", candidate)
            else "INVALID_FORMAT"
        )
    if field_type in {"identifier", "academic_year"}:
        pattern = r"[A-Za-z0-9][A-Za-z0-9._/-]{2,63}"
        return "VALID_FORMAT" if re.fullmatch(pattern, candidate) else "INVALID_FORMAT"
    if field_type in {"class", "section"}:
        return "AMBIGUOUS"
    return "AMBIGUOUS"
