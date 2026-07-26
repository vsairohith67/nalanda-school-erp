# Proposed Staging Deployment Architecture

Status: design only; nothing is deployed.

## Recommended topology

```text
Internet later
  -> staging.nalandaps.com (future DNS approval only)
  -> Caddy/nginx on 443 (TLS, HSTS, limits, sanitized forwarding)
  -> 127.0.0.1:3000
  -> one Next.js Node process
  -> local persistent SSD
       /var/lib/nalanda/data/database/staging.db (+ journal/WAL/SHM)
       /var/lib/nalanda/uploads/fee-register-ocr/
       /var/lib/nalanda/backups/{json,encrypted}/
       /var/lib/nalanda/data/temp/{cloud-backup,restore-rehearsal}/
       /var/cache/nalanda/next/<build-id>/
```

Use a dedicated unprivileged deployment/service account. The app release is read-only to the service except framework runtime needs; the data root is writable only by the service account. The Node listener binds to loopback, so clients cannot bypass the proxy or spoof trusted forwarding headers.

## Release and process contract

- `/opt/nalanda/releases/<UTC>-<short-commit>/` contains immutable source/build/dependencies.
- `/opt/nalanda/current` is an atomic symlink to the selected release; `/opt/nalanda/previous` retains the prior verified release.
- `/var/lib/nalanda/data`, `/var/lib/nalanda/uploads` and `/var/lib/nalanda/backups` persist independently of releases.
- `/etc/nalanda/staging.env` contains root-owned mode `0600` environment values; it is never in Git or a release archive.
- Before a release becomes read-only, deployment creates a release-specific writable `.next/cache` symlink to `/var/cache/nalanda/next/<build-id>/`. It is disposable cache, excluded from backups, and is never shared across build IDs.
- systemd runs one explicit Node/Next CLI process on `127.0.0.1:3000`, makes releases read-only, grants writes only to the declared persistent/cache/log/runtime roots, applies task and memory bounds, restarts on failure with bounds, and captures stdout/stderr.
- `flock` or the platform's equivalent serializes deploy, migration, backup, restore, cleanup, and scheduled singleton jobs.

## HTTPS, hostname, and Google Workspace boundary

The intended name is `staging.nalandaps.com`, but DEVOPS-1C does not create it. A later DNS change should add only the approved staging host record after exporting the current zone. It must not edit, delete, or replace Google Workspace MX, SPF, DKIM, DMARC, verification, or unrelated records. `nalandaps.com` and `www.nalandaps.com` remain untouched.

TLS terminates at the managed ingress or Caddy/nginx. HTTP redirects to HTTPS. HSTS begins on the staging hostname after HTTPS is verified; do not preload or broaden HSTS to unrelated subdomains in this phase. The application requires secure `__Host-` session cookies, strict SameSite, and sanitized single-hop forwarding.

## Persistence and backup

- SQLite and all sidecars reside on the same local persistent volume.
- `STAGING_DATA_DIR=/var/lib/nalanda` is the containment root. Database, uploads, backups and temp/rehearsal paths are explicit children checked by `pnpm deployment:env-check`.
- Nightly infrastructure snapshots are supplementary. The primary recovery artifact is a validated, encrypted application/SQLite-consistent backup, later copied off-host to an approved destination.
- Backups never live only on the same disk. Until an off-host destination is approved, actual external staging is not disaster-recovery complete.

## Deployment/migration/rollback

Deployment pulls an exact commit/tag, installs with frozen lockfile, validates, tests/builds in a new release, backs up staging data, enables maintenance, stops the old writer, runs one `prisma migrate deploy`, starts the new release, and performs liveness/protected-page/smoke checks. Migration status and backup IDs are logged without private contents.

Code rollback atomically returns `current` to the previous release and restarts. If the schema is not backward compatible, code rollback alone is prohibited; restore the paired pre-migration backup in maintenance mode, verify integrity/reconciliation, then start the previous release. Never attempt an automatic down-migration.

## Health, monitoring, and maintenance

- `/api/deployment-health` is a non-mutating liveness probe with `private, no-store` and no business data.
- An authenticated/scheduled deep readiness probe checks DB read, disk headroom, backup age, and singleton-worker health without mutation.
- During the approved initial supervised-only period, local systemd/Caddy health and redacted journals are sufficient for attended verification. External uptime checks and a central immutable redacted sink remain separate approval gates and are required before unattended continuous operation.
- Maintenance mode returns 503/Retry-After at ingress, while operator access remains local/SSH only.

## Staging isolation

- Separate hostname, instance, SQLite file, data root, secrets, encryption keys, users, logs, monitoring labels, backups, and provider profiles.
- Synthetic data only. No real contacts, finances, documents, Schoolknot exports, biometrics, or location data.
- All live WhatsApp/SMS/Email/AI/OCR/cloud-backup/payment providers remain disabled. Only deterministic/mock/local encrypted paths may run.
- No automatic promotion or deployment to production. Staging release identifiers start `staging-`; production identifiers are rejected by the validator.
