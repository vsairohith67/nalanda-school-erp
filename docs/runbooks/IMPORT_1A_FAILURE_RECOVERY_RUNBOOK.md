# IMPORT-1A Failure and Recovery Runbook

1. Stop the affected batch. Do not re-upload to email, cloud drives, Asana,
   Notion, Canvs, GitHub or chat.
2. Record only the opaque batch reference, safe error code, time and operator
   role. Do not record names, contacts, row values, filenames or local paths.
3. For parser refusal, correct the source in a fresh controlled template. Never
   disable macro, formula, object, external-link, password or size checks.
4. For validation blockers, use the sheet/row/column issue list, correct the
   workbook or record an allowed duplicate decision and revalidate.
5. For expired/stale plans, revalidate. Do not reuse the old approval.
6. For execution failure, confirm the batch is not completed, inspect aggregate
   OBS-1A status/fingerprint and rerun only with the governed idempotency flow.
   The failed transaction must have created no partial domain rows.
7. For rollback block, do not delete dependent activity. Create a manual
   reconciliation plan with the relevant module owners.
8. For `RECOVERY_REQUIRED`, restore the matching encrypted private asset into
   approved storage, verify its SHA-256, then revalidate. Ordinary logical JSON
   is not sufficient.
9. Before any future real-data retry, refresh logical/raw/private-asset backups,
   rehearse restore and reapprove the exact plan in a maintenance window.
10. Escalate suspected disclosure, credential exposure, identifier collision or
    integrity failure under the OBS incident-response process.
