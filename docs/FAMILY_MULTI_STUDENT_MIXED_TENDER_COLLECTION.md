# Family/Multi-Student Mixed-Tender Collection

**Phase:** `FIN-FAMILY-PAY-1`  
**Boundary:** local/private only; no provider activation, deployment, or real-data onboarding  
**Backup contract:** version 37

## Architecture and lifecycle

`FamilyCollection` is the immutable accounting envelope. It owns one or more
`FamilyCollectionInstrument` rows, exact Student/term/head
`FamilyStudentAllocation` rows, and the allocation-to-instrument
`AllocationInstrumentShare` matrix. Compatibility `Payment` rows remain the
source consumed by existing Student ledgers and reports, but each is uniquely
linked to one allocation and share. Receipt versions, lifecycle events, and
provider allocation plans are append-only.

The write lifecycle is `preview -> confirm/issue`. Preview resolves the
Guardian/Student scope and current dues server-side and returns a stable plan
hash. Confirm rechecks the plan inside one transaction. Request key plus
fingerprint makes response-loss and repeated-click retries return the original;
a changed payload, stale plan, duplicate normalized reference, or concurrent
loser fails closed.

Posted collections are never edited. Correction atomically supersedes the
original, cancels its compatibility effects, and issues a linked replacement.
Reversal cancels every active compatibility Payment and appends receipt/event
history. Locked Cash Book dates require Director or Super Admin; an Accountant
attempt creates a privacy-safe review notification without changing collection
state.

## Exact allocation and accounting invariant

All calculations use integer paise. Automatic allocation is deterministic in
selected Student order and then term/head due order. Manual plans reject
duplicate rows, non-positive values, over/under-allocation, stale balances, and
implicit cross-year scope. Family credit is disabled.

```text
sum(instruments) = sum(allocations) = sum(shares)
                 = sum(active compatibility Payments)
                 = consolidated receipt total
```

Each instrument's shares equal that instrument exactly, and each allocation's
shares equal that allocation. Cash Book and bank/UPI reports count an instrument
once; Student ledgers count their individual allocation shares.

## Receipt specification

The stable opaque family reference identifies one consolidated receipt. It
shows payer, instrument summaries with masked references, child/term/head
breakdowns, remaining child-specific balances, totals, version, status, and
correction/reversal linkage. Print CSS provides a private A4-oriented document
and browser Save as PDF path. Legacy family-linked Payment receipt URLs redirect
to the consolidated receipt; ordinary single-Student receipts remain unchanged.

## Permission and privacy matrix

| Role/context | Aggregate | Create/issue | Correct/reverse | Receipt detail |
| --- | --- | --- | --- | --- |
| Accountant | Yes | Yes | Yes; locked-day leadership gate | Yes |
| Director / Super Admin | Yes | Yes | Yes | Yes |
| Admin / Principal | Permission-separated view only | No default | No | Only if explicitly permitted |
| Viewer | Totals/counts only | No | No | No identities, references, or instruments |
| Parent context | No staff aggregate | No | No | Full only if linked to every child; otherwise authorised child extract |
| Teacher context | No | No | No | Must explicitly switch to Parent context and pass Guardian linkage |

Endpoints are private and `no-store`. Child scope comes from active server-side
Guardian links; admission-number tampering, removed links, inactive Parent
context, and unrelated children fail closed. External references are normalized
for uniqueness and displayed only masked. General logs, exports, and external
governance records must contain no reference, Student identity, or DB content.

## Cash Book, reconciliation, and provider boundary

One cash instrument contributes once to fee cash. One UPI/bank/other instrument
is the reconciliation root for its amount and normalized reference. The
immutable provider allocation plan records internal intent only; it does not
call, configure, or activate a provider. Provider onboarding needs a separate
security, reconciliation, retention, and release gate.

## Backup and restore

Version 37 exports and validates seven family arrays: collections, instruments,
allocations, shares, receipt versions, lifecycle events, and provider plans.
Validation checks graph ownership, unique identities, exact totals,
status/linkage, and compatibility Payment linkage before restore. Restore remaps
User, Guardian, and Student identities, restores self-relations, relinks
Payments, and is idempotent. A multi-Student receipt number is accepted only for
a complete validated family graph.

## Operator guide

1. Open **Family collections -> New family collection**.
2. Select a Guardian/counterparty and only server-returned linked children.
3. Add approved instruments. Cash needs no reference; UPI/bank/other requires one.
4. Choose deterministic automatic allocation or enter an exact manual plan.
5. Review the share matrix and balanced invariant, then confirm once.
6. Print the consolidated receipt. Use the governed detail page for correction
   or reversal; never edit Payment rows directly.
7. Escalate locked-day changes to Director/Super Admin and reconcile each
   instrument root, not each child share.

## Developer guide and threat model

Keep preview/confirm validation shared, post within one Prisma transaction, and
preserve uniqueness on request key/fingerprint, normalized external reference,
allocation/share compatibility links, and receipt version. Never add
client-authoritative dues or Guardian scope. Extend backup, restore, cleanup,
reports, and legacy adapters together with schema changes.

| Threat | Control |
| --- | --- |
| Cross-family access/tampering | Active Guardian links and context resolved server-side |
| Duplicate/replayed payment | Fingerprint, unique key/reference, transactional retry |
| Paise loss or duplicated revenue | Integer-paise matrix and both-side exact sums |
| Stale dues | Confirm-time plan-hash and due revalidation |
| Partial write | One transaction and forced-FK rollback proof |
| Reference/identity disclosure | Masking, no-store, aggregate Viewer, scoped Parent extract |
| History rewrite | Append-only versions/events and compensating workflows |
| Provider overreach | Immutable plan only; no outbound provider integration |
| Recovery corruption | Graph validation and restore-twice proof |

## Verification and residual debt

The hand-checked Rs 40,000 case uses Rs 30,000 UPI plus Rs 10,000 cash across
four children, five instrument shares, one split child, and child-specific
remaining dues. Copied-database QA covers all 17 scenarios, correction/reversal,
two-client concurrency, forced rollback, role/privacy isolation, desktop and
390x844 layouts, light/dark themes, consolidated print, and restore twice.

Physical-printer/PDF acceptance remains an operator device check. A real
bank/UPI provider, deployment, and real-family onboarding are not authorised.
Family credit remains deliberately unavailable.
