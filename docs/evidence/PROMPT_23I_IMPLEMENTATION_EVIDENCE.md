# Prompt 23I implementation evidence

Date: 2026-08-08
Branch: `feature/payroll-payslips-employee-self-service`
Base main commit: `0d6cc25e`
Decision: ready for independent Prompt 23I-QA; not merged or released

## Implemented controls

- Thirteen additive models and one additive migration cover effective-dated
  policy/structure versions, Staff assignments, immutable revisions, periods,
  runs, employee/component results, advances/recoveries, payslip versions and
  append-only payroll events.
- Calculation accepts only active compensation plus explicit locked attendance,
  approved leave/unpaid leave, approved adjustments and advance schedules. It
  returns exact formula/source-version snapshots and deterministic paise or
  configured rupee rounding.
- Statutory-looking components are refused unless manual and marked
  `MANUAL_OR_EXTERNALLY_APPROVED`; no EPF, ESI, professional-tax, TDS or pension
  formula is invented.
- Accountant preparation/calculation/submission is separated from exact
  leadership approval/lock/reversal. Critical actions require re-authentication,
  expected-version compare-and-set and transaction-safe idempotence.
- Approved results, salary revisions, payslips, advances and audit history have
  migration-level no-delete/immutability enforcement.
- Finance posting is fail-closed. Payroll creates no Student Payment, receipt,
  fee allocation, expense, Cash Book movement, transfer or disbursement.
- Payslips are versioned, allowlisted, authenticated/no-store, opaque-reference
  colour or monochrome A4 PDFs with no raw internal ID, bank detail,
  Aadhaar/PAN/UAN, credential or audit data.
- Employee self-service resolves the signed-in User to exactly one linked Staff
  record and exposes only that Staff member's structure, revisions, issued
  payslips, approved inputs/adjustments and advance history.

## Sequential verification

| Gate | Result |
| --- | --- |
| Route inventory | Passed: 313 page routes and 480 API routes |
| Lifecycle backfill | Passed: zero active Students; no data changed |
| Copied-database `PAY23I` matrix | Passed: nine role contexts, six Staff states, ten hand-calculation scenarios, concurrency, stale version, forced rollback and finance isolation |
| Fresh migrations | Passed deploy twice/status clean: 11 migrations and 236 models/tables |
| Backup/restore | Version 37 includes 202 arrays; payroll graph restored twice with count idempotence and no credential data |
| Focused tests | Passed 14 payroll calculation, governance, PDF and backup tests |
| Typecheck | Passed all project partitions with a 3 GB heap cap |
| Full suite | Passed 189 files and 1,702 tests |
| Production build | Passed compile/generate with a 4 GB heap cap |
| Git safety | Passed candidate, staged and tracked secret/private-runtime scan |

## Browser proof

The in-app Browser used a migrated database copy and random credentials stored
only below ignored `tmp`. The runtime and copied database were removed after
proof.

- Director administration showed versioned structures/components, assignment
  and revision history, issued-run exact totals, advance recovery and explicit
  no-disbursement/no-finance-posting notices.
- Staff self-service showed only the linked employee's current structure,
  revision, issued payslip, approved calculation inputs and advance balance.
- Switching the Teacher + Parent user to Parent context redirected payroll to
  Access Restricted and Parent navigation contained no salary/payroll item.
- Payroll reports showed approved totals, one issued payslip and a suppressed
  one-person department, with no ranking or raw identifier.
- Administration and ESS passed 1366x768 and exact 390x844 in light and dark,
  with 44 px actions, visible keyboard focus, no horizontal overflow, no native
  dialog and zero Browser console errors/warnings.

## Operational and release safety

- Operational business baseline remains zero: no Student, active enrollment,
  Guardian, Staff, Payment or payroll business record was created.
- A version-37 operational JSON backup was generated under ignored `backups/`.
- The additive migration is not applied operationally during implementation;
  independent QA owns approval, protected rollback, migration, merge and tag.
- No deployment, live provider, real Staff/payroll onboarding, disbursement,
  statutory filing, portal automation or external payroll integration occurred.
