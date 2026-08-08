# Finance Multi-Child Split-Tender Audit

**Audit ID:** `GOV-RECON-1-FIN`<br>
**Audit date:** 2026-08-08<br>
**Baseline:** `main` at `71f671b8b6ee946884e5b79a9786581f237a6437` / `payroll-ess-v37-2026-08-08`<br>
**Method:** read-only schema, services, routes, UI, tests, backup/restore and Git evidence inspection

## Conclusion

The exact family/multi-Student mixed-tender requirement is **not implemented**. The current engine supports one Student per receipt and tested same-Student split tender. It explicitly rejects attaching a second Student to an existing receipt. There is no family collection aggregate, child-allocation ledger, governed family credit, allocation-plan snapshot or uniqueness guard for UPI transaction references.

The next implementation phase should therefore be `FIN-FAMILY-PAY-1 — Family/Multi-Student Mixed-Tender Fee Collection`.

## Current evidence

- `Payment` is Student-owned through `studentId`/`admissionNo`; payment components are separate Payment rows.
- `components/payment-form.tsx` collects one admission number and can split that Student's amount across cash, multiple UPI rows and Bank/Other.
- `lib/payment-controls.ts` normalises split instruments but `assertReceiptStudentMatchInDatabase` refuses a different Student/admission number on the same receipt.
- `app/api/payments/route.ts` writes same-Student component rows and one receipt note in one transaction.
- `lib/fee-allocation.ts` derives one Student's term/fee-head balances from their payment rows. Overpayment is calculated but is not a governed family-credit account.
- `lib/cash-book.ts` derives cash totals from active cash Payment rows; there is no independent family cash posting record.
- `lib/receipt-integrity.ts` provides controlled single-Student receipt cancellation/correction and audit, not a family allocation reversal.
- `tests/payment-controls.test.ts`, `tests/fee-allocation.test.ts` and receipt tests cover same-Student splitting and allocation. They do not prove atomic multi-Student collection.
- Backup/restore version 37 preserves Payment/receipt history but has no family collection, instrument or child-allocation entities.
- No database uniqueness constraint or service refusal was found for a duplicate UPI transaction reference.

## Scenario evidence matrix

| # | Scenario | Result | Current models/services/routes | Current tests | Gap | V1 action required | Migration impact | Compatibility risk |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | One Parent, one Student, one cash payment | `PARTIALLY_IMPLEMENTED` | Student `Payment`; payment POST; derived Cash Book | Single-Student cash paths exist | No Parent/family collection identity | Create governed collection envelope while preserving current simple flow | Additive | Medium |
| 2 | One Parent, one Student, cash plus UPI | `PARTIALLY_IMPLEMENTED` | Same-Student Payment components and receipt | Split-component tests | No Parent envelope; UPI uniqueness is absent | Map instruments and allocations under one idempotent collection | Additive | Medium |
| 3 | One Parent, four linked Students, one UPI payment | `MISSING` | Receipt ownership guard forbids cross-Student use | None | No family root or allocation rows | Resolve linked children server-side and allocate atomically | New entities/indexes | High |
| 4 | One Parent, four linked Students, cash plus UPI | `MISSING` | Same-Student components only | None | Neither cross-Student allocation nor family instruments | Add atomic instruments-plus-allocations workflow | New entities/indexes | High |
| 5 | Partial payment leaving child-specific balances | `PARTIALLY_IMPLEMENTED` | Separate Student dues can be derived | Per-Student allocation tests | No single family transaction preserving each child's share | Store exact child allocation and recalculate each ledger | Additive | High |
| 6 | Manual child-wise allocation | `MISSING` | No family allocation API/UI | None | Missing allocation plan | Preview, validate and confirm bounded child/head/term allocations | New entities/routes/UI | High |
| 7 | Previewed automatic allocation | `MISSING` | Per-Student allocation helper only | Per-Student helper tests | No cross-child ordering rule or preview snapshot | Add deterministic policy, preview and user confirmation | New snapshot/entity | High |
| 8 | Duplicate UPI transaction-reference refusal | `MISSING` | Reference field lacks a proven unique guard | None | Duplicate external reference can be accepted | Normalise and uniquely reserve reference by governed scope | Unique index plus conflict handling | High |
| 9 | One Cash Book posting for the cash component | `PARTIALLY_IMPLEMENTED` | Cash Book derives cash Payment rows | Current cash totals tested elsewhere | No one-to-one family instrument posting | Link exactly one active cash instrument/posting to collection | Additive/derivation change | High |
| 10 | One UPI/bank record for the UPI component | `PARTIALLY_IMPLEMENTED` | Payment component carries mode/reference | Same-Student split tests | No family-level instrument record or uniqueness | Persist one instrument record and link allocations | New entity/index | High |
| 11 | One consolidated family receipt | `MISSING` | Receipt invariant is one Student | None | No family receipt root | Add consolidated receipt snapshot and numbering policy | New entity | High |
| 12 | Child-wise receipt breakdown | `MISSING` | Student receipt lines only | None | No child allocation snapshot | Render child/term/head breakdown from locked allocations | Additive renderer | High |
| 13 | Separate Student-ledger effects | `PARTIALLY_IMPLEMENTED` | Independent Student Payment rows affect ledgers | Single-Student tests | Not atomic or linked to one family collection | Post exact allocation rows exactly once to each ledger | New links/compatibility adapter | High |
| 14 | Controlled reversal/correction | `PARTIALLY_IMPLEMENTED` | Single-Student receipt workflow/audit | Receipt-integrity tests | No atomic family-instrument/allocation reversal | Append compensating version/event; never rewrite allocations | New version/event entities | High |
| 15 | Exactly-once posting under repeated clicks and concurrency | `UNSAFE_OR_AMBIGUOUS` | Transactional write and receipt checks exist | No family idempotency/concurrency proof | Repeat may fail rather than return same result; no collection idempotency key | Add request fingerprint, unique active keys and concurrent tests | Indexes and service contract | High |
| 16 | Optional unallocated family credit only when explicitly enabled | `MISSING` | Per-Student overpayment calculation only | No governed family-credit tests | No credit account, approval or application workflow | Default full allocation; add credit only behind explicit governed feature | New entities if enabled | High |
| 17 | Online-payment allocation-plan preservation before provider capture | `MISSING` | No provider capture allocation plan | None | Capture can have no immutable pre-authorised child plan | Lock/version allocation plan before provider session/capture | New snapshot/idempotency model | High |

## Accounting invariant

Every confirmed collection must enforce, in integer paise and inside one database transaction:

```text
sum(payment instruments)
= sum(student allocations)
+ explicitly approved unallocated credit
+ explicitly approved refund/reversal
```

Default V1 behaviour is full allocation: unallocated credit is zero unless a separately governed advance-credit capability is explicitly enabled. Refund/reversal terms in the invariant are signed/compensating accounting values defined by the implementation; they may not be used to hide an imbalance.

## Compatibility and safety judgment

This is a high-risk additive finance change. Existing one-Student receipts, receipt numbers, Cash Book totals, pending dues, reports, exports, backup/restore and correction history must remain readable and correct. A compatibility adapter may expose legacy receipts as a one-Student/one-allocation collection without rewriting historical rows. Operational data migration must be separately approved, rehearsed on a copied database and reversible; GOV-RECON-1 authorises none of those actions.
