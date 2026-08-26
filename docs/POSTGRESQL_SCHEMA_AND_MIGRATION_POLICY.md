# PostgreSQL schema and migration policy

## Two histories, one model contract

SQLite remains at `prisma/schema.prisma` and `prisma/migrations/`. PostgreSQL is at `prisma/postgresql/schema.prisma` and `prisma/postgresql/migrations/`. Never edit, reorder, squash, delete, or reinterpret the SQLite history for PostgreSQL.

The current PostgreSQL history starts with `20260826_postgresql_baseline/migration.sql`. It is a deterministic current-model baseline for an empty PostgreSQL database, not a claim that SQLite migration SQL ran on PostgreSQL. Its manifest records source/schema/migration hashes, table/index/trigger counts, and the transformation contract.

## Required change flow

1. Make the governed business-model change in the canonical SQLite schema and add a normal SQLite migration.
2. Regenerate/check the PostgreSQL schema.
3. Add a new forward-only PostgreSQL migration for the same semantic change.
4. Regenerate trigger/partial-index contracts when affected.
5. Run parity, empty deploy, repeat deploy, status, constraint, logical transfer, and provider regression gates.
6. Review both provider histories in the pull request.

`prisma db push`, migration checksum rewriting, marking an unproved migration applied, and resetting a non-disposable database are prohibited.

## Deployment precheck

The release SHA, schema-contract hashes, PostgreSQL major, role grants, current migration status, backup availability, synthetic restore, TLS settings, pool/direct URL split, and rollback decision must be checked before any later staging migration. A migration uses `DIRECT_URL` and the migrator identity. The running app uses `DATABASE_URL` and the runtime identity.
