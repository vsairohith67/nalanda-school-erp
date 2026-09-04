# PostgreSQL portability audit

## Scope and evidence

`pnpm.cmd qa:postgres:portability` scans the repository for SQLite syntax, PRAGMAs, file/database paths, sidecars, raw SQL, triggers, views, partial indexes, and generated columns. Its machine-readable result is `docs/evidence/postgresql-portability-manifest.json`; every match records its path, line, matched construct, and classification.

The classifications are `PROVIDER_NEUTRAL`, `SQLITE_ONLY`, `POSTGRESQL_ONLY`, `REQUIRES_ADAPTER`, `SHOULD_USE_PRISMA_API`, and `UNSAFE_OR_UNUSED`. Historical SQLite migrations remain `SQLITE_ONLY`; the new schema/migration/trigger line is `POSTGRESQL_ONLY`; current runtime SQL and backup paths are reviewed at the central adapter boundary.

## Material findings and disposition

- SQLite PRAGMA, `sqlite_master`, file integrity, sidecar, and database-copy behavior is isolated behind the SQLite capability path.
- PostgreSQL health uses connectivity, migration, constraint, index-validity, server-version, and database-size checks.
- Dynamic table/column probes use a server-owned allow-list and parameterized values. No client chooses raw identifiers.
- The active partial index `ParentMeetingParticipant_one_primary` has a PostgreSQL equivalent.
- All 168 final active SQLite triggers have deterministic PostgreSQL equivalents. Historical replaced trigger declarations are not treated as active.
- The current schema has no views, enums, or generated columns requiring semantic translation.
- Existing `Float`, `Decimal`, `Boolean`, `DateTime`, `Json`, `Bytes`, nullability, empty-string behavior, case normalization, and business defaults are preserved. PostgreSQL readiness does not silently perform a financial-type cleanup.
- Backup v45 is the provider-neutral logical format with v44 restore compatibility; password hashes and runtime secrets remain excluded.

## Raw SQL rule

Runtime raw SQL must be tagged/parameterized. Dynamic identifiers must come from a closed server allow-list. Fixed DDL strings used only by PostgreSQL migration/role QA are explicitly governed and never contain request input. Provider-specific SQL outside the adapter or governed migration path is a release failure.
