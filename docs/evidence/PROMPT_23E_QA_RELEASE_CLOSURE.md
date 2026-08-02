# Prompt 23E-QA Independent Release Closure

Date: 2026-08-03

Result: `EVENTS_HOLIDAYS_CALENDAR_CLEARED`

Implementation branch: `feature/events-holidays-academic-calendar`

Release tag: `events-holidays-calendar-v37-2026-08-03`

## Independent review and security fixes

Every changed calendar model, migration, permission, helper, API, page, backup path and QA harness was reviewed from the unchanged Prompt 23D release base. Independent QA corrected the following release blockers before clearance:

- workflow actions are canonicalised before permission selection and unknown actions fail closed;
- emergency closure publication requires its exact additional permission;
- database triggers preserve published content, lifecycle evidence, replacement ownership, current pointers and append-only audit history;
- Parent examination references require the current published timetable and exact active examination/class/section scope;
- notification audiences resolve through current IAM assignments plus active Guardian, enrollment, Staff and timetable relations, and reads remain bound to the active role context;
- management CSV is leadership-only, bounded, formula-safe, private/no-store and rate-limited;
- attendance and report-card calendar bases use exact scope predicates, while locked report-card key/snapshot evidence is validated and preserved;
- backup validation proves lifecycle, ownership, audience, pointer and audit consistency, and restore is atomic, idempotent and collision-safe; and
- SQLite copies refuse active sidecars and verify that the operational database and sidecar state stay unchanged.

Seven focused security-regression tests were added. The full suite and independent copied-database harness passed after the final archive-lifecycle correction.

## Fresh copied-database matrix

`pnpm.cmd qa:23eqa` completed as `CAL23EQA_INDEPENDENT_PASSED` using only ignored copies and fresh `CAL23EQA` fixtures. It covered two Super Admins, Principal, two Teachers, one- and multi-child Parents, Teacher plus Parent, Director plus Parent, Viewer, Accountant, inactive and expired roles, a removed Guardian link, multiple academic years/classes/sections, posted attendance, all six operational day types, all eight event audiences and a current examination reference.

The matrix proved event/day separation, exact Parent and Teacher object scope, multi-role and multi-child context isolation, stale-handle denial, working-day totals, posted-attendance non-rewrite, locked historical basis preservation, publication/replacement idempotency, concurrency refusal, forced rollback, append-only history, notification deduplication and version-37 restore twice. Cleanup was inspected twice and the operational database was unchanged.

## Production Browser and accessibility proof

Three short copied-database production-runtime batches covered Principal management, Parent multi-child delivery and Teacher plus Parent context switching at `1366 × 768` and exact `390 × 844` in light and dark themes.

Principal QA proved working-day totals, conflict/impact preview, posted-attendance reconciliation warnings, audience preview, event publication/replacement/withdrawal and immutable history. Parent QA proved school-wide plus exact linked-child scope, child switching, current examination reference and denial of Staff/leadership content. Teacher QA proved assigned-class and authorised Staff scope, unrelated-class denial, role-context switching, child-context removal outside Parent context and stale-tab failure closed.

All final surfaces had semantic calendar/list/table structures, labelled controls, visible keyboard focus, 44 px actions, contained cards/dialogs and no page-level overflow. Browser console/hydration warnings and errors, native dialogs and clean production stderr were all zero. Each runtime was stopped before the next batch; the final Browser state retained no tabs and port 3220 is closed.

## Migration, backup and operational integrity

The protected pre-migration operational database was 5,603,328 bytes with SHA-256 `EAB263EB6CF2DF05E389F6F2629EBBA7AD7B8070429FB2A4063C642F15080AB1`. A version-37 logical backup and two byte-identical raw restore rehearsals were retained under ignored protected storage. Both rehearsals returned SQLite `integrity_check=ok` and zero foreign-key violations.

The single additive migration `20260802170000_events_holidays_academic_calendar` applied once; the second deployment was a no-op and all seven migrations are current. The post-migration operational database is 5,799,936 bytes with SHA-256 `A92DA6F6C45D9569B7A07D3CFEA4359DF020EA7AF84AD088CEBD3FE33CB5262E`.

The exact pre/post operational baseline is 0 Students, 0 active enrollments, 0 Payments / INR 0, 0 Guardians and 0 Staff. Exactly four protected accounts and assignments remain: one active owned `SUPER_ADMIN`, with retained `ADMIN`, `ACCOUNTANT` and `VIEWER` accounts inactive. Permission profiles, overrides, sessions and active child contexts remain zero.

## Final verification

The required commands passed sequentially after the operational migration:

1. `pnpm.cmd routes:list` — 300 page routes and 439 APIs.
2. `pnpm.cmd lifecycle:backfill` — zero active Students and zero writes.
3. `pnpm.cmd typecheck` — all 13 configured TypeScript projects passed.
4. `pnpm.cmd test` — 181 files and 1,652 tests passed.
5. `pnpm.cmd build` — production compile/generate passed with the bounded 4 GB Node heap.
6. `pnpm.cmd backup` — version-37 backup `nalanda-fee-control-backup-2026-08-03-00-29.json` created.
7. `pnpm.cmd git:safety-check` — passed with no secret or private runtime artifact detected.

## Release boundary

The release uses a fast-forward merge only. The feature branch is retained and local/remote main, feature branch and annotated tag must resolve identically. No force push is permitted.

This clearance does not authorise staging, deployment, public-site event publication, live Email/SMS/WhatsApp, real-user onboarding, event registration/ticketing, payments, transport, appointments, attachments or any unrelated phase.

Next governed phase: Prompt 23F — Classwork, Secure Submissions, Attachments and Feedback.
