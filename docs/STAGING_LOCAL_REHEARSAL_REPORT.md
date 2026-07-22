# DEVOPS-1C Local Staging Rehearsal Report

Date: 2026-07-23 IST. Scope: ignored `tmp/devops1c/` artifacts and synthetic data only. Result: `LOCAL_STAGING_REHEARSAL_PASSED`.

## Evidence

- A new zero-byte SQLite file was created under the ignored root, then `prisma migrate deploy` applied only `20260722_clean_install_baseline`; `prisma migrate status` reported current.
- The environment validator passed without printing secret values. The synthetic verifier proved exactly one `STG-` Student, one active enrollment, one staging user, zero Payments and ₹0 collected.
- A version-37 JSON backup was created from the synthetic database and retained only under the ignored rehearsal root.
- The bounded 4 GB production build completed all 211/211 static pages with `QA20C_ISOLATION_ACTIVE ... operational=false` evidence.
- Next.js ran on `127.0.0.1:3101`; a self-signed, uninstalled, disposable certificate terminated HTTPS at a proxy on `127.0.0.1:3443`. No tunnel or non-loopback listener was used.
- `/api/deployment-health` returned 200 and `no-store`; `/settings` returned a 307 staging-origin login redirect; `/api/students` returned 401 and `no-store`.
- HSTS, CSP, frame denial, referrer and permissions headers were present. Login returned a `Secure`, `HttpOnly`, `SameSite=Strict` session cookie and `no-store`. Static Next assets returned `public, max-age=31536000, immutable`.
- After a successful synthetic login, the exact Node process was stopped and restarted. The synthetic database hash was unchanged across the restart.
- Code rollback started the distinct retained build `8maN2Sqm7ZgE--2bX7Xwj`; its login page returned 200. The tested new build was `ShDqeFFrEOvwufgNZj8Xz`.
- Both processes were stopped by exact PID. Ports 3101 and 3443 were not exposed externally.

## Defects found and corrected during rehearsal

1. Windows `Start-Process` initially split the workspace path at its space. The rehearsal script now quotes both CLI and script paths and always cleans up tracked child PIDs.
2. The synthetic login request initially lost JSON quoting. It now uses a short-lived request file inside the ignored root and removes it immediately.
3. A protected redirect initially inherited the private backend listener origin. Middleware now uses validated `APP_ORIGIN`, with a safe request-origin fallback, and focused tests cover the behavior.
4. A release-local `.env` could inject development seed defaults. The deployment validator now rejects `.env` outside the explicit local rehearsal; staging must inject secrets from outside the release.

## Boundary result

The operational database was never a Prisma target in this rehearsal. Its expected path was supplied only to the existing isolation guard as the forbidden path. No operational data, provider credentials, cloud resource, DNS record, tunnel, payment provider or LIVE message job was used.

This report proves local readiness only. It is not evidence that a staging deployment, public HTTPS certificate, DNS record, immutable logging service or off-host backup exists.
