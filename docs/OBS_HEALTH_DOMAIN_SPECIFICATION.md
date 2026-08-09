# OBS Health Domain Specification

Each card reports `HEALTHY`, `DEGRADED`, `WARNING`, `CRITICAL`, `UNKNOWN`, `NOT_CONFIGURED`, or `MAINTENANCE`, plus the last check, safe explanation, next action, metrics, and runbook.

| Domain | Sources | Important failure conditions |
| --- | --- | --- |
| Core Application | server process and minimal health | process unavailable |
| Database | SQLite reachability and integrity run | unreachable, `quick_check` failure, foreign-key violation |
| Migration | `_prisma_migrations` | pending, failed, rolled back, schema mismatch |
| Data Protection | logical/encrypted backup and restore rehearsal | missing/stale/failed backup or restore |
| Storage Capacity | approved local roots only | missing root, low free capacity, inaccessible storage |
| Security and Auth | sessions, lifecycle and aggregate events | no active Super Admin, disabled attempt, failure/rate-limit spike |
| Background Work | governed jobs and existing outboxes | repeated failure, dead letter, overdue retry |
| Notification Delivery | notification/provider outboxes | persistent backlog or failure |
| Document Processing | OCR, report, payslip, admission and classwork states | failed/quarantined processing |
| Release and Client | manifest, migrations, backup, PWA, advisory client policy | below minimum, unresolved mismatch |
| Provider Configuration | existing provider profiles only | configured LIVE provider reports failure |
| Business Integrity | governed count-only invariant checks | orphan or inconsistent governed relationship |
| Deployment Readiness | existing environment validator | blocking production contract failure |

`NOT_CONFIGURED` for an optional provider is not a core failure. Local-only deployment warnings do not make the local application unhealthy. Backup existence is never presented as restore proof.
