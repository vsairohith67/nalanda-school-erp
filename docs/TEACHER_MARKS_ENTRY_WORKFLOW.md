# Teacher Marks-Entry Workflow

## Scope

`/teacher/marks` is the governed EXAM-RC-IMPL-2 surface. It loads only active
`TeacherExamAssignment` rows that pass the complete server-side exact-scope
resolver. The legacy `/marks` and `ExamCycle`/`ExamAssessment`/`StudentMark`
workflow remains for compatibility and is not a source for governed
calculations.

## Daily workflow

1. Choose an authorised examination, class, section, paper and component
   assignment. The selector never lists an inferred cohort.
2. Record a distinct state for every Student/component:
   `NOT_ENTERED`, `PRESENT`, `ABSENT`, `EXEMPT`, or `NOT_APPLICABLE`.
3. For `PRESENT`, enter a number from zero through the frozen component
   maximum using no more than the frozen decimal precision. Zero is a valid
   numeric result.
4. Move between mark cells with arrow keys. Single-cell paste is accepted only
   when the pasted text is a valid bounded number.
5. Save a draft explicitly or allow the 900 ms draft-only autosave. The page
   shows unsaved count, save time, completion count, filters and row errors.
6. A contributor may save governed contributions. Only
   `PRIMARY_SUBMITTER` may use Final submit.
7. Final submit opens an accessible application dialog. It never occurs from
   autosave and never uses a native browser dialog.

## Conflict and failure behaviour

Every save carries the sheet version, immutable history version, optimistic
version and row versions. A mismatch returns `EXPECTED_VERSION_CONFLICT` and
requires reload. Bulk saves run in one transaction, accept at most 200 rows
and are idempotent by request key. Denied scope returns no Student data.

After submission the sheet is read-only. A primary Teacher may send a bounded
correction request, but cannot reopen the sheet.
