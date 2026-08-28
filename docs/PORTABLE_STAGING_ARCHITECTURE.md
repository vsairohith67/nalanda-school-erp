# Portable staging architecture

The foundation packages Nalanda as one non-root, multi-command OCI image. PostgreSQL owns durable relational state, Valkey owns transient distributed rate-limit state, and a private S3-compatible service owns file objects and encrypted backup containers. Caddy is only the local HTTPS rehearsal edge. No database, Valkey, object-store, or Docker-socket port is published.

The synthetic MinIO service has a dedicated bootstrap identity that is mounted only into MinIO and the one-shot policy bootstrap container. Web/runtime containers receive a module-prefix application identity that cannot access `private/backups/*`; the backup job receives a separate identity restricted to that backup prefix. Integration QA proves that the application identity cannot create another bucket and that anonymous reads fail.

Valkey, MinIO, the MinIO policy bootstrap and Caddy run as numeric non-root users. A networkless, secretless, one-shot helper with only `CHOWN` prepares the disposable MinIO volume; it exits before MinIO starts. Caddy's writable CA/config state is held in bounded non-root tmpfs for this disposable local rehearsal.

The web tier uses a restricted pooled database identity. A one-shot migrator uses `DIRECT_URL`, an advisory migration lock, and the PostgreSQL migrator identity. Scheduled jobs use PostgreSQL advisory locks so only one replica performs a governed run. Required dependency loss makes readiness fail while liveness stays available.

The committed stack is synthetic and loopback-only. It is neither public staging nor a provider choice. All operational flags remain off, cloud AI stays disabled, and native server compatibility does not certify physical devices or app-store delivery.
