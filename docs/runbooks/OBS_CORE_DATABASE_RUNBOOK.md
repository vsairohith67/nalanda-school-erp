# Core Application and Database Runbook

1. Stop risky writes and record a privacy-safe incident.
2. Confirm `/api/health` locally, then run the governed deep check once.
3. For integrity/foreign-key failure, preserve a protected database copy and do not repair the operational database in place.
4. Verify migration ledger and schema on an isolated copy.
5. Escalate with safe fingerprints/counts only. Never paste the database URL, path, row data, or credentials.
6. Recover through the governed backup/restore process and verify twice before any operational replacement.
