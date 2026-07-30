# Exams and Marks Foundation

> The legacy raw-marks workflow below predates the independently cleared
> versioned examination-scheme foundation. New configuration uses
> `EXAMINATION_SCHEME_ASSIGNMENT_FOUNDATION.md`; it does not open marks entry
> or authorize this legacy workflow to consume a new scheme. That integration
> belongs to `EXAM-RC-IMPL-2`.

## Scope

Prompt 17B stores internal raw marks. It supports exam cycles, exact class/section/subject/component assessment sheets, decimal maximum and pass marks, Teacher-scoped entry, absent/exempt/not-applicable states, workflow, preview-first CSV import, internal reports, append-only history, and backup/restore version 24.

It does not generate report cards, KG rubrics, ranks, merit lists, Parent or Student results, progression decisions, online exams, question papers, answer-sheet files, AI grading, notifications, or Teacher performance scoring. Prompt 17C may consume only locked raw-mark snapshots when it builds report cards. Prompt 17D owns Teacher performance analytics.

## Permissions and default policy

- Super Admin and Director: all ten exam permissions.
- Principal: view, manage, configure, enter, submit, approve, lock, correct approved marks, reports, and export.
- Admin: view, manage/configure, reports, and export. Approval/locking are disabled by default and can be enabled explicitly in `/roles` only if school policy assigns those duties.
- Teacher: view plus enter/submit only inside exact authorised timetable assignments. No approval, lock, correction, broad export, or cross-school fallback.
- Viewer/Auditor: masked read-only reports, no export.
- Accountant and Parent: no exam or marks access in Prompt 17B.

All page and API actions recheck the database-backed permission matrix. Parent and Student-facing publication routes do not exist.

## Teacher scope

Teacher scope is resolved conservatively:

`User -> active StaffMember -> active TimetableTeacher -> active TimetableAssignment -> active class/section and subject`

The mark sheet must match academic year, class, exact section, and `timetableSubjectId`. A missing or inactive link grants no access. Payload tampering is rejected after the server reloads the assessment. Leadership roles with the required permission have broad school scope. If two Teachers share the same subject, both can enter only when each Teacher has an explicit matching timetable assignment; no primary-subject or name-based fallback is used. Timetable data remains read-only.

## Exam and assessment workflow

Exam cycle:

`DRAFT -> OPEN_FOR_ENTRY -> ENTRY_CLOSED -> APPROVED -> LOCKED`

- Draft configuration is editable.
- Opening requires at least one assessment and changes draft sheets to `OPEN`.
- Closing requires every active sheet to be submitted.
- Exam approval requires every active sheet to be approved.
- Exam locking requires every active sheet to be locked.
- Cancellation requires a reason and preserves the record. A locked exam cannot be cancelled.

Assessment sheet:

`DRAFT -> OPEN -> SUBMITTED -> APPROVED -> LOCKED`

- Submission requires one valid mark/status row for every eligible Student.
- A submitted Teacher sheet cannot be edited.
- Approval is allowed only after exam entry closes.
- Locking is allowed only after the exam is approved.
- Repeated completed transitions are idempotent; stale parallel actions return a reload conflict.
- Approved but unlocked marks can use `CORRECT_APPROVED_MARKS`: a required reason and previous/new snapshots are appended. Locked sheets have no normal reopen or unlock path.
- Approved or locked data is never hard-deleted.

## Mark entry rules

The roster comes from active `AcademicYearEnrollment` rows whose Student is active and not deleted. Academic year and class must match. A populated assessment section requires that exact section; an intentionally blank assessment section is class-wide and includes active enrollments across the class's sections.

- `PRESENT` requires a mark.
- Blank is not zero.
- Zero is valid.
- Marks cannot be negative or exceed `maxMarks`.
- Up to four decimal places are preserved with `Prisma.Decimal`.
- `ABSENT`, `EXEMPT`, and `NOT_APPLICABLE` must not carry marks.
- Remarks are plain text and optional.
- Save, submit, approve, lock, and correction revalidate on the server.
- Mark events are append-only and expose a safe actor label, never raw actor IDs.

The entry table is keyboard reachable; Enter advances through mark inputs. Wide content stays inside `.table-wrap`. Workflow actions use labelled in-app dialogs, never native browser dialogs.

## CSV import

Use `/marks/import` and download the formula-safe template. Columns are exact and ordered:

`examCode,className,section,subjectName,componentName,admissionNumber,marksObtained,entryStatus,remarks`

Preview parses and validates without writes. Matching is exact; there is no fuzzy Student or assessment matching. Duplicate Student rows, invalid statuses, blank present marks, out-of-range values, unrelated enrollments, out-of-scope Teacher targets, closed/approved/locked sheets, and row-level errors block confirmation. Confirmation resolves everything again inside one transaction. Identical reruns are counted as unchanged, not duplicated.

## Reports and export

`/marks/reports` explicitly lists exam cycles with no assessment sheets, configuration/entry completeness, missing marks, present/absent/exempt/not-applicable counts, class/subject sheet averages, high/low raw mark, derived pass/fail and no-pass-mark distributions, assessment/exam workflow state, Teacher submission state, cancelled sheets, configuration-only cancelled exams, and correction counts. Viewer/Auditor responses mask exam codes server-side and cannot export.

These values are internal and derived. They create no permanent rank, merit list, progression decision, or report card. CSV contains only allowlisted assessment-level fields, applies spreadsheet-formula protection, and is unavailable to Teacher, Viewer, Parent, and Accountant roles.

## Backup and restore

Backup version 24 adds `examCycles`, `examAssessments`, `studentMarks`, and `studentMarkEvents`. Password hashes and raw exam/mark actor IDs are excluded; safe event actor labels remain.

Restore accepts older backups without the four arrays. It validates exact exam, assessment, Student, timetable-subject, and active-enrollment links; unique exam codes; unique assessment combinations; unique assessment/Student marks; decimal/status constraints; event links; and correction reasons. Same-code/different-ID and combination collisions are isolated with warnings. Marks/events cannot attach to an unrelated local assessment. Existing locked or newer local snapshots remain authoritative. Class-wide assessment links accept any active section in the matching class, and blank optional component names restore as the main component. Event restore is append-only and idempotent.

Prompt 17B-QA also hardened correction safety: controlled corrections are refused after an exam is cancelled or locked, even if a stale assessment row is still marked approved.

Completed transitions return their existing state safely, including their public assessment summaries. Uniqueness conflicts are translated to a safe message and never expose Prisma invocation or schema details.

The existing SQLite Prisma P3005 baseline remains documented. The checked-in migration is `prisma/migrations/20260716_exams_marks_foundation/migration.sql`; local development uses the established baseline-safe schema sync procedure.

## Operator sequence

1. Create the exam in `/exams/new`.
2. Add explicit timetable-backed assessments while the exam is a draft.
3. Open marks entry with the labelled confirmation.
4. Teachers use `/teacher/marks` or `/marks`, save drafts, validate missing rows, then submit each sheet.
5. Leadership closes exam entry after every sheet is submitted.
6. An authorised approver reviews and approves each sheet, then approves the exam.
7. An authorised locker locks each sheet, then locks the exam.
8. Use `/marks/reports` for internal review. Prompt 17C may later read locked raw marks.

Never use this phase to publish results, decide promotion/repeat/failure, or overwrite locked marks.

## Prompt 17C integration

Digital report cards now consume locked Exam/Marks rows as read-only source snapshots. Report-card pages cannot change a StudentMark, assessment, or exam. The initial policy supports one locked Exam Cycle per mark-based batch, excludes Exempt/Not Applicable rows from the denominator, preserves Absent separately from numeric zero, blocks missing required marks, and performs no rank calculation. Backup version 25 adds report-card entities while retaining all version-24 exam arrays.

## Prompt 17D analytics consumption

Teacher Analytics reads compatible locked assessments and aggregate mark-status/workflow evidence only. It enforces the minimum cohort, excludes Student identity/raw marks, distinguishes zero/absent/exempt/not-applicable, and never claims Teacher causation. It does not change ExamAssessment or StudentMark data.
