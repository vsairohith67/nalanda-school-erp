from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import corpus_root
from .corpus import generate_corpus, verify_corpus
from .hybrid import simulate_hybrid
from .preprocess import run_preprocessing_experiment
from .report import build_report
from .security_probe import run_security_probe
from .validation_probe import run_validation_probe
from .runner import rescore_candidate, run_all, run_candidate


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="nalanda-ocr-benchmark")
    commands = root.add_subparsers(dest="command", required=True)
    corpus_generate = commands.add_parser("corpus-generate")
    corpus_generate.add_argument("--output", type=Path, default=corpus_root())
    corpus_verify = commands.add_parser("corpus-verify")
    corpus_verify.add_argument("--corpus", type=Path, default=corpus_root())
    benchmark = commands.add_parser("benchmark")
    benchmark.add_argument("--candidate", required=True, choices=("tesseract", "paddleocr", "unlimited-ocr", "surya"))
    benchmark.add_argument("--corpus", type=Path, default=corpus_root())
    benchmark_all = commands.add_parser("benchmark-all")
    benchmark_all.add_argument("--corpus", type=Path, default=corpus_root())
    rescore = commands.add_parser("rescore")
    rescore.add_argument("--candidate", required=True, choices=("tesseract", "paddleocr", "unlimited-ocr", "surya"))
    rescore.add_argument("--corpus", type=Path, default=corpus_root())
    report = commands.add_parser("report")
    report.add_argument("--output", type=Path)
    hybrid = commands.add_parser("hybrid")
    hybrid.add_argument("--primary", required=True, choices=("tesseract", "paddleocr", "unlimited-ocr", "surya"))
    hybrid.add_argument("--fallback", required=True, choices=("tesseract", "paddleocr", "unlimited-ocr", "surya"))
    hybrid.add_argument("--output", type=Path)
    commands.add_parser("preprocess")
    commands.add_parser("security-probe")
    commands.add_parser("validation-probe")
    return root


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    if arguments.command == "corpus-generate":
        result = generate_corpus(arguments.output)
        payload = {"output": str(arguments.output.resolve()), "documents": len(result["documents"]), "files": len(result["files"])}
    elif arguments.command == "corpus-verify":
        payload = verify_corpus(arguments.corpus)
        if not payload["ok"]:
            print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
            return 2
    elif arguments.command == "benchmark":
        payload = run_candidate(arguments.candidate, corpus=arguments.corpus)
    elif arguments.command == "benchmark-all":
        payload = run_all(corpus=arguments.corpus)
    elif arguments.command == "rescore":
        payload = rescore_candidate(arguments.candidate, corpus=arguments.corpus)
    elif arguments.command == "report":
        payload = {"report": str(build_report(arguments.output))}
    elif arguments.command == "hybrid":
        payload = simulate_hybrid(arguments.primary, arguments.fallback, arguments.output)
    elif arguments.command == "preprocess":
        payload = run_preprocessing_experiment()
    elif arguments.command == "security-probe":
        payload = run_security_probe()
    elif arguments.command == "validation-probe":
        payload = run_validation_probe()
    else:
        raise AssertionError(arguments.command)
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
