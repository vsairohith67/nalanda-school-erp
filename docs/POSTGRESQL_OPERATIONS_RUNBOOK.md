# PostgreSQL operations runbook

All write-capable readiness commands require `POSTGRES_READINESS_SYNTHETIC_QA=1`, a non-production environment, a loopback PostgreSQL host, and a database name containing `qa`, `ci`, `synthetic`, or `test`. These commands must refuse staging, production, remote, or unmarked targets.

## Readiness order

1. Confirm the exact release SHA and `DATABASE_PROVIDER=postgresql`.
2. Confirm TLS-valid pooled `DATABASE_URL` and direct `DIRECT_URL` are present without printing them.
3. Run `pnpm.cmd db:generate:postgres` and `pnpm.cmd qa:postgres:parity`.
4. Verify backup/PITR and rollback ownership for the intended environment.
5. Run `pnpm.cmd db:status:postgres`; apply migrations with the migrator through `pnpm.cmd db:migrate:postgres`.
6. Run `pnpm.cmd qa:postgres`, role probes, synthetic restore, and bounded application smoke tests.
7. Start the app with the runtime role; verify process, database/pool, migration, distributed rate-limit, feature-flag, and maintenance health separately.

## Incident signals

Observe privacy-safe aggregates for pool saturation, connection failure, statement/lock timeout, deadlock, serialization retry/exhaustion, slow queries, migration mismatch, backup/restore failure, database unavailability, and distributed rate-limit health. Never log URLs, hosts publicly, SQL containing private values, bind parameters, passwords, Student/financial values, tokens, or dumps.

## Controlled response

- Pool/database unavailable: fail readiness, stop write traffic, retain safe liveness, and use the provider incident path.
- Migration mismatch: keep the release unavailable; do not mark migrations applied manually.
- Serialization/deadlock: retry only an identified idempotent transaction within the bound.
- Constraint/financial mismatch: stop the rollout and preserve evidence; do not continue to users.
- Restore failure: keep the source untouched, retain checksums/log fingerprints, and investigate in an isolated target.

Rollback changes application traffic/release only after verifying that the prior binary understands the already-applied forward schema. Never reset or destructively roll back a shared database.
