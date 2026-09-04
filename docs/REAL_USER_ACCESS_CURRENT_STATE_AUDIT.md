# Real-User Access Current-State Audit

Prompt: `REAL-USER-ACCESS-READINESS-1A`  
Audited base: `6754f92ab5d8dcb63b80edc42bfb955ad6be832c`  
Audit date: 2026-09-02

This audit is a source-level assessment of the current `main` authentication and IAM implementation. It is not evidence that real users, live delivery providers, private staging, physical devices, or operational activation exist. All implementation and QA for this prompt remains synthetic-only and default-off.

## Classification

| Capability | Classification | Current evidence and exact boundary |
| --- | --- | --- |
| User model and inactive lifecycle | `IMPLEMENTED_AND_CLEARED` | `User` carries `credentialVersion`, `authorizationVersion`, `lifecycleStatus`, `isActive`, forced-password-change state and optimistic `version`. Effective access and persisted-session resolution fail closed unless the account is active. |
| Username and email/mobile/admission login | `IMPLEMENTED_AND_CLEARED` | `AuthLoginAlias` provides normalized unique aliases. Login accepts only verified aliases; Student admission aliases additionally require a school-governed Student link. |
| Password hashing and policy | `IMPLEMENTED_BUT_NEEDS_ROLLOUT_QA` | Passwords use Node `scrypt` with per-password random salt, timing-safe comparison, 12–128 character bounds and a small common/default-password blocklist. NIST SP 800-63B-4 now recommends 15 characters for password-only authentication, so rollout policy must distinguish single-factor legacy login from MFA-backed login. |
| Login throttling and abuse controls | `IMPLEMENTED_AND_CLEARED` | Account/source login buckets, recovery buckets and the shared Security Resilience/Valkey policy exist. Production distributed mode fails closed when an atomic store is unavailable. |
| Durable account lockout | `PARTIAL` | Temporary rate-limit blocks exist; there is no durable account lock state, governed unlock lifecycle or per-factor attempt record. |
| Recovery request and password reset | `IMPLEMENTED_BUT_NEEDS_ROLLOUT_QA` | Generic anti-enumeration response, verified recovery aliases, hash-only short-lived single-use reset tokens, bounded attempts, credential-version binding and session revocation exist. Live Email/SMS delivery is disabled; only an isolated local test sink is supported. |
| Account invitations and first-login activation | `MISSING` | Admissions has a separate applicant invitation. There is no governed one-time `User` invitation, activation session, approval-bound first-login flow or server-owned activation gate. |
| Staff-to-user linking | `IMPLEMENTED_BUT_NEEDS_ROLLOUT_QA` | `StaffMember.userId` is unique and named-user creation requires an existing active Staff record for Teacher access. The current direct creation path needs the new request/approval gate. |
| Guardian-to-user linking | `IMPLEMENTED_BUT_NEEDS_ROLLOUT_QA` | `User.guardianId` is unique and Parent access resolves active `StudentGuardian` child contexts. The current direct creation path needs the new request/approval gate. |
| Student-to-user linking | `PARTIAL` | A school-governed `ADMISSION_NUMBER` alias can bind a login to one Student. There is no general governed Student-account candidate workflow or age/policy gate. |
| Active-role context and multi-role switching | `IMPLEMENTED_AND_CLEARED` | `AuthSession.activeRoleAssignmentId` selects exactly one active role. Permission evaluation uses that assignment rather than the union of all roles; Parent child context is separately selected and version-bound. |
| Base permissions and delegated/custom access | `IMPLEMENTED_AND_CLEARED` | Server permissions, role defaults, permission profiles, individual overrides, immutable denials and exact Marks Entry delegation are implemented. Teacher permanent marks-write remains an immutable denial. |
| Incompatible-role review | `PARTIAL` | Active-role isolation exists, but account-preparation conflict warnings and explicit review-required role combinations are not catalogued or enforced. |
| Session registry and revocation | `IMPLEMENTED_AND_CLEARED` | Hash-only web sessions include credential/authorization versions, safe browser/device summaries and one/all revocation. Password recovery and IAM changes revoke sessions. |
| Native sessions and refresh rotation | `IMPLEMENTED_AND_CLEARED` | Native PKCE, device signing, hashed access/refresh tokens, refresh-family rotation/reuse revocation and device binding exist behind default-off cross-platform gates. |
| Offline Sync devices | `IMPLEMENTED_AND_CLEARED` | Offline Sync devices, challenges, nonces, revocation and privacy-safe events exist behind a default-off gate. They remain distinct from web sessions and passkey authenticators. |
| Trusted web devices | `MISSING` | Web sessions carry safe device summaries but there is no trusted-browser enrollment or trust lifecycle. This prompt does not need silent trust; MFA remains required according to role/action policy. |
| Authentication and IAM audit events | `IMPLEMENTED_AND_CLEARED` | `AuthSecurityEvent` and `UserAudit` provide privacy-filtered security and IAM histories. Secret-like detail keys are refused. |
| Last-Super-Admin protection | `IMPLEMENTED_AND_CLEARED` | A transactional IAM safety lock, active-Super-Admin count, self-change denial and final-role protections exist. |
| Notification outbox/provider | `EXTERNAL_PROVIDER_GATE` | Local isolated authentication delivery exists for copied/synthetic QA only. No live Email, SMS or WhatsApp adapter is activated. |
| MFA policy | `MISSING` | No enrolled-factor model or login/activation enforcement exists. |
| TOTP | `MISSING` | No encrypted TOTP secret, bounded validation window, replay record, recovery or factor-removal workflow exists. |
| WebAuthn/passkeys | `MISSING` | No RP/origin-bound registration or authentication challenge, public credential store, counter/backup-state handling or revoke flow exists. |
| Recovery codes | `MISSING` | No saved single-use hash-only recovery codes exist. |
| Step-up authentication | `PARTIAL` | Critical IAM mutations require password re-entry, but there is no short-lived action/session-bound MFA step-up grant. |
| Training acknowledgement | `MISSING` | No versioned module assignment/completion evidence or activation prerequisite exists. |
| Policy acknowledgement | `MISSING` | No versioned acceptable-use/privacy/account-sharing acknowledgement exists. |
| Temporary access | `IMPLEMENTED_BUT_NEEDS_ROLLOUT_QA` | Base roles, profiles and overrides support `validUntil` and fail closed after expiry. There is no expiry worker, certification record or no-silent-renewal review workflow. |
| Periodic access review | `MISSING` | No due-date, review decision, recertification or reduction/suspension record exists. |
| Offboarding | `PARTIAL` | IAM suspension and role ending revoke web sessions. One governed action does not yet revoke invitations, factors, native sessions and Offline Sync devices together. |

## Architecture to preserve

1. A Staff, Guardian or Student record is not a login account.
2. A `User` account, its role assignments and the session's active role are separate authorities.
3. Parent access requires both the Parent role context and an active Guardian-to-Student relationship; a raw Student identifier is never sufficient.
4. Teacher marks-write authority is denied by the active Teacher role even when another account role exists; Marks Entry access remains exact-scope and time-bound.
5. Credential and authorization version changes invalidate stale sessions.
6. Native sessions, Offline Sync devices, biometric devices and future passkey authenticators remain distinct resource types.
7. The existing Security Resilience/Valkey limiter is extended; no competing production limiter is introduced.
8. Existing users are not silently enrolled, activated or migrated into MFA. The new rollout feature remains default-off and synthetic QA is the only enabled environment in this phase.

## Implementation decision

The readiness foundation will add the minimum durable workflow records around the current `User`, role, permission, session and audit models. It will not replace login aliases, session tokens, role evaluation, Parent child-context resolution, Native Auth, Offline Sync device trust or the existing security-event ledger.
