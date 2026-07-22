# Books, Library Income, and Publisher Payment Workflow

## Purpose and accounting boundary

Prompt 16D adds a focused books-finance foundation. It is not a library circulation, accession, stock, procurement, payroll, GST, bank-reconciliation, gateway, or student-fee module.

Book-sale receipts are authoritative only in `BookSaleReceipt` and `BookSaleReceiptLine`. They use a separate `BOOK-...` number sequence and never create or change student fee `Payment`, fee dues, fee receipts, or miscellaneous-income receipts. A student link identifies the buyer when a catalog item requires one; it does not post to the student fee ledger.

## Catalog and academic-year rates

- `BookCatalogItem` stores a normalized unique item code, item type, optional safe publisher link, class/subject, student-link policy, and active status.
- `BookCatalogRate` stores academic-year and optional effective-date pricing. Active ranges for the same item and academic year cannot overlap.
- Prices are operator-entered. No application price is hardcoded.
- Issuance copies the item code, title, class, publisher name, unit price, discount, and total into immutable receipt-line snapshots. Later catalog or rate changes do not rewrite history.
- Linked catalog items cannot be hard deleted. Inactivation is the normal retirement path.

## Book-sale receipts

Authorized operators issue receipts from **Books → Sales → Issue receipt**. The server resolves active rates for the selected receipt date, requires a student whenever any chosen item requires one, accepts positive whole quantities, validates discounts and references, and calculates all paise-exact totals inside one transaction.

Physical `CASH` sales must use `BOOKS_CASH_COUNTER`. UPI, bank, NEFT, RTGS, IMPS, cheque, and other non-cash methods do not enter physical cash. Non-cash references follow the finance validation rules; cheque requires its number and date.

An issued receipt is immutable. Authorized cancellation requires a reason, preserves the receipt and snapshots, and excludes the cancelled amount from active sales, settlement expectations, and live cash-book sources. The print view is black-and-white friendly, is labelled **Books / Academic Materials Receipt**, and explicitly says it is not a school-fee receipt.

## Daily book-cash settlement and cash book

`BookCashSettlement` records the books in-charge's daily reconciliation. The live expected amount is the sum of active CASH book-sale receipts for that India-local calendar date. Submission stores that expectation as a snapshot.

The required reconciliation is:

`handed to Director + handed to cash counter + retained by books in-charge + variance = expected book cash`

A non-zero variance requires a reason. Draft and submission are separate from final approval. Super Admin and Director approve by default; Admin and Accountant do not.

Approval requires the matching daily `CashBookDay` to exist in DRAFT status. It creates exactly one active `DIRECTOR_HANDOVER` `CashBookMovement` for the Director amount. Repeated or concurrent approval cannot create a second movement. The cash-counter and retained amounts remain school physical cash and create no outflow. The settlement itself is never added as a second inflow.

The cash-book expected closing formula is:

`opening + fee cash + miscellaneous-income cash + book-sale cash + manual/adjustment inflows - cash expenses - manual/adjustment outflows - bank deposits - Director handovers`

Only active CASH book-sale receipts enter `bookSalesCash`. Submitted/approved/locked cash days preserve `bookSalesCashSnapshot`; later receipt changes produce source drift instead of rewriting the locked snapshot. Cancellation after settlement approval cancels the linked handover through the documented cash-movement cancellation path and preserves both records; it never silently deletes the movement.

## Publisher bills and payments

Publisher vendors remain ordinary `Vendor` records. The Books publisher pages are filtered wrappers over the existing expense ledger:

- **Publishers** shows safe vendor identity, invoice count, and outstanding amount. Read-only roles do not receive bank, tax, contact, reference, or actor fields.
- **Publisher bills** lists relevant existing `ExpenseRecord` rows and links to the existing draft, submit, approve, partial/final payment, and cancellation workflow.
- **New publisher bill** creates an `ExpenseRecord` draft with a required Vendor, invoice details, `Books & Academic Materials`, and `Library` or `Academics`. It does not create a payment automatically.

`ExpenseRecord` and `ExpensePayment` remain the only authoritative publisher bill/payment ledger. Existing expense approval and payment permissions still apply. Bank and cheque payment details use the existing expense validators. There is no duplicate publisher-payment table.

## Annual library-management service expense

**Create Library Management Service Expense** creates an ordinary `ExpenseRecord` draft using a required approved service-provider Vendor, department `Library`, and category `Professional Fees`. Its description identifies the academic year and service period. The authorized operator enters the amount because it can change each year; ₹25,000 is not hardcoded. It is not payroll. A later existing CASH `ExpensePayment`, if authorized, enters the Cash Book once through the standard cash-expense source.

## Permission defaults

| Role | Default books-finance access |
|---|---|
| Super Admin | All books permissions. |
| Director | All books permissions, including settlement approval and exports. |
| Admin | Catalog, rates, sales/cancellation, settlement draft/submit, reports/export, and publisher bill creation; no settlement approval by default. |
| Accountant | Sales, settlement draft/submit, publisher bills, reports/export; no catalog/rate or settlement approval by default. |
| Principal | Read-only reports; no export or writes. |
| Viewer/Auditor | Read-only reports; no export; sensitive publisher references, actors, settlement notes, and private fields are omitted. |
| Teacher | No books-finance access. |
| Parent | No books-finance access. |

All page and API access is enforced server-side. Existing expense permissions additionally govern publisher approval and payment.

## Reports, CSV, and printing

Books reports cover date, item, class, student, publisher, payment method/account, active/cancelled, cash/non-cash, settlement reconciliation, pending/unapproved days, publisher invoiced/paid/outstanding, and academic year. CSV exports use exact decimal text, formula-safe cells, allowlisted columns, and safe filenames. They omit raw user IDs, hashes, secrets, full banking data, filesystem paths, and private actor identifiers.

## Backup and restore

Backup version 19 continues including catalog items/rates, book receipts/lines, settlements, and `CashBookDay.bookSalesCashSnapshot`; those books-finance arrays were introduced in version 18. It continues excluding password hashes. Restore remains compatible with older backups, where the absent book-cash snapshot is treated as zero.

Restore validates exact student, vendor, item, rate, receipt, line, settlement, cash-day, and movement links; receipt totals; active rate overlaps; receipt-number and settlement-date uniqueness; Director handover type/amount; and child-parent identity. It isolates same-number records with different identities, preserves newer local root records under the existing policy, and remains idempotent.

## Remaining limitations

This phase has no library circulation, issue/return, accession register, barcode/RFID, inventory quantity or valuation, purchase orders, procurement approval, payroll, GST filing, bank reconciliation, payment gateway, or AI recommendation. Publisher ageing is an operational invoice-age view, not an accounting or statutory statement. The existing SQLite Prisma Migrate `P3005` baseline limitation remains documented.

## Prompt 16F separation update

The separate Library catalog/accession register is now built. It does not reuse or mutate `BookCatalogItem`, rates, sale receipts, publisher bills, expense payments, student fee payments, miscellaneous income, or cash-book calculations. An optional LibraryCopy Vendor/Expense link is provenance only and cannot post financial data. Books-finance backup arrays remain unchanged; backup version 19 adds separate library arrays.
