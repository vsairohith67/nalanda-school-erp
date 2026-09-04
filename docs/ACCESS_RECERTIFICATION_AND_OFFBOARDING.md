# Access Recertification and Offboarding

## Periodic certification

Each activated governed account receives an `AccessCertification` with due date and a snapshot of approved role/scope. Review considers live employment/enrolment/Guardian link, role need, exact scope, MFA, training, inactivity, sessions/devices and temporary grants.

The review vocabulary is `REVIEW_DUE`, `REVIEW_IN_PROGRESS`, `RECERTIFIED`, `REDUCE_ACCESS`, `SUSPEND`, `REVOKE` and `EXPIRED`. The current service accepts explicit retain/modify/revoke decisions with bounded reason from an authorised actor other than the subject and requires action-bound step-up. Retain schedules the next review; revoke calls the same comprehensive offboarding transaction. Changes do not silently renew a temporary grant.

Specialised and delegated assignments carry start, expiry, exact scope, reason and approver. The expiry job atomically changes due active assignments to `EXPIRED`, clears active uniqueness keys, increments authorisation versions, revokes sessions and records an event. Request-time permission evaluation already fails closed after `validUntil`, so a delayed scheduler does not preserve access.

## Offboarding

Staff departure, Guardian-link removal, Student leaving/completion, role removal, suspension and account disable require explicit review. Full offboarding:

- disables the account and increments credential/authorisation versions;
- ends active/pending roles and permission profiles and revokes overrides;
- revokes web/native sessions and Offline Sync devices;
- revokes passkey/TOTP authenticators and recovery codes;
- revokes invitations, activation sessions, MFA challenges and step-up grants;
- preserves domain records and immutable IAM/security audit history.

The transaction refuses self-offboarding and preserves the last-Super-Admin invariant. Rehire/reactivation begins with a new eligibility/link review, access request, training/policy currency check and factor enrolment; it never restores old access merely by toggling `isActive`.

