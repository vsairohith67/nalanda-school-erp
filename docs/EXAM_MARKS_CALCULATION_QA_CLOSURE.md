# EXAM-RC-IMPL-2 Independent QA Closure

Date: 2026-07-31  
Result: `EXAM_MARKS_CALCULATION_CLEARED`

## Scope cleared

Independent QA cleared the governed Teacher marks-entry, final submission,
correction/reopen, Principal moderation, deterministic calculation and
immutable Student result-snapshot foundation. It did not implement or approve
report-card publication, Parent/Student result delivery, colour or
black-and-white PDFs, merged PDFs, ZIPs, or physical print layouts.

## Exact authorization and workflow evidence

- A fresh ignored `EXAM2QA` copied database covered Super Admin, Director,
  Principal, two assigned Teachers, contributor, unlinked Teacher, inactive
  Staff/Teacher, Parent, Accountant and Viewer.
- Teacher access required the active User, active StaffMember, active
  TimetableTeacher and exact active assignment across academic year,
  examination, class, section, subject paper and component.
- Cross-year, class, section, subject, paper, component and Teacher tampering
  failed closed without Student or marks disclosure.
- `PRESENT` zero, positive `PRESENT`, `ABSENT`, `NOT_ENTERED`,
  `NOT_APPLICABLE` and `EXEMPT` remained distinct. Bounds, decimal precision,
  duplicate entries, bulk rollback, stale versions and retry idempotence were
  independently exercised.
- Draft/autosave, primary-versus-contributor ownership, one logical final
  submission, read-only submission, correction request, Principal
  reject/reopen, immutable superseding sheet versions, resubmission,
  moderation and concurrent lock controls passed.

## Calculation and snapshot evidence

Hand-calculated RAW_SUM and WEIGHTED_NORMALIZED fixtures passed, including
zero, scheme-directed state treatment, required-source refusal, exact
100-percent weights, zero-denominator refusal, rounding, explicit subject
groups, grade/pass/rank feature gates, deterministic ties, exact-cohort
average/highest and locked attendance.

Repeated preview was deterministic. A governed correction produced a new
snapshot version while preserving the old snapshot. Locking froze the exact
scheme, sheet, cohort and attendance inputs, left exactly one active locked
run, preserved the superseded run and created no report publication.

## Security, Browser and accessibility evidence

The API matrix passed origin/CSRF protection, 512 KiB marks payload limits,
bounded batch validation, private/no-store, POST-only mutation,
enumeration-resistant denial, compare-and-set, transaction rollback,
concurrent submission/lock and calculation rate limiting. No marks or Student
data was transmitted to an external provider.

Short production Browser batches covered Teacher and Principal workflows at
1366×768 and exactly 390×844 in light and dark modes. Grids remained inside
controlled horizontal wrappers, exact examination changes remounted their
sheet rows atomically, interactive controls were at least 44 px, focus was
visible, dialogs were labelled and non-native, document overflow was zero,
console/hydration issues were zero and clean production stderr was empty.

## Migration, backup and cleanup

Migration `20260730_teacher_marks_moderation_calculation` deployed twice on
fresh and copied rehearsal databases without drift. Version-37 backup/restore
preserved the governed graph and remained idempotent on the second restore.

Before operational migration, a protected raw rollback copy was byte-identical
to SHA-256
`1288102356A1D4EE5CFCBF08C1D79306EC758FF905BC091660EC195B6BF64F8A`;
its restored copy passed SQLite integrity and the exact account/business
baseline. The approved additive migration then applied once. The expected
physical database change produced SHA-256
`90ACB7F9C1BA74049ED6430DBAA8A633C84B4452BC869F3E85AF14E9DA1B5696`,
with three clean migrations and no application-record change.

All `EXAM2QA` users, Staff links, assignments, classes, Students, schemes,
marks, audits, snapshots, databases, runtimes, harnesses and logs were removed.
Cleanup was inspected twice. The operational baseline remains:

- 0 Students and 0 enrollments;
- 0 Payments and INR 0;
- 0 Guardians and 0 Staff;
- one active Super Admin;
- inactive Admin, Accountant and Viewer.

## Final verification and release boundary

Final verification passed 279 page routes, 400 API routes, zero-write lifecycle
backfill, all TypeScript projects, 174 test files and 1,605 tests, the 217-page
production build, version-37 backup and Git safety.

Release tag: `exam-marks-calculation-v37-2026-07-31`. The feature branch is
retained. Cloud deployment remains unauthorized.

Next governed phase:
`EXAM-RC-IMPL-3 — Report Publication, Parent Delivery and Bulk Colour/B&W PDFs`.

