# OCR Scanning Foundation 1B — Future Prompt

Status: `GENERATED_NOT_EXECUTED`

Prerequisite: OCR Benchmark 1A must remain cleared and its production boundary must be preserved.

## Mission

Implement a default-off, local-only, human-reviewed OCR scanning foundation using the selected classic PaddleOCR PP-OCRv5 mobile English, Devanagari and Telugu pipeline. Do not introduce an automatic heavy-model fallback. Handwriting, low-confidence, omitted, invalid and structurally complex pages must remain explicit human-review cases.

This prompt is a software-foundation task, not authorization for real documents, operational activation or a private pilot.

## Hard boundaries

- No cloud OCR or hosted inference.
- No real Student, Guardian, Parent, Staff or school document during development/QA.
- No silent or automatic authoritative record creation/update.
- No direct Prisma/database bypass and no second Admissions truth.
- No raw/rejected OCR or source-document indexing in Universal Search or Smart AI.
- No camera permission until an operator explicitly selects a future camera action.
- No always-on camera, scanner driver, public OCR endpoint or uncontrolled background worker.
- No Unlimited-OCR or Surya production integration in 1B.
- Do not represent synthetic handwriting-like results as natural handwriting certification.
- Stop with a scope-expansion verdict if the approved retention, authorization or authoritative-service contract cannot be met without materially broader work.

## Selected architecture

Implement a separate bounded local worker using pinned PaddleOCR `3.7.0`, PaddlePaddle GPU `3.3.1`, `PP-OCRv5_mobile_det`, `en_PP-OCRv5_mobile_rec`, `devanagari_PP-OCRv5_mobile_rec` and `te_PP-OCRv5_mobile_rec` at the revisions/hashes in `tools/ocr-benchmark/candidates/candidate-lock.json`.

Reuse or promote the audited 1A controls:

- extension/MIME agreement and decoder verification;
- maximum 25 MiB file, 25 pages, 6,000 pixels/axis, 40M pixels/page, 120M pixels/document;
- bounded aggregate pages/bytes/pixels/time/output;
- path containment and duplicate-byte rejection;
- metadata-stripping raster boundary;
- argument-array subprocess/container calls, minimal environment and process-tree timeout;
- network-disabled inference, read-only model/input mounts and bounded output;
- immutable runtime/model receipts and redacted diagnostics.

Any changed production limit must have an explicit abuse-case test and rationale; do not silently increase the benchmark limits.

## Functional scope

1. Secure file import for PNG/JPEG/PDF and scanner-produced PDF.
2. A local OCR job service with explicit queued/running/completed/failed/expired states, rate limits, per-role/object authorization and idempotency.
3. Transient page rasterization and OCR candidate generation with page/region provenance.
4. Candidate-field mapping limited to existing Admissions/Student/Guardian/Staff service contracts.
5. Deterministic validator states: `VALID_FORMAT`, `INVALID_FORMAT`, `AMBIGUOUS`, `MISSING`; never silent correction.
6. Review states `GREEN`, `AMBER`, `RED`, while preserving mandatory human approval even for `GREEN`.
7. Two-pane review UI per `OCR_HUMAN_REVIEW_UX_SPEC.md`, including keyboard/accessibility support and visible source evidence.
8. Per-field accept/edit/reject/missing decisions, with edited provenance and rejected alternatives.
9. Final submission only through existing authoritative services, normal permissions and optimistic concurrency.
10. Privacy-safe audit metadata: document digest, engine/revision, timing, validator/review states and operator decision without unnecessary raw text duplication.

## Confidence and fallback rules

Use Paddle recognition confidence only as evidence; calibrate it again against the 1A corpus and new synthetic integration fixtures. Do not call it probability of correctness. A `GREEN` state requires engine success, source region, valid format where applicable, no omitted page and an approved calibration rule. Conflicts, handwriting-like input, poor layout, missing evidence and critical fields default to `AMBER` or `RED`.

There is no automatic Tesseract fallback in 1B. If a narrow CPU contingency is requested, benchmark it separately on the actual 1B deployment class and demonstrate that it improves the routed slice; otherwise route failure directly to manual entry/review.

Optional upscale/sharpen may be tested only as a reversible low-resolution retry. Record both raw and retried evidence. Do not globally enable adaptive threshold, denoise or deskew pipelines that regressed 1A.

## Retention and deletion

Before any non-synthetic pilot, obtain an approved policy defining separate periods and owners for:

- original source document;
- temporary rasterized pages;
- raw OCR output;
- candidate fields and rejected alternatives;
- approved authoritative values;
- OCR audit metadata;
- backups and failure residue.

Default raw/source retention to the shortest review window. Encrypt private storage, deny cross-role/object access, prevent cache/public-path exposure, test expiry/deletion including failure recovery, and display the policy in the review UI. Never claim deletion until the storage service confirms it.

## Roles, privacy and abuse controls

- Define exact roles/actions for upload, view source, run OCR, review, submit, reject, purge and audit.
- Enforce object scope and linked-record authorization on every route, not only the UI.
- Reauthenticate or require stronger confirmation for critical final submission where existing policy requires it.
- Rate-limit files/pages/jobs per actor and bound queue concurrency.
- Treat document-borne instructions and OCR markup as inert text; sanitize all display/export contexts.
- Log safe identifiers/digests, not document contents, tokens or private values.
- Test malformed files, decompression bombs, traversal, duplicate replay, polyglot-like files, prompt-injection-like text, output floods, timeouts, canceled jobs and stale review submissions.

## Input UX

Support bounded file import first. Plan Windows scan/import and native Android/iOS capture as separately permissioned adapters. Browser/mobile camera access must be user-initiated, clearly indicated, cancelable and absent from background operation. Preserve original orientation while offering non-destructive review rotation.

## Integration boundaries

- Reuse existing Admissions CRM and Student/Guardian/Staff authoritative services.
- Do not change authoritative uniqueness, authorization, validation or conflict behavior.
- Do not persist target records until explicit final operator submission succeeds.
- Keep drafts/candidates separately classified and inaccessible to Search/Smart AI.
- Ensure retries cannot double-create or double-apply a record.

## QA evidence

Use a dedicated branch and physical worktree. Hash the operational database before/after and run all write-capable tests on synthetic or copied databases only. Verify:

- exact model/runtime pinning and offline inference;
- admission and resource limits;
- no PII/secrets/public artifacts;
- role/object isolation and IDOR cases;
- review accessibility/keyboard workflow;
- critical-field edit/approval/audit behavior;
- no silent writes, duplicate submission or stale overwrite;
- retention expiry/deletion and backup boundary;
- source-region correctness and confidence calibration;
- natural-handwriting limitation is visible;
- full ERP typecheck, tests, build, safety/final-scope gates and production-runtime browser QA;
- exact-head security scan and CI.

## Release boundary

Release only a default-off software foundation. Do not activate real users/data, camera/scanner hardware, a production worker or a document pilot. Create a later explicit private synthetic-pilot/operational-readiness gate covering retention approval, deployment hardware, backup, incident response, operator training and representative legally usable validation data.

## Required final status

Return one leading status defined by the future release task. Make clear that software clearance is not operational activation.
