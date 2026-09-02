# Financial Opening Position and Reconciliation

Opening position separates current-year fee assignment, Old Due opening balance, verified historical Payments, unapplied credit, discounts, refunds/reversals and unidentified difference. An opening balance is never represented as a fabricated Payment.

All comparisons use integer paise. Reconcile Student and family/sibling allocation, fee-head totals, Payment count/total, receipt references, discounts, refunds/cancellations, Cash Book, bank/cash/UPI totals where evidence exists, and source control totals.

Difference states are `MATCH`, `EXPLAINED_DIFFERENCE`, `UNEXPLAINED_DIFFERENCE`, `SOURCE_INCOMPLETE`, `SOURCE_CONFLICT` and `DO_NOT_IMPORT`. An unexplained difference blocks its batch. An explained difference requires evidence, Finance Reviewer and Final Owner approval; explanation is not a mathematical match.

No source amount is converted through binary floating point. The dry-run engine parses rupee strings into paise and reports source, accepted and difference totals. It does not post ledger rows, receipts or balances. Use the empty [reconciliation template](../templates/onboarding/financial-reconciliation.csv).

Historical payment import belongs to Wave 5 after Wave 4 opening position is accepted. Orphan Payments, missing receipt evidence, unexplained family allocation and mismatched control totals remain unimported.
