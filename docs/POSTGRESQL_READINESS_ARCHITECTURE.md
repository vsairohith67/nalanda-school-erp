# PostgreSQL readiness architecture

## Decision

Nalanda keeps SQLite as the committed local/default provider and adds PostgreSQL 17 as the separately generated staging/pilot provider. This phase changes software compatibility only. It does not deploy a database, copy operational data, activate users, change DNS, or remove SQLite.

The canonical model remains `prisma/schema.prisma`. `scripts/postgres/schema-contract.mjs` produces `prisma/postgresql/schema.prisma` by changing only the datasource provider and adding `DIRECT_URL`. The parity test rejects all other model, field, relation, default, key, index, and mapping drift.

## Build contract

One Prisma Client represents one provider per build:

- `pnpm.cmd db:generate:sqlite` selects SQLite.
- `pnpm.cmd db:generate:postgres` selects PostgreSQL.
- `pnpm.cmd build` uses the explicit `DATABASE_PROVIDER`, defaulting to SQLite only when it is absent.
- unknown providers and URL/provider mismatches fail closed.
- staging or production with SQLite fails closed unless all three server-only synthetic-local override values are present.

The application keeps its existing `@prisma/client` imports. A build never tries to use one generated client with both engines.

## Schema and behavior

The PostgreSQL baseline contains all 330 current models. SQLite history remains unchanged at 24 migrations; PostgreSQL has a separate one-migration baseline. The active SQLite contract has 168 triggers, no views, and one partial unique index. Deterministic translation creates PostgreSQL trigger functions/triggers and the equivalent partial index. Contract checks regenerate and compare these artifacts rather than trusting manual edits.

Runtime provider differences are concentrated in `lib/database-provider.ts`, `lib/database-capabilities.ts`, and the backup/technical-operations adapters. PostgreSQL never receives a PRAGMA. SQLite file-copy and sidecar behavior remains SQLite-only.

## Security boundary

The conceptual database identities are `nalanda_migrator`, `nalanda_runtime`, `nalanda_backup`, and `nalanda_readonly_diagnostics`. The web app uses the runtime identity, never the migrator. Runtime can perform table DML but cannot create schemas/tables/roles, alter `_prisma_migrations`, become superuser, or bypass row security. Backup and diagnostics identities are read-only. Application authorization remains mandatory; database roles do not replace tenant, owner, feature, or business checks.

PostgreSQL staging/production URLs require TLS. The pooled runtime URL and direct migration URL are distinct secret-store values. Localhost-only disposable QA may use a direct unencrypted container connection.

## Proven local boundary

The local software gate uses the pinned `postgres:17.11-bookworm` image, a localhost bind, tmpfs storage, synthetic credentials, synthetic data, and disposable databases. PostgreSQL 17 is within the upstream supported window. Managed hosting is a later purchase/deployment decision.
