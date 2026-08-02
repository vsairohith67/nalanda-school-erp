# Prompt 23D Implementation Checkpoint

Date: 2026-08-01
Branch: `feature/parent-attendance-exam-timetable`
Base: `9fe5c2b928c2c84bc2e4c739d5bf377ce1501fc7`

## Major QA group 1 — copied-database domain, authorization and recovery

Result: `PARENT23D_COPIED_DATABASE_QA_PASSED`.

- The additive migration deployed twice on a copied operational database and reported clean status.
- One-child default, multi-child selector, opaque-handle rotation, cross-family denial, removed-link denial, inactive Parent denial, and Teacher/Director context isolation passed.
- All five existing attendance statuses produced exact official counts; draft attendance, notes, remarks, Staff IDs and raw IDs were excluded. No working-day count or percentage was invented.
- Draft denial, first publication, immutable rows, replacement indication/history, withdrawal, conflict validation and stale-version refusal passed.
- Forced append-only audit deletion failed and rolled back without event loss.
- Backup version 37 serialized and validated all timetable versions/rows/events. A clean migrated database restored the exact `REPLACED` and `WITHDRAWN` history transactionally.
- Both QA databases were removed. The operational SQLite byte hash and size were unchanged.

Application TypeScript passed under the 3 GB low-memory heap after the default host limit exited without diagnostics. Focused Prompt 23D tests pass. Browser QA, operational migration with protected rollback, full sequential verification, feature-branch push and external record closure remain pending at this checkpoint.

## Major QA group 2 — protected operational migration

- An exclusive-open check passed with no Next.js runtime using the operational SQLite file.
- Protected raw rollback copy SHA-256: `236B5DC718814A9729D8C451B4F647C500D715E93EFE7ACF8D3A80E3698ECA95`.
- A version-37 logical backup was written beside that copy under the ignored `backups/parent23d-pre-migration-20260801` directory.
- Migration `20260801183000_parent_attendance_exam_timetable` applied once; a second deploy was a no-op and migration status reports all six migrations current.
- Post-migration database SHA-256: `EAB263EB6CF2DF05E389F6F2629EBBA7AD7B8070429FB2A4063C642F15080AB1`; size `5,603,328` bytes. The difference is the authorised additive schema/migration ledger only.
- Exact pre/post operational business baseline: 0 Students, 0 active enrollments, 0 active Payments, INR 0, 0 Guardians, 0 Staff.
- Exact pre/post account baseline: one active owned `SUPER_ADMIN`; `ADMIN`, `ACCOUNTANT` and `VIEWER` each retained inactive.

Browser QA, full sequential verification, final backup, Git safety, branch push and external record closure remain pending.

## Major QA group 3 — Parent production Browser, desktop

- Copied-database production runtime completed at `1366×768` and was stopped after the batch. Production stderr was empty.
- One-child Parent attendance showed the exact five official statuses and counts, excluded unposted records and private notes, exposed no raw identifiers, and did not invent a percentage or working-day count.
- The current replacement timetable alone was visible; the authenticated print view remained linked-child scoped and showed the update indication and publication time.
- The multi-child IAM selector required an explicit child choice, refreshed both Parent surfaces, and showed distinct empty states for no attendance and no current published timetable.
- Teacher + Parent was denied in Teacher context; switching to the active Parent role revealed Parent navigation and the governed child selector.
- A direct leadership timetable URL was denied with the generic access-restricted surface. The shared system-state action was raised to the required 44 px minimum before the next Browser batch.
- Light and dark theme checks, no-overflow checks, visible-focus rules, and console/hydration capture completed with zero console errors, warnings or native dialogs.

## Major QA group 4 — Parent production Browser, mobile and stale context

- The copied-database Parent surfaces passed at exact `390×844` in dark theme with no document-level horizontal overflow, no visible action below 44 px, no native dialog, and zero console errors or warnings.
- The date-grouped examination timetable retains semantic table markup and becomes labelled mobile cards for subject, time, reporting time and venue; both current and replacement-history tables fit inside the viewport without clipping.
- Switching from Aarav to Diya rotated the opaque child handle and advanced the IAM context version. Reopening Aarav's prior version-bound attendance URL failed closed to the generic linked-child choice surface and revealed no Aarav identity or attendance data.
- The mobile batch production stderr was empty and the runtime was stopped. Peak observed system memory was 84.4%, below the user-authorised 90% ceiling.

## Major QA group 5 — Principal production Browser

- The copied-database Principal workflow passed at `1366×768` and exact `390×844` in light and dark themes.
- The version list preserved versions 1 and 2 as `REPLACED`; version 3 moved from `DRAFT` to `READY_FOR_PUBLICATION` and then to `PUBLISHED` with a bounded publication reason and a distinct replacement reason.
- An empty required end time was refused with the safe row-level validation message before any invalid row was saved. The complete two-paper Parent preview, conflict summary, reporting times and venue remained exact.
- Publication produced append-only readiness and replacement-publication history with the Principal actor, status transitions, timestamps and replacement reason. The replaced version remained visible in history.
- The mobile editor and version list had no page-level overflow; wide semantic tables remained inside labelled horizontal-scroll containers. The accessible mobile workflow dialog was fully inside the `390×844` viewport, used `aria-modal` and `aria-labelledby`, and had 44 px actions.
- Across the Principal batch there were no visible actions below 44 px, no native dialogs, no console errors or warnings, no hydration errors, and zero production stderr. Peak observed system memory was 85.8%, below the user-authorised 90% ceiling, and the runtime was stopped.

## Major QA group 6 — Browser fixture cleanup and operational recheck

- The `PARENT23D` copied-database Browser fixtures and logs were destroyed; the idempotent cleanup passed twice and a second inspection found no copied database directory.
- Port 3218 had no listener, the temporary memory-control harness was removed, and no Browser runtime remained.
- The operational baseline remained exact: 0 Students, 0 active enrollments, 0 Payments / INR 0, 0 Guardians and 0 Staff; one active owned `SUPER_ADMIN`; `ADMIN`, `ACCOUNTANT` and `VIEWER` inactive.

## Major QA group 7 — full implementation verification

- `pnpm.cmd routes:list`: 294 page routes and 429 API routes (six additive Parent/Principal pages and six additive APIs over the IAM checkpoint).
- `pnpm.cmd lifecycle:backfill`: dry run, 0 active Students scanned and no data changed.
- `pnpm.cmd typecheck`: exit 0 across the application, tools and all five test partitions. The final guarded run peaked at 88.3% physical memory.
- `pnpm.cmd test`: 179 files and 1,635 tests passed. The final guarded run peaked at 77.5%.
- `pnpm.cmd build`: exit 0 using the documented sequential Turbopack compile/generate production modes under a bounded 4 GB Node heap; build ID `Uj3sScvxiIjlxBn8w-jO5`; final peak 84.3%; no build error or fatal diagnostic.
- `pnpm.cmd backup`: version 37 backup created on 2026-08-02. Its `examGovernance` payload includes the three timetable collections; all are correctly empty for the zero-business operational baseline.
- `pnpm.cmd git:safety-check`: passed with no secret or private runtime artifact detected.
- Prisma reports all six migrations applied and the operational schema up to date. No port 3218 runtime or copied Browser fixture remained.
- The exact operational business/account baseline remained unchanged after every gate.

During guard calibration, three compiler/build allocation bursts briefly sampled at 92.0%, 90.1% and 93.4% before termination. No database or application state was mutated by those incomplete processes. The final reproducible path trims idle working sets before each large gate and completed at 88.3%, 77.5% and 84.3% respectively; independent QA must reuse that path and the 89.3% hard stop.

Feature-branch commit/push and external record closure remain pending.
