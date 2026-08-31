from __future__ import annotations

import time
from abc import ABC, abstractmethod
from pathlib import Path

from ..config import LIMITS, SCHEMA_VERSION
from ..schema import DocumentResult, EngineMetadata, PageResult


class CandidateAdapter(ABC):
    name: str

    @abstractmethod
    def available(self) -> tuple[bool, str]:
        raise NotImplementedError


def remaining_page_timeout(entry: dict, cap_seconds: float = LIMITS.max_seconds_per_page) -> float:
    """Return the smaller of the per-page cap and the remaining hard run budget."""

    deadline = float(entry.get("_run_deadline_monotonic", float("inf")))
    return max(0.0, min(float(cap_seconds), deadline - time.perf_counter()))

    @abstractmethod
    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        raise NotImplementedError


class UnavailableAdapter(CandidateAdapter):
    def __init__(self, name: str, reason: str):
        self.name = name
        self.reason = reason

    def available(self) -> tuple[bool, str]:
        return False, self.reason

    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        now = time.perf_counter()
        return DocumentResult(
            document_id=entry["document_id"],
            pages=[
                PageResult(page=index + 1, omitted=True, error=self.reason)
                for index in range(max(1, int(entry.get("_admitted_pages", 0))))
            ],
            engine=EngineMetadata(
                candidate=self.name,
                version="UNAVAILABLE",
                revision=None,
                device="UNAVAILABLE",
                cold_start_ms=0.0,
                elapsed_ms=(time.perf_counter() - now) * 1000,
                status="UNAVAILABLE",
                notes=[self.reason],
            ),
            schema_version=SCHEMA_VERSION,
        )
