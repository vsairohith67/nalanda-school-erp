# Clean-Install Migration Failure Analysis

## Scope

DEVOPS-1B reproduced the trusted-baseline migration failure using Prisma 6.19.3, the unchanged 40-directory migration chain, and an otherwise empty zero-byte SQLite file under the ignored `tmp/devops1b/empty-db/` QA root. The process-scoped `DATABASE_URL` never referenced `prisma/dev.db`.

## Reproduction result

The supported command was:

```powershell
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
```

Prisma found 40 migrations, selected `20260618_phase2_auth_audit` first, and returned P3018 with SQLite error code 1:

```text
Migration name: 20260618_phase2_auth_audit
Database error: no such table: Payment
```

The failed database contained only `_prisma_migrations`. Its failed row had `applied_steps_count = 0`, no `finished_at`, no rollback marker, and the recorded checksum matched the pre-repair SHA-256 `8FE53A0E25BD00D3F2D682E5D656ED3AD9069CF79D00B06B99621A0B0390F0C6`.

## Exact failing dependency

Line 1 of the first migration is:

```sql
ALTER TABLE "Payment" ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false;
```

`Payment` has not been created by an earlier migration because there is no earlier migration. The same file also creates an index on `Payment` and creates `PaymentAudit` with a foreign key to `Payment`.

## Complete ordering findings

The defect is not isolated to one SQL statement:

- `20260618_student_import_fields` alters `Student`, but no active migration creates `Student`.
- Sixteen historical migrations have at least one dependency that was not created earlier in the active chain.
- Missing foundational dependencies include `Payment`, `Student`, and other tables or migration-order prerequisites listed in `PRISMA_MIGRATION_DEPENDENCY_INVENTORY.md`.
- The verified operational database has no `_prisma_migrations` table. It was historically synchronized with `prisma db push`, so it cannot establish which migration checksums were deployed elsewhere.
- Fixing only the first `Payment` alteration would expose later missing dependencies and would not prove equivalence to the authoritative current schema.

## Safety observations

- Prisma on this Windows checkout required the empty SQLite file to exist before `migrate deploy`; attempting a missing file failed in the schema engine before SQL execution. Creating a zero-byte isolated file exposed the actual chain failure.
- No operational row was read for the failure reproduction.
- No absolute path, private record, credential, or operational value is included in this report.
- The operational database hash, size, and timestamp remained unchanged after reproduction.
