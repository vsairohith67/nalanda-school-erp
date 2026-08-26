# SQLite to PostgreSQL pilot migration plan

Status: plan only. Real data migration is not authorized.

## Gates before a pilot

- PostgreSQL readiness release and exact-head CI are green.
- Private staging is separately approved, deployed, access-controlled, monitored, and synthetic-only.
- Managed backup/PITR, RPO/RTO, runtime/migrator/backup identities, TLS, pooling, Valkey rate limiting, object storage, and rollback ownership are operationally verified.
- A named owner approves a time window, reconciliation rules, downtime/read-only boundary, rollback point, user cohort, training, support, and privacy handling.

## Rehearsal

Take an explicitly authorized offline copy without altering the source. Record path provenance privately, size, mtime, SHA-256, and sidecars. Restore the copy into an isolated rehearsal; export v44; import an empty PostgreSQL baseline; reconcile every collection, relationship, money/status total, immutable history, revocation/session state, and sample business output. Repeat until deterministic.

## Controlled pilot

Freeze source writes, hash/copy again, run migration with logged safe counts, reconcile independently, and require a human go/no-go. Point only the approved private pilot to PostgreSQL. Monitor errors, pool, locks, latency, financial invariants, sync duplicates, and authorization. Roll back application traffic to the preserved SQLite source if any stop condition occurs; never overwrite that source.

## Stop conditions

Any orphan, missing/duplicate financial event, checksum/status discrepancy, authorization/privacy defect, revocation reactivation, unresolved High/Critical security finding, backup failure, migration mismatch, or unavailable rollback blocks the pilot.
