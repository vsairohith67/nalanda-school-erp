# PostgreSQL schema line

This directory is the governed PostgreSQL counterpart to the canonical SQLite line.

- `schema.prisma` is generated deterministically from `../schema.prisma` by `scripts/postgres/schema-contract.mjs`.
- `migrations/` is PostgreSQL-only history. Never run the SQLite migration SQL here.
- `trigger-equivalents.sql` and the manifests preserve the active SQLite trigger and partial-index business contract.
- `DATABASE_URL` is the runtime/pooled URL. `DIRECT_URL` is the direct migrator URL.

Use `pnpm.cmd db:generate:postgres`, `pnpm.cmd db:migrate:postgres`, and `pnpm.cmd qa:postgres:parity` in Windows PowerShell. Do not use `prisma db push` as a migration strategy.
