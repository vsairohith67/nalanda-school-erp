# Portable file-storage migration boundary

Governed S3-compatible storage is implemented for Admissions, Classwork, Support, Payslip, Event Media, onboarding, and fee-register OCR. Filesystem storage remains the development and copied-QA adapter.

The database remains the authorization, ownership, retention, recovery-status, byte-size, media-type, and checksum ledger. A later real-data migration must enumerate exact governed rows, copy only validated keys, verify size/hash, reconcile counts, and switch only after two-way evidence. It must never crawl an arbitrary directory/bucket, infer ownership from paths, or delete source files during first cutover.

Generated PDFs streamed immediately are ephemeral. Durable report/export/identity-card delivery must use their governed private prefixes before a provider adapter enables persistence.
