# Supervised Real-Pilot Go/No-Go Gates

Synthetic clearance is necessary but never sufficient. Every category below must have a named owner, dated evidence and explicit `GO`; otherwise the supervised real-user pilot is `NO-GO`.

| Gate | Required future evidence |
| --- | --- |
| Software | Exact tagged release; zero Critical/High software defects; accepted browser/workflow regression |
| Security | Private repository/artifacts; secret scan; named accounts; MFA/access policy; incident owner |
| Hosting | Approved provider/region/budget/architecture; private staging accepted |
| Database | PostgreSQL target, migration plan, connection/role/backup evidence; no ad-hoc operational conversion |
| Backup | Encrypted off-host destination, key custody, monitoring and restore-twice rehearsal |
| DNS/TLS | Approved hostname, trusted certificate, origin/access policy and expiry owner |
| Real data | Provenance, minimization, dry run, validation, approval, rollback and privacy authorization |
| User accounts | Named identities, verified channels, least privilege, initial-password process and revoke procedure |
| Training | Role attendance, task rehearsal, quick sheets, escalation contact and sign-off |
| Support | Hours, queues, SLA, incident escalation, privacy/retention wording and owners |
| Devices | Inventory, supported browsers, patching, lock/revoke, physical acceptance and lost-device procedure |
| Biometric | Software release compatibility plus separate vendor/hardware/firmware/payload certification; templates excluded |
| Native apps | Private HTTPS, real physical-device certification, signing/distribution and update/rollback evidence |
| Privacy/legal | Approved notices, retention, consent, contracts/DPA and incident-notification advice |
| Rollback | Maintenance window, backups, trigger, owner, legacy fallback, reconciliation and post-rollback access |

No single score, CI run, synthetic backup or emulator build may override a red category.
