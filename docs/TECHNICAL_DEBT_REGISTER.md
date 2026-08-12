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
| IMPORT-TD-01 | Real school onboarding has not been rehearsed or authorised | Require a separate approved maintenance/import phase with fresh backups, named operators, reconciliation and rollback gates |
| IMPORT-TD-02 | Structural OOXML refusal is local and does not include a third-party malware engine | Evaluate an approved private scanner before production if policy requires it; never transmit workbooks externally without approval |
| IMPORT-TD-03 | Partial-import and bulk update modes are intentionally absent | Keep V1 all-or-nothing create/link; require a separately authorised correction template and compensating-change model |
| RC-TD-01 | Classes I-X correction register is incomplete | Freeze the 29 confirmed items; do not implement R5 or regenerate physical packs until the user confirms the full list |
| RC-TD-02 | R4.2 packs include KG and predate final Classes I-X corrections | Preserve as ignored technical evidence with `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS`; never print for V1 acceptance |
| RC-TD-03 | KG/LKG/UKG operational activation and physical acceptance are deferred | Preserve implementation under `IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5`; keep `kg-report-cards-v1-5` default-off until a separately authorised V1.5 phase |
| RC-TD-04 | Parent-facing grade-band boundary format is undecided | Preserve exact underlying scale boundaries; wait for explicit display-format approval before R5 |
