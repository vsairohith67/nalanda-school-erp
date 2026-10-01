# Smallest serial ERP integration patch

R1 leaves this integration patch and all live summary/Staff mapping/final approval gates unchanged. Its public report-access fixture is an invented nonsensitive aggregate, not a real approved-summary adapter or regenerated Excel renderer.

No ERP source, schema, permission, endpoint, migration, v45 backup contract or unreleased recovery work was changed here. The released Staff mapping, biometric ingestion and reconciliation/report services were inspected read-only. Existing biometricReportRows/daily CSV do not expose the requested approved monthly leave/late summaries with the owner's explicit report ordering.

## Approved monthly source adapter

The main ERP workstream should expose an authorized export through its existing reconciliation/report permission path. Return schemaVersion 1, YYYY-MM month, immutable sourceRevision, review.status APPROVED, reviewerReference, reviewedAt, synthetic=false, and staff rows keyed by stable Staff reference with approved numeric leaves/lates, evidence-backed remarks and evidenceReferences. Use only reconciled/approved aggregates under existing school policy. Unknown remains unresolved; never derive leave from missing punches or late counts from raw punch count. No new attendance-policy engine or tables are requested.

Management separately approves a schemaVersion 1 order manifest containing period, version, approvalReference, synthetic=false and stable staffReference/displayName/group/include/position. Names are not identity matching keys. Every included row must have a summary; extras/duplicates/missing values are review errors. Keep private mapping and actual roster off GitHub. Feed the existing component renderer; no silent live capability claim before this adapter exists.

## Existing ingestion freshness gate

The bridge deliberately preserves the exact persisted batchReference/body/bridgeTime and original/received timestamps to match released deduplication semantics. Released ingestion's 48-hour freshness limits can reject a backlog after prolonged outage. Serial ERP owners must decide a governed replay admission design: verify duplicate committed body before rejecting age, and admit previously uncommitted aged records only through an explicit authorized review policy with original timestamps retained. Preserve signature, registration and body-hash checks; no blanket age bypass or bridge-side timestamp rewriting. Until that decision and tests exist, backlog freshness is a documented integration gate and held punches remain intact.

Metadata proposals are simulator-only/non-executable. Future supported metadata writes require explicit authority, revision/expiry revalidation, conflict review and hardware acceptance; no deletion, privilege escalation, last-write-wins or automatic name matching. Fingerprint mirroring is explicitly NOT IMPLEMENTED, with no companion/ERP template handling.

The companion queue and report sidecars are local component formats, separate from ERP logical backups. Keep vendor workflow until controlled verified collector cutover; do not modify eTimeTrackLite's MDB or clear terminal logs.
