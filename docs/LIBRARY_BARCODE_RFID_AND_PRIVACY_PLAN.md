# Library Barcode, RFID, and Privacy Plan

## Decision

Implement barcode labels before considering RFID. A USB barcode scanner normally behaves like keyboard input in a browser, is inexpensive, needs no vendor SDK, and has a manual fallback. RFID is future-only and must not start without documented reader/tag evidence and a successful school acceptance test.

## Barcode workflow

- Each label resolves to one `LibraryCopy` by its immutable accession number or unique generated barcode. Never encode a borrower, raw database ID, password, secret, or financial reference.
- Issue/return uses one focused scan field, a bounded lookup, a visible copy confirmation, then a borrower scan/search and explicit transaction confirmation. The server remains authoritative for status, membership, due date, limits, and duplicate protection.
- Scanner input must tolerate Enter suffixes, keyboard focus loss, camera-less desktops, repeated scans, partial scans, and a manual typed/search fallback. Normalize and exact-match the identifier before lookup. Debounce at the client for usability and enforce a short-lived idempotency key plus transactional copy/loan locks at the server for correctness.
- Unknown, withdrawn, duplicate, mismatched, or already-finalized scans display a clear non-destructive error. A scan never silently issues, returns, waives, or charges a book twice.
- Label printing/reprinting needs a permission, copy list/selection, small print layout, human-readable accession number, and audit evidence. It must not print borrower history.

## RFID future review

An RFID tag identifies a library copy only. It is not authentication, attendance, location tracking, child tracking, or staff tracking. Do not collect room, movement, GPS, or live-presence data.

Before approval, obtain and review: reader/tag model and supported standard; vendor SDK/API/manual; browser/local bridge requirement; offline read/write behavior; sample export; data ownership/hosting/retention terms; full recurring licence/cloud/support costs; warranty; replacement-tag process; export format; API rate/availability limits; and documented migration path to another vendor. Run a real test with the target Windows machines, labels/tags, network-off fallback, export, and operator training before any schema or procurement commitment.

Use a replaceable reader adapter boundary and preserve a barcode/manual workflow even if RFID is deployed. Store only the tag's unique copy mapping and operational audit events. Do not make an RFID tag sufficient to open a portal, approve a transaction, identify a guardian, or bypass role permissions.

## Privacy and portal policy

Borrowing history is private education/staff data. Parent views must start from the authenticated guardian's existing linked-child relationship and only show that guardian's linked children. Teacher views must derive their library member from the authenticated linked staff account and show no other staff/student borrower history. Viewer/Auditor views are aggregate/masked by default; named borrower lists require a specific authorized operational/audit purpose.

Future APIs require server-side permission and ownership checks, allowlist response fields, no-store caching where personal history is returned, and formula-safe exports. Do not expose raw internal IDs, password hashes, secrets, filesystem paths, precise location data, or detailed payment references. Portal summaries should prefer copy/title, issued/due/overdue state, and safe charge status; waiver reasons, payment references, and staff borrowing detail remain restricted. Parent receipts are not a new receipt type: a later linked-child view can expose only the existing authorized Miscellaneous Income print/receipt entitlement after ownership checks, or otherwise only a charge-status summary.

## Prompt 16F privacy checkpoint

Prompt 16F stores an optional unique barcode value only; it does not print labels, accept scanner input, debounce scans, or integrate RFID. Library responses use allowlists and safe actor names. Viewer/Auditor Vendor and Expense provenance is reduced to linked/not-linked status, with no Vendor GSTIN/PAN/bank/private notes, expense payment references, raw actor IDs, secrets, or filesystem paths. Parent and Teacher receive no library route, navigation, or API permission in this phase.

## Prompt 16G privacy checkpoint

Borrowing history is now implemented behind server-side circulation permissions. Principal has read-only operational access; Viewer/Auditor is limited to masked reports without export; Accountant, Teacher, and Parent remain blocked. Barcode values are still neither credentials nor scanner inputs. No Parent/Teacher portal, label generation, scanner workflow, RFID, contact/address export, raw actor ID, or finance field was added.
# Prompt 16I update

Code 39 barcode labels and keyboard-style scanner assistance are implemented. RFID, camera scanning, authentication use, location tracking, and stock verification remain out of scope; see `LIBRARY_BARCODE_LABEL_AND_SCANNER_WORKFLOW.md`.
