# Admissions CRM Threat Model

| Threat | Control |
|---|---|
| Public enumeration/spam | Generic 202 response, consent, honeypot, source throttle, idempotent request hash, no listing/upload |
| Invitation theft/replay | 256-bit random token, hash-only storage, expiry, single use, attempt limit, newer-token invalidation, no URL token |
| Cross-family access | Exact token-hash-to-application binding and exact document/application ownership |
| Role escalation | Effective IAM permission plus service role/object checks; Teacher exact assignment; Accountant deny; no self-grant |
| File attack | Strict allowlist, MIME/magic/structure/size/dimension checks, animated/executable rejection, opaque keys, symlink/traversal refusal, SHA-256 |
| Lost/corrupt assets | Encrypted container, bounded manifest, two isolated restores, wrong-key/corruption refusal before `VERIFIED` |
| Duplicate corruption | Exact suggestions only, no fuzzy auto-merge, opaque references, human reason, append-only resolution |
| Double admission | Transaction, compare-and-set number allocation, unique lineage/request constraints, idempotent retry |
| Partial conversion | Forced-failure transaction rollback across all created rows |
| History tampering | Database triggers forbid update/delete of decisions, conversions, versions, duplicate resolutions and events |
| Spreadsheet injection | Bounded aggregate-only export and formula-safe CSV cells |
| Retention overreach | Review dates and preview-only workflow; no invented duration or automatic deletion |

Residual production risks are policy approval, operator error, token handling outside the application, backup-key custody and unapproved real-data onboarding. Deployment/live providers remain outside Prompt 23H.
