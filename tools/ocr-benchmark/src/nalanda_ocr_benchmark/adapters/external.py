from __future__ import annotations

import json
import os
from pathlib import Path

from ..config import LIMITS
from ..schema import DocumentResult
from ..security import minimal_candidate_environment
from .base import CandidateAdapter, remaining_page_timeout
from .process import run_bounded


class ExternalJsonAdapter(CandidateAdapter):
    def __init__(self, name: str, command_environment_key: str):
        self.name = name
        self.command_environment_key = command_environment_key
        self.command: list[str] | None = None
        self.reason: str | None = None
        raw = os.environ.get(command_environment_key)
        if not raw:
            self.reason = f"{command_environment_key}_NOT_CONFIGURED"
            return
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list) or not parsed or not all(isinstance(item, str) and item for item in parsed):
                raise ValueError
            self.command = parsed
        except (json.JSONDecodeError, ValueError):
            self.reason = f"{command_environment_key}_INVALID_JSON_ARGV"

    def available(self) -> tuple[bool, str]:
        return (self.command is not None, self.reason or "CONFIGURED")

    def process(self, entry: dict, source: Path, run_dir: Path) -> DocumentResult:
        if self.command is None:
            raise RuntimeError(self.reason or "EXTERNAL_COMMAND_UNAVAILABLE")
        output_path = run_dir / "worker-output" / self.name / f"{entry['document_id']}.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        argv = [*self.command, "--input", str(source), "--entry-json", json.dumps(entry, ensure_ascii=False), "--output", str(output_path)]
        timeout_seconds = remaining_page_timeout(
            entry,
            LIMITS.max_seconds_per_page * max(1, int(entry.get("_admitted_pages", 1))),
        )
        if timeout_seconds <= 0:
            raise RuntimeError(f"{self.name.upper()}_RUN_WALL_CLOCK_LIMIT")
        evidence = run_bounded(
            argv,
            cwd=run_dir,
            environment=minimal_candidate_environment(
                {
                    "OCR_BENCHMARK_RUN_DIR": str(run_dir),
                    "OCR_BENCHMARK_OUTPUT": str(output_path),
                }
            ),
            timeout_seconds=timeout_seconds,
            max_output_bytes=LIMITS.max_output_bytes_per_page,
        )
        if evidence.timed_out or evidence.output_limited:
            raise RuntimeError(f"{self.name.upper()}_WORKER_RESOURCE_LIMIT")
        if evidence.returncode != 0 or not output_path.is_file():
            error = " ".join(evidence.stderr.split())[:1000]
            raise RuntimeError(f"{self.name.upper()}_WORKER_FAILED:{evidence.returncode}:{error}")
        if output_path.stat().st_size > LIMITS.max_output_bytes_per_page * max(1, int(entry.get("pages", 1))):
            raise RuntimeError(f"{self.name.upper()}_OUTPUT_LIMIT")
        raw = json.loads(output_path.read_text(encoding="utf-8"))
        result = DocumentResult.from_dict(raw)
        if result.document_id != entry["document_id"] or result.engine.candidate != self.name:
            raise RuntimeError(f"{self.name.upper()}_OUTPUT_IDENTITY_MISMATCH")
        return result
