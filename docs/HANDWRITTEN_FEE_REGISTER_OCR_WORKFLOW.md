# Handwritten Fee Register OCR Workflow

Prompt 20B adds a private, human-reviewed staging workflow for photographed handwritten fee-register pages. OCR output is untrusted draft evidence. It is never approval, never a Student match by itself, and never a financial transaction.

## Current safety decision

Only deterministic `MOCK` and provider-free `MANUAL` modes may be active. `LOCAL_HTTP` and `CLOUD_API` remain disabled. A text-only local model is not automatically an image-OCR model; any future local activation needs a separately selected OCR or multimodal model. Cloud activation needs a later provider, retention, region, contract, and privacy review.

Payment posting remains disabled. The current normal Payment route preserves `Payment.date`, and the Daily Cash Book reads active cash Payments by that transaction date. However, the current creation path does not expose one shared helper that proves all required outstanding-balance, fee-allocation, overpayment, receipt-allocation, idempotency, and historical Cash Book invariants. Prompt 20B therefore provides a formula-safe reviewed staging CSV and does not create Payments or ERP receipts.

The handwritten receipt/reference remains OCR evidence only. It is never used as the ERP receipt number.

## Private source files

Supported source types are JPEG, PNG, and still WebP. Validation checks content signature, filename extension, declared MIME, file size, pixel count, and animation. SVG, HTML, executables, office files, HEIC, malformed or animated images, and mismatched files are rejected.

PDF is not supported in Prompt 20B because the repository has no reviewed, bounded server-side PDF rasterizer. Photograph or scan each register page as a supported image.

Image bytes live under `FEE_REGISTER_OCR_STORAGE_DIR`, or the private local default `data/fee-register-ocr`. The helper refuses storage under `public`, generates an opaque key, stores the display name separately, blocks traversal and symlink escape, and serves bytes only through an authenticated permission-checked route with `private, no-store`, `nosniff`, CSP, and sandbox headers. No static URL, remote ingestion, service-worker cache, absolute path, or ordinary image-content logging is used.

Authorised purge removes only source bytes. Page hash, MIME, size, review history, revisions, events, and Payment links remain. A restored JSON backup marks an unpurged page `MISSING_SOURCE` because images are deliberately not embedded in JSON.

## Review workflow

1. Create a batch for one academic year and choose `MOCK` or `MANUAL`.
2. Upload supported private page images.
3. Run deterministic MOCK extraction or add manual rows.
4. Treat every returned field, confidence label, raw text, and bounding box as untrusted.
5. Match by exact normalised admission number first. Exact Student name plus class and section may create a conservative exact match only when unique. Ambiguous or fuzzy candidates require manual selection.
6. Correct fields with a reason. Every correction writes an immutable row revision, increments the batch review version, and invalidates stale approval.
7. Review duplicate evidence against the batch, prior OCR rows, handwritten reference, and existing Payments. Exact duplicates cannot proceed; possible or likely duplicates need a reasoned authorised resolution.
8. Explicitly confirm source visibility, Student, date, amount, mode, academic context, handwritten reference when present, duplicate result, and relevant remarks.
9. Submit and approve the exact review version. Reviewer and approver must be different.
10. Use posting preview for a zero-write eligibility snapshot. Actual posting remains fail-closed; use the reviewed staging CSV.

Confidence labels (`HIGH`, `MEDIUM`, `LOW`, `MISSING`) are informational only. Every financial field must be checked against the source image.

## Permissions

- Super Admin and Director: all OCR permissions.
- Accountant: view images, upload, extract, review, resolve duplicates, preview, reports, and export. The posting permission exists for a later gate, but the provider profile and processing helper keep posting disabled.
- Principal: view images, review, approve, and reports; no posting.
- Admin: view images, upload, extract, review, and reports; no approval, posting, profile activation, or purge.
- Viewer/Auditor: aggregate reports only; no image access and no export.
- Teacher and Parent: no OCR access.

Private images require `VIEW_FEE_REGISTER_OCR_IMAGES`; general Student or finance access does not imply it.

## Pages and controls

The workflow is under `/fee-register-ocr`, with new-batch, batch detail, private page review, row review, posting preview, settings, and reports pages. All write actions use accessible in-app dialogs. Native `alert`, `confirm`, and `prompt` are prohibited.

Reports cover batches, pages, row states, duplicate classes, match methods, field confidence, provider modes, amounts, posting failures, retention, and OCR-to-Payment reconciliation. CSV cells are formula-safe and use explicit fields only. The reviewed export states: “Reviewed OCR staging export. This file does not prove that a Payment was posted.”

## Backup, restore, and scope

Backup version 35 includes profiles, batches, page metadata, rows, revisions, posting runs, and events. It excludes image bytes, raw page-level provider text, absolute paths, provider credentials, actor IDs, live provider payloads, and passwords. Restore validates links and identities, isolates collisions, preserves newer local records, forces live/posting flags off, and remains idempotent.

Prompt 20C raises the combined ERP backup to version 36 and encrypts that validated JSON before MOCK/LOCAL_FOLDER upload. The OCR arrays remain covered as safe database metadata, but private OCR source image bytes remain excluded. Cloud-backup health states: “Database backup verified. Private uploaded assets are not included in this backup.” OCR Payment posting remains disabled.

Prompt 20C is out of scope. Do not activate a real OCR provider or financial posting until a separate phase proves the exact provider/privacy contract and the complete Payment helper invariants.
