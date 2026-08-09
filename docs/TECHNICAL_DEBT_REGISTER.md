# Technical debt register

| ID | Item | Status / next gate |
| --- | --- | --- |
| SUPPORT-TD-01 | Legally approved support privacy/retention/terms text is unavailable | `DRAFT_PENDING_APPROVAL`; qualified review before publication or purge policy |
| SUPPORT-TD-02 | Live external notification providers are disabled | Intentional; separate provider approval, DPIA/security and staging gate |
| SUPPORT-TD-03 | Malware scanning is limited to safe local structural/active-content refusal | Evaluate an approved private scanner before production if operational policy requires it; no external file processing |
| SUPPORT-TD-04 | Academic Calendar target calculation uses published school-wide days plus weekday fallback | Confirm office hours and holiday completeness during operational policy approval |
| SUPPORT-TD-05 | No destructive retention purge exists | Intentional in SUPPORT-1A; require preview, hold protection, backup and exact approval in a future phase |
| OBS-TD-01 | External monitoring and analytics providers are not configured | Intentional local-only boundary; separate deployment, privacy, procurement and provider-activation approval required |
| OBS-TD-02 | Release manifests depend on governed release metadata injection | Keep the state `UNKNOWN` when commit/build metadata is absent; add it only in an authorised release pipeline |
| OBS-TD-03 | Restore-rehearsal freshness is unknown until a durable rehearsal record exists | Backup existence is never recovery proof; retain the warning until isolated restore evidence is recorded |
| OBS-TD-04 | Client-version policy is advisory only | Forced reload, lockout and deployment cutover remain unauthorised in OBS-1A |
