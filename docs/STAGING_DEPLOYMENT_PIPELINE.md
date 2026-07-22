# Staging Deployment Pipeline

Design only. There is no automatic production deployment.

## Directory layout

```text
/srv/nalanda-staging/
  releases/<YYYYMMDDTHHMMSSZ>-<short-commit>/
  current -> releases/<release-id>/
  previous -> releases/<previous-id>/
  data/{database,private,backups,temp}/
  locks/{deploy,backup,scheduler}.lock
  logs/                  # service-manager spool only; shipped/redacted
/etc/nalanda-staging/environment   # root/service readable, mode 0600
```

Release IDs are immutable and begin `staging-`; the deployment log records full Git commit/tag, lockfile hash, build ID, migration status and backup artifact ID.

## Pipeline gates

1. Fetch the private repository and check out the exact approved commit/tag; verify signed transport/remote and clean tree.
2. Create a new immutable release directory. Install with `pnpm install --frozen-lockfile`.
3. Run `pnpm git:safety-check` and reject credentials/private runtime artifacts.
4. Load staging secrets without echo; run `pnpm deployment:env-check`. The release directory must not contain `.env`; the host injects the validated environment from its secret store.
5. Run typecheck, full tests, production build, route inventory and migration inventory/schema checks. Use a bounded 4 GB heap only if default memory fails.
6. Acquire the deploy singleton lock. Create and validate the pre-migration staging backup.
7. If the release changes migrations, enable ingress maintenance, stop the one Node writer, and require zero remaining DB owners.
8. Run `prisma migrate deploy` once, then `prisma migrate status`. Never run `migrate dev`, `db push`, or `migrate resolve` automatically.
9. Point `current` to the new release and start exactly one service instance.
10. Check `/api/deployment-health`, anonymous login page, protected redirect/API 401, secure headers/private cache, database read/synthetic login, PWA manifest/service worker, and no 5xx burst.
11. Exit maintenance only after all checks pass. Retain the previous release via `previous` and keep the paired pre-migration backup.
12. On failure, execute the declared code-only or code+database rollback automatically while maintenance remains active.

## Failure and retention policy

- Any unknown env, secret, provider, database path, branch/commit, migration, backup, or health result is a hard stop.
- Maximum planned migration downtime: 10 minutes. At 8 minutes, stop forward work and prepare rollback; at 10 minutes, roll back unless the incident owner explicitly extends staging maintenance.
- Retain the last 3 built releases and last known-good release; daily backups 14 days, weekly 8 weeks; deployment/migration logs 90 days; security/audit policy may require longer.
- Failed releases never receive traffic again without a new approval. Partial releases are quarantined then deleted after evidence retention.
- No pipeline trigger targets `main` production, `nalandaps.com`, provider live activation, or DNS.

## Managed-container adaptation

If the fallback platform cannot access the persistent disk during build/pre-deploy, build the image first, then stop the old disk owner and run a runtime entrypoint that acquires the singleton lock, backs up, migrates, and starts. Because a disk-backed Render service cannot do zero-downtime deploys, brief maintenance is expected. Never run a separate migration job that mounts or concurrently opens the same SQLite disk unless the provider guarantees exclusive ownership.
