# Clean-Install Migration Repair Decision

## Decision

DEVOPS-1B uses **Strategy B — a new squashed baseline** generated from the unchanged authoritative `prisma/schema.prisma`.

## Why targeted historical repair was rejected

Targeted repair would be safe only if the missing historical starting schema were known and every changed checksum were demonstrably compatible with every supported deployed environment. Those conditions are not met:

- The 40-directory chain does not contain the original core-table creation history.
- The first migration alters `Payment`; the second alters `Student`; sixteen migrations have unresolved prior dependencies.
- The operational database has no `_prisma_migrations` metadata and therefore supplies no checksum history.
- Reconstructing a guessed old schema or editing/reordering multiple historical files would create an unsupported checksum/history ambiguity.
- Adding a full current-schema migration before the old chain would cause later migrations to recreate or re-alter objects and is not deterministic.

The existing SQL remains valuable evidence, but it is not a trustworthy deployable chain.

## Squashed-baseline controls

- Preserve every original migration directory outside active `prisma/migrations`.
- Preserve the original `migration_lock.toml` and add a machine-verifiable manifest containing all 40 directory names, byte sizes, and migration SQL SHA-256 values.
- Generate the active baseline with Prisma 6.19.3 `migrate diff --from-empty --to-schema-datamodel ... --script`; do not hand-author schema SQL.
- Keep `prisma/schema.prisma` byte-for-byte unchanged.
- Keep backup format/version 37 unchanged.
- Apply the baseline normally to empty databases with `prisma migrate deploy`.
- On an existing unbaselined database, verify schema equivalence first, then mark the baseline applied with `prisma migrate resolve --applied` and deploy later migrations. DEVOPS-1B rehearses this only against a byte-for-byte copy.
- Make the onboarding wrapper idempotent by checking for a completed baseline row before calling `resolve`.

## Rejected alternatives

- `prisma db push` as a deployment/install process: rejected because it does not provide deployable migration history.
- Suppressing P3018 or continuing after failure: rejected because it would leave an indeterminate schema.
- Deleting the legacy migrations: rejected because it would destroy audit evidence.
- Raw insertion into `_prisma_migrations`: rejected because Prisma provides `migrate resolve` and fabricated rows are prohibited.
- Shipping a pre-populated database: rejected because a clean install must build from an empty SQLite file.
- Changing the Prisma schema: rejected because the current schema is authoritative and the prompt forbids schema changes to accommodate broken history.

## Rollback boundary

Before merge, rollback is the feature branch commit reversal. After a future independently approved merge, retain the legacy archive permanently; do not reactivate it. An existing database must be backed up and its application-schema fingerprint verified before baseline onboarding. DEVOPS-1B does not onboard the operational database.
