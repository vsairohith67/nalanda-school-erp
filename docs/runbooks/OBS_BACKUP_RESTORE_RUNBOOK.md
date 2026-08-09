# Backup and Restore Runbook

1. Generate the current logical backup and protected byte-identical rollback artifact.
2. Validate format v40 and ensure secrets, credentials, sessions, raw logs, keys, and temporary artifacts are absent.
3. Restore into a fresh migrated copied database twice.
4. Confirm second restore is idempotent; check integrity, foreign keys, current checks, and duplicate alerts/incidents/windows/manifests/policies.
5. Validate encrypted private-asset recovery separately where applicable.
6. Never start a destructive restore from the dashboard. Operational replacement requires explicit governed authority.
