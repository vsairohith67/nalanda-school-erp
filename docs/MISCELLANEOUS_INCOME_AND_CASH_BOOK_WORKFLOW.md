# Miscellaneous Income and Daily Cash Book Workflow

Prompt 16C adds two related but separate finance-control registers. Miscellaneous income records non-fee school income. The daily cash book reconciles physical cash. Neither changes student fee `Payment`, fee calculation, pending dues, fee receipts, or student ledger logic.

## Miscellaneous-income items and rates

`MiscIncomeItem` stores the item code, name, category, student-link policy, and active/inactive status. Six safe starter items are seeded: Belt, Tie, Bonafide Certificate, Transfer Certificate, Class X Certificate / Migration Service, and Other. No price is seeded or hard-coded. An authorized operator must add `MiscIncomeRate` rows for the current academic year before issuing receipts.

Rates use Decimal amounts and optional effective dates. The server rejects overlapping active rate windows for one item and academic year. Old rates remain preserved, and every receipt line stores the issued item-name, rate link, quantity, unit amount, discount, and line-total snapshot. Changing a later rate never rewrites an issued receipt.

Student-link policies are enforced across all selected lines:

- REQUIRED: the receipt must link a real active student. Bonafide, TC, and Class X certificate/migration items use this default.
- OPTIONAL: the receipt may link a student. Belt, Tie, and Other use this default.
- NOT_REQUIRED: the receipt must not link a student.

## Issue and cancel a receipt

Use **Miscellaneous Income -> Create receipt**. Select one or more items, positive whole quantities, and discounts. The server reloads the active academic-year rate and recalculates gross, discount, and net totals in a transaction. Discounts cannot exceed their line gross and net must remain positive.

Receipt numbers use the separate `MISC-YYYYMMDD-XXXXXX` namespace. They are never fee receipt numbers. Issued receipts cannot be silently edited. Cancellation requires `CANCEL_MISC_INCOME` and a reason, preserves the original header/lines, and excludes the amount from active reports and cash sources.

Reference rules:

- CASH: recorded against the school cash counter and affects physical cash. Transaction references are cleared.
- UPI, bank transfer, NEFT, RTGS, IMPS, and OTHER: received account and transaction reference are required; they do not affect physical cash.
- CHEQUE: received account, cheque number, and cheque date are required; it does not affect physical cash.

The print page is black-and-white friendly, uses public-safe account labels, contains no internal user IDs, and shows a cancellation watermark when needed.

## Daily physical-cash calculation

The cash book reads authoritative rows; operators must not manually duplicate them.

`expected closing = opening + active fee cash + active miscellaneous cash + manual/adjustment inflows - active cash expense payments - manual/adjustment outflows - bank deposits - Director handovers`

- Fee cash comes only from active, non-deleted fee `Payment` rows whose mode is Cash for the selected date.
- Miscellaneous cash comes only from active `MiscIncomeReceipt` rows with method CASH.
- Cash expense comes from each `ExpensePayment` row paid by CASH whose parent expense is not cancelled. Partial payments are summed once each.
- UPI, bank, cheque, and other non-cash rows never enter the physical-cash formula.
- Amounts use Decimal arithmetic and preserve paise.

`CashBookMovement` is only for MANUAL_INFLOW, MANUAL_OUTFLOW, BANK_DEPOSIT, DIRECTOR_HANDOVER, ADJUSTMENT_IN, and ADJUSTMENT_OUT. Amounts must be positive, the movement date must equal the cash day, and a reason is required. Use separate bank-deposit and Director-handover rows for a split disposition. UI wording is **Deposited to school current account**, **Handed to Director Sir**, and **Closing cash retained**.

## Day workflow and correction policy

1. DRAFT: opening, counted closing, notes, and movements are editable. Opening normally carries from the previous LOCKED day's counted closing cash. A manual first opening or changed carry-forward needs a note.
2. SUBMITTED: counted closing is required. A non-zero variance needs an explanation. Live sources and movement totals are snapshotted transactionally; ordinary edits stop.
3. APPROVED: leadership approval is recorded separately from submission and lock.
4. LOCKED: final and immutable. There is no casual unlock or history deletion.
5. REJECTED: rejection reason is preserved; an explicit return-to-draft action is available to a permitted draft manager.
6. CANCELLED: cancellation reason and record are preserved. A LOCKED day cannot be cancelled.

Every transition uses a state-and-update-time compare-and-set inside a transaction. Double submit/approve/lock fails. Later source changes do not rewrite submitted or locked snapshots. The detail/report surfaces compare the live source fingerprint with the stored snapshot and show a source-drift warning. Correct a locked-day problem with a documented compensating movement on a later day; do not edit or unlock history.

## Permissions

| Role | Default |
|---|---|
| Super Admin, Director | All miscellaneous-income and cash-book permissions |
| Admin | Manage income/items, cancel income, manage and submit draft cash days, reports/export; no cash approve/lock/cancel |
| Accountant | Manage income/items and manage/submit cash days, reports/export; no income cancellation, cash approval/lock/cancel |
| Principal | Read-only income, cash book, and reports; no export |
| Viewer/Auditor | Read-only income, cash book, and reports; no export; sensitive references/actors hidden |
| Teacher, Parent | No access |

Pages and APIs enforce permissions server-side. Restricted payloads omit transaction, cheque, bank-deposit and handover references, private notes/reasons, and actor names. No response includes password hashes, raw actor IDs, secrets, or filesystem paths.

## Pages, reports, and dashboard

- `/misc-income`, `/misc-income/new`, `/misc-income/[id]`, `/misc-income/[id]/print`, `/misc-income/items`, `/misc-income/reports`
- `/cash-book`, `/cash-book/[date]`, `/cash-book/reports`
- Protected APIs live under `/api/misc-income` and `/api/cash-book`, including item/rate, receipt/cancel, movement, workflow, report, and export routes.
- CSV exports use allowlisted columns and neutralize spreadsheet formulas.
- The dashboard adds only today's miscellaneous income, expected cash on hand, today's cash-book status, pending approvals, and unexplained-variance warning.

## Backup, restore, and boundaries

Backup version 17 adds all six Prompt 16C entities. Restore remains compatible with older backups, validates exact student/item/rate/receipt/line/day/movement links and totals, rejects duplicate receipt numbers and cash dates, maps actors only when safe, preserves newer local root rows, remains idempotent, and isolates same-number/date records with different identities so children cannot attach to unrelated local rows. Password hashes remain excluded.

This phase does not build books/library-specific accounting, payroll, GST filing, bank reconciliation, inventory/stores, gateway integration, AI advice, or any change to attendance, timetable, UDISE, lifecycle, or progression. Prompt 16D was subsequently implemented as a separate books-finance foundation.

## Prompt 16D book-sale cash integration

Active CASH `BookSaleReceipt` totals now enter the daily cash book once as `bookSalesCash`; UPI/bank/cheque sales do not. A submitted cash day snapshots `bookSalesCashSnapshot`, later receipt changes produce source drift, and the book settlement itself is not a second inflow. Settlement approval creates at most one existing `DIRECTOR_HANDOVER` movement; cash handed to the school counter or retained by the books in-charge creates no outflow. Backup version 18 includes the new snapshot and remains compatible with version-17 backups. See `BOOKS_LIBRARY_INCOME_AND_PUBLISHER_PAYMENT_WORKFLOW.md`.

## Prompt 16C implementation verification

## Prompt 16H Library charge collection

Library charges reuse this module exactly once through `LIB-STUDENT-CHARGE` and `LIB-STAFF-CHARGE`. The approved Library charge payable amount is the authoritative receipt-line amount; item masters do not define a price. CASH enters the Cash Book once through the normal Miscellaneous Income source, while non-cash methods do not. The unique charge-receipt link and compare-and-set update block double collection. Cancelling a linked receipt leaves the charge paid, appends a reconciliation warning, and requires an explicit compensating correction rather than silently changing locked history. This integration never creates a student fee `Payment`, due, fee-ledger row, or second Library ledger.

## Prompt 16C release evidence

The final gate passed `lifecycle:backfill` with no changes, typecheck, 558 tests across 72 files, and the 133-page production build. In-app Browser QA covered configurable rates, multi-line CASH receipts, student-required Bonafide income, UPI reference enforcement, preserved cancellation, print output, deposits, Director handover, split disposition, variance explanation, submit/approve/lock, locked immutability, source drift, reports/CSV, role isolation, 1366×768 and 390×844, light/dark mode, contained table scrolling, zero page overflow, and zero console errors/warnings. Cleanup retained the six seeded item masters and removed every QA rate, receipt, line, cash day, movement, and temporary role user. The clean version-17 backup is `nalanda-fee-control-backup-2026-07-15-13-30.json` and contains no password hashes.
## Prompt 20B historical fee-register boundary

The Daily Cash Book reads active CASH fee `Payment` records using `Payment.date`, not OCR upload or review time. Prompt 20B preserves that finding but does not create Payments: the existing creation path does not yet prove all allocation, outstanding-balance, receipt, overpayment, idempotency, and historical-date invariants through one reusable helper. OCR posting therefore remains disabled and cannot change Cash Book totals. A reviewed staging CSV is the only financial handoff.

# Prompt 18B document-package service charge

An approved Class X package charge is collected exactly once through one existing `MiscIncomeReceipt` and one configured `CLASS-X-CERT` line. The Daily Cash Book derives that receipt once through its existing source calculation. Prompt 18B never creates a fee `Payment`, changes dues, or uses a payment gateway. A permitted full waiver records a reason and creates no receipt. The receipt label must remain “Document Package Service Charge Receipt”, not a Board or school-fee receipt.
