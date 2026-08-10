# IMPORT-1A Implementation Checkpoint

Date: 2026-08-10

Status: `BULK_ONBOARDING_READY_FOR_QA`. All implementation verification gates
below passed. This checkpoint is not yet independent-QA clearance, merge
approval, deployment approval or real-data onboarding approval.

## Implemented

- additive batch, row-lineage and audit models/migration;
- three versioned protected XLSX template families with dropdowns and examples;
- bounded fail-closed OOXML/container/formula/external-content parsing;
- deterministic field, relationship, reference and duplicate validation;
- private no-store upload/error workbook storage and delivery;
- hashed expiring dry-run plans, narrow permissions and Principal bundle scope;
- re-authenticated approval, atomic execution, idempotency and reconciliation;
- dependency-aware exact rollback and manual-reconciliation refusal;
- OBS-1A aggregate job/batch/replay/rollback metrics;
- backup version 41 privacy-safe metadata and recovery-required restore;
- responsive thirteen-step Import Centre and governed documentation.

## Safety evidence

The preflight operational database contained zero Students, zero active
enrollments, zero Payments and INR 0 collected. Four protected accounts/role
assignments and one active Super Admin were recorded. No real workbook or real
Student, Guardian, Staff, Parent account, payment, marks, attendance, payroll or
document data is used by this phase. The additive migration is not applied to
the operational database before independent QA approval.

## Verification ledger

| Gate | State |
| --- | --- |
| Pre-edit typecheck | Passed |
| Prisma format/validate/generate | Passed |
| Focused workbook/planning/governance tests | Passed (12 tests) |
| Repository typecheck | Passed, including the exact partitioned `pnpm.cmd typecheck` gate |
| Copied-database synthetic lifecycle/atomicity/idempotency/rollback/restore | Passed; atomic failure created zero partial rows, replay was idempotent, exact rollback restored baseline, and no active account was created |
| Browser role, light/dark, desktop and exact 390x844 | Passed; Director/Principal/Admin/Computer Operator scopes verified, four denied roles refused, no horizontal overflow, and zero fresh console errors after the timestamp hydration correction |
| Full tests | Passed: 201 files and 1,772 tests; three environment-dependent qpdf checks skipped |
| Production build | Passed |
| Routes | 331 page routes and 545 API routes |
| Fresh install and restore rehearsal | Passed: 18 migrations, 292 models/tables, 245 backup arrays, repeated restore idempotent |
| Operational backup | Passed at backup version 41 before applying the onboarding migration |
| Operational hash/protected-account recheck | Passed: byte-identical hash; zero Students, active enrollments and Payments; INR 0; four Users and four role assignments; onboarding tables remain unapplied |
| Git safety | Passed after candidate, staged and tracked scans |
| Independent QA | Pending |

No merge, release tag, deployment, live provider or real-data import is
authorised at this checkpoint.
