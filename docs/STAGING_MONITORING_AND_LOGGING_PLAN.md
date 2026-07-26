# Staging Monitoring and Logging Plan

No external logging or monitoring account/resource is authorised. Initial attended staging may use privacy-filtered local systemd/Caddy health evidence only. Centralised immutable logging and external alerts are requirements before unattended continuous operation and remain separate hard approval gates.

## Signals and ownership

| Signal | Source | Alert/target | Retention |
| --- | --- | --- | --- |
| Application stdout/stderr | systemd/container | any sustained 5xx/error burst; no private payloads | hot 14 days; central 90 days |
| Security events | auth/rate-limit/proxy/WAF | repeated failures, setup attempts, origin/body rejections | immutable 180 days |
| Audit events | SQLite application audit tables | unexpected privileged action/workflow transition | backup with DB; minimum 1 year or approved policy |
| Deployment/migration | deploy runner + Prisma status | any failed/partial gate | 1 year, append-only |
| Backup/restore | backup worker/CLI | failed backup, verification failure, age >24h active or >48h idle, restore rehearsal overdue | 1 year metadata; artifacts per backup policy |
| Uptime/health | external HTTPS monitor later | two consecutive liveness failures or TLS expiry <21 days | 90 days |
| Host CPU/RAM/load | host/provider metrics | CPU >85% 15m; RAM >85% 10m; OOM immediate | 90 days |
| Disk/DB | host agent + safe DB size probe | disk >70% warn/>85% critical; abnormal DB growth; I/O/lock/integrity errors | 180 days |
| HTTP | proxy access log/metrics | 5xx >2% 5m, p95 >2s, 429 anomaly, upload 413 anomaly | 30 days raw metrics; 90 days aggregates |
| Provider health | DB profiles/health jobs | any unexpected LIVE mode; mock/local worker failure | 90 days safe metadata |
| PWA | client-safe version/update telemetry later | repeated install/update failures by build, no user/private identifiers | 30 days aggregate only |

## Redaction contract

Never log passwords, tokens, secret values/names paired with values, Authorization/Cookie/Set-Cookie headers, session payloads, full Student/staff/guardian records, full phone/email/address/Aadhaar, marks, ranks, fee balances/payments/receipt contents, uploaded document/image contents, provider payloads, OCR text/images, SQL query values, backup plaintext, or stack traces containing environment/path values.

Allow safe fields only: UTC timestamp, severity, service/environment/release, route template (not raw query), HTTP status, duration bucket, correlation ID, actor role and irreversible truncated hash when justified, safe error code, byte/count aggregates, backup key version/artifact hash, migration ID, and redacted source hash. Access logs must drop query strings and sensitive headers; phone/email logging uses no full value.

## Pipeline

1. App emits structured single-line JSON to stdout/stderr through a redaction wrapper; no direct mutable log file dependency.
2. Service manager journals locally with size/time caps and permissions.
3. Only after explicit provider/cost/data/retention approval, a staging-only agent may ship over TLS to a separate immutable append-only sink.
4. Alerts notify named operators; messages contain safe codes/links, never records.
5. Monthly access/retention review and quarterly restore/security-log sample audit.

The current app mostly emits console errors and durable database audit events; a consistent structured logger/central sink is therefore a remaining prerequisite, not a completed feature. Until it is approved and verified, staging is supervised-only and not ready for unattended continuous operation.

## Incident response

On suspected secret/private-data logging: restrict sink access, stop affected emitter, rotate implicated secrets/sessions, preserve immutable evidence, identify viewers/exports, purge only under approved retention/legal process, document exposure scope, and add a regression test. Never solve the incident by deleting all audit evidence.
