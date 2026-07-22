# Library Catalog and Accession Workflow

## Prompt 16F status and boundary

Prompt 16F implements the bibliographic library catalog and permanent physical accession register. A `LibraryTitle` is one title/edition and a `LibraryCopy` is one school-owned physical copy with one immutable accession number. These records are deliberately separate from `BookCatalogItem`, academic-year sale rates, book-sale receipts, student fee `Payment`, miscellaneous income, and cash-book calculations.

This phase does not include library members, issue, return, renewal, reservation, overdue, fines, waivers, Parent/Teacher library portals, barcode labels/scanners, RFID, stock verification, procurement, purchase orders, or inventory valuation. The optional barcode field is storage preparation only.

## Daily operator workflow

1. Open **Library -> Catalog** and create the bibliographic title. Title code is normalized to an uppercase stable key. ISBN punctuation is removed for comparison; a normalized ISBN may belong to only one title in this phase.
2. Open **Accession register -> Accession copy**. Select the existing title, enter the permanent accession number, optional barcode, acquisition source, condition, status, shelf, and optional provenance links.
3. Review the preview. Confirm only after checking the title and accession number. Confirmation creates the copy and its `ACCESSIONED` event in one transaction.
4. Open a copy detail to record a shelf move, condition change, missing/repair/available status, correction, or withdrawal. Each action appends a `LibraryCopyEvent`; old events are not updated or deleted.
5. Withdrawal requires a reason and preserves the copy, accession number, and history. The accession number can never be edited or reused.

## Vendor and Expense boundary

Vendor and `ExpenseRecord` links are optional read-only provenance references. The server validates the exact IDs and rejects a Vendor/Expense pair that belongs to different Vendors. A copy's acquisition cost is informational. Accession, update, import, and withdrawal never create or alter an expense, expense payment, publisher bill, student fee payment, miscellaneous-income receipt, book-sale receipt, or cash-book movement. Viewer/Auditor sees only `Linked Vendor` / `Linked Expense`; Vendor tax/bank/private notes and expense payment references are never exposed through library payloads.

## Preview-first imports

`/library/import` has separate templates for titles and physical copies. It accepts CSV/XLSX for browser-side parsing, previews every row, and requires an explicit review checkbox before confirm. Matching is exact normalized title code, exact Vendor code, and exact Expense number; there is no fuzzy match. Duplicate normalized title code, ISBN, accession, or barcode is reported by row. Existing records are skipped without overwrite, making a repeated confirm non-duplicating. Copy creation and `ACCESSIONED` event creation share the confirm transaction. Import history reuses `ImportBatch` with `LIBRARY_TITLES` and `LIBRARY_COPIES` types.

## Permissions

- Super Admin and Director: all six library permissions.
- Admin: view, catalog/copy management, import, reports, and export.
- Principal: view and reports only.
- Viewer/Auditor: masked read-only view and reports; no export.
- Accountant, Teacher, and Parent: no access by default.

The permissions are `VIEW_LIBRARY`, `MANAGE_LIBRARY_CATALOG`, `MANAGE_LIBRARY_COPIES`, `IMPORT_LIBRARY_CATALOG`, `VIEW_LIBRARY_REPORTS`, and `EXPORT_LIBRARY_REPORTS`. A future Library In-charge can be configured as a custom permission bundle in the existing role matrix; no new global role was added.

## Reports and export

Reports are non-circulation only: accession register, title-wise copies, status, condition, shelf, language, subject, category, publisher, acquisition source, Vendor/Expense linkage completeness, metadata gaps, withdrawn copies, and recent events. CSV is formula-neutralized, locally named, and excludes raw IDs, password hashes, secrets, Vendor banking/tax fields, expense payment references, and private actor IDs.

## Backup and continuation

Backup version 19 adds `libraryTitles`, `libraryCopies`, and `libraryCopyEvents` and continues excluding password hashes. Restore validates parent IDs, normalized uniqueness, Vendor/Expense identity mappings, withdrawal history, and `ACCESSIONED` event presence. It maps dependents only through exact restored identities, isolates collisions, preserves newer local roots under the existing policy, and is idempotent for exact event IDs. Version 18 and older backups remain valid with empty library arrays.

Prompt 16G now adds membership and transactional issue/return/renewal/reservation. The withdrawal extension point is replaced with a real open-loan guard. Circulation does not mutate physical copy status and does not add fines or payment behavior; see `LIBRARY_MEMBERSHIP_AND_CIRCULATION_WORKFLOW.md`. The catalog/accession arrays remain part of backup version 20 alongside the five new circulation arrays.
# Prompt 16I update

`LibraryCopy.barcodeValue` now has preview-first assignment, Code 39 validation, and append-only barcode assignment/correction events. Accession numbers remain immutable.
# Prompt 16J stock snapshots and corrections

Starting stock verification snapshots accession, barcode, title, shelf, physical status, condition, active-loan state, borrower type, and due date. Snapshot fields do not rewrite the accession register. Only an explicitly approved itemized resolution can call the existing shelf, condition, or physical-status helper, which appends one `LibraryCopyEvent`. No valuation, acquisition-cost reporting, procurement, or financial record is created.
