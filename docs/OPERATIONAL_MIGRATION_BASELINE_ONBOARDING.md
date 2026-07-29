# Operational Prisma Migration-Baseline Onboarding

## Decision and scope

DEVOPS-1E formally registered the existing operational SQLite database as
having the active Prisma baseline migration
`20260722_clean_install_baseline` applied. The approved operation added Prisma
migration metadata only. It did not run `db push`, alter the application
schema, edit application rows manually, change configuration, change users or
permissions, deploy a provider, change DNS, or perform a payment action.

Implementation was performed on
`devops/operational-migration-onboarding` from the then-current synchronized
private `main`. The required
`operational-account-hardening-v37-2026-07-28` tag was verified as an ancestor
of that dynamically captured commit. Independent DEVOPS-1E-QA is required
before merge.

## Preflight evidence

- Synchronized `main` commit:
  `2bc71254d01d0bc57fa5b91867269f5ddba52661`
- Local/remote divergence: `0 / 0`
- Required release tag: reachable from `main`
- Operational database SHA-256:
  `3BA84F4834C4BE4B682D3BCE624490A99337BCAEC8027EFC27B9C4FF4FE11022`
- Operational database size: `4,771,840` bytes
- Operational database timestamp:
  `2026-07-28T18:22:32.2357749Z`
- Application-table digest:
  `E019FCE5B0A3347BE0BFFC037AEEA207705E6ECA915B80B112E5D91AD69BA08C`
- Application-schema fingerprint:
  `30450CC8181A86EC83F54855637BB636235B818F0632BCDD7F3D5152E9375BCC`
- Prisma schema SHA-256:
  `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`
- Active migration SQL SHA-256:
  `E6D467206CFA536487C8C63882D13BA489C0235BE74E9E076423323A511C3025`
- Initial Prisma metadata: `_prisma_migrations` absent
- SQLite integrity: `ok`
- Foreign-key violations: `0`
- Backup version: `37`

The exact operational business baseline was 0 Students, 0 active enrollments,
0 Payments, INR 0 collected, 0 Guardians, and 0 Staff. Account state was one
active, owned `SUPER_ADMIN`, with the retained `ADMIN`, `ACCOUNTANT`, and
`VIEWER` accounts inactive. No account was deleted.

Configuration row counts were preserved:

| Application configuration table | Rows |
|---|---:|
| `AiAssistantEvaluationCase` | 9 |
| `AiAssistantProfile` | 3 |
| `AiAssistantSourcePolicy` | 22 |
| `ExpenseCategory` | 15 |
| `ExpenseDepartment` | 8 |
| `FeeRegisterOcrProfile` | 4 |
| `FeeStructure` | 13 |
| `MiscIncomeItem` | 8 |
| `RolePermission` | 2,712 |
| `SchoolSettings` | 1 |
| `SmsEmailIntegrationProfile` | 2 |
| `TimetableClassSection` | 23 |
| `TimetablePeriodTemplate` | 249 |

Git safety, route inventory, lifecycle backfill dry-run, typecheck, database
integrity, and foreign-key checks passed before any change.

## Copied-database rehearsal

An ignored byte-identical copy of `prisma/dev.db` was used. The copy initially
had no `_prisma_migrations` table. `prisma migrate resolve --applied`, deploy,
and status succeeded, and deploy/status were repeated.

The copy ended with exactly one completed metadata row named
`20260722_clean_install_baseline`. Its recorded checksum was the lowercase
form of the active migration SQL SHA-256, `rolled_back_at` was null, and
`applied_steps_count` was `0`. Both deploy runs reported no pending migration;
the second applied nothing. The application digest, application-schema
fingerprint, business counts, account states, configuration counts, schema and
migration hashes, integrity result, and foreign-key result were unchanged.
The disposable copy was destroyed after recording evidence.

## Rollback evidence

Fresh rollback artifacts were created under ignored protected storage:

| Artifact | SHA-256 | Size |
|---|---|---:|
| `DEVOPS1E-ROLLBACK-20260729T133237Z-v37.json` | `17C2328CD8FD8703B68245CB571778CEC699000CE40DF24AC413F8EB7B1769FD` | 815,868 bytes |
| `DEVOPS1E-ROLLBACK-20260729T133237Z-raw.db` | `3BA84F4834C4BE4B682D3BCE624490A99337BCAEC8027EFC27B9C4FF4FE11022` | 4,771,840 bytes |

The logical artifact is backup version 37 and contains no password-hash
field. The raw copy is byte-identical to the approved pre-change database.
Logical restore was rehearsed twice into a disposable migrated database. The
restored zero-data baseline and configuration were exact, with clean SQLite
integrity and zero foreign-key violations. The disposable restore was removed.

Rollback, if post-change verification had failed, was to stop only the
verified Nalanda process, retain the failed database as protected evidence,
restore the byte-identical raw copy, verify its recorded hash, then rerun the
zero-data, account-state, configuration, integrity, foreign-key, startup, and
login checks. No rollback was required.

## Approval and operational execution

The approval gate displayed the current database hash, both backup filenames
and hashes, copied-database result, expected metadata-only change, unchanged
application digest and zero-data controls, and rollback procedure. The exact
approval phrase was received before the operational database was touched.

No running Nalanda ERP process or listener was found before the change, and an
exclusive database-file check succeeded. The operational database hash was
rechecked immediately after approval and matched the approved pre-change hash.

Against `prisma/dev.db`, Prisma then:

1. recorded `20260722_clean_install_baseline` as applied;
2. ran deploy and status;
3. repeated deploy and status to prove idempotence.

Both deploy runs reported no pending migration. The second run applied
nothing.

## Post-change evidence

- Operational database SHA-256:
  `9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`
- Operational database size: `4,771,840` bytes
- Application-table digest:
  `E019FCE5B0A3347BE0BFFC037AEEA207705E6ECA915B80B112E5D91AD69BA08C`
- Application-schema fingerprint:
  `30450CC8181A86EC83F54855637BB636235B818F0632BCDD7F3D5152E9375BCC`
- Prisma schema SHA-256:
  `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`
- Active migration SQL SHA-256:
  `E6D467206CFA536487C8C63882D13BA489C0235BE74E9E076423323A511C3025`
- SQLite integrity: `ok`
- Foreign-key violations: `0`
- Backup version: `37`

`_prisma_migrations` contains the active baseline exactly once as a completed,
not-rolled-back migration with the expected checksum. No migration is pending.
The physical database hash changed as expected because Prisma metadata was
added. The application digest, application-schema fingerprint, zero-data
baseline, account states, configuration counts, schema hash, and migration SQL
hash remained exact.

## Recovery diagnosis

The initial `OPERATIONAL_MIGRATION_ONBOARDING_BLOCKED` result was a closure
orchestration timeout, not a Prisma or database failure: onboarding was already
complete, but a five-minute monitor waited for an unnecessary private login on
an ignored post-onboarding copy and timed out with
`COPY_UNCHANGED_TIMEOUT`. An operational login was correctly avoided because
the login route updates `User.lastLoginAt` and would change the approved
application digest. The recovery classification was
`ONBOARDING_ALREADY_COMPLETE`; the operational database was unlocked, while
only the verified copied-database Next.js process held its disposable copy.

Recovery did not call `migrate resolve`. After stopping only the verified
copied-database process, two operational deploy/status pairs both reported no
pending migrations and an up-to-date schema. Neither pair changed the
operational hash, size, timestamp, application digest, metadata row, counts,
account state, configuration, integrity, or foreign keys.

## Verification and handoff

Final verification passed:

- focused clean-install/migration suite: 8/8 tests;
- route inventory: 274 page routes and 378 API routes;
- lifecycle backfill: zero-write dry-run;
- typecheck;
- full regression: 1,567/1,567 tests across 169 files;
- production build with the bounded 4 GB heap: 212/212 static pages;
- version-37 backup
  `nalanda-fee-control-backup-2026-07-29-20-04.json`, SHA-256
  `3FA8FFA39B81DCE593063F78CC949EE07397145A9F7CF961C196A6A93D9591DA`,
  with no password-hash key;
- Git safety.

Browser verification used the ignored byte-identical post-onboarding copy. A
production server started successfully, `/dashboard` redirected to
`/login?next=%2Fdashboard`, the login form rendered, and the console contained
zero warnings or errors. No credentials were submitted and no application row
was changed. The disposable database was destroyed after evidence capture.

The final operational database SHA-256 remained
`9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`
with its original post-onboarding size and timestamp. Protected rollback
artifacts and both static source hashes remained exact. No rollback was
required.

DEVOPS-1E-QA must independently recheck the feature commit and private remote,
the single migration metadata row, both migration hashes, unchanged
application digest and controls, rollback artifacts, startup/login, and the
full verification results. It must not merge while any evidence differs.
