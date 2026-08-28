# Portable upgrade and rollback

Upgrade order: verify exact provenance; create and verify an encrypted backup; run the candidate migrator under lock; stop on drift/failure; start one candidate; prove readiness/native compatibility; start the second; then test smoke, objects, jobs and metrics.

Application rollback never runs destructive down migrations. It is allowed only when the previous image remains compatible with the current schema. Otherwise keep the candidate or maintenance page serving and use a reviewed forward fix. Preserve PostgreSQL, objects, Offline Sync idempotency, device/session revocation and the backup.

A failed migration must release the lock, leave the previous healthy tier untouched, and emit only a safe code. Provider adapters implement atomic traffic switching; Compose documents order but is not a zero-downtime orchestrator.
