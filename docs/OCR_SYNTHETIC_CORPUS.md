# OCR Benchmark 1A Synthetic Corpus

The benchmark corpus is deterministic, synthetic-only and excluded from Git. No Student, Guardian, Staff or school operational document was used.

## Immutable identity

- Generator seed: `20260830`.
- Corpus schema: `nalanda-ocr-benchmark-1.0`.
- Manifest SHA-256: `84c13b92234d3309d51a6bc38883f08cac08034a839d64719eb9219ed9f7ec0c`.
- 50 benchmark documents, 59 generated files and 77 benchmark pages.
- Aggregate admitted inputs: 3,292,436 bytes and 172,586,069 decoded pixels.
- Heavy output root: `.codex/artifacts/OCR-BENCHMARK-1A/corpus-v1` (ignored).
- Synthetic names use the `OCRTEST` namespace; phone numbers use unmistakably fake `00000` patterns; addresses are explicitly fictional.

The full `NALANDA PUBLIC SCHOOL` heading is rendered with Georgia Bold. The observed Georgia Bold font SHA-256 is `72a6cd94fab6c179392075d3fb361e269cdddfad41bb7ab385fa22a37e49a900`. Ordinary body text uses regular-weight pinned Noto assets. Script shaping uses pinned Noto Devanagari and Noto Telugu assets; handwriting-like examples use pinned, redistributable Google Fonts with their OFL texts committed beside the generator.

## Coverage

| Matrix | Coverage |
| --- | --- |
| Languages | English, Hindi, Telugu, English+Hindi, English+Telugu, English+Hindi+Telugu |
| Base documents | Admission, Student, Guardian, Staff joining, leave, transfer, registers/tables, handwriting and mixed print/handwriting |
| Phone-camera variants | 18 deterministic variants: cardinal/slight rotation, perspective, shadow, uneven light, low contrast, over/underexposure, blur, motion blur, low resolution, crease, clutter, partial crop and JPEG compression |
| Scanner variants | 150/200/300/600 DPI crossed with colour, grayscale and black-and-white |
| PDFs | Native text, image-only, mixed, multi-page, duplicate page, blank page, rotated page and a bounded 25-page document |
| Adversarial | Empty-value hallucination fields and visible prompt-injection-like document text |
| Malformed/security | Corrupt JPEG/PNG, malformed/polyglot-like PDF, MIME mismatch, unsupported type, dimension bomb header, EXIF-bearing image and duplicate bytes |

Handwriting is synthetic handwriting-like evidence, not a certified benchmark of natural Telugu or Hindi handwriting. Any production decision must keep difficult handwriting in manual review until a legally reusable, representative handwriting set is approved.

## Ground truth

Each document entry contains a stable ID, path, page count, language combination, category, structured fields, critical-field flag, handwriting flag, page number, expected value and optional pixel region. Table examples contain expected cell text and coordinates. Ground truth is generated before OCR and is never edited in response to model output.

Metrics retain language and category breakdowns. Difficult rotations, crop damage, blank pages and the 25-page boundary are not removed from aggregates to improve a model's score.

## Admission limits

- 25 MiB per file.
- 25 pages.
- 6,000 pixels on either axis.
- 40 million pixels per page and 120 million pixels per document.
- 120 seconds per page.
- 2 MiB captured candidate output per page.
- 5 MiB manifest, 64 documents, 128 pages, 512 MiB inputs and 3 billion decoded pixels per run.
- Four-hour aggregate hard deadline; each blocking page/script/request receives only the smaller of its page cap and the remaining run budget.
- Extension/MIME agreement, decode verification and bounded PDF parsing occur before a candidate runs.
- Duplicate input bytes are rejected by SHA-256 within a batch.

The nine malformed/security cases pass their expected admission outcomes without invoking an OCR candidate.

## Reproduction

From the repository root:

```powershell
pnpm.cmd ocr:corpus:generate
uv run --project tools/ocr-benchmark python -m nalanda_ocr_benchmark corpus-verify
pnpm.cmd ocr:security:probe
```

Generation fails if the destination already exists. Reproducibility tests generate into fresh temporary directories twice and require byte-identical manifests and files. On a non-Windows host, `OCR_GEORGIA_BOLD` must point to a legitimately available Georgia Bold font; generation fails closed if it is absent.

Generated images, PDFs, OCR output and downloaded weights must remain ignored. Only the generator, small font assets whose licences permit redistribution, locks, checksums and sanitized summaries may be committed.
