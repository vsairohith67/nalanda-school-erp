# PostgreSQL backup and restore

The POSTGRES-READINESS-1A logical transfer is restricted in code to synthetic local data and private, exclusive files under worktree `tmp/`. It is not an operational backup mechanism. The structural restore actor is always inactive, requires a password change, and receives a fresh cryptographically random unrecoverable password hash on every run.

## Software-phase proof

On the disposable synthetic PostgreSQL database, PostgreSQL 17.11 `pg_dump -Fc` produced a custom-format dump, a SHA-256 was recorded, and `pg_restore --no-owner --exit-on-error` restored it into a second empty database. The restored database retained 330 application tables, one completed PostgreSQL migration, and the synthetic domain/financial counts. The dump was deleted immediately after verification.

## Later staging/production policy

Use three complementary layers:

- managed automated backups and point-in-time recovery when purchased;
- an encrypted, access-controlled application logical backup using backup v44;
- scheduled restore rehearsal into an isolated non-production target.

The backup identity is read-only and separate from runtime/migrator. Dumps must never be logged, attached to CI, or uploaded as artifacts. Encryption keys and provider credentials stay in the secret store. Define purchased-provider RPO/RTO before staging activation; software readiness does not claim that any managed backup/PITR service is active.

Every restore rehearsal verifies tool versions, checksum, schema/migration state, constraints, table/domain counts, financial totals, revoked state, and a critical application probe before deletion of the restored target and dump.
