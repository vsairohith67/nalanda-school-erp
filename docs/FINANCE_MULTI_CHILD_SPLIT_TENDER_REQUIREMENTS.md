# Family/Multi-Student Mixed-Tender Fee Collection Requirements

**Requirement:** `V1-FIN-FAMILY-001`<br>
**Recommended implementation phase:** `FIN-FAMILY-PAY-1`<br>
**Status:** V1 blocker; specification only

## Business outcome

An authorised collector can receive one family payment for one or more linked Students, split it across one or more instruments, allocate it exactly to each child/term/fee head, issue one consolidated receipt with child-wise breakdown and produce correct separate Student-ledger and Cash Book/bank effects exactly once.

## Required model concepts

- **Family collection:** immutable public reference, payer context, collection date, state, idempotency key, actor and version.
- **Payment instrument:** CASH, UPI or governed BANK/OTHER component, exact paise, normalised reference where required, and posting status.
- **Student allocation:** linked Student, fee year/term/head/installment, exact paise, allocation order/policy and locked snapshot.
- **Family receipt version:** consolidated immutable snapshot with child-wise breakdown and supersession/correction links.
- **Collection event:** append-only review, confirm, post, issue, reverse, correct and refund history.
- **Optional family credit:** disabled by default; if enabled, separately approved, traceable and allocatable later without becoming anonymous money.

Internal database IDs stay server-side. Parent-child eligibility must be resolved from active Guardian/User links, and a cashier must not be able to select an unrelated Student merely by admission number.

## Workflow

1. Resolve the payer and linked eligible Students server-side. Authorised school collection may use an explicitly recorded counterparty without granting Parent portal rights.
2. Select one or more Students and enter instruments.
3. Build either a manual allocation or a deterministic automatic-allocation preview.
4. Display instruments, child/term/head allocations, remaining balances and the invariant before confirmation.
5. Refuse missing/duplicate instrument references, ineligible children, stale balances, negative/zero rows, over-allocation and under-allocation.
6. On confirmation, lock the allocation plan and post collection, instruments, allocations, receipt and audit exactly once in one transaction.
7. Produce one consolidated receipt and child-wise breakdown; each Student ledger reflects only that child's allocations.
8. Post exactly one cash component to Cash Book and exactly one record for each non-cash instrument.
9. A correction/reversal appends a governed compensating version/event and updates every affected child/instrument atomically. It never edits issued history in place.

## Allocation policy

Automatic allocation must be deterministic, documented and previewed. Its ordering should be configurable only through versioned policy, with a safe default such as oldest due academic period, then term/installment, then fee-head display order, and then stable Student order. Manual edits require the preview to be recomputed and revalidated.

Partial family payments are allowed only when every paise is allocated to a child or approved credit. The receipt must show remaining child-specific balances after the transaction.

## Idempotency and concurrency

- The client supplies a single-use request key; the server also derives a bounded request fingerprint.
- A repeated identical request returns the previously committed result and does not create a second posting.
- A reused key with different content is refused.
- Confirmation validates current Student balances and collection version using compare-and-set semantics.
- Normalised UPI/bank references have a database uniqueness rule in the approved scope and a privacy-safe conflict response.
- Concurrent clicks, retry after response loss and two browser sessions are independent acceptance tests.

## Online provider boundary

Before creating a provider order/session or accepting capture, persist an immutable versioned allocation plan containing exact Students and exact paise totals. Provider callbacks reference that plan and are idempotent. A stale or changed plan cannot be silently applied after capture; it enters a governed reconciliation state. Provider activation is outside this phase.

## Receipt, reporting and recovery

- The consolidated receipt has a stable family-collection reference, instrument summary and child/term/head breakdown.
- Separate Student ledgers and dues reports reconcile to allocations, not the overall receipt total.
- Cash Book and bank/UPI reports reconcile to instruments, not duplicated child rows.
- Reports expose safe references and avoid unnecessary Parent/Student personal data.
- Backup/restore includes all new roots, snapshots, versions and events; validates exact links/totals; remains backward compatible and idempotent.
- Legacy one-Student receipts remain readable without rewriting operational history.

## Security and permissions

- All mutations are authenticated, server-authorised and origin-protected.
- View, create, confirm/issue, correct/reverse, approve family credit and export permissions are separable.
- Parent access, if later offered, is limited to linked children and issued receipts.
- Sensitive payment references are masked except for roles with an operational need.
- Responses are private/no-store and family/payment data is excluded from PWA caches, logs and external planning systems.

## Acceptance evidence required

Independent tests must cover all 17 scenarios in `docs/FINANCE_MULTI_CHILD_SPLIT_TENDER_AUDIT.md`, the accounting invariant, paise rounding, stale-plan refusal, reference normalisation, repeated clicks, concurrent requests, receipt correction, Cash Book reconciliation, individual ledger effects, backup/restore twice, copied-database migration rehearsal and cleanup. Browser acceptance must include desktop and `390x844` mobile without horizontal page overflow.
