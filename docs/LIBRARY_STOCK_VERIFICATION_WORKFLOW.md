# Library Stock Verification Workflow

## Purpose and boundaries

Prompt 16J adds a controlled physical stock-verification exercise. It does not add RFID, camera scanning, procurement, valuation, depreciation, accounting, automatic Expense records, automatic Library charges, fee Payment changes, child/staff tracking, or barcode-based authentication.

## Safe workflow

1. An authorized operator creates a draft and previews the exact expected scope.
2. Starting the draft transactionally creates one immutable snapshot record per non-withdrawn physical copy in scope.
3. The snapshot preserves accession, optional barcode, title, shelf, physical status, condition, active-loan state, borrower type only, and due date. It never stores borrower contacts, addresses, costs, Vendor/invoice details, or credentials.
4. An active loan is classified `ISSUED_OFFSITE`; `UNDER_REPAIR` is `KNOWN_REPAIR`; an already `MISSING` copy is `NEEDS_REVIEW`. None is silently treated as newly missing.
5. Barcode lookup is exact, with explicit exact accession fallback. Enter submits, focus returns to the input, rapid duplicates are harmless, and Reset enables a deliberate recheck.
6. A scan or observation updates only the verification record and append-only scan log. It never changes `LibraryCopy`.
7. Out-of-scope copies are logged and may be added as `UNEXPECTED` only with confirmation and reason. Unknown input never creates a copy or uses fuzzy matching. Withdrawn scans remain historical.
8. Unchecked `AVAILABLE` copies may be previewed and itemized as missing proposals. Issued and repair copies are excluded.
9. Submit, discrepancy review, correction application, approval, and final lock are separate steps. Concurrent duplicate actions are guarded.
10. Each approved shelf, missing, condition, or repair correction is explicitly applied once through the existing Library copy helper and linked to exactly one append-only `LibraryCopyEvent`.
11. Approval requires no unresolved discrepancy. Lock requires `APPROVED`; there is no normal unlock UI.

## Permissions and defaults

- Super Admin and Director: all stock-verification permissions, including final lock.
- Admin: create/manage, scan, review, apply, approve, reports, and CSV export; no final lock by default.
- Principal: review plus read-only reports; no scan, correction application, or lock.
- Viewer/Auditor: masked read-only sessions/reports; no export.
- Accountant, Teacher, Parent: no access.

Every page and API performs its own server-side permission check. Custom role-matrix bundles may later be used for a Library In-charge; no global Library role was added.

## Reports and privacy

Reports cover session summary, expected/verified, present, unchecked, missing proposals, previously missing, issued/offsite, known repair, mis-shelved, damaged, unexpected/out-of-scope, unresolved, applied corrections, scope progress, recent scans, and locked history. CSV is formula-safe and uses an India-local filename. Viewer export is blocked. Reports omit raw actor IDs, borrower names, contacts, addresses, financial/Vendor/acquisition/invoice data, hashes, secrets, and filesystem paths.

## Backup and restore

Backup version is 22 and includes sessions, records, scan events, and workflow events. Restore remains compatible with older backups, validates exact session/copy/event links and uniqueness, isolates same-number/different-ID collisions, preserves immutable snapshots/locked state, keeps newer local sessions, and is idempotent for already-restored rows. Password hashes remain excluded.

## Limitations and next phase

Physical USB scanner certification still requires real hardware; keyboard-input simulation is the supported QA substitute. SQLite Prisma P3005 baseline behavior remains documented. Post-application corrections require an explicitly documented compensating `LibraryCopyEvent`; applied verification records are immutable. Next planned phase: Prompt 17A.
