# Staging SQLite Feasibility and Limits

## Decision

`SQLITE_STAGING_ACCEPTABLE_WITH_RESTRICTIONS`

This is a staging-only decision. It is not a production database endorsement and does not authorize operational-data upload or onboarding.

Official SQLite guidance says SQLite is suitable for most low/medium-traffic websites, but it permits only one writer at a time and advises a client/server database when multiple servers or many simultaneous writers are required. WAL requires all processes on the same host and creates associated `-wal` and `-shm` files. Sources: [Appropriate Uses for SQLite](https://sqlite.org/whentouse.html) and [Write-Ahead Logging](https://sqlite.org/wal.html), reviewed 2026-07-23.

## Mandatory restrictions

1. Exactly one application instance and one Node process may open the staging database.
2. The SQLite file, journal/WAL/SHM, OCR files, and local backup work areas use one locally mounted persistent SSD volume. Do not place SQLite on NFS/SMB, object storage, or a shared network filesystem.
3. No horizontal scaling, multi-region active/active, failover writer, or scale-to-zero platform whose disk can disappear.
4. Only one migration/backup/restore/scheduler operation may hold the singleton maintenance lock.
5. Health checks are read-only/non-mutating. The public liveness route never queries or writes business data.
6. Backups are serialized. For a live file, use an application-consistent SQLite backup/validated JSON export; do not copy just `*.db` while ignoring a journal/WAL/SHM.
7. Restore requires maintenance mode, stopped writers, pre-restore backup/hash, integrity check, reconciliation, and explicit rollback.
8. Staging is synthetic-only. Production/operational data remains prohibited without a separate approval.

## Technical limits and controls

| Area | Limit/risk | Required control |
| --- | --- | --- |
| File locking | SQLite depends on correct local filesystem locks. Network filesystem locking can be unsafe. | Same-host local block storage only. |
| Concurrent reads/writes | Many readers are supported; only one writer at a time. Long writes cause queueing/`SQLITE_BUSY`. | Short transactions, busy/error monitoring, load test with synthetic traffic, and a concurrency exit threshold. |
| WAL/SHM | Sidecars share memory/host assumptions and may contain committed state. | Keep adjacent on one volume; include checkpoint/sidecar handling in backup/restore runbook. Do not enable WAL casually. |
| Container restart | Ephemeral root files disappear. | Database and every private write path must be below the mounted persistent root and validated before start. |
| Deployment | Two releases must never write the same DB concurrently. | Stop old process, maintenance mode, migrate once, start new process, smoke test. Brief downtime is accepted. |
| Migration | `prisma migrate deploy` is non-interactive but not a rollback engine. | Backup first; single runner; inspect status; keep previous code and a restore point. |
| Corruption | Disk snapshots of an actively changing DB may be inconsistent. | Validated application/SQLite-consistent backups, `PRAGMA integrity_check`, restore rehearsal, off-host encrypted copy later. |
| Horizontal scaling | Shared-file multi-instance design is unsafe/unsupported. | One instance. PostgreSQL or another managed client/server DB is a future prerequisite for scaling. |
| Multi-region/failover | Local file has no transparent cross-region writer failover. | Accept staging downtime; document rebuild-from-backup RTO/RPO. |
| Monitoring | File health is not visible from generic HTTP uptime alone. | Alert on disk, DB size/growth, backup age, `SQLITE_BUSY`/I/O/integrity errors, and restore rehearsal age. |

## Expected school concurrency

The repository contains no measured production concurrency evidence. Do not invent a capacity number. The readiness envelope is initially capped at 25 simultaneous authenticated synthetic users, no more than 5 concurrent write workflows, and one background singleton operation. Before physical-device/user acceptance, run a synthetic test at that envelope and record p95 latency, 5xx/lock errors, memory, CPU, and disk I/O. Any persistent `SQLITE_BUSY`, write latency above 2 seconds, or need for more than one server changes the decision to `MANAGED_DATABASE_REQUIRED_BEFORE_STAGING` for that workload.

## Recovery objectives for staging

- Target RPO: 24 hours maximum; aim for 4 hours while active testing is scheduled.
- Target RTO: 4 hours for full host loss; 30 minutes for release rollback without database restore.
- Retain daily verified encrypted backups for 14 days, weekly for 8 weeks, and at least two off-host copies after a destination is approved.
- A disk snapshot is an infrastructure aid, not the sole SQLite backup.
