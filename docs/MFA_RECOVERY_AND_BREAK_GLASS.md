# MFA Recovery and Break-Glass

No live recovery provider or helpdesk bypass is activated. Recovery is a governed identity-security event, not a silent factor reset.

## Standard recovery

1. The affected user or an authorised IAM actor creates a request with factor type and bounded reason.
2. A different authorised reviewer records human identity/device-loss evidence and advances `REQUESTED` to `REVIEWED`.
3. A third, different authorised approver performs fresh action-bound MFA step-up.
4. The transaction marks the request approved, revokes the selected factor and all unused recovery codes, revokes web/native sessions and Offline Sync devices, increments credential/authorisation versions, and locks the account pending re-enrolment.
5. Privacy-safe security events retain requester, reviewer, approver, timestamps, factor type and reason without a secret or recovery answer.

The subject cannot review or approve their own request. The requester, reviewer and approver cannot collapse to one person; approval of an unreviewed request fails. Concurrent/replayed decisions use state-conditional updates and fail closed.

## Break-glass boundary

There is no one-click break-glass override in 1A. Any future emergency process must be separately approved, time-bounded, limited to named leadership, require independent post-event review, alerting and full audit, and may not suppress last-Super-Admin protection. Until that exists, use the three-person recovery contract or an already-enrolled factor/recovery code.

Recovery-code use is itself recorded and the code is atomically consumed. Regeneration revokes the older set. Codes and evidence secrets are never logged or exported in plaintext.

