from __future__ import annotations

import json
from pathlib import Path

from .config import results_root
from .security import sha256_file


def _number(item: dict, key: str, digits: int = 4) -> str:
    value = item.get(key)
    return "N/A" if value is None else f"{float(value):.{digits}f}"


def _mib(value: object) -> str:
    return "N/A" if value is None else f"{int(value) / 1024 / 1024:.1f}"


def build_report(output: Path | None = None) -> Path:
    summaries = []
    for candidate in ("tesseract", "paddleocr", "unlimited-ocr", "surya"):
        candidate_root = results_root() / candidate
        path = candidate_root / "summary.json"
        manifest_path = candidate_root / "run-manifest.json"
        if not path.is_file() or not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("candidate") != candidate or manifest.get("summary_sha256") != sha256_file(path):
            raise RuntimeError(f"REPORT_SUMMARY_INTEGRITY_MISMATCH:{candidate}")
        summary = json.loads(path.read_text(encoding="utf-8"))
        if summary.get("candidate") != candidate:
            raise RuntimeError(f"REPORT_SUMMARY_IDENTITY_MISMATCH:{candidate}")
        summaries.append(summary)
    target = output or (results_root() / "OCR_BENCHMARK_SUMMARY.md")
    lines = [
        "# OCR Benchmark Generated Summary",
        "",
        "This file summarizes raw local evidence. It is not production OCR clearance.",
        "",
        "| Candidate | Docs/pages | Field exact | Critical exact | CER | WER | Handwriting | Table F1 | Hallucination | Degradation | Rotation | PDF | p50/p95 ms | Pages/min | RAM/VRAM MiB | Status |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for item in summaries:
        lines.append(
            "| {candidate} | {documents}/{pages} | {field} | {critical} | {cer} | {wer} | {handwriting} | {table} | {hallucination} | {degradation} | {rotation} | {pdf} | {p50}/{p95} | {ppm} | {ram}/{vram} | `{statuses}` |".format(
                candidate=item["candidate"],
                documents=item["documents"],
                pages=item.get("pages", "N/A"),
                field=_number(item, "normalized_exact_field_accuracy"),
                critical=_number(item, "critical_field_exact_accuracy"),
                cer=_number(item, "character_error_rate"),
                wer=_number(item, "word_error_rate"),
                handwriting=_number(item, "handwritten_field_accuracy"),
                table=_number(item, "table_cell_f1"),
                hallucination=_number(item, "critical_field_hallucination_rate"),
                degradation=_number(item, "degradation_robustness"),
                rotation=_number(item, "rotation_robustness"),
                pdf=_number(item, "pdf_exact_field_accuracy"),
                p50=_number(item, "latency_p50_ms", 1),
                p95=_number(item, "latency_p95_ms", 1),
                ppm=_number(item, "pages_per_minute", 2),
                ram=_mib(item.get("peak_ram_bytes")),
                vram=_mib(item.get("peak_vram_bytes")),
                statuses=json.dumps(item.get("status_counts", {}), sort_keys=True),
            )
        )
    lines.extend(["", "## Exact field accuracy by language", ""])
    languages = sorted(
        {language for item in summaries for language in item.get("exact_field_accuracy_by_language", {})}
    )
    lines.append("| Candidate | " + " | ".join(languages) + " |")
    lines.append("| --- | " + " | ".join("---:" for _ in languages) + " |")
    for item in summaries:
        values = item.get("exact_field_accuracy_by_language", {})
        lines.append(
            "| " + item["candidate"] + " | " + " | ".join(
                "N/A" if language not in values else f"{float(values[language]):.4f}"
                for language in languages
            ) + " |"
        )
    lines.extend(
        [
            "",
            "Language cells are not cross-language matched pairs: they retain every corpus document carrying that language label, including degradations and PDFs. Consult raw metrics and the corpus manifest before interpreting them.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return target
