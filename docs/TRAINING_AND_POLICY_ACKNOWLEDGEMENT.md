# Training and Policy Acknowledgement

Readiness provides a lightweight versioned prerequisite contract, not a learning-management system and not final legal wording.

Machine-readable training requirements are attached to the approved role templates. Modules cover relevant combinations of account security, role boundaries, privacy, Student data, finance safety, Academic Integrity/marks, linked-child privacy, phishing, lost device, incident reporting, Offline Sync and biometric governance.

The designed lifecycle is `NOT_ASSIGNED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `EXPIRED` and `WAIVED_WITH_REASON`. Durable acknowledgements bind a user to an exact module/version and record assignment, completion, optional expiry, bounded acknowledgement and any separately approved waiver. A candidate-controlled checkbox cannot fabricate server-owned completion.

Activation queries the approved request's required module keys and verifies current completion records. Each module must first be opened through the authenticated activation session; the server returns the exact active module/version content and records `IN_PROGRESS`. Completion requires the same server-bound module handle after the minimum reading interval and then records `COMPLETED`. A checkbox alone cannot create completion evidence. Missing, stale, skipped, or expired mandatory training prevents activation. A new required version can require re-completion.

Policy acknowledgements are independently versioned for acceptable use, confidentiality/privacy, account-sharing prohibition, incident reporting and role-specific responsibility. Current copy is explicitly synthetic/draft; it is not represented as School-approved legal text. A new policy version may require re-acknowledgement before continued privileged access under a future operational policy.

Waiver is exceptional: it needs a bounded reason, authorised approver, expiry where appropriate and audit. It must never silently bypass mandatory privileged-role MFA or immutable authorisation denials.
