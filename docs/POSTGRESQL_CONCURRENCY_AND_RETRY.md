# PostgreSQL concurrency and retry

## Control choices

- Unique constraints/idempotency keys claim exact events: payment event IDs, expense/misc references, family allocation keys, Admissions conversion, active Parent Meeting requests, Offline Sync mutation IDs, refresh-token hashes, meal records, reminder job keys, and import batch IDs.
- Compare-and-swap (`updateMany` with expected status/version) controls attendance, report/media state, and other optimistic workflows.
- Conditional updates claim scarce capacity, such as Transport route seats.
- Multi-record financial and sync flows use a consistent order: authoritative parent/request row, mutable aggregate/capacity claim, durable business row, then append-only event/audit rows.
- Serializable isolation is used only where a measured multi-record invariant needs it.

`withDatabaseRetry` recognizes Prisma `P2034`, PostgreSQL serialization `40001`, and deadlock `40P01`. It permits at most five configured attempts (three by default), uses bounded exponential backoff with jitter, preserves the caller's idempotency key, and logs only a safe category/attempt. Authorization, validation, uniqueness, and arbitrary failures are never retried.

## Evidence

The PostgreSQL race contract runs 14 two-writer scenarios. Every scenario requires one safe commit/claim and one controlled refusal. Focused provider-agnostic regressions additionally cover marks authorization, report publication, last-Super-Admin protection, Offline Sync conflict/revocation/two-device semantics, native token rotation/reuse, reminders, and imports.
