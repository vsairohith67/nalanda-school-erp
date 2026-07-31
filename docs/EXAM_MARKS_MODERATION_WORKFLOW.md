# Principal Marks Moderation Workflow

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
