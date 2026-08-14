# V1 Backup, Restore and Migration Acceptance

- 18 Prisma migrations are applied and current.
- Fresh and copied-database deployment runs are idempotent.
- Backup format version 41 covers current V1 metadata.
- Governed module asset recovery uses encrypted manifests, exact entry equality, hash verification and two isolated restores.
- Operational SQLite is never a migration rehearsal or restore target.
- The protected operational file remains SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, 8,409,088 bytes, with zero business rows and four protected accounts.
- Support recovery status now requires a durable configured key; OCR evidence verifies its stored hash on every served read.
- The final Release Operations rehearsal reconfirmed 18 migrations, 292 copied-database tables, byte-identical pre-deploy evidence, logical restore twice, a verified 10,955-file artifact payload, one-release locking, injected low-space refusal, zero provider calls and no private data in the artifact.

Production restore, real retention purge and external key custody require named operators and separate authorization.
