# Principal Marks Moderation Workflow

Academic Integrity v1.1 preserves this leadership moderation/calculation architecture while removing ordinary Teacher marks-write authority. Principal and Super Admin may enter directly; an exact-scope `MARKS_ENTRY_OPERATOR` may save/submit only within its grant. Teacher assignment records remain structural historical/configuration evidence and never confer write authority. Prior Teacher-write wording is `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`.

`/exams/moderation` is the governed Principal workspace. It reports completion
by exact examination/class/section/paper/component with the primary Teacher,
contributors, lifecycle status, submission time, missing entries,
ABSENT/EXEMPT/N/A counts, validation failures, late state, correction requests
and complete sheet-version history.

Allowed actions are rendered only when their effective permissions are
present:

- `MODERATE_EXAM_MARKS`: move submitted or resubmitted sheets to moderated;
- `REOPEN_EXAM_MARK_SHEETS`: reject or approve a correction request;
- `RUN_EXAM_CALCULATIONS`: create a deterministic preview when readiness is
  clear;
- `LOCK_EXAM_CALCULATIONS`: freeze the exact source sheet versions and result
  snapshot run.

Every action requires a bounded reason in an accessible application dialog.
Super Admin intervention requires the separate intervention permission and
reason. Reopen creates a new version; it never edits or deletes the submitted
mark history.

The calculation readiness list is authoritative. A missing, unsubmitted,
out-of-cohort, `NOT_ENTERED`, non-current or scheme-mismatched source blocks
calculation. Lock does not publish a report card and does not create PDFs.
