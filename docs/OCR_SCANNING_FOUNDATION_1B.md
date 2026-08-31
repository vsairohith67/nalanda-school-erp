# OCR Scanning Foundation 1B

This release adds a local-only PaddleOCR software foundation for synthetic or copied-data workflows. It does not authorize real school documents, operational activation, a physical scanner, a cloud OCR service, or direct OCR writes to authoritative data.

## Release boundary

- Feature flag: `ocr-scanning-foundation-1b`, production default `false`, rollout `0%`; activation authority is `SUPER_ADMIN`, while every runtime action still reuses its existing module permission.
- Engine: PaddleOCR `3.7.0` with PaddlePaddle GPU `3.3.1`.
- Models: exact PP-OCRv5 mobile detector plus English, Devanagari and Telugu recognizers, revision and SHA-256 locked.
- Source handling: admitted image/PDF content is stored only in the private-object boundary; the browser receives a no-store raster endpoint and never embeds an uploaded PDF.
- Authority: OCR produces candidates only. Every field requires a human decision, critical fields are explicit, and final submission requires a separate confirmation.
- Writes: accepted or edited values pass through the existing Admissions, Students, Guardians or Staff service in one transaction. Rejected or missing candidates are not written.
- Search/AI: source documents, rasters, raw OCR output and candidates are excluded from Search and Smart AI.

## Worker boundary

The worker starts as an unprivileged user with a read-only root filesystem, all Linux capabilities dropped, no-new-privileges, bounded PID/memory/tmpfs limits, no network, and read-only exact-model mounts. The signed internal API uses a worker identity, HMAC, nonce replay protection, leases, heartbeats, bounded retries and typed failure states. Results are rejected unless engine, runtime, model receipts, source digest, page dimensions, polygons, scripts, durations, rotations, retries and output sizes meet the exact contract.

The worker image and model weights are local external artifacts. They must never be committed to the repository or uploaded by public CI.

## Human-review workflow

1. An authenticated operator with the existing target-module upload authority selects an Admissions, Student, Guardian or Staff target and imports a supported image/PDF.
2. Admission validates type, structure, size, pages, pixels and context-specific idempotency before private storage and queueing.
3. The local worker returns bounded page rasters, recognition blocks and exact provenance.
4. Mapping classifies candidates as GREEN, AMBER or RED workflow cues. These are not accuracy probabilities.
5. The operator accepts, corrects, rejects or marks every field missing. No OCR value is authoritative at this point.
6. The final modal stays blocked until all fields have saved decisions and the critical-field acknowledgement is checked.
7. Submission uses the authoritative domain service and records an append-only event.

## Retention and recovery

Database backup covers OCR durable metadata, jobs, page metadata, field decisions, submissions and append-only events. Source/raster/raw objects remain outside database backup under the independent retention/purge policy. Purge enumerates the private document prefix, deletes every object, verifies absence and records controlled failure if confirmation is incomplete.

Restore is idempotent and was exercised twice on isolated databases. Operational certification must approve real-document retention before the feature can be enabled.

## Operations

Keep `ocr-scanning-foundation-1b` OFF until the separately generated `OCR-SCANNING-OPERATIONAL-CERTIFICATION-1C` is authorized and completed. A missing worker produces a controlled unavailable state; it never creates a partial candidate submission or false success. CPU suitability remains deployment-hardware evidence pending because the cleared benchmark path is local GPU.

See [runtime QA](evidence/ocr-scanning-1b/RUNTIME_QA.json), [dependency inventory](evidence/ocr-scanning-1b/DEPENDENCY_INVENTORY.md), and the [1C certification prompt](prompts/OCR_SCANNING_OPERATIONAL_CERTIFICATION_1C.md).
