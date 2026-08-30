# Accountant Daily Closing Runbook

## Fee collection

1. Confirm synthetic/test banner, active Accountant role, date and academic year.
2. Search by the governed Student reference; confirm Student/class and current-year dues without exposing unrelated family data.
3. Enter Cash or manual UPI evidence. For siblings use the governed family-payment workflow and verify allocations before confirmation.
4. For partial payment, confirm remaining dues. For full payment, confirm zero expected remainder for the selected obligation.
5. Submit once. Duplicate click, same idempotency key and reconnect retry must return the original result, not a second receipt.
6. Print/reprint from the authoritative posted receipt. An Offline Sync draft has no receipt number and is not official.
7. Cancellation/correction uses the existing permission, expected version, reason, audit and leadership notification. Never edit posted money silently.

## Daily cash closing checklist

- [ ] Record opening balance in integer paise.
- [ ] Sum non-cancelled Cash fee collections for the day.
- [ ] Sum active Cash miscellaneous-income receipts.
- [ ] Sum approved/paid Cash expenses.
- [ ] Calculate `opening + cash fees + cash misc income - cash expenses`.
- [ ] Compare expected and actual closing cash. Difference must be exactly zero paise.
- [ ] Compare receipt sequence, Daily Collection, payment totals, expense report, misc-income report and Cash Book.
- [ ] Investigate gaps by reference; do not add a balancing transaction merely to force zero.
- [ ] Submit/lock only through existing authorization and preserve exceptions.
- [ ] Principal/Director reviews the bounded summary according to current permissions.

## Failure recovery

| Symptom | Operator action |
| --- | --- |
| Session expired before submit | Sign in again, reopen draft and verify whether a receipt already exists before retry |
| Network failed after submit | Search by receipt/idempotency reference; never re-enter until authoritative state is known |
| Duplicate warning | Stop; compare Student, amount, date, mode and reference; escalate uncertain cases |
| Offline conflict/rejection | Keep the draft non-official, read the server reason, correct or discard under the cleared workflow |
| Cash mismatch | Freeze closing, preserve reports and references, escalate to finance owner |
| Locked day | Do not rewrite; use the governed review/correction path |
