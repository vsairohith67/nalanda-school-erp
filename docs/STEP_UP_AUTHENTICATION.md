# Step-Up Authentication

Step-up is a fresh proof for one high-risk operation. A previous MFA-backed login is not indefinitely sufficient.

The server creates a short-lived challenge bound to user, current web session, exact action, environment and current credential/authorisation versions. Passkey is preferred when enrolled; TOTP is the fallback. Successful factor verification consumes the challenge and creates a short-lived hash-only grant with the same bindings. The target mutation atomically consumes that grant once.

Current protected readiness actions include access approval, invitation issue, access-certification decision, MFA-recovery approval and user offboarding. The architecture also supports applying the same contract to high-risk role changes, all-session revocation, factor removal/regeneration, biometric/Offline Sync approvals, feature activation, backup/restore and bulk export.

Validation refuses an expired grant, wrong action, user, session or environment, replay, stale security version, disabled account, revoked factor or changed active role/session context. Tokens are accepted from bounded request bodies, never URLs. Same-site cookies and existing anti-CSRF controls protect browser mutations; privacy-safe events record outcome without factor response or token.

Step-up does not expand the actor's permissions. The underlying service still authorises the current active role and exact resource/scope after factor verification.

