# Marks Submission and Reopen Lifecycle

## States

`NOT_STARTED → DRAFT → READY_TO_SUBMIT → SUBMITTED`

Validation may produce `VALIDATION_FAILED`. A governed correction uses:

`SUBMITTED/RESUBMITTED/MODERATED/LOCKED → REOPEN_REQUESTED → REOPENED → RESUBMITTED`

Principal moderation produces `MODERATED`; calculation lock produces
`LOCKED`.

## Version contract

An `ExamMarkSheet` row is one immutable mark-history version. A logical sheet
has a stable SHA-256 key and exactly one non-null `currentKey`. Reopen creates a
new row with `versionNumber + 1` and `supersedesSheetId`, copies the prior
entries, clears the old current marker, and activates the new marker in one
transaction. The prior marks, submission actor/time and correction evidence
remain.

Draft edits use `optimisticVersion`; Student rows use `rowVersion`.
Submission verifies all required Students, no `NOT_ENTERED`, current frozen
scheme identity and expected versions. Request keys are recorded uniquely in
the existing append-only `ExaminationSchemeAudit` ledger, preventing duplicate
submission, correction, moderation or notification evidence.

Teachers may request correction with a reason of at most 500 characters.
Principal may reject or reopen with a reason. Teachers cannot reopen directly,
and no workflow hard-deletes history.
