# FIN-FAMILY-PAY-1 Independent QA and Release Evidence

**Date:** 2026-08-08  
**Feature branch:** `finance/family-multi-student-mixed-tender`  
**Implementation commit:** `0a8d6cd`  
**Backup version:** 37

## Outcome and scope

Independent copied-database QA cleared the 17 required family/multi-Student
mixed-tender scenarios. The released boundary is local/private. No online
provider, deployment, real-data onboarding, or physical-printer acceptance was
authorised.

## Numerical and transactional proof

The hand calculation posted Rs 40,000 as Rs 30,000 UPI plus Rs 10,000 cash to
four linked children. Four allocations and five shares preserved every paise;
one child was split across both instruments and another remained partly due.
The graph contained one consolidated receipt, one cash instrument, one UPI
instrument, exact Student compatibility Payments, and one immutable provider
allocation plan without any provider call.

Retries returned the original root. Changed-payload key reuse, normalized
duplicate reference, stale plan, unrelated/removed child scope, over/under/zero
allocation, and implicit credit failed closed. Two simultaneous confirmations
returned one root; a forced foreign-key failure left all family, Payment, Cash
Book, and audit counts unchanged. Correction superseded rather than rewrote the
original, locked-day Accountant action persisted a leadership review without a
financial mutation, and Director reversal cancelled the replacement effects.

## Browser, role, and privacy proof

The in-app Browser completed the real copied-database Accountant wizard,
allocation matrix, confirmation, consolidated detail, and print view. Desktop
and exact 390x844 layouts, light and dark themes, 44 px mobile targets, keyboard
dialog structure, and no horizontal overflow were verified. A fresh tab had
zero console errors. Viewer received aggregate counts/totals only and could not
open create; Admin could not create; a linked Parent received the full four-child
receipt while child-extract logic suppressed the rest when full linkage was not
present. Raw external references were masked and absent from backup/log evidence.

## Migration and recovery proof

Fresh install and existing-database onboarding passed with 12 migrations, 243
models/tables, and canonical schema fingerprint
`65E4DB9BA415AE6F75E53F9A937FB695118E761CFACAEC7F18A556222C1F1B35`.
The copied family graph restored twice with 3 collections, 6 instruments, 12
allocations, 15 shares, 5 receipt versions, 15 events, 3 provider plans, and 15
compatibility Payments.

Before operational migration, the database was 6,893,568 bytes with SHA-256
`DD39C1491AB8F604EC3BAD8598F7D80FE95DBBF81F6C2792276948A57DA92F72`.
The ignored protected raw rollback copy is byte-identical. The protected v37
logical backup has SHA-256
`CC3BBED498C6B178D2D0183BD316A0488110F03594A8D2A018D3249689476A56`,
contains zero Student/Payment/Guardian/Staff rows, four protected users, and no
password hashes; it restored twice into a fresh migrated database with
`integrity_check=ok` and zero foreign-key violations.

The single additive migration applied once and repeat deploy was a no-op. The
post-migration database SHA-256 is
`1AA6B2A4542F6B3316A1E32B846C1FDD07DC0B14A7335288FAC2529CB374CDE7`.
All business and family tables remain zero, all four protected accounts and the
active Super Admin remain present, and SQLite integrity/foreign keys remain
clean. The post-migration v37 backup contains 209 arrays including all seven
zero family arrays, does not mutate the database, and passed generic restore
idempotency/collision checks.

## Verification and cleanup

- Route inventory: 318 pages and 486 APIs.
- Lifecycle backfill: dry run, zero changes.
- TypeScript default 2 GB command: reached the heap ceiling before diagnostics;
  the required 4 GB production build compiled and generated successfully.
- Test suite: 190 files and 1,720 tests passed.
- Focused post-cleanup regression: 53 tests passed.
- Prisma validate/generate, schema equivalence, build, backup, restore, diff
  check, and Git safety passed.
- First copied cleanup removed all 3 collections and complete related graph,
  15 compatibility Payments, 25 Payment audits, 2 notification campaigns and
  recipients/events, the locked Cash Book day, and all namespaced fixtures.
- Second cleanup removed zero; both inspections showed zero family residuals.
  The copied database and runtime were destroyed.

External governance records must contain only this aggregate evidence. They
must not contain Student identity, payment references, credentials, or database
content.
