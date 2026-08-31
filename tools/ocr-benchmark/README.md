# Nalanda OCR Benchmark 1A

This workspace is benchmark tooling only. It does not expose an ERP route, add a
database model, or write an OCR value into an authoritative record.

All corpus identities are deterministic `OCRTEST` identities. Generated pages,
model weights, caches, raw OCR output, and profiles belong under the ignored
`.codex/artifacts/OCR-BENCHMARK-1A` root.

The benchmark enforces bounded files before an engine sees them: 25 pages,
25 MiB, 6,000 pixels on either axis, 40 million pixels per page, 120 million
pixels per document, and a per-page timeout. Candidate commands are invoked as
argument arrays with a minimal environment. Heavy/custom-code engines must run
inside the documented container profile with read-only input, bounded output,
no ERP database mount, no repository secrets, and no outbound route during
inference (`--network none` or an internal-only server/client network).

Commands are exposed from the repository root as `pnpm.cmd ocr:*`. Run
`pnpm.cmd ocr:corpus:generate` first. A fresh machine must provide Georgia Bold
through `OCR_GEORGIA_BOLD` (Windows normally provides `georgiab.ttf`); generation
fails closed if the school-name font is missing.

## Reproducible setup

All versions, revisions, licences and expected model hashes are in
`candidates/candidate-lock.json`. Create the core environment without adding OCR
packages to the ERP:

```powershell
uv sync --project tools/ocr-benchmark --frozen
pnpm.cmd ocr:qa
pnpm.cmd ocr:corpus:generate
pnpm.cmd ocr:security:probe
```

Model downloads are an explicit online preparation phase. Use the immutable
revisions in the candidate lock and verify every listed SHA-256 before inference.
Put them under `.codex/artifacts/OCR-BENCHMARK-1A/models`; never put a token in a
command transcript. Actual inference is offline:

- Tesseract: put the pinned `eng`, `hin`, `tel` and `osd` traineddata in
  `models/tessdata_best-e12c65a` and set `TESSDATA_PREFIX` only if using another
  verified location.
- PaddleOCR: prefetch the four named official models into
  `models/paddleocr/official_models`, build the candidate image from
  `candidates/paddle/Dockerfile`, then run `pnpm.cmd ocr:benchmark:paddle`.
- Unlimited-OCR: download the complete Hugging Face snapshot at the locked
  revision into `models/unlimited-ocr`, verify the 3B safetensors hash, pull the
  locked vLLM digest and build `candidates/client/Dockerfile`. The launcher alone
  creates its internal network and custom-code sandbox.
- Surya: download the locked GGUF, projector and chat template to
  `models/surya-ocr-2-gguf`, verify hashes, and provide the locked llama.cpp
  runtime on `PATH`.

## Commands

```powershell
pnpm.cmd ocr:benchmark:tesseract
pnpm.cmd ocr:benchmark:paddle
pnpm.cmd ocr:benchmark:unlimited
pnpm.cmd ocr:benchmark:surya
pnpm.cmd ocr:benchmark:all
pnpm.cmd ocr:preprocess
pnpm.cmd ocr:report
```

`ocr:benchmark:all` expects every prerequisite to exist and fails rather than
downloading at inference time. Raw normalized output, run manifests and reports
remain under the ignored artifact root. A candidate's `offline` metadata is not
proof on its own; the corresponding launcher/network evidence is authoritative.
