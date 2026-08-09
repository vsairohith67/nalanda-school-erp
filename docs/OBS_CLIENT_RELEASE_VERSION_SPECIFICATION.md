# Release and Client Version Specification

The dashboard reports server release, environment, safe commit/build identifiers, latest applied migration, migration count, logical-backup format, PWA build, application schema fingerprint, and advisory client state.

Client states are `CURRENT`, `UPDATE_AVAILABLE`, `UPDATE_REQUIRED`, and `UNKNOWN`. Policy records are expected-version controlled and OBS-1A accepts only `ADVISORY` enforcement. The phase does not force refresh, sign users out, block old clients, deploy builds, or mutate service-worker caches from the dashboard.

A release manifest is immutable release evidence. Only the governed release workflow may mark the appropriate manifest current. A migration/backup/version mismatch blocks release readiness but does not imply the running local application is unavailable.
