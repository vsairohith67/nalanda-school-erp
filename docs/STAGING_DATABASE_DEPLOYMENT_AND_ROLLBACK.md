# Staging Database Deployment and Rollback

## Path 1 — Fresh synthetic staging database (authorised design)

1. Enable maintenance before any database operation.
2. Create a new empty file path inside the mounted `STAGING_DATA_DIR/database` directory; do not pre-create schema with `db push`.
3. Export the absolute query-free `DATABASE_URL`; run `pnpm deployment:env-check`.
4. Run `pnpm exec prisma migrate deploy` exactly once under the deployment singleton lock.
5. Run `pnpm exec prisma migrate status` and require the single active migration to be applied with no pending/failed entry.
6. Create unique synthetic staging users/fixtures only. Remove transient seed password variables and rotate initial passwords.
7. Prove the database does not contain the 8/8/19/INR 99,100 operational baseline, real admission/contact/document values, or an operational DB hash match.
8. Run schema equivalence, auth/role, private-cache, PWA, and core smoke tests.
9. Create and validate an immediate version-37 backup; record hash, byte size, migration status, release and synthetic aggregate counts.
10. Exit maintenance only after health checks pass.

## Path 2 — Later authorised copied operational-data rehearsal

This path is **not authorised in DEVOPS-1C** and was not performed.

It requires written scope/owner/time approval, a copied database only, privacy and retention review, maintenance mode, verified pre/post hashes and business reconciliation, a documented baseline-resolve procedure for the copy, restricted access/logging, and a tested rollback. The real `prisma/dev.db` must never be uploaded, marked resolved, or migrated by this plan. Any command that cannot prove it targets the approved copy must fail closed.

## Pre-migration backup

- Acquire the singleton lock and stop all writers.
- Record release, DB path identity (not secret contents), DB hash/size, migration status and synthetic aggregate counts.
- Produce an application/SQLite-consistent backup and validate it. If WAL is in use, checkpoint safely or use a supported SQLite backup mechanism; never copy the main file alone.
- Store the backup outside the release directory, encrypt it, and record its hash. Later copy it to the approved off-host destination.

## Rollback matrix

| Failure | Action |
| --- | --- |
| Build/env/test fails before DB change | Do not enter maintenance; discard new release. |
| Backup fails | Abort deployment; do not migrate. |
| Migration fails before new app starts | Keep maintenance, capture safe error, restore paired backup if any schema/data change occurred, verify integrity/status, restart previous release. |
| New app health/smoke fails, schema backward-compatible | Stop new process, repoint `current` to previous release, start and verify. |
| New app health fails, schema not backward-compatible | Keep maintenance, stop writers, restore paired pre-migration backup, verify hash/integrity/reconciliation, then start previous release. |
| Disk/host loss | Rebuild a clean host/release, restore latest verified encrypted off-host backup, run integrity/status/reconciliation, then open access. |

Prisma has no general automatic down-migration. Never improvise one in an incident. Every schema-changing release must declare whether code-only rollback is compatible before deployment.

## Restore verification

Require `PRAGMA integrity_check` = `ok`, expected schema fingerprint/migration status, synthetic user/auth checks, private-cache headers, backup version 37 readability, no unexpected operational fingerprints, and documented RPO/RTO. Retain the failed artifact and logs only if privacy policy permits; never log rows or secrets.
