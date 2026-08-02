# Prompt 23D-QA Independent Release Closure

Date: 2026-08-02

Result: `PARENT_ATTENDANCE_TIMETABLE_CLEARED`

Implementation branch: `feature/parent-attendance-exam-timetable`

Independent QA fix commit: `9317551cb0937d98ded642faac7b4383aeba8970`

Release tag: `parent-attendance-timetable-v37-2026-08-02`

## Independent review and fixes

Every Prompt 23D page, API, model, migration, permission, context resolver,
workflow helper, backup path and test was reviewed from the unchanged IAM
release base. Independent QA corrected four bounded defects before clearance:

- tampered authenticated Parent print requests now fail closed without a
  framework console error or Student disclosure;
- role and linked-child selectors now use explicit accessible labels and fit
  the desktop and exact mobile menu bounds;
- publication, withdrawal and archive retries accept only the exact immediately
  completed actor/reason/version transition and otherwise return a stale
  version conflict;
- timetable restore reuses an enclosing Prisma transaction instead of opening
  an unsupported nested transaction.

The independent security diff scan completed all 34 receipts with zero
findings. Four candidates were reviewed and rejected as non-vulnerabilities
only after the stronger retry, baseline and recovery evidence was present.

## Fresh copied-database proof

The unique `PARENT23DQA` matrix used only ignored copied databases and synthetic
Principals, Parents, linked/unrelated children and multi-role users. It proved:

- exact one-child defaults, multi-child switching, cross-family and tampered
  opaque-handle denial, removed-link denial, inactive/expired Parent denial,
  role-context separation, session revocation and stale-tab failure;
- exact official attendance rows, month/year filtering, five existing status
  counts, no-record handling and exclusion of drafts, notes, Staff identities,
  class-wide data, raw IDs and any invented percentage or working-day rule;
- draft-only Principal editing, subject/cohort/time/duplicate/overlap
  validation, empty-publication refusal, expected-version CAS, concurrent
  publication protection, exact retry idempotency, forced-failure rollback,
  immutable published rows, replacement, withdrawal, archive and append-only
  audit history;
- current-published exact-cohort Parent delivery with no draft, other-cohort,
  marks, assignment or internal-note exposure;
- migration deployment twice and clean status; and
- full backup-version-37 restoration twice with exact preservation of linked
  Students, Guardians, enrollments, attendance, timetable versions/rows/events,
  publication links and audits, without credential or active-session secrets.

The independent adversarial baseline probe inserted an unexpected active Parent
into a copy and proved that the operational verifier fails closed. Cleanup and
absence of copied databases, logs, print artifacts and runtimes were inspected
twice.

## Production Browser and accessibility proof

Three short copied-database production-runtime batches covered Parent one-child,
multi-child and Teacher-plus-Parent context switching, direct denied URLs,
authenticated print views, and the Principal draft/preview/ready/publish/
replacement/history workflow. Checks ran at `1366x768` and exact `390x844` in
light and dark themes.

All final surfaces had visible keyboard focus, labelled controls, 44 px actions,
contained tables/dialogs, no document-level overflow, no native dialogs, zero
console/hydration errors and zero clean production stderr. Each runtime was
stopped before the next batch; peak observed memory stayed below the authorised
90 percent ceiling.

## Recovery, verification and operational integrity

The protected pre-migration rollback copy has SHA-256
`236B5DC718814A9729D8C451B4F647C500D715E93EFE7ACF8D3A80E3698ECA95`.
Migration `20260801183000_parent_attendance_exam_timetable` is additive, all six
migrations are current, and repeated deployment is a no-op. The operational
database SHA-256 remains
`EAB263EB6CF2DF05E389F6F2629EBBA7AD7B8070429FB2A4063C642F15080AB1`.

The required low-memory sequence passed in order:

1. `pnpm.cmd routes:list` — 294 page routes and 429 APIs.
2. `pnpm.cmd lifecycle:backfill` — zero active Students and zero writes.
3. `pnpm.cmd typecheck` — passed.
4. `pnpm.cmd test` — 1,636 tests across 179 files passed.
5. `pnpm.cmd build` — passed with the bounded 4 GB Node heap.
6. `pnpm.cmd backup` — version 37 backup
   `nalanda-fee-control-backup-2026-08-02-14-47.json` created and validated.
7. `pnpm.cmd git:safety-check` — passed.

The final exact operational baseline is 0 Students, 0 active enrollments,
0 Payments / INR 0, 0 Guardians and 0 Staff. There are exactly four protected
accounts/role assignments: one active owned `SUPER_ADMIN`; `ADMIN`,
`ACCOUNTANT` and `VIEWER` remain inactive. Permission profiles, explicit
grants/denials, sessions and active child contexts remain zero.

## Release boundary

The feature branch is retained. The governed release is a fast-forward merge
only, with local/remote main, feature branch and annotated tag required to
resolve identically. No force push is permitted.

This clearance does not authorise staging, deployment, live SMS/email/WhatsApp,
real-user onboarding, attendance correction/dispute, classwork/submission,
events/holidays, appointments, transport, payroll, admissions CRM or any other
unrelated module.

Next governed phase: Prompt 23E — Events, Holidays and Academic Calendar.
