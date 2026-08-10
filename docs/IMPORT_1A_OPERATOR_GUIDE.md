# IMPORT-1A Operator Guide

Use the private Bulk Onboarding Centre only with an approved controlled
workbook. Download a fresh template, select the exact bundle and never paste
payments, marks, attendance, salary, government IDs, documents or passwords.

Upload changes no business record. Validate, review every issue and download
the private error workbook if corrections are needed. For an existing governed
identifier, choose only Link Existing, Skip or Reject and enter a clear reason.
Revalidate after every workbook/reference/resolution change.

Before approval, compare the workbook hash, plan expiry, per-sheet rows,
create/link/enrollment/skip counts, academic years/classes and pending account
proposals. Approval does not execute. Execution requires a current approved
plan, password re-authentication, reason and exact confirmation.

After execution, reconcile counts and spot checks from the ERP. Parent/Staff
accounts remain pending IAM proposals; never issue credentials from Excel.
Use rollback preview only for an exact erroneous batch. A blocked preview means
later activity exists: stop and follow the manual reconciliation runbook.

For any parser, validation, stale-plan, concurrency, execution or recovery
failure, preserve the batch reference and safe error code, do not email/upload
the workbook, and follow [the failure and recovery runbook](runbooks/IMPORT_1A_FAILURE_RECOVERY_RUNBOOK.md).

Real-data use is not authorised by implementation or QA. It requires the full
go-live checklist in [the governing specification](GOVERNED_BULK_ONBOARDING.md).
