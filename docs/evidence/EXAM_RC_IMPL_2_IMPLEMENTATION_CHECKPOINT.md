# EXAM-RC-IMPL-2 Implementation Checkpoint

Date: 2026-07-31.

- Branch: `feature/teacher-marks-moderation-calculation`.
- Released foundation commit was dynamically verified reachable from
  synchronized `main`; history was not reset or rewritten.
- Pre-edit typecheck passed.
- Operational baseline was read-only verified as zero Students, zero active
  enrollments, zero Payments, INR 0, zero Guardians and zero Staff.
- Protected accounts remained one active Super Admin and inactive Admin,
  Accountant and Viewer.
- One additive migration:
  `20260730_teacher_marks_moderation_calculation`.
- Fresh and copied migration rehearsals: all three migrations applied/current,
  no schema diff.
- Operational database was not migrated in the implementation phase. Its
  status intentionally shows only
  `20260730_teacher_marks_moderation_calculation` pending for independent QA
  review and the governed release step.
- Low-memory typecheck: complete application plus 64 scripts and 172 tests
  checked in sequential shards under the ordinary heap.
- EXAM2 isolated lifecycle: 4 Students, 2 Teachers, 6 primary assignments,
  1 contributor assignment, 7 sheet versions after one correction, 4 result
  snapshots and 25 keyed audit events.
- Proved contributor save/submit denial, exact Teacher denial, valid zero,
  ABSENT/EXEMPT/N/A, stale conflict, final submission, correction v2,
  moderation, RAW_SUM, WEIGHTED_NORMALIZED, explicit group calculation,
  deterministic rerun and calculation lock.
- Operational database hash remained unchanged.
- Focused governance tests: 6 passed, including deterministic preview after
  moderation lock.
- Principal Browser QA, isolated copied-database production runtime:
  1366×768 dark and exact 390×844 light; all six sheets locked; preview rerun
  reused the locked run with zero new snapshots; completion, version history,
  responsive table containment, 44px actions, live status, labels, controlled
  dialogs and zero console/hydration errors verified.
- Teacher Browser QA, isolated copied-database production runtime:
  1366×768 dark and exact 390×844 light; exact assignment selector, PRESENT
  zero, ABSENT, EXEMPT and N/A, paste, Arrow-key movement, debounced draft
  autosave, final submission, frozen controls and correction request verified.
  Document widths equalled their viewports, the wide grid remained in an
  `overflow-x: auto` wrapper, visible controls were at least 44px and native
  dialogs were absent.
- A locale-dependent saved-time hydration mismatch found on a fresh Teacher
  reload was replaced with deterministic IST formatting. The rebuilt
  production runtime was then reloaded on a fresh localhost origin and showed
  the saved IST timestamp with zero console/hydration errors.
- Each Browser runtime was stopped after its batch; stderr was empty. The
  copied EXAM2 database and private Browser state were removed, and cleanup
  inspection passed twice.
- Master and detailed Canvs boards were updated and re-fetched. Mermaid source
  fallbacks remain in `docs/diagrams/`.
- Final verification: 279 page routes, 400 API routes, lifecycle backfill with
  zero writes, all seven typecheck shards, 173 test files / 1,602 tests and the
  bounded 4 GB production build with 217 generated static pages all passed.
- Version-37 backup:
  `backups/nalanda-fee-control-backup-2026-07-31-09-37.json`.
- Final Git safety passed. Operational data remained 0 Students, 0 active
  enrollments, 0 Payments, INR 0, 0 Guardians and 0 Staff; protected account
  states remained unchanged.

Remote commit/push and Notion re-fetch evidence are recorded by the final
implementation handoff.
