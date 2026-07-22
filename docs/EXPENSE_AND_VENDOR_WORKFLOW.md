# Expense and Vendor Workflow

Prompt 16A adds the school expense register and vendor foundation. Prompt 16B now reads approved expense records for budget control, but expenses remain separate from student fee `Payment` records. Neither phase includes cash book, miscellaneous income, payroll, inventory, tax filing, bank reconciliation, or online payments.

## Vendor records

Vendors use a unique vendor code, name, optional contact/address/tax details, payment terms, and ACTIVE/INACTIVE/BLOCKED status. Only the last four bank-account digits are stored. GSTIN, PAN, and IFSC checks validate format only; they do not verify an identity with a government portal or bank. A linked vendor cannot be hard deleted. Use INACTIVE or BLOCKED; status changes require confirmation and preserve linked expense history.

Read-only expense roles do not receive vendor tax/banking fields. `VIEW_VENDORS` opens the vendor master; `MANAGE_VENDORS` is required to create, edit, search GSTIN, and see sensitive tax/banking fields.

## Expense money rule

Amounts use Prisma Decimal values. The server requires:

`net amount = gross amount + tax amount - deduction amount`

Every amount is non-negative, net/gross must be greater than zero, and only two decimal places are accepted. The server rejects inconsistent input and does not silently recalculate an approved record.

## Workflow

1. DRAFT: editable and unpaid. The operator may save or submit it.
2. PENDING_APPROVAL: locked against edits. An authorized approver may approve or reject.
3. APPROVED: immutable. An authorized payment operator may record one or more partial payments.
4. REJECTED: preserved with a required rejection reason. It is not payable or editable; create a corrected draft if needed.
5. PAID: represented by APPROVED plus payment status PAID. Payment rows and audit history are immutable.
6. CANCELLED: preserved with a required reason. Payments are not deleted. Cancelled net amounts are excluded from active-spend report totals.

All transitions use server-side permission checks, guarded current-state updates, a database transaction, and an append-only `ExpenseAudit` record. A repeated/double action fails safely when the current state no longer matches.

## Payment references

- CASH: no transaction reference required.
- UPI, BANK_TRANSFER, NEFT, RTGS, IMPS, OTHER: transaction reference required when payment is recorded.
- CHEQUE: cheque number and cheque date required when payment is recorded.
- A draft may hold expected payment details, but saving/submitting never marks it paid automatically.
- Partial payments are stored in `ExpensePayment`; overpayment is rejected.

## Permissions and defaults

| Role | Default access |
|---|---|
| Super Admin, Director | All expense/vendor permissions |
| Admin | View/manage vendors and expenses; approve, pay, cancel, report, export |
| Principal | View expenses and reports only (conservative school-policy default) |
| Accountant | View/manage vendors and expenses; pay; reports/export; no approval or cancellation |
| Viewer/Auditor | View expenses and reports only; no vendor master, writes, or export |
| Teacher, Parent | No expense/vendor access |

Custom role-matrix rows can change these defaults, except Super Admin remains locked on.

Read-only expense payloads omit payment/cheque references, private notes, rejection/cancellation reasons, and finance actor names. They retain operational amounts/statuses and append-only action history needed for read-only audit review.

## Reports and export

`/expenses/reports` shows date-, vendor-, category-, department-, payment-status-, and approval-status summaries. Cancelled rows remain auditable but are excluded from active totals. CSV needs `EXPORT_EXPENSE_REPORTS`, uses allowlisted columns, neutralizes spreadsheet formulas, and excludes raw user IDs, secrets, and tax/banking details. Budget analysis is a separate read-only Prompt 16B surface under `/budgets/reports`.

## Backup and restore

Backup version 15 added Vendor, ExpenseCategory, ExpenseDepartment, ExpenseRecord, ExpensePayment, and ExpenseAudit. Version 16 retains those arrays and adds budgets, allocations, and revisions. Restore accepts older backups, validates links/statuses/exact two-decimal money, maps user links safely, avoids duplicate expense numbers and master rows, and keeps a newer local vendor record. If an expense number exists under a different record ID, restore keeps the local row and does not attach the backup row's payments/audits. Password hashes remain excluded.

## Remaining limitations and later phases

- No invoice-document upload or filesystem storage in Prompt 16A.
- Rejected items use a new corrected draft; there is no return-to-draft action.
- Cancellation is the correction mechanism for approved/paid records; there is no reversal voucher or refund workflow yet.
- Category/department setup is seeded by migration; dedicated master-management pages are future work.
- Reports are operational summaries, not accounting statements, tax returns, bank reconciliation, or budget variance.

Prompt 16A-QA is complete. Prompt 16B adds budget and spending controls; see `BUDGET_AND_SPENDING_CONTROL_WORKFLOW.md`. Prompt 16C daily cash book/day close and Prompt 16D miscellaneous income remain future separate phases. Keep all four separate from student fee logic.

Prompt 16C is now implemented. Cash-book expense outflow reads each non-cancelled CASH `ExpensePayment` for the selected date, including partial payments exactly once. Expense rows are not copied into cash movements and are not rewritten by the cash book. See `MISCELLANEOUS_INCOME_AND_CASH_BOOK_WORKFLOW.md`.

Prompt 16D is now implemented without a second publisher ledger. The Books publisher pages create and filter existing `Vendor` and `ExpenseRecord` rows; every partial/final payment remains an existing `ExpensePayment` governed by the original expense approval/payment permissions and validators. Publisher bill drafts default to `Books & Academic Materials` and `Library`/`Academics`. The annual library-management service action creates a `Professional Fees` / `Library` expense draft for an approved Vendor, with an operator-entered amount and no payroll posting. See `BOOKS_LIBRARY_INCOME_AND_PUBLISHER_PAYMENT_WORKFLOW.md`.
