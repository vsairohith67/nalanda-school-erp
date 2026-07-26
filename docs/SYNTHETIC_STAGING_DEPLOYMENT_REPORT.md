# Synthetic HTTPS Staging Deployment Report

Status: `PAYMENT_GATED_DEFERRED`

DEVOPS-1D actual deployment did not occur. Only no-cost local synthetic preparation and rehearsal were completed. DEVOPS-1D is not complete, DEVOPS-1D-QA has not begun, and DEVOPS-1D-QA is not safe to begin. This report is a privacy-safe deployment record template plus the evidence available before any provider account, payment method or billable resource exists.

## Approvals and cost

| Item | Current result |
| --- | --- |
| AWS | Excluded; no resource created |
| Replacement provider | Not approved; Vultr Mumbai is the current technical recommendation |
| Billable approval | Not received |
| Provider account/payment method | Not created or linked |
| Proposed compute | Vultr 1 vCPU, 2 GB RAM, 55 GB SSD, 2 TB transfer; USD 10/month before tax/FX, subject to supervised console confirmation |
| Conservative initial envelope | USD 12/month before tax/FX: USD 10 compute plus USD 2 transfer contingency |
| Extra disk/reserved IP/snapshot/automatic backup | Not authorised |
| External backup/monitoring/logging | Not authorised |

Nothing billable may be created until the user receives a plain-language explanation of the account, VPS, SSD, IP, transfer, DNS, TLS, backup, monitoring, tax/FX and deletion model and then explicitly approves the exact console total.

## Planned deployment identity

- Hostname: `staging.nalandaps.com` (proposed only; no DNS change).
- Provider/region/plan/resource name/public IP/creation time: pending approval and creation.
- Source repository: private `vsairohith67/nalanda-school-erp`.
- Approved source checkpoint: main commit `44ab30bde1298035b58fcce0a8aacc6ea9c95705`, tag `staging-readiness-v37-2026-07-23`.
- Feature branch: `devops/synthetic-staging-deployment`.
- Operating system and Node/pnpm versions: pending server verification.

## Planned architecture and hardening

- One supported Ubuntu LTS VPS, one loopback-only Next.js Node process, Caddy and systemd; no horizontal scaling, load balancer or managed database.
- Immutable releases under `/opt/nalanda/releases`, atomic `/opt/nalanda/current`, persistent SQLite under `/var/lib/nalanda/data`, private uploads under `/var/lib/nalanda/uploads`, backups under `/var/lib/nalanda/backups`, disposable Next cache under `/var/cache/nalanda/next`, redacted logs under `/var/log/nalanda`, and root-owned mode-`0600` `/etc/nalanda/staging.env`.
- Non-root deployment access, a separate unprivileged service account, key-only SSH after a second shell is verified, firewall, security updates, NTP, limited sudo and brute-force protection remain pending the approved VPS.
- The reviewed systemd baseline bounds tasks/memory, removes capabilities and grants writes only to declared persistent/cache/log/runtime paths.
- The reviewed Caddy 2.10+ template sanitizes proxy headers and applies 5 MiB generally with one exact 26 MiB OCR upload exception. Raw access logging is disabled until route/query/header redaction is approved.

## Database and synthetic-data boundary

- Database path classification: fresh synthetic SQLite only; the eventual path is `/var/lib/nalanda/data/database/staging.db`.
- Required migration: `20260722_clean_install_baseline`.
- Required fixtures: `QA-DIRECTOR`, `QA-PRINCIPAL`, `QA-TEACHER`, `QA-PARENT`, and `QA-STUDENT`, using only `.invalid` email addresses and non-routable phone placeholders.
- The seed requires four different strong temporary passwords injected only for the command. Values must never be printed or stored in Git/docs/logs/chat and must be removed immediately afterward.
- Migration deploy/status, synthetic proof, persistence restart, local encrypted backup, disposable restore and rollback rehearsal are pending the approved server.
- `prisma/dev.db`, operational backups, Schoolknot data, real identifiers, fee/marks/attendance/documents/photos and operational onboarding remain prohibited.

## DNS, HTTPS, access, backup and monitoring

- DNS record: not added. Root, `www`, Google Workspace MX/SPF/DKIM/DMARC and verification records are unchanged.
- TLS/certificate/redirect/HSTS/CSP/secure-cookie/proxy checks: pending DNS and server approval.
- Access restriction: named synthetic accounts with no public registration; pending server verification.
- Backup: off-host destination not approved. The later minimum is an encrypted local synthetic backup plus disposable restore proof; this is insufficient for unattended or long-term staging.
- Monitoring/logging: no external resource approved. Until approved and verified, staging is supervised-only and not ready for unattended continuous operation.

## Verification and rollback

- Local pre-flight and the provider-neutral post-change regression passed on the feature branch.
- Routes/APIs: 274 page routes and 377 API routes.
- Lifecycle dry run: 8 active students scanned, 8 already enrolled and 0 changes.
- Migration inventory, fresh-install migration and schema-equivalence checks passed.
- Fail-closed deployment environment validation, typecheck and Git safety passed.
- Fresh synthetic rehearsal passed migration deploy/status, environment validation, idempotent seed and exact synthetic-only verification with 4 users, 1 Student, 1 active enrollment, 1 Guardian, 1 Staff member and 0 Payments. The temporary database was removed and no secret value was printed.
- Tests/build: 1,477 tests across 162 files passed; the optimized build generated 211/211 static pages.
- No-cost preparation closure verification on 2026-07-26 passed 274 page routes, 377 API routes, 1,477 tests across 162 files, 25 staging/environment checks, 8 clean-install migration checks, typecheck, the synthetic rehearsal, and an optimized 211/211-page build.
- Final local operational backup: version 37 `nalanda-fee-control-backup-2026-07-26-10-44.json`. It remains ignored and local and is prohibited from staging.
- VPS smoke tests, role/browser QA at 390×844, HTTPS privacy/cache checks, no-5xx proof, release rollback and synthetic database persistence are pending.

## Operational database integrity

The operational database remains prohibited from every staging command. The post-change integrity check passed with SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`, size 4,771,840 bytes, timestamp `2026-07-19T13:21:15.353Z`, 8 Students, 8 active enrollments, 19 Payments, INR 99,100 collected, schema SHA-256 `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`, migration SQL SHA-256 `E6D467206CFA536487C8C63882D13BA489C0235BE74E9E076423323A511C3025`, active migration `20260722_clean_install_baseline`, no `_prisma_migrations`, and backup version 37.

## Remaining gates

1. Explain provider and cost concepts; obtain replacement-provider/account pre-flight approval.
2. Privately create/sign in to the provider account without exposing credentials.
3. Show the exact recurring console total and obtain separate VPS creation approval.
4. Create and harden exactly one approved VPS.
5. Obtain separate approval for the read-only GitHub deploy key.
6. Deploy the exact approved commit, migrate a fresh database and prove synthetic-only fixtures.
7. Obtain separate DNS approval; add only the `staging` A record and verify HTTPS.
8. Prove named-account access, smoke tests, persistence and rollback.
9. Obtain separate off-host backup and external monitoring/logging approvals if desired; otherwise retain supervised-only restrictions.
10. Preserve this no-cost preparation on the feature branch without merging or tagging it. Any future paid deployment requires a new explicit approval and a fresh verification of every applicable gate.

DEVOPS-1D-QA must not begin until all mandatory DEVOPS-1D deployment, HTTPS, synthetic-data, access and rollback checks succeed.
