# Accountant Data Minimisation and Receipt Integrity

> **FIN-2B supersession:** FIN-2B deliberately authorises final-receipt cancellation and governed correction for an Accountant holding the exact narrow permission. The actions remain transactional, immutable, audited and leadership-notified. Read `ACCOUNTANT_RECEIPT_CANCELLATION_CORRECTION_AND_NOTIFICATION.md`. All FIN-2A privacy, export and receipt-integrity safeguards remain.

## FIN-2A scope

FIN-2A fixes four confirmed Nalanda risks:

1. Accountant fee-collection screens no longer depend on broad Student serializers.
2. Accountant-accessible finance exports are purpose-specific, bounded, formula-safe, private, and audited.
3. At the FIN-2A checkpoint, an Accountant could not cancel a final fee receipt. FIN-2B intentionally supersedes only that authority rule through exact narrow permissions.
4. `Payment` components are authoritative for the effective receipt state, while `ReceiptNote` is transactionally synchronized metadata.

This phase adds no payroll, salary, payslip, resignation, advance-salary, payment-gateway, refund, Schoolknot-parity, or large finance module. It adds no Prisma model or migration.

## Accountant Student-data allowlists

The Accountant is non-delegably denied `VIEW_STUDENTS`. Fee collection uses the exact-admission lookup at `/api/finance/students/lookup`, protected by `CREATE_PAYMENTS`.

The identity response contains only:

- `admissionNo` — identifies the fee account and receipt;
- `studentName` — lets the operator verify the person selected;
- `className` and `section` — verify the current class/section;
- `academicYear` — selects the applicable fee structure;
- `status` — prevents collection against an inappropriate lifecycle state;
- calculated fee allocation and dues — required to decide the fee amount and term allocation.

Server-side calculations may select `studentType`, `discountPercent`, and `deletedAt`, but those fields are not returned by the lookup response. `studentId` is used only inside the payment transaction and is not returned by the lookup, ledger, collection, or dues serializers.

The Accountant response boundary excludes:

- date of birth;
- address;
- father, mother, Guardian, Parent, phone, email, and WhatsApp fields;
- Aadhaar-related values;
- medical, marks, and unrelated attendance data;
- Student/Guardian/internal actor IDs;
- private Student notes and lifecycle history;
- document/storage paths;
- portal usernames, password hashes, and other credentials.

The Accountant is also non-delegably denied `COMMUNICATE_PARENT`, `EXPORT_REMINDERS`, and `EXPORT_STUDENTS`. A stale enabled `RolePermission` row cannot restore those grants. Viewer/Auditor receives only aggregate pending-dues and collection reports and is non-delegably denied every export plus Student-ledger printing, including when stale enabled `RolePermission` rows exist.

## Finance response contracts

Separate serializers serve separate purposes:

- payment management: payment component ID plus fee-payment fields required to edit the component;
- ledger: no payment ID, Student ID, actor ID, deletion metadata, or private remarks;
- collection: no payment ID, Student ID, actor ID, deletion metadata, or private remarks;
- pending dues: fee identity, fee allocation, paid amounts, term dues, total due, and due state only;
- Viewer/Auditor reports: class/section aggregates with no Student identity.

Finance JSON responses set `Cache-Control: private, no-store`, `Pragma: no-cache`, and `X-Content-Type-Options: nosniff`. The global middleware also applies same-origin unsafe-request protection and private/no-store behavior to authenticated pages and APIs.

## Export inventory and privacy contract

All CSV helpers neutralize cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return before CSV quoting. Successful downloads append a `FINANCE_EXPORT_DOWNLOADED` `UserAudit` entry containing only the export type, purpose, role, output row count, allowed field names, scope, safe filename, date boundary, and aggregate flag. Audit failure prevents an unaudited download.

| Export | Purpose and permission | Allowed personal fields | Limit and scope | Filename and cache |
|---|---|---|---|---|
| Payment ledger | Fee-payment reconciliation; `EXPORT_PAYMENTS` | admission number, Student display name, class, section, receipt/payment facts | 2,000 rows; default 31 days; maximum 366 days | dated purpose name; private/no-store |
| Pending dues | Fee-due reconciliation; `EXPORT_REPORTS` | admission number, display name, class, section, status, fee/dues facts | 2,000 rows; academic-year/filter scope | academic-year purpose name; private/no-store |
| Daily collection | Collection reconciliation; `EXPORT_REPORTS` | admission number, display name, class, section, receipt/payment facts | 2,000 rows; one selected day | date purpose name; private/no-store |
| Student master | Student administration; `EXPORT_STUDENTS` | minimal academic identity fields | 2,000 rows; current filter scope | academic-year purpose name; private/no-store; Accountant denied |
| Reminder preparation | Approved reminder preparation; `EXPORT_REMINDERS` | one preferred destination plus dues/message fields | 2,000 rows; academic-year/filter scope | academic-year purpose name; private/no-store; Accountant denied |
| Expenses | Expense reconciliation; `EXPORT_EXPENSE_REPORTS` | no Student/Parent fields | 2,000 rows; default 31 days; maximum 366 days | dated purpose name; private/no-store |
| Budget | Approved allocation/utilization reconciliation; `EXPORT_BUDGET_REPORTS` | no Student/Parent fields | 2,000 allocation rows; one approved/locked plan | academic-year purpose name; private/no-store |
| Miscellaneous income | Non-fee receipt reconciliation; `EXPORT_MISC_INCOME_REPORTS` | Student name/admission only where the receipt is Student-linked; payer name for walk-in reconciliation | 2,000 receipts; default 31 days; maximum 366 days | dated purpose name; private/no-store |
| Cash Book | Physical-cash source/closing reconciliation; `EXPORT_CASH_BOOK_REPORTS` | no Student/Parent fields | 2,000 days; default 31 days; maximum 366 days | dated purpose name; private/no-store |
| Books sales, settlements, publisher bills | Books-finance reconciliation; `EXPORT_BOOK_REPORTS` | Student name/admission or walk-in payer only for sale receipts | 2,000 rows per selected purpose; default 31 days; maximum 366 days | purpose/date name; private/no-store |
| Library charge reports | Charge, incident, overdue, or receipt reconciliation; `EXPORT_LIBRARY_CHARGE_REPORTS` | purpose-limited borrower label and class/staff type | 2,000 rows; default 31 days; maximum 366 days | type/date name; private/no-store |
| Class X packages | Package/linked-charge reconciliation; `EXPORT_CLASS_X_PACKAGE_REPORTS` | Student name, admission number, package/payment state | 500 rows; default 31 days; maximum 366 days | dated purpose name; private/no-store |
| Fee-register OCR | Aggregate batch reconciliation or one reviewed staging batch; `EXPORT_FEE_REGISTER_OCR_REPORTS` | admission number only in the reviewed staging batch | 2,000 batches/rows; aggregate is date-bounded, reviewed export is one batch | safe batch/date name; private/no-store |

No export includes Parent contacts, address, date of birth, Student documents, marks, medical data, Student/internal actor IDs, passwords, secrets, or private Student notes. Distinct purposes have distinct routes and field lists; there is no universal Accountant personal-data export.

## Final fee-receipt cancellation

`CANCEL_PAYMENTS` is non-delegably denied to Accountant. The direct payment and receipt-audit APIs also require:

- authenticated `CANCEL_PAYMENTS`;
- role `DIRECTOR` or `SUPER_ADMIN`;
- a 3-to-500-character reason;
- the receipt version presented to the user;
- the current version to match inside the transaction.

The UI uses an accessible in-app `role="dialog"` with `aria-modal="true"` and explains that every split component will be cancelled. It uses no native `alert`, `confirm`, or `prompt`.

Cancellation:

- updates every active `Payment` component under the receipt in one transaction;
- never hard-deletes the receipt, component, or history;
- appends one safe `PaymentAudit` snapshot for each changed component;
- synchronizes `ReceiptNote` to `Cancelled` with the approved reason;
- rejects a stale active mutation with HTTP 409;
- treats a repeated or racing request after the final state is reached as an idempotent success without extra audit rows.

Receipt and admission numbers are locked during payment correction. The API enforces the lock, stored receipt date, fee type, term, and current receipt version, so an edit cannot move one component away from its split receipt, reassign its Student, or make its logical metadata disagree with sibling components.

New receipt creation reserves `ReceiptNote.receiptNo` before inserting components. All split components must arrive in the same atomic create request; a later create request cannot append a component to an existing receipt. This prevents cross-request metadata drift and makes the unique receipt number the transaction-level concurrency guard.

Receipt-audit ranges accept only positive safe integers, reject overflow/scientific-notation values such as `1e308`, and are limited to 500 receipt numbers per request.

## Authoritative receipt state

`lib/receipt-integrity.ts` is the shared rule:

- all non-deleted components active: `ACTIVE`;
- all non-deleted components cancelled: `CANCELLED`;
- any active/cancelled mixture: `INCONSISTENT`.

`ReceiptNote` does not override that result. A note disagreement is an integrity warning. Creation, correction, whole-receipt cancellation, and whole-receipt restoration synchronize the note transactionally.

Only fully `ACTIVE` receipts contribute to:

- receipt detail and print;
- Student ledger totals;
- pending dues allocation;
- Daily Collection;
- dashboard collection totals;
- payment and collection exports;
- Receipt Audit classification;
- fee-cash source calculations used by Cash Book.

A cancelled print remains available as preserved history and is visibly marked cancelled. An inconsistent split receipt fails closed: it is not counted as collected until reviewed and corrected.

## Audit privacy

New payment audit rows store a purpose-limited receipt snapshot rather than a Prisma row dump. Historical audit JSON is parsed and re-serialized through the same allowlist before being returned or rendered. Internal payment/Student/actor IDs, deletion metadata, password material, and filesystem paths are excluded.

## Copied-database QA evidence

The FIN-2A QA utility copies the operational SQLite database into the ignored isolated QA root and checks the operational SHA-256 before and after every command. The initial run creates only `FIN2A` synthetic users, one `FIN2A` Student, and a Cash plus two-UPI split receipt. Independent QA uses a separate database and `FIN2AQA` fixture prefix. Temporary random passwords exist only in ignored runtime state files, are never placed in source or documentation, and are deleted with the QA roots.

Completed evidence:

- 23/23 dedicated permission, serializer, export, receipt-state, range, reservation, and concurrency regression tests passed.
- A real copied-database concurrent cancellation produced one 3-component change and one idempotent result.
- A repeated cancellation changed zero components and created no extra audit.
- A forced transaction failure preserved all 3 active components and created zero audit rows.
- The Browser cancellation of synthetic split receipt `982026` cancelled all 3 components exactly once, synchronized `ReceiptNote`, reopened INR 6,000 of dues, removed collection and Cash Book residue, and rendered a visibly cancelled receipt.
- Accountant login/lookup/logout, direct cancellation denial, Director cancellation, Viewer aggregate-only reports, private API denial, secure caching, and static-cache behavior passed on the copied database.
- Browser QA passed at `window.innerWidth=1366`, `window.innerHeight=768` and exact mobile `window.innerWidth=390`, `window.innerHeight=844`, `document.documentElement.clientWidth=390`, `document.documentElement.clientHeight=844`. There was no horizontal overflow, every table was contained, the accessible dialog fit the viewport, every visible mobile control was at least 44px after correcting the two audit-detail summaries, and both light and dark modes passed.
- The final clean Browser run had zero console warnings/errors, no native JavaScript dialog, and zero production stderr.
- FIN2A records were removed and inspected twice, then the copied database and ignored credential state were destroyed.
- Final regression passed typecheck, 1,496/1,496 tests across 163 files, and 212/212 production build entries. The first build attempt reached the established 2 GB Node heap; the authorised bounded 4 GB retry passed.
- The final version-37 backup is `nalanda-fee-control-backup-2026-07-26-19-36.json`; it is ignored and unstaged.
- The operational checkpoint remains SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`, 4,771,840 bytes, timestamp `2026-07-19T13:21:15.353Z`, with 8 Students, 8 active enrollments, 19 Payments, and INR 99,100 collected.

## Operational checkpoint recovery evidence

The first final backup rehearsal exposed a defect in FIN-2A's permission seeding: `ensureDefaultRolePermissions()` rewrote six existing operational role overrides while enforcing the new hard-denial policy. The integrity gate stopped the release before staging or commit. Backup-document comparison proved that only five Accountant permission rows and one Viewer permission row changed; Student, enrollment, Payment, collection, schema, and migration data did not change.

The seeder now creates missing safe defaults but never rewrites an existing operational override during backup. Non-delegable restrictions remain fail-closed in effective permission reads, matrix display, payload validation, and explicit matrix saves. A disposable recovery candidate was reconstructed from the exact pre-change values and SQLite counters; it matched the authorised SHA-256 byte-for-byte before a rollback-protected atomic replacement. The project integrity checker then confirmed the exact hash, size, timestamp, schema hash, migration hash, business baseline, absence of `_prisma_migrations`, active migration, and backup version. All private recovery copies were removed after verification, and the final backup proved both hash and timestamp remain unchanged.

## FIN-2A-QA independent closure

Independent QA used a new ignored copied database and newly generated `FIN2AQA` Director, Accountant, Viewer, Student, and Cash plus two-UPI split-receipt fixtures.

The independent pass verified:

- Accountant lookup returned exactly `academicYear`, `admissionNo`, `className`, `feeAllocation`, `section`, `status`, and `studentName`; the broader Student API returned 403.
- Accountant direct final-receipt cancellation and Student-master export returned 403. Purpose-specific payment, dues, and collection CSVs returned only their documented headers with private/no-store caching.
- Viewer pending dues remained aggregate-only with no Student identity or export control; direct payment export returned 403 and ledger print ended at `/unauthorized` without identity content.
- Director cancellation returned 400 without a reason and 409 for a stale active version. The valid accessible confirmation cancelled all three components, wrote exactly three append-only audits, synchronized `ReceiptNote`, and remained idempotent with zero changes on repeat.
- The cancelled receipt reopened INR 6,000 of dues, left zero paid allocation for the synthetic Student, left zero Daily Collection and fee-cash residue, disappeared from dashboard activity, and printed all three components under a visible `CANCELLED` watermark.
- A later create request against the existing receipt returned 409 and left the component count at three. Unsafe receipt-audit range `1e308` returned 400.
- Concurrent cancellation produced one three-component result and one idempotent result. The forced failure rehearsal preserved all three active components and wrote zero audits.
- Desktop Browser QA passed at `1366x768` in dark and light mode. Mobile QA passed at `window.innerWidth=390`, `window.innerHeight=844`, `document.documentElement.clientHeight=844`; the active form client width was 375 because of its scrollbar. No page overflow or uncontained table was present and every visible control was at least 44px.
- Independent QA found that both reason textareas relied on button/server enforcement without native required semantics. Both now have `required` and `minLength=3`; a fresh rebuilt FIN2AQA run verified the required/minimum-length properties, labelled/described modal, disabled pre-reason confirmation, 44px controls, no native dialog, zero console warnings/errors, and zero clean-run production stderr.
- The deliberate invalid-login run stayed on `/login` with the safe generic error and produced one redacted authentication warning containing no credential, Student identifier, fee balance, or cookie.
- Each FIN2AQA copied database was cleaned, inspected twice at zero synthetic records, and destroyed. The operational checkpoint remained exact after every command.
- Final closure retained backup version 37 in ignored, unstaged `nalanda-fee-control-backup-2026-07-26-20-40.json`; Git safety and the operational integrity checker passed.

## Remaining limitations

- There is no partial final-receipt cancellation. The whole receipt is the only safe rule.
- There is no refund, chargeback, gateway, or compensating locked-day correction module.
- `ReceiptNote` remains metadata; its schema was not expanded into a workflow/version model.
- SQLite serializes writes. FIN-2A handles concurrent final-state requests idempotently, but horizontal multi-instance deployment remains outside the supported architecture.
- Historical broad audit JSON may still exist at rest in old databases; FIN-2A redacts it at every restricted response/render boundary and writes only safe snapshots going forward.
- Physical Android/iPhone PWA certification remains a separate device phase; FIN-2A-QA does not claim physical-device evidence.
