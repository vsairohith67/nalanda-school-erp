# STAGE-1A Private Staging Security Plan

Evidence date: **2026-08-15**. This document designs a synthetic-only private environment. It does not create a host, account, secret, DNS record, deployment, user, or provider configuration.

## Security decision

Use one 4 GB India-region Linux VM, one Node process, one persistent local volume, HTTPS, and **two independent access layers**:

1. a host/reverse-proxy network allowlist for approved school/administrator egress addresses; and
2. a separate named staging access gate before ERP authentication.

This is the conservative default because it does not require delegating DNS or identity to another vendor and it fails closed before the application is exposed. If approved operators do not have stable egress addresses, use a mesh VPN as the next choice and keep the public service firewall closed. No Student or Parent access is permitted in private staging.

## Environment separation

| Boundary | Required staging control |
| --- | --- |
| Database | New synthetic-only SQLite file; never copied from the operational database except a separately authorized, privacy-reviewed future procedure |
| Private files | New empty durable root for admissions, classwork, onboarding, payslip requests, support, and OCR; never reuse operational paths |
| Secrets | New staging-only values in provider/systemd environment storage, generated after authorization; never source-controlled, logged, copied from production, or written in planning docs |
| Accounts | Fresh named synthetic operator accounts; no public Student/Parent accounts and no real-user activation |
| Network | Default-deny host firewall; SSH from named operator source/VPN only; HTTPS reaches access gate before Next.js |
| Providers | Email, SMS, WhatsApp, Push, payment, AI, and cloud OCR remain disabled/fail-closed; no live API key exists in staging |
| Releases | Only the verified RC/release archive; previous verified release retained for rollback; no auto-deploy from `main` |

## Mandatory visible and HTTP controls

- Display a persistent, high-contrast **STAGING — SYNTHETIC DATA ONLY** banner on every page, including login and error pages.
- Send `X-Robots-Tag: noindex, nofollow, noarchive` on every response and serve `robots.txt` with `User-agent: *` and `Disallow: /`. Robots instructions are defense in depth, not access control.
- Send `Cache-Control: private, no-store` for authenticated, user-specific, error, and staging-gate responses. Do not let CDN/shared caches store them.
- Require HTTPS. Use Caddy automatic certificate provisioning on a VM after approved DNS, or the selected platform's managed TLS. Redirect HTTP to HTTPS and enable the repository's cleared security headers.
- Cookies must be `Secure`, `HttpOnly`, and use the strictest compatible `SameSite` policy; staging and production cookie names/domains must not overlap.
- Reject requests before Next.js unless the source passes the approved network/VPN policy and the named staging gate. ERP authentication remains a separate inner control.
- Do not expose directory listings, database/private-file paths, source maps containing private internals, framework debug routes, or provider consoles.

Reference: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), and the existing [Staging TLS, proxy, and security headers plan](STAGING_TLS_PROXY_AND_SECURITY_HEADERS.md).

## Private-access options

| Option | Strengths | Limits / new dependency | Conservative use |
| --- | --- | --- | --- |
| **IP allowlist + named staging gate** | Two layers; provider-independent; low cost; public TLS works normally; auditable at proxy and app | Stable operator egress IPs required; emergency access procedure needed; password/credential lifecycle remains local | **Recommended default** when school/admin IPs are stable. Allow only named operators, rate-limit, MFA on ERP where supported, and deny all Student/Parent access. |
| **Mesh VPN (for example Tailscale) + named staging gate** | Service can be closed to the public internet; device/user revocation; supports roaming operators | Adds an identity/network provider and device enrollment; public custom-domain/DNS/TLS design may need split DNS or DNS challenge; provider approval required | **Recommended fallback** for dynamic IPs. Keep ports closed publicly and document device removal. Official concepts: [Tailscale access control](https://tailscale.com/kb/1018/acls). |
| **Cloudflare Access + application gate** | Identity-aware edge gate, MFA/policy options, hides origin when configured correctly | Adds Cloudflare account, DNS/proxy, identity-provider, log, and lock-in decisions; requires separately approved cloud/DNS changes | Safe only if the user explicitly selects it and STAGE-1B authorizes the extra provider. Official guide: [Cloudflare Access applications](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/). |
| **HTTP Basic Auth alone** | Simple reverse-proxy control | Shared credentials, weak lifecycle/auditability, browser caching, and no device policy | **Rejected as the sole gate.** It may supplement, never replace, the named gate and network control. |
| **Unlisted public URL / robots only** | No setup | URLs leak; search controls are voluntary; no authentication | **Rejected.** |

No option may store credentials in Git, documentation, screenshots, logs, external status systems, or chat.

## SQLite and persistent-volume controls

The cleared V1 topology is unchanged:

1. exactly one writable Node process opens the SQLite database;
2. the DB and any journal/WAL/SHM files live on the same locally mounted persistent SSD as the configured private-file root;
3. no NFS, SMB, object-store-mounted filesystem, serverless scratch disk, horizontal writer, scale-to-zero, or multi-region writer;
4. migrations, backups, singleton jobs, and restores use one exclusive lock;
5. a release enters maintenance mode, stops the writer, captures a matched backup, runs migration exactly once, verifies, then starts exactly one process;
6. restore enters maintenance mode, stops all writers/jobs, retains the failed state, restores DB and matching private assets, verifies integrity/reconciliation, then reopens access.

Provider disk snapshots are only an infrastructure recovery aid. Render explicitly warns against snapshot restore as database recovery for custom databases; use application-consistent SQLite backups and a validated restore. Sources: [SQLite WAL](https://sqlite.org/wal.html) and [Render persistent disks](https://render.com/docs/disks).

## Backup and restore design

- Daily application-consistent backup of SQLite plus a manifest identifying the matched private-asset checkpoint.
- Recommended staging retention: 14 daily and 8 weekly restore points; user may choose a shorter controlled minimum in the [decision sheet](STAGE_1A_USER_DECISION_PACKAGE.md).
- Encrypt off-host copies after a destination is approved; credentials must be separate from the host and least-privileged.
- Record hash, size, backup version, migration count, schema fingerprint, source release, timestamp, and private-asset manifest. Do not export password hashes to logical backup formats.
- Alert if the last successful backup is older than 26 hours, integrity validation fails, disk reaches 40%, or the off-host copy fails.
- Rehearse a restore before staging acceptance and monthly thereafter while staging is active. The rehearsal uses a disposable target, proves DB integrity and application startup, and is destroyed afterward.
- Target staging RPO: 24 hours maximum. Target host-loss RTO: 4 hours. Target release rollback without data restore: 30 minutes.

## Monitoring and operations

Enable the already-cleared OBS-1A controls without connecting an unapproved live provider:

- external HTTPS availability through the same private access path;
- process restart count, CPU, memory/RSS, disk utilization, file-descriptor pressure, and Node fatal errors;
- 4xx/5xx rates, p50/p95/p99 latency, access-gate denials, and authentication anomaly counts without credentials or personal data;
- `SQLITE_BUSY`, I/O/integrity errors, DB/backup/private-file growth, backup age, and restore-rehearsal age;
- certificate expiry and renewal result;
- release/tag identity and health endpoint result.

Logs must avoid credentials, cookies, tokens, student/staff content, private filenames, payment data, and request bodies. Retention and any external log sink require a later user decision. See [Staging Monitoring and Logging Plan](STAGING_MONITORING_AND_LOGGING_PLAN.md).

## Release and rollback sequence

The later authorized sequence is: verify signed/hashed release identity → close access/maintenance banner → stop the sole process → matched backup → migration status → one migration runner → start one process → synthetic smoke tests → reopen only to allowlisted operators. Never perform a two-instance rolling deploy against SQLite.

Rollback uses the retained previous release, the same single process, and the pre-release matched backup only if schema/data restoration is required. A failed release is kept as evidence; do not overwrite it. See [Staging Database Deployment and Rollback](STAGING_DATABASE_DEPLOYMENT_AND_ROLLBACK.md) and [Staging Deployment Pipeline](STAGING_DEPLOYMENT_PIPELINE.md).

## Acceptance checklist

Private staging is not ready for use until all are proven:

- separate empty DB/private roots/secrets and synthetic account provenance;
- HTTPS and certificate hostname; HSTS only after rollback implications are accepted;
- visible banner, noindex/robots refusal, private/no-store, and secure cookies;
- network/VPN layer plus named staging gate; public Student/Parent denial;
- every live email/SMS/WhatsApp/Push/payment/AI/OCR integration disabled and tested fail-closed;
- one process/writer, persistent local-volume mount, exclusive migration/job lock;
- OBS-1A alerts, daily matched backup, off-host copy, disposable restore rehearsal, and release rollback;
- 2 GB minimum/4 GB recommended resource checks and the proposed upgrade thresholds in the [provider comparison](STAGE_1A_HOSTING_PROVIDER_COMPARISON.md).

Related: [Cost and budget model](STAGE_1A_COST_AND_BUDGET_MODEL.md) · [Domain/DNS change plan](STAGE_1A_DOMAIN_DNS_CHANGE_PLAN.md) · [User decision package](STAGE_1A_USER_DECISION_PACKAGE.md)
