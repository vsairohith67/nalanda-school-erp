# Import Rollback Runbook

Classify every planned action as `FULLY_REVERSIBLE`, `REVERSIBLE_BEFORE_USER_ACTIVITY`, `REQUIRES_COMPENSATING_ACTION`, `ARCHIVE_ONLY` or `NOT_SAFE_TO_AUTOMATICALLY_ROLL_BACK`.

Before import, record backup IDs/hashes, batch/package/mapping/wave IDs, expected creates/updates/links/totals, ownership lineage and the point after which user activity blocks deletion. Test restore separately.

On failure: freeze the affected wave, disable user access, preserve logs/reports/source hashes, identify exact batch-owned changes and compare current hashes/dependencies. Automatic rollback may remove only unchanged batch-owned creations in dependency-safe order. Never delete later legitimate activity.

Identity merges, finance, issued academic records and records with later user activity require compensating/forward correction. Corrections preserve source, normalized, imported and corrected values, reason, operator, approver, timestamp, affected record and batch.

After rollback/compensation, reconcile counts/totals/references, verify restoreability, document residuals, obtain reviewer/owner acceptance and decide whether a new package/mapping/dry run is required. A failed or partial rollback is reported truthfully.
