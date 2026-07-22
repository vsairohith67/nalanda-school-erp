# DEVOPS-1C-QA Independent Staging Readiness Report

Date: 2026-07-23 IST. Scope: independent review of pushed feature commit `6372273e4a43b21a4363929d7a42d16d18833d9b`, followed by corrections on the same feature branch. No live deployment was authorised or performed.

## Preflight and independent decision

The feature branch matched its upstream, the working tree was clean, the GitHub repository was private, `origin/main` remained `a0f84455705bf9fbe8d57150f92db580501744ce`, and Git safety plus operational-integrity checks passed. The recommendation remains a single 2 GB-class Linux VPS in Mumbai with loopback Next.js, Caddy/nginx, one local persistent SSD and off-host encrypted backup. The fallback remains a managed container in Singapore with exactly one paid persistent disk and one instance. Serverless, ephemeral-disk platforms, multiple instances, network-filesystem SQLite and scale-to-zero with disposable storage remain rejected.

SQLite result remains `SQLITE_STAGING_ACCEPTABLE_WITH_RESTRICTIONS`: one writer instance, one local persistent volume, no concurrent migrations, serialized backup/restore/jobs, maintenance during restore, non-mutating health, and synthetic data only. A managed client/server database is required before horizontal/multi-region production design, but PostgreSQL migration is outside this phase.

## Defects found and corrected

1. The environment validator rejected `.env` but not all Next release-local `.env*` variants. It now rejects `.env.local`, `.env.production`, `.env.production.local` and every other `.env.*` file except the safe `.env.example` outside the explicit local rehearsal.
2. `NEXT_PUBLIC_PWA_BUILD_VERSION` was documented but not fail-closed. It now requires a staging-prefixed identifier and rejects production mixing; focused tests cover it.
3. The environment matrix omitted six rehearsal-only variables. It now classifies the transient synthetic password/opt-in and local HTTPS port/PFX variables, including owner, secret handling and external-service prohibition.
4. The first rehearsal retained a `Set-Cookie` token in an ignored header artifact and left disposable PFX files. The script now parses headers in memory, persists only a redacted cookie value, deletes request JSON immediately and deletes the PFX in `finally`. The earlier artifacts were removed.
5. The systemd template used a weaker filesystem boundary than the architecture claimed. It now starts the explicit Node/Next CLI, uses `ProtectSystem=strict`, marks releases read-only and grants writes only to data/lock roots.
6. Next image/runtime cache writes were not fully reconciled with immutable releases. The plan now uses a build-specific `.next/cache` symlink into disposable data-root cache, excludes it from backups and never shares it across build IDs.

## Independent local rehearsal

A new ignored `tmp/devops1c/qa-independent/` root was created. A zero-byte SQLite target received `prisma migrate deploy`; `prisma migrate status` was clean with `20260722_clean_install_baseline`. The validator, synthetic seed and synthetic verifier passed with one Student, one active enrollment, zero Payments and ₹0 collected. A version-37 synthetic backup was validated.

The current production build ran on `127.0.0.1:3201` behind a disposable self-signed HTTPS proxy on `127.0.0.1:3543`. Health returned 200/no-store/HSTS, a protected page redirected 307 to the staging origin, a private API returned 401/no-store, static assets were immutable, and login produced redacted evidence of a Secure/HttpOnly/SameSite=Strict cookie. Database hash stayed stable across stop/restart. Rollback started distinct build `8maN2Sqm7ZgE--2bX7Xwj` and returned the login page. Both ports closed, the PFX/request file were absent, and the persisted cookie value was `[REDACTED]`.

## Plans verified

- Database deployment uses fresh synthetic SQLite, `prisma migrate deploy`, clean status, immediate backup, maintenance, a paired pre-migration backup and code-or-code-plus-database rollback. The operational database remains unonboarded.
- TLS/proxy/cache requires HTTPS-only ingress, HSTS after certificate proof, secure host-only cookies, sanitized single-hop forwarding, validated `APP_ORIGIN`, request/upload limits, no wildcard CORS, brute-force controls, private no-store and immutable content-hashed assets.
- Monitoring/logging specifies immutable central collection, retention, redaction, uptime/CPU/RAM/disk/DB/backup-age/5xx/login/PWA alerts, and prohibits credentials, cookies, Student records, phones, marks, fees and document contents.
- Singleton scheduling keeps external WhatsApp/SMS/Email/AI/OCR/cloud-provider/payment work disabled; backup, cleanup and restore operations require locks and safe retries.
- Android/iPhone PWA plans cover install/home-screen, standalone launch, authentication, updates, offline shell, private-cache inspection and uninstall. Physical certification remains blocked until approved trusted HTTPS staging exists.
- The cost register covers compute, persistent storage, backup, logs, monitoring, DNS/TLS, bandwidth, region/egress/renewal risk and continuous-versus-scheduled uptime. No purchase is represented as complete.

## Remaining user decisions and boundary

The user must still approve provider/region, budget/billing owner, hostname, named access, off-host backup destination, immutable logging/monitoring provider, uptime schedule and operating/support owners. Central immutable logging and off-host backup must exist before external testers receive access. A copied-operational-data rehearsal requires a separate written privacy/maintenance approval and is not part of this result.

No cloud resource/account, paid subscription, public endpoint, tunnel, DNS/Google Workspace change, operational database upload/onboarding/migration, production secret or live provider activation occurred.

## Regression closure

The independent regression passed 274 page routes, 377 API routes, lifecycle dry-run, migration inventory/fresh/schema checks, deployment environment validation, typecheck, 1,473 tests across 162 files, and a bounded synthetic-only production build with 211/211 static pages. Final operational backup is version 37 `nalanda-fee-control-backup-2026-07-23-04-38.json`. Git safety passed and operational database/schema/migration hashes, size, normalized timestamp, absent migration metadata and 8/8/19/₹99,100 baseline stayed exact. Technical QA is cleared; repository release closure still requires the prescribed clean feature push, fast-forward main merge and annotated tag.
