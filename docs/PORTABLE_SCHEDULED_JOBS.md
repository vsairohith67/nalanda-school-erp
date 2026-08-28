# Portable scheduled jobs

The manifest is `deploy/portable/scheduled-jobs.json`. Current jobs are Parent Meeting reminders, Support SLA checks and due encrypted backups. Each runs as `scheduled-job <manifest-id>`; arbitrary paths and shell arguments are refused.

Durable jobs use a PostgreSQL advisory lock, bounded timeout, fixed command and privacy-safe result. Scheduling belongs to the provider adapter. Web replicas do not elect through process memory.

The reference stack also runs `backup-worker` as a separate non-root process. Web replicas only enqueue
authorised manual backup requests in PostgreSQL. The worker holds the backup-prefix-only S3 identity
and a dedicated PostgreSQL role with read-only business-table access plus writes only to backup workflow
tables. It processes manual, scheduled, retry and recovery work under a PostgreSQL advisory lock. It has no
web authentication, proxy or health-token secrets and cannot reach web replicas. Destructive retention
remains a separately authorised maintenance job; portable web requests fail closed. Web replicas never
receive backup object credentials.

The opt-in Compose profile `maintenance` supplies a third object identity that can delete only exact
backup object versions. It is mounted only into the one-shot `backup-maintenance` service and is never
available to the continuous worker or web replicas.

Deletion is a two-step owner-authorised operation. `backup-maintenance-plan` emits a complete immutable
snapshot of the policy, protected recovery points and exact eligible object versions plus its SHA-256.
The operator reviews and stores that JSON outside the web-writable database, then supplies its exact
digest to the one-shot `backup-maintenance` service. Apply locks every backup-control table, recomputes
the complete snapshot, and refuses any state change before deleting an exact version. A broad `prune`
invocation without the reviewed file and digest is not part of the portable contract.
