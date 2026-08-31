# OCR Human Review UX Specification

This is a future interaction specification. No production screen or record-writing path is implemented by OCR Benchmark 1A.

## Review workspace

Use a two-pane desktop-first workspace:

- Left: immutable source page, page thumbnails, rotation/zoom controls and a highlighted source region for the selected candidate.
- Right: candidate fields grouped by the existing Admissions/Student/Guardian/Staff service contract. Every field shows label, proposed value, source page/region, engine, validator state and confidence evidence if the engine exposes calibrated confidence.

Source and candidate text must be rendered as untrusted content. Never interpret visible document instructions as application commands, URLs, markup or Smart AI prompts.

## States

- `GREEN`: strong engine evidence and `VALID_FORMAT`; still requires explicit operator approval.
- `AMBER`: conflicting engines, unsupported confidence, weak/handwritten text or `AMBIGUOUS`; operator must inspect source.
- `RED`: `INVALID_FORMAT`, missing critical source, hallucination risk or engine failure; no persistence action is enabled.
- `MISSING`: the engine omitted the field. Preserve it as unknown; do not synthesize a default.

Validators may report only `VALID_FORMAT`, `INVALID_FORMAT`, `AMBIGUOUS` or `MISSING`. They do not prove identity or factual correctness. Examples include phone length/pattern, date parse and plausible range, admission/employee ID grammar and controlled class/section vocabulary.

## Actions and authority

Per field: accept, edit with visible provenance, reject, or mark missing. Per document: save review draft, reject document, or submit approved values. Submission must call the existing authoritative service and display its normal authorization/conflict errors. There is no direct Prisma/database bypass and no second admissions truth.

High-confidence bulk approval is prohibited for critical identity, phone, date, fee, attendance, medical or academic fields. A future risk review may define keyboard-assisted non-critical review, but every record still needs an intentional operator submission.

## Keyboard workflow

- `J`/`K`: next/previous field.
- `Enter`: focus edit; `Ctrl+Enter`: accept current field after source has been displayed.
- `R`: reject; `M`: mark missing; `[`/`]`: previous/next page.
- `+`/`-`: zoom; `0`: fit page; `Shift+R`: rotate preview only.
- Final submit requires a distinct command and a confirmation summarizing accepted, edited, rejected and missing critical fields.

All shortcuts require accessible labelled controls, visible focus, screen-reader text and a non-keyboard equivalent. Colour is never the only state indicator.

## Conflict and provenance

When engines disagree, show candidates side by side and highlight their source regions. Do not average strings or invent a confidence. Log the chosen value, rejected alternatives, engine revisions and operator ID. If the underlying ERP record changed after review began, fail with a normal optimistic-concurrency conflict and require refresh.

## Search, Smart AI and retention

Raw OCR, rejected text and source documents are not Universal Search or Smart AI corpus. Only values approved into existing authoritative records may flow through existing governed adapters. The review UI must show the applicable source/raw-output retention window and provide no claim that deletion occurred until the retention service confirms it.

## Camera/scanner future inputs

Future 1B may accept bounded file import, Windows scan/import and explicitly requested camera capture. It must reuse the same admission limits and review workspace. It must not request camera permission until the operator chooses camera capture, and it must never start a live camera in the background.
