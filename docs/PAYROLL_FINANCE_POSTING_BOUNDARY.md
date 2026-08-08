# Payroll Finance Posting Boundary

Accounting posting is `DISABLED` in Prompt 23I. The application exposes a preview explaining the intended payroll-run totals but cannot post it.

The existing expense and Cash Book domains do not jointly prove all required invariants: exact payroll-run ownership, exactly one posting per approved run, idempotent reversal, locked-period protection and append-only audit. Therefore approval and payslip issue create no `Payment`, receipt, fee allocation, `ExpenseRecord`, `CashBookMovement`, bank transfer or salary-paid marker.

Any future posting phase requires a separately approved additive design with a unique payroll-run ownership key, transaction-safe post/reverse operations, locked-accounting-period checks, reconciliation and copied-database failure evidence. Until then every posting attempt must fail closed. Bank disbursement remains outside that future accounting handoff.
