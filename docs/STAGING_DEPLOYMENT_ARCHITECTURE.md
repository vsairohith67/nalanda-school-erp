# Proposed Staging Deployment Architecture

Status: design only; nothing is deployed.

## Recommended topology

```text
Internet later
  -> staging.nalandaps.com (future DNS approval only)
  -> Caddy/nginx on 443 (TLS, HSTS, limits, sanitized forwarding)
  -> 127.0.0.1:3000
  -> one Next.js Node process
  -> local persistent SSD /srv/nalanda-staging/data
       database/staging.db (+ journal/WAL/SHM)
       private/fee-register-ocr/
       backups/json/
       backups/encrypted/
       temp/cloud-backup/
       temp/restore-rehearsal/
```

Use a dedicated unprivileged deployment/service account. The app release is read-only to the service except framework runtime needs; the data root is writable only by the service account. The Node listener binds to loopback, so clients cannot bypass the proxy or spoof trusted forwarding headers.

## Release and process contract

- `/srv/nalanda-staging/releases/<UTC>-<short-commit>/` contains immutable source/build/dependencies.
- `/srv/nalanda-staging/current` is an atomic symlink to the selected release.
- `/srv/nalanda-staging/data` persists independently of releases.
- `/etc/nalanda-staging/environment` (or the provider secret store) contains mode `0600` environment values; it is never in Git or a release archive.
- systemd runs one `pnpm exec next start --hostname 127.0.0.1 --port 3000` process, restarts on failure with bounds, and captures stdout/stderr.
- `flock` or the platform's equivalent serializes deploy, migration, backup, restore, cleanup, and scheduled singleton jobs.

## HTTPS, hostname, and Google Workspace boundary

The intended name is `staging.nalandaps.com`, but DEVOPS-1C does not create it. A later DNS change should add only the approved staging host record after exporting the current zone. It must not edit, delete, or replace Google Workspace MX, SPF, DKIM, DMARC, verification, or unrelated records. `nalandaps.com` and `www.nalandaps.com` remain untouched.

TLS terminates at the managed ingress or Caddy/nginx. HTTP redirects to HTTPS. HSTS begins on the staging hostname after HTTPS is verified; do not preload or broaden HSTS to unrelated subdomains in this phase. The application requires secure `__Host-` session cookies, strict SameSite, and sanitized single-hop forwarding.

## Persistence and backup

- SQLite and all sidecars reside on the same local persistent volume.
- OCR/private assets and all backup/temp/rehearsal directories are configured under `STAGING_DATA_DIR` and checked by `pnpm deployment:env-check`.
- Nightly infrastructure snapshots are supplementary. The primary recovery artifact is a validated, encrypted application/SQLite-consistent backup, later copied off-host to an approved destination.
- Backups never live only on the same disk. Until an off-host destination is approved, actual external staging is not disaster-recovery complete.

## Deployment/migration/rollback

Deployment pulls an exact commit/tag, installs with frozen lockfile, validates, tests/builds in a new release, backs up staging data, enables maintenance, stops the old writer, runs one `prisma migrate deploy`, starts the new release, and performs liveness/protected-page/smoke checks. Migration status and backup IDs are logged without private contents.

Code rollback atomically returns `current` to the previous release and restarts. If the schema is not backward compatible, code rollback alone is prohibited; restore the paired pre-migration backup in maintenance mode, verify integrity/reconciliation, then start the previous release. Never attempt an automatic down-migration.

## Health, monitoring, and maintenance

- `/api/deployment-health` is a non-mutating liveness probe with `private, no-store` and no business data.
- An authenticated/scheduled deep readiness probe checks DB read, disk headroom, backup age, and singleton-worker health without mutation.
- External uptime checks, central immutable redacted logs, CPU/RAM/disk/DB size alerts, backup-age alerts and 5xx/auth-failure alerts are required before staging opens to testers.
- Maintenance mode returns 503/Retry-After at ingress, while operator access remains local/SSH only.

## Staging isolation

- Separate hostname, instance, SQLite file, data root, secrets, encryption keys, users, logs, monitoring labels, backups, and provider profiles.
- Synthetic data only. No real contacts, finances, documents, Schoolknot exports, biometrics, or location data.
- All live WhatsApp/SMS/Email/AI/OCR/cloud-backup/payment providers remain disabled. Only deterministic/mock/local encrypted paths may run.
- No automatic promotion or deployment to production. Staging release identifiers start `staging-`; production identifiers are rejected by the validator.
