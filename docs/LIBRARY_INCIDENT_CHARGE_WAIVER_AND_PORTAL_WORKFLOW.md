# Library Incident, Charge, Waiver, and Portal Workflow

Prompt 16H adds explicit Library accountability without changing student fees. It covers overdue assessment, lost/damaged cases, charge approval, full or partial waiver, exactly-once collection through Miscellaneous Income, safe reports, and read-only Parent/Teacher views.

## Incident lifecycle

An authorized operator creates a `DRAFT` LOST or DAMAGED incident against an exact loan/member/copy/title set. LOST requires an active issued loan and marks the physical copy `MISSING`; DAMAGED may be reported during or after return and marks the copy `UNDER_REPAIR` with condition `DAMAGED`. Copy, circulation, and incident events are append-only.

Submission and approval are separate. Resolution is explicit: original item returned, repaired and available, existing accessioned replacement accepted, paid charge, full waiver, partial waiver plus payment, or written off. Cancellation requires a reason. Resolved and cancelled incidents are immutable. Accepting a replacement only links an existing accessioned copy; it creates no purchase, expense, procurement, or valuation record.

## Charge assessment and rule snapshots

Overdue remains derived only when an issued loan due date is before the current Asia/Kolkata date; due today is not overdue. Viewing a report never posts a charge. An authorized operator previews the applicable active charge rule and explicitly confirms assessment. Matching order is exact Student class, exact Staff type, then general member type. Grace, daily rate, and maximum cap are guidance only. If no rule applies, an authorized manual amount and reason are required.

Each assessment snapshots overdue days, rule code, rate, original amount, and reason. A unique active-loan key prevents a second active overdue charge for the same loan. Returned or cancelled loans cannot receive a new overdue charge. Lost and damaged charges require an approved matching incident. Money is stored and calculated as exact Decimal values.

Charge workflow is `DRAFT -> PENDING_APPROVAL -> APPROVED`, followed by `PAID`, `WAIVED`, or an explicit cancellation/rejection. Approval does not approve an incident and incident approval does not approve a charge. Paid, waived, and cancelled charges are not silently edited.

## Waiver and collection

Only `WAIVE_LIBRARY_CHARGES` can record a waiver, and a reason is mandatory. A partial waiver reduces `payableAmount` transactionally and keeps the charge approved; a full waiver sets the payable amount to zero and closes the charge without a receipt. Paid or cancelled charges cannot be waived. Compare-and-set guards stop concurrent or repeated actions, and every action appends a `LibraryChargeEvent`.

Collection requires an approved positive payable amount and `COLLECT_LIBRARY_CHARGES`. The transaction creates exactly one Miscellaneous Income receipt and one authoritative Library charge line, links the receipt uniquely to the charge, marks the charge paid, and appends the collection event. Stable item codes are `LIB-STUDENT-CHARGE` and `LIB-STAFF-CHARGE`; they contain no hard-coded rate. Student collection uses the exact linked Student, while Staff collection has no Student link. CASH contributes once to Cash Book through Miscellaneous Income; UPI, bank transfer, and cheque do not contribute physical cash. No fee `Payment`, fee due, student fee ledger, or separate Library ledger is created.

If the linked Miscellaneous Income receipt is cancelled, the paid charge is not reopened or erased. A `CORRECTION` warning event is appended and reports show a receipt-cancelled reconciliation warning. Any financial reversal or locked Cash Book correction remains an explicit authorized compensating workflow.

## Ownership-safe portals

`/parent/library` is read-only and requires the Parent role plus an exact Guardian-Student link. The child switcher contains linked children only. Loans, reservations, public-safe incident states, approved/paid/waived charges, and Library charge receipts are allowlisted; internal notes, raw IDs, actor/approver details, contacts, and unrelated borrowers are excluded. The receipt is labelled **Library Charge Receipt** and **not a school-fee receipt**.

`/teacher/library` is read-only and resolves only the signed-in Teacher's linked `StaffMember` and Library membership. It never accepts a borrower selector and shows a friendly unlinked state. Neither portal permits issue, return, renewal, reservation, waiver, approval, collection, or payment.

## Permission defaults

| Role | Default Prompt 16H scope |
|---|---|
| Super Admin, Director | All incident, charge, waiver, collection, report, export, and own-portal permissions |
| Admin | Incident operations/approval, charge assessment/approval/cancellation, reports/export; no waiver or collection |
| Principal | Incident/charge review and approval plus reports; no collection, waiver, or export |
| Accountant | View approved charges, collect, reports/export; no incident decision or waiver |
| Viewer/Auditor | Masked read-only reports; no export |
| Teacher | Own Library portal only |
| Parent | Linked-child Library portal only |

Every page and API repeats permission and ownership checks server-side. Administrative CSVs use allowlisted fields, exact paise, formula-safe cells, and India-local filenames.

## Backup and continuation

Backup version 21 adds `libraryIncidents`, `libraryChargeRules`, `libraryCharges`, and `libraryChargeEvents`, plus the configured Library Miscellaneous Income items through the existing item array. Restore supports older backups, validates canonical and replacement links, Student/Staff ownership, receipt identity, active-key uniqueness, exact amounts, event parents, number collisions, and idempotence while preserving newer local history. Password hashes remain excluded.

Intentionally absent: payment gateway, school-fee posting, automated fine generation, scanner integration, RFID, stock verification, procurement, purchase orders, and inventory valuation. Prompt 16I is the separately gated barcode-label/scanning phase. Prompt 16J is the separately gated stock-verification phase.

## Prompt 16H release evidence

The final release ladder passed on 16 July 2026: route inventory found 123 page routes and 154 API routes; lifecycle backfill scanned 8 active Students with 8 existing enrollments and changed nothing; typecheck passed; 713 tests across 85 files passed; and the production build generated 193 routes without an error. Browser QA covered Student overdue assessment, partial waiver and CASH collection; LOST assessment and full waiver; post-return DAMAGED handling and UPI collection; cancelled-receipt reconciliation; Accountant, Admin, Principal, Viewer, Parent, and Teacher boundaries; formula-safe reports; 1366x768 and 390x844 layouts; light/dark mode; table containment; focus visibility; and zero console errors or warnings. Production stderr was empty.

All temporary Prompt 16H memberships, policies, loans, reservations, incidents, charges, rules, receipts, movements, titles, copies, users, and related events were removed. The two intentionally configured no-rate Miscellaneous Income items remain. Backup version 21 is `nalanda-fee-control-backup-2026-07-16-10-33.json`; its four accountability arrays are present and empty after cleanup, both configured Library income items are included, and no password-hash key is present.
