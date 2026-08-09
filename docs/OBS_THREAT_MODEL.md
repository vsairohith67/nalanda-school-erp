# OBS-1A Threat Model

| Threat | Control |
| --- | --- |
| Secret/PII leakage through logs or notes | key rejection, text redaction, bounded safe fields, no raw payloads |
| Broad role access | exact server permissions; summary/detail/action separation |
| Alert storm | stable fingerprint, occurrence counter, notification only on new/reopened critical cycle |
| Hidden corruption during maintenance | protected checks cannot be silenced/suppressed |
| Lost concurrent update | expected-version `updateMany` claims |
| Timeline tampering | append-only event tables and no delete routes |
| Dashboard-triggered outage | bounded manual checks, rate limit, no repair/restore/provider calls |
| Backup as false assurance | independent restore-rehearsal status and restore-twice evidence |
| Employee surveillance | aggregate adoption only; no clickstream or user ranking |
| External telemetry drift | no external telemetry/provider activation in this phase |

Residual risks: process-down monitoring cannot be supplied by an in-process local-only application; physical disk failure requires protected external backup handling; production alert delivery and infrastructure telemetry require a separately authorised deployment phase.
