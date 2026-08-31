# Synthetic Pilot Backup and Restore Rehearsal

**Result:** `SYNTHETIC_PILOT_BACKUP_RESTORE_PASSED`
**Backup format:** v44
**Data boundary:** generated synthetic fixture only; no operational database or real private object was read or written.

## Reconciliation

The governed logical backup restored twice into a freshly migrated disposable database. The second restore was count-idempotent. Source and restored values matched:

| Evidence | Source | Restored |
| --- | ---: | ---: |
| Students | 800 | 800 |
| Payments | 801 | 801 |
| Non-cancelled collection total | 4,272,000 | 4,272,000 |
| Student attendance records | 800 | 800 |
| Staff attendance records | 80 | 80 |
| Marks | 20 | 20 |
| Issued report cards | 20 | 20 |
| Immutable report versions | 20 | 20 |
| Immutable report events | 20 | 20 |
| Support requests | 12 | 12 |
| Parent Meetings | 40 | 40 |
| Offline mutations | 30 | 30 |
| Native sessions / refresh history | 1 / 1 | 1 / 1 |
| Event Media assets | 1 | 1 |

The restored native session was forced revoked with `RESTORED_CREDENTIAL_REQUIRES_REAUTHORIZATION`; no live credential was reactivated.

## Private object and encryption proof

One generated 1x1 synthetic PNG was placed under the canonical private Event Media key shape. A governed encrypted asset artifact was created in ignored QA storage, decrypted and restored into two isolated roots, and both restored file/ownership digests matched. A random wrong key was refused. The ephemeral key, encrypted artifact, restored private bytes and disposable databases were removed after success; only the non-secret ignored evidence manifest was retained.

## Local rehearsal timings

| Stage | Milliseconds |
| --- | ---: |
| Logical backup | 673 |
| Fresh schema migration | 18,968 |
| First logical restore | 8,907 |
| Idempotent second restore | 5,538 |
| Private asset backup plus two restores | 96 |
| Whole rehearsal | 35,039 |

These measurements are local synthetic rehearsal observations, not production RTO or SLA commitments. Production RPO/RTO remains an external operational decision requiring a private destination, durable key custody, scheduler, monitoring and recovery owner.
