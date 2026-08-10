# Release and Rollback Runbook

## Operator workflow

1. Confirm synchronized retained branch, clean tree, expected commit/tag and Git safety.
2. Capture dynamic routes/APIs, tests, migrations, backup format and the private operational fingerprint/baselines.
3. Run `release:inspect` with explicit environment/current/target/previous release, owner and session.
4. Run environment validation, focused/full tests, build and package/verification gates sequentially. Set `NALANDA_STANDALONE_BUILD=true` only on a symlink-capable Linux release runner and pass `--runtime-mode standalone`; Windows/local portability rehearsal uses `--runtime-mode framework`. Never let the runner choose implicitly.
5. Rehearse fresh/copy migration twice, synthetic staging, backup/restore, health, smoke and PWA update/rollback.
6. Name approver and rollback owner. Production also requires separately authorised provider/budget/cutover and maintenance window.
7. Enter maintenance and drain the writer before backup/migration/switch. Record the point of no return.
8. Verify startup, OBS-1A health and role-specific smoke. Complete only after all required gates pass.
9. Release the lock through `inspect-cleanup`; retain privacy-safe append-only history.

Production execution is deliberately fail-closed unless the runtime supplies a separately governed authorization and a bounded approval reference. RELEASE-OPS-1A supplies neither and performs no deployment.

## Failure actions

| Failure | Default action |
| --- | --- |
| pre-package/artifact/pre-migration | Abort with no change. |
| migration | Keep maintenance; use verified pre-migration DB/assets only if no new writes occurred. |
| switch/startup/health/smoke/client | Switch to previous verified build; restore data only when migration compatibility requires it. |
| post-release operational | Disable feature flag or escalate reconciliation; never auto-restore after new writes. |

Record safe rollback deadline, data-write boundary, owner, evidence and unresolved consequences. A database restore after new writes requires an explicit reconciliation decision. Rollback is idempotent and must prove the previous build starts.

## Maintenance

OBS-1A records planned/active/complete windows. Runtime maintenance permits liveness/client-version and restricted Technical Operations access, refuses ordinary API/mutation traffic with 503, and shows a private-data-free page headed **NALANDA PUBLIC SCHOOL** in Georgia Bold. Overdue windows are alerts; maintenance never hides corruption or security-critical alerts.

## Failed-release incident

Keep the lock and maintenance state, classify the exact failure, preserve logs privately, redact secrets/paths/hashes from general communication, choose rollback/forward-fix/reconciliation, and verify health/data/assets after recovery. Do not broadcast through Email/SMS/WhatsApp in this phase.
