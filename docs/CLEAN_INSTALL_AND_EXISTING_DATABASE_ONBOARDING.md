# Clean Install and Existing Database Onboarding

## Safety boundary

The active Prisma chain contains one Prisma-generated SQLite baseline: `20260722_clean_install_baseline`. The 40 pre-DEVOPS-1B migrations are preserved as evidence under `prisma/migration-archives/devops1b-legacy-chain/` and must never be copied back into active `prisma/migrations`.

Never run `migrate deploy`, `migrate dev`, `db push`, or `migrate resolve` against an existing operational database without a separately approved maintenance window, verified backup/copy, schema-equivalence proof, rollback owner, and independent review. DEVOPS-1B ran onboarding only against byte-for-byte copies.

## Fresh clone and empty database

1. Clone the private repository and check out an approved commit containing the DEVOPS-1B baseline.
2. Copy `.env.example` to an untracked `.env` and replace every placeholder locally. Do not commit it.
3. Keep `DATABASE_URL` pointed at a new local SQLite filename. SQLite paths in the Prisma schema are relative to `prisma/`.
4. Create the empty file if it does not exist. Prisma 6.19.3 on the verified Windows environment required an existing zero-byte file before `migrate deploy`:

```powershell
New-Item -ItemType File -Path "prisma\local-example.db"
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec prisma generate --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma
```

5. Require `Database schema is up to date!` and run:

```powershell
pnpm.cmd migration:inventory
pnpm.cmd migration:fresh-check
pnpm.cmd migration:schema-check
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

`migration:fresh-check` creates its own guarded database, deploys from zero, checks migration status, proves schema equivalence, uses explicit synthetic seed passwords, runs lifecycle backfill in dry-run mode, and deletes the database on success.

## Why db push is not deployment

`prisma db push` synchronizes a schema without creating or applying auditable migration history. It does not replace `prisma migrate deploy`, cannot prove ordered reproducibility, and was the reason the existing local database had no `_prisma_migrations` baseline. Do not use `db push` as the fresh-install, staging, production, CI, or recovery migration process.

## Existing unbaselined SQLite database

The approved technical sequence is:

1. Stop the application and prevent logins/writes.
2. Record source hash, byte size, timestamp, application-schema fingerprint, every table row count, business aggregate controls, and a business-data digest.
3. Make and verify a byte-for-byte copy. Perform every rehearsal on the copy.
4. Prove the copy has zero semantic drift from `prisma/schema.prisma` with Prisma `migrate diff --exit-code`.
5. If and only if the active baseline schema is already fully present and `_prisma_migrations` has no completed baseline row, run on the copy:

```powershell
pnpm.cmd exec prisma migrate resolve --applied 20260722_clean_install_baseline --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma
```

6. Repeat the wrapper. It must detect the completed baseline row, skip a second `resolve`, run deploy/status, and remain idempotent.
7. Permit only `_prisma_migrations` metadata changes. Application schema, every application-table count, business-data digest, and business aggregates must remain exact.

The repository rehearsal command performs those checks against a new copy and deletes the copy on success:

```powershell
pnpm.cmd migration:existing-db-check
```

It refuses the operational path as a migration target. DEVOPS-1B does not authorize running the resolve sequence on `prisma/dev.db`.

## Future migrations

1. Start from the approved baseline branch/commit and a clean working tree.
2. Change `prisma/schema.prisma` only for the separately approved application requirement.
3. Create the next migration with supported Prisma migration tooling against a disposable database.
4. Review generated SQL for destructive operations, secrets, seed values, missing dependencies, and SQLite rebuild behavior.
5. Run all migration commands, focused tests, full tests, build, backup/restore rehearsal, and Git safety.
6. Verify a fresh remote clone without any database or backup.
7. Require independent review before merge. Never edit the committed baseline after deployment; add a new migration.

## Rollback

Before merge, discard/revert only the feature-branch commit. After merge, source rollback means reverting the new code while retaining the legacy archive and recorded baseline history. Database rollback requires a separately approved restore from a verified backup; never delete `_prisma_migrations` rows or reactivate the archived chain. If schema equivalence or data digests differ, stop and restore the untouched copy rather than attempting an improvised repair.
