# Future Pilot Cutover and Rollback Plan

This plan is not authorization to cut over.

## Before maintenance

Approve the supervised-pilot gates, name incident/cutover/data/finance/academic/support owners, schedule the maintenance window, freeze source changes, create final source and target backups, verify rollback access and communicate the legacy fallback.

## Cutover sequence

1. Enter maintenance and confirm the exact approved release/environment.
2. Take final source hashes/backups and verify target backup/recovery state.
3. Run the approved import plan; do not change validation decisions during execution.
4. Reconcile Student/Guardian/Staff counts, academic years, opening balances, dues and required private assets.
5. Provision named users with least privilege and verified credential delivery.
6. Run role smoke tests for Super Admin, Principal, Director, Accountant, Teacher, Parent and denied Viewer.
7. Open a small supervised cohort, monitor health/audit/support and retain the legacy system read-only where approved.

## Rollback decision

Rollback for data corruption, finance mismatch, role/privacy breach, unavailable recovery, widespread login failure, incorrect academic publication or an unresolved Critical/High defect. The incident commander records the decision; operators do not improvise partial database edits.

## Rollback sequence

Return to maintenance, revoke newly provisioned access if required, preserve evidence, restore the approved target/source state, verify counts/finance/immutable history/private assets, restart the accepted release or legacy fallback, run role smoke tests and communicate the revised state. Reconcile any actions taken during the window before another attempt.

## Post-launch monitoring

For each supervised opening, monitor authentication, permissions, 5xx/latency, database/storage, backup age, finance duplicates, attendance/report exceptions, Offline Sync conflicts and support load. A green synthetic rehearsal is not a production SLA.
