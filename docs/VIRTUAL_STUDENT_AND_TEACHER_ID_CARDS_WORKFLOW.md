# Virtual Student and Teacher ID Cards

Prompt 18C adds privacy-safe, school-operational identity cards for active Students and StaffMembers. A card is not a government identity document, is never a login credential, and is never accepted as authorization for a public or unauthenticated action.

## Supported scope

- Student and Staff card types with separate allowlisted fields and number series.
- Individual draft, review, approval, issue, correction, replacement, revocation, cancellation, version history, exact internal lookup, and safe reports.
- Previewed and approved Student class/section or active-population batches and Staff active/designation batches.
- CR80 front/back rendering, A4 cut-guide sheets, and Code 39 card-number barcodes.
- Parent access only to currently linked children and Teacher access only to the StaffMember linked to that signed-in Teacher.

There is no managed Student/Staff photo field in the current schema. Cards therefore render a neutral photo placeholder. Photo-required templates, remote image URLs, and arbitrary file paths are rejected. A future photo system must be separately designed, privacy-reviewed, role-gated, and backed up before this rule can change.

## Safe fields

Student cards may use school name/logo/address/office contact, card number, student name, admission number, class, section, academic year, validity, optional date of birth or guardian name when explicitly configured, photo placeholder, barcode, return instructions, issuing role, and version status.

Staff cards may use school name/logo/address/office contact, card number, staff name/code, designation, department, primary subject, validity, photo placeholder, barcode, return instructions, issuing role, and version status.

Never include home addresses, personal phone numbers, Aadhaar, caste, religion, disability or medical data, fee category/status, salary, bank, EPFO/ESI/tax data, password hashes, actor IDs, or raw database IDs.

## Workflow and concurrency

Draft and batch preview consume no card number. Approval freezes the reviewed source or exact batch scope. Issue runs transactionally, revalidates eligibility, allocates one number with compare-and-set protection, creates immutable version 1, and appends an event. Repeated issue calls are idempotent. Corrections keep the card number and append a version with a mandatory reason. Replacement revokes the old card and issues a newly numbered card. Revocation is explicit; expiry is derived from `validUntil` without rewriting history.

Active default series resolution prefers an exact academic-year series, then a non-year fallback. Missing or ambiguous series block issue. Inactivation never changes issued cards.

## Permissions

Director has full control. Principal can run operational review, approval, issue, correction, replacement, revocation, lookup, reports, and export but not template/series administration. Admin can configure templates/series, create drafts/batches, lookup, report, and export but cannot perform final approvals or issue. Teacher has only own Staff card access. Parent has only linked-child Student card access. Viewer receives masked aggregate reports only. Accountant has no ID-card access by default.

Every page and API checks its named permission server-side. Parent/Teacher ownership is rechecked server-side and no public lookup endpoint exists.

## Printing and barcode behavior

The card surface is CR80 size (`85.6mm × 53.98mm`) and supports front, back, pair, and A4 batch sheets with print cut guides. The Code 39 barcode contains only the normalized opaque card number. Barcode scanning is useful only in the authenticated exact-lookup screen and never authenticates a person.

## Backup, restore, and operations

Backup version 29 adds number series, templates, batches, cards, immutable versions, and append-only events. Actor IDs are sanitized. Restore validates unknown fields, ownership, template/batch/series/version/event links, duplicates, collisions, validity periods, and unsupported photo paths before ordered insertion. Older version-28 backups remain compatible when all six arrays are absent.

Before release run:

```powershell
pnpm.cmd routes:list
pnpm.cmd lifecycle:backfill
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd backup
```

For QA use the `QA18C` prefix, verify Director and blocked-role behavior, both portals, exact lookup, front/back/print, dark/light, desktop and exact 390×844 mobile, then delete every temporary card, version, event, batch, template, series, and fixture identity before the final backup.

## Explicit non-goals

No physical-card vendor integration, PVC printer SDK, RFID/NFC, attendance punches, door access, meal/transport/library entitlement, finance linkage, public barcode lookup, public validation, government-ID simulation, or new personal-photo storage was added.
