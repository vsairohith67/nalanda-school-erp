# Examination Scheme and Teacher Assignment Independent QA Closure

## Result and boundary

`EXAM-RC-IMPL-1-QA` independently cleared the Principal examination
configuration, versioned scheme and exact Teacher assignment foundation on
`feature/exam-scheme-assignment-foundation`.

The cleared release still does not implement a marks-entry grid, Student
result calculation, moderation/approval, publication, report-card issue or
bulk PDF/ZIP generation. The next separately governed phase is
`EXAM-RC-IMPL-2 — Teacher Marks Entry, Moderation and Calculation Foundation`.

## Preflight

- implementation commit:
  `f03a1f7c10342b27377a428cd2de396aec7f1c8d`;
- synchronized unchanged `main` before QA:
  `de5fb89a0c5582443c839bbff2e176f99d7ba293`;
- private origin: `vsairohith67/nalanda-school-erp`;
- clean implementation branch and exact upstream commit;
- UX release tag verified as an ancestor;
- Git safety passed;
- pre-migration operational SHA-256:
  `9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`;
- exact operational baseline: 0 Students, 0 active enrollments, 0 Payments,
  INR 0, 0 Guardians and 0 Staff;
- account baseline: one active owned Super Admin; retained Admin, Accountant
  and Viewer inactive.

No history was reset or rewritten.

## Independent copied-database matrix

The `EXAM1QA` harness created only synthetic Super Admin, Director, Principal,
two active Teachers with Staff/timetable links, current and next academic
years, multiple classes/sections, subjects, papers, timetable assignments and
valid/invalid scheme versions.

The matrix passed:

- explicit `RAW_SUM` and `WEIGHTED_NORMALIZED`;
- variable ordered components, positive maxima and exact 100% weighted total;
- zero, negative, duplicate and unsafe configuration refusal;
- class/section scope plus subject/paper override enforcement;
- subject-group membership and weighting;
- grade-band overlap rules;
- co-scholastic and template-family versioning;
- clone/new-version, activation/freeze and archive-without-delete behavior;
- stale examination/assignment conflict refusal;
- active/frozen history immutability;
- exact year/exam/class/section/subject/paper/component ownership;
- inactive, unlinked and cross-scope Teacher refusal;
- permission-without-assignment refusal;
- one explicit primary submitter plus audited contributors;
- contributor refusal without a primary and primary-archive refusal while a
  contributor remains;
- non-activating Teacher proposal;
- Principal activation/audit;
- Super Admin exact intervention permission plus reason.

QA corrected five release defects before clearance:

1. every mutable configuration operation now requires the expected
   examination version;
2. assignment rejects a component from a different subject/paper override;
3. active/frozen assignments are immutable and draft primary ownership cannot
   be removed while active contributors remain;
4. Teacher proposal/list paths revalidate active User, Staff and timetable
   links; and
5. configuration views now use human labels, accessible confirmation dialogs
   and 44 px interaction targets.

The corrected focused suite passes 11/11 tests.

## Browser and accessibility

Principal configuration and Teacher assignment views passed at desktop
`1440x900` and exact mobile `390x844`, in light and dark themes.

Evidence:

- no page or feature-root horizontal overflow;
- no undersized visible interaction target;
- every visible input/select/textarea is labelled;
- keyboard-safe native controls and Escape/cancel-safe archive dialog;
- dialog has `role="dialog"`, `aria-modal`, label and description;
- no raw database IDs or configuration enums;
- Teacher sees exactly the six expected active exact assignments;
- no marks-entry grid is present;
- direct Teacher navigation to Principal configuration redirects to
  `/unauthorized`;
- cross-origin mutation is `403`; unauthenticated same-origin mutation is
  `401`;
- zero Browser console warnings/errors; and
- the final clean runtime smoke returned `200` with zero stderr bytes.

## Migration, restore and cleanup

The single additive migration is:

`20260730_exam_scheme_assignment_foundation`

Rehearsal passed on:

- fresh database: two migrations, 174 models/tables and clean status;
- copied existing database: 160 pre-existing tables preserved, 14 new tables,
  deploy/status repeated with no duplication;
- version-37 restore: restored twice idempotently with no credential-hash key;
- independent EXAM1QA copied database: exact configuration, assignment, audit
  and migration invariants.

The copied database and private Browser state were removed. Cleanup was run
again and a second filesystem inspection found no EXAM1QA database, state,
runtime helper or runtime log.

## Operational migration

Fresh read-only rollback artifacts were created under ignored protected
storage:

`EXAM1QA-ROLLBACK-20260730T170450Z`

- raw database SHA-256:
  `9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`;
- logical version-37 SHA-256:
  `C15A93D7E0EC01D219F7795AA6351AC05ABA831FA6C63299BDACCEE61A144DE6`;
- logical backup has zero `passwordHash` keys.

The approved additive migration was then deployed to `prisma/dev.db`.
Deploy was repeated and status reported the schema up to date.

Post-migration evidence:

- physical SHA-256 changed as expected to
  `1288102356A1D4EE5CFCBF08C1D79306EC758FF905BC091660EC195B6BF64F8A`;
- 160-table application-data digest remained exactly
  `E019FCE5B0A3347BE0BFFC037AEEA207705E6ECA915B80B112E5D91AD69BA08C`;
- all six operational business totals remained zero;
- the four account states remained exact;
- all 14 new configuration tables contain zero rows;
- both migration rows are complete and not rolled back;
- SQLite integrity is `ok` and foreign-key violations are zero.

The post-migration version-37 backup is
`nalanda-fee-control-backup-2026-07-30-22-36.json`, SHA-256
`10AD7F5C96D96EFEBD090EBD69BE4562C0EC21ED14E5174FE9C2A73469257AE5`,
with zero `passwordHash` keys.

## Full verification and release

- 278 page routes and 391 API routes;
- lifecycle backfill: 0 scanned, 0 missing, 0 created, no write;
- application and tools typecheck passed;
- 1,596 tests across 172 files passed;
- bounded 4 GB production build generated 214/214 static pages;
- backup version 37 passed;
- Git safety passed.

The feature branch is retained. Release uses a fast-forward-only merge and
annotated tag `exam-scheme-foundation-v37-2026-07-30`. No deployment or
staging cutover is authorized by this QA closure.
