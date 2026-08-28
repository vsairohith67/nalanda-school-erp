# Portable disaster recovery

Rebuild from reviewed source/image, mounted secrets, encrypted database backup, and provider-versioned/off-host private objects. Recreate networks/dependencies, initialize the bucket, migrate empty PostgreSQL, restore in isolation, verify, then start two replicas and edge. Valkey is transient.

The local object-store volume is not an off-host copy. Provider approval must name backup location, immutability/versioning, retention, restore authority and tested object replication. Use only synthetic data until real onboarding is approved.

Record database backup/restore, object restore, rebuild and rollback durations. Local numbers are rehearsal evidence, never a managed-provider SLA.
