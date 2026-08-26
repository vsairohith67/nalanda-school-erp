# POSTGRES-READINESS-1A QA clearance

Status: candidate evidence complete locally; exact-head GitHub CI, merge, tag, and tracker closure are terminal gates.

## Boundary

This evidence proves software compatibility for private synthetic PostgreSQL staging. SQLite remains the committed default and the operational SQLite file was not opened for write, migrated, converted, or used as a transfer source. No managed database, deployment, DNS, real data/user activation, or provider purchase occurred.

## Contract evidence

- Canonical SQLite: 24 migrations, 330 models, schema SHA-256 `B8898226E8E9DB028A5637B95F07F3D1FDB02231191B4C82922CC13368D77363`.
- PostgreSQL schema: 330 models, generated SHA-256 `8612504CA59563B650EE76F6AF5190A6D4F3C81FD6D85057E23C9019D2FAE99B`.
- PostgreSQL baseline: one migration, 330 tables, 1,627 indexes, 168 active triggers, zero views, zero invalid indexes, zero unvalidated constraints; migration SHA-256 `B567F7FD126BEB48403A54BF82519C7C1D13DEFC015280E5A02DA81818F6FBAA`.
- Trigger contract SHA-256: `8DC922EED0D6FE260D6A2458360DAC6485A8CD19476E683F1CC1F0CC93E01074`.
- PostgreSQL: pinned local `postgres:17.11-bookworm`; baseline deploy passed and repeat deploy was a no-op.

## Transfer and recovery

- Synthetic SQLite fresh deploy: 24 migrations and 330 models/tables.
- Backup v44 export: 275 collection arrays, 8 Students, 11 Payments, Payment total 92,100.
- PostgreSQL restore: business-key checksums and total reconciled; second restore made no logical change and created no duplicate financial event.
- Physical recovery: PostgreSQL 17.11 custom `pg_dump`, SHA-256 `02eb925dbfc0079f8e18ce8e0d16d6e32824e800dc4349d8b4900ca666cb9f8f`, restored to a second empty database, 330 tables and domain/financial counts verified; dump deleted.

## Security, concurrency, and performance

- Roles: runtime DML passed; schema/table/role creation, migration-table alteration, and migration-ledger INSERT/UPDATE/DELETE were denied; backup/diagnostics writes were denied; all three non-migrator roles are non-superuser, non-createdb, non-createrole, and non-bypass-RLS. Nine prohibited-operation probes passed.
- Concurrency: 14 two-writer PostgreSQL scenarios each produced one safe claim and one controlled refusal; 108 focused authorization/state/idempotency tests passed.
- Scale: 800 Students, 1,200 Guardians, 80 Staff including 45 Teachers, 2,400 Payments, 1,000 Parent Meetings, 2,000 Offline Sync mutations, and 1,000 native sessions.
- Query plans: 13 representative operations; maximum measured local execution time 0.209 ms on the final security-remediated rerun. This is a local synthetic measurement, not a managed-service SLA.
- Error mapping/retry: only Prisma/PostgreSQL serialization and deadlock categories receive bounded retry; public errors omit SQL, table, URL, and parameter detail.

## Security remediation verification

- Authoritative Codex Security scan `f204019f-716f-4663-bfd6-c281fdb19ef1` reported two High and three Medium findings in the new readiness tooling.
- `hardcoded-privileged-test-account`: fixed. Restore now requires the synthetic-local guard and keeps its structural actor inactive with a fresh random password hash and mandatory password change; export/restore-twice still passed.
- `postgres-qa-target-isolation`: fixed. Restore, roles, performance, and concurrency require an explicit opt-in, non-production environment, loopback host, and a database name marked `qa`, `ci`, `synthetic`, or `test`.
- `postgres-tls-fail-closed`: fixed. Runtime and provider CLI configuration now require certificate-validating TLS, bounded connection/timeouts, and distinct runtime/migrator usernames for staging and production.
- `runtime-migration-ledger-isolation`: fixed. Runtime write grants are explicitly revoked from `_prisma_migrations`; INSERT, UPDATE, and DELETE denial probes pass.
- `logical-transfer-confidentiality`: fixed for this software-readiness scope. Export is restricted to a synthetic SQLite source below worktree `tmp/`; transfer files are exclusive owner-only creations and link or existing-file targets are refused. Operational transfer remains a separately authorized encrypted workflow.
- Codex Security `verify-fix` performed read-only source/control/sink tracing for all five findings. Result: five fixed, zero still vulnerable, zero inconclusive.
- Focused post-fix checks: 18 provider/synthetic-target/release tests passed; deterministic parity added 7 passing tests; complete typecheck passed; 108 PostgreSQL concurrency and provider-agnostic focused tests passed.

## Remaining terminal evidence

Record the exact feature SHA, independent security report, dependency audit, full SQLite/PostgreSQL test/build totals, Browser viewports, GitHub run/job conclusions, merge SHA, annotated tag, operational hash recheck, and Notion/Canvs readback here or in the terminal release record before marking this document cleared.
