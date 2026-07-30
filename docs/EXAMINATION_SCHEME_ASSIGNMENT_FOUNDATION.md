# Examination Scheme and Assignment Foundation

## Release boundary

`EXAM-RC-IMPL-1` implements the approved version-1 configuration foundation
only. It provides Principal-owned examination setup, versioned class schemes,
calculation configuration, subject papers and groups, grade/co-scholastic and
template-family bindings, exact timetable-backed Teacher assignments, and
append-only lifecycle audit.

This phase does **not** implement the marks-entry grid, Student result
calculation, result approval/publication, report-card issue, or bulk PDF/ZIP
generation. The legacy raw-marks and report-card surfaces remain separate and
must not be treated as evidence that this new scheme has entered marks.

## Domain ownership and versioning

Every numeric scheme is scoped to:

- academic year;
- examination;
- class;
- an optional governed section override; and
- optional subject/paper applicability.

The additive model is:

| Model | Purpose |
|---|---|
| `Examination` | Principal-owned examination identity, academic year, type, dates, status and optimistic version |
| `ExaminationClassScope` | Exact class plus optional section applicability |
| `ExaminationSchemeVersion` | Immutable-after-activation numeric configuration version for one class/optional section |
| `ExaminationComponent` | Ordered component, kind, maximum, optional contribution weight and required/optional state |
| `ExamSubjectPaper` | Examination subject/paper identity and optional scheme override |
| `ExamSubjectGroup` / `ExamSubjectGroupMember` | Governed subject aggregation with explicit raw or weighted mode |
| `GradeScaleVersion` / `GradeScaleBand` | Versioned, non-overlapping grade ranges |
| `CoScholasticSchemeVersion` / `CoScholasticItem` | Versioned co-scholastic item configuration |
| `ExamTemplateFamilyBinding` | Class/section binding to an approved report-template family |
| `TeacherExamAssignment` | Exact timetable-backed primary or contributor assignment |
| `ExaminationSchemeAudit` | Append-only configuration, activation, archive, intervention and proposal evidence |

Active or frozen versions have no in-place edit path. A correction is created
by cloning the source version into a new draft. Archiving records history and
sets status; no examination, scheme, assignment or audit hard-delete API is
provided.

## Calculation contract

Every numeric scheme and subject group chooses one mode explicitly:

- `RAW_SUM`: the configured component maxima are summed. Contribution weights
  are forbidden.
- `WEIGHTED_NORMALIZED`: each component has a positive maximum and an explicit
  contribution weight; weights total exactly `100`.

There is no universal `10+40`, `20+80`, `25+25`, or historical combined
weighting. Configuration validation rejects:

- zero or negative maxima;
- duplicate component codes or display order;
- a missing weight in weighted mode;
- a weight in raw mode;
- weighted contributions that do not total exactly 100%;
- duplicate group membership;
- a non-positive or otherwise unsafe denominator;
- overlapping grade bands; and
- activation of an incomplete or invalid scheme.

Version 1 stores rounding policy
`RC05_V1_DECIMAL6_HALF_UP2`: retain six decimal places during later
normalisation and round the final numeric value half-up to two decimal places.
The policy is stored now; this phase does not execute the calculation.

## Principal workflow

Authorised Principal or explicitly permitted leadership can:

1. Create an examination with academic year, type, dates, classes and optional
   sections.
2. Create a first draft scheme or clone a prior version.
3. Select `RAW_SUM` or `WEIGHTED_NORMALIZED` and enter ordered components,
   maxima, optional weights and required/optional state.
4. Configure subject papers and governed subject groups.
5. Bind grade-scale, co-scholastic and report-template families.
6. Assign exact timetable-linked Teachers.
7. Preview the complete configuration and validation state.
8. Activate and freeze a valid scheme.
9. Archive the examination or an assignment without deleting history.

Principal pages:

- `/exams/configuration`
- `/exams/configuration/new`
- `/exams/configuration/[id]`

Teacher assignment page:

- `/teacher/exam-assignments`

The workspace is responsive and was exercised at desktop and exact
`390x844` mobile viewports in light and dark themes.

## Exact Teacher assignment

An assignment is valid only when all of these identities match:

- academic year;
- examination;
- class;
- section;
- subject;
- subject paper;
- optional component;
- active Staff member;
- active timetable Teacher; and
- exact timetable assignment for that academic year, class, section and
  subject.

A User role or broad marks permission is not sufficient. Missing Staff,
timetable Teacher, or timetable assignment fails closed.

For each exact examination/class/section/subject/paper/component scope, one
active primary submitter is permitted. Additional Teachers must be explicitly
recorded as audited contributors, and a contributor cannot replace or silently
create final ownership. Overlapping primary ownership is rejected.

`VIEW_OWN_EXAM_ASSIGNMENTS` returns only the authenticated Teacher's active
assignments. `PROPOSE_EXAM_SCHEMES`, when explicitly granted, permits a
non-activating proposal for an already assigned subject. Teachers cannot
activate or freeze a scheme.

## Permissions and governance

| Permission | Capability |
|---|---|
| `VIEW_EXAM_CONFIGURATION` | View configured scopes, versions, bindings and assignments |
| `MANAGE_EXAM_CONFIGURATION` | Create and edit draft examinations/configuration |
| `ACTIVATE_EXAM_SCHEMES` | Validate, activate and freeze a complete version |
| `ASSIGN_EXAM_TEACHERS` | Create/archive exact timetable-backed assignments |
| `PROPOSE_EXAM_SCHEMES` | Propose only within an exact assigned subject |
| `VIEW_OWN_EXAM_ASSIGNMENTS` | View the authenticated Teacher's exact assignments |
| `INTERVENE_EXAM_SCHEMES` | Exceptional Super Admin intervention with a mandatory audit reason |

Principal receives the management, activation and assignment defaults.
Teacher receives only own-assignment visibility by default. Proposal authority
is an explicit grant. Super Admin intervention is not inferred from the role:
the intervention permission and a specific audit reason are both required.

All mutations require an authenticated server-side permission, same-origin
CSRF protection, `expectedVersion` optimistic concurrency, bounded input,
private/no-store responses and safe client-facing errors. Lifecycle and
intervention events append to `ExaminationSchemeAudit`.

Development CSP permits `unsafe-eval` only in Next.js development mode so the
local Browser runtime can hydrate. Test and production CSP remain strict. The
login form also has a POST fallback, preventing a pre-hydration browser
submission from placing a password in a URL.

## API surface

The additive APIs are:

- `GET/POST /api/exam-configurations`
- `GET/PATCH /api/exam-configurations/[id]`
- `POST /api/exam-configurations/[id]/schemes`
- `POST /api/exam-configurations/[id]/papers`
- `POST /api/exam-configurations/[id]/groups`
- `POST /api/exam-configurations/[id]/grade-scales`
- `POST /api/exam-configurations/[id]/co-scholastic`
- `POST /api/exam-configurations/[id]/template-bindings`
- `POST /api/exam-configurations/[id]/assignments`
- `POST /api/exam-configurations/[id]/assignments/[assignmentId]`
- `POST /api/exam-configurations/[id]/workflow`
- `POST /api/exam-configurations/[id]/proposals`
- `GET /api/teacher/exam-assignments`

No endpoint in this set enters Student marks, calculates results, publishes a
result or generates a PDF.

## Migration and isolated QA

The implementation contains one additive Prisma migration:

`20260730_exam_scheme_assignment_foundation`

Fresh-install rehearsal applies the active clean-install baseline plus this
migration. Existing-database rehearsal verifies all pre-existing tables and
business data before and after applying the migration twice. Neither rehearsal
targets `prisma/dev.db`.

The copied-database harness uses only `EXAM1` synthetic identities:

```powershell
pnpm.cmd qa:exam1 -- prepare
pnpm.cmd qa:exam1 -- inspect
pnpm.cmd qa:exam1 -- cleanup
```

The synthetic fixture covers a weighted scheme, a raw subject group, subject
papers, grade/co-scholastic/template bindings, four primary assignments,
overlap rejection, activation/freeze and cloning a new draft. Cleanup removes
the copied database and ignored state. The operational business baseline must
remain `0 Students / 0 active enrollments / 0 Payments / INR 0 / 0 Guardians /
0 Staff`.

## Operator rules

- Never configure a historical weighting from memory; select the mode and
  enter every maximum/weight explicitly.
- Preview and resolve every validation issue before activation.
- Confirm the Teacher has an active Staff and exact timetable link; do not
  grant a broad role permission to bypass missing ownership.
- Use one primary submitter and explicitly named contributors.
- Archive instead of deleting.
- Clone an activated version for a correction; do not edit the frozen record.
- Super Admin intervention requires a narrow reason describing why Principal
  action was unavailable or insufficient.
- Do not treat activation as permission to enter marks. Marks entry remains a
  later independently reviewed phase.

## Architecture boards

- [Authoritative Nalanda ERP architecture](https://app.canvs.io/?room=WEPBLxUvW55admAHwFA7)
  - re-fetched after marking the v1 setup and deferred result boundary.
- [Detailed Examination and Report Card workflow](https://app.canvs.io/?room=tY7AqTFjFKQMyhcul0i5)
  - re-fetched after marking Principal setup, versioned schemes and exact
    Teacher assignment implemented, with marks entry deferred.

The editable repository source is
[`diagrams/examination-scheme-assignment-foundation.mmd`](diagrams/examination-scheme-assignment-foundation.mmd).

## Release gate

Final implementation verification recorded 278 page routes, 391 API routes, a
zero-write lifecycle dry run, default-memory sequential application/tools
typecheck, 1,594 passing tests across 172 files, 214 generated static pages,
backup version 37
`nalanda-fee-control-backup-2026-07-30-20-02.json`, and a passing Git safety
scan. The operational database SHA-256 remained
`9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`
with the exact zero-business/four-account baseline, integrity `ok` and zero
foreign-key violations. The feature migration is intentionally pending on the
operational database.

The feature branch is `feature/exam-scheme-assignment-foundation`. It must be
committed and pushed without merging. Independent `EXAM-RC-IMPL-1-QA` is the
next gate. This document does not authorize staging, deployment, marks entry,
result calculation, publication, or PDF generation.
