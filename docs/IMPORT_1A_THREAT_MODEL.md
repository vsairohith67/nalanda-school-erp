# IMPORT-1A Threat Model

## Assets and trust boundaries

Protected assets are private workbook bytes, contact data, Student/Guardian/
Staff identity, relationship and enrollment integrity, IAM proposals, approval
credentials, database state and audit lineage. Trust boundaries are the
authenticated browser, no-store APIs, OOXML parser, private filesystem, Prisma
transaction, IAM re-authentication, backup/recovery and OBS-1A aggregates.

## Principal threats and controls

| Threat | Control |
| --- | --- |
| Public or cached workbook | Permission gates, private/no-store headers, opaque private storage, PWA allowlist exclusion |
| Macro/object/external-link execution | `.xlsx` only, ZIP/content/relationship allowlists, binary/embedded/external refusal |
| ZIP bomb or parser exhaustion | Compressed size, entry, expansion, ratio, sheet, row, column and cell limits |
| Formula injection | Formula-cell and dangerous-prefix refusal; generated error cells are neutralised |
| Schema confusion | Exact sheet/header/template/schema/bundle checks; hidden/duplicate/unexpected sheet refusal |
| Silent overwrite or identity collision | Exact identifiers, duplicate decisions with reason, create-new/update refusal |
| Cross-row orphaning | Deterministic row keys and cross-sheet dependency checks |
| Stale approval or race | Workbook/plan/reference/target hashes, expiry and optimistic version claim |
| Replay or partial execution | Unique idempotency key and one all-or-nothing database transaction |
| Privilege escalation | Proposal-only account lineage, no credentials/account activation, Principal bundle scope, privileged self-approval refusal |
| Unsafe rollback | Exact lineage, dependency scan, re-authenticated preview, manual reconciliation on any block |
| Backup privacy leak | No workbook bytes/path/actor reason/submitted values; private IDs hashed; restore as recovery-required |
| Observability leak | Aggregate states, counts, duration timestamps and safe fingerprints only |
| Long-lived private files | Bounded purge deadline and documented pending retention job |

Residual risks are deployment storage encryption, operator endpoint compromise,
future real-data scale, dedicated Staff reference masters and unimplemented
automated purge/private-asset recovery. They remain release gates, not accepted
production risk.
