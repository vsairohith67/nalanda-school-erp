# AUTH-2B Verified Recovery and Session Registry

Status: `AUTH_VERIFIED_RECOVERY_CLEARED` after independent AUTH-2B-QA.
The retained feature branch and release tag preserve the reviewed boundary. No live email/SMS provider,
cloud service, account activation, permission profile, role switching or
delegated account administration is authorised.

## Existing-auth audit

Before this phase, `User` held a unique username, optional profile email,
scrypt password hash, role, active state and last-login time. Login accepted
username or `User.email`, used one generic failure, dummy scrypt, in-process
account/source throttling and a signed 12-hour HttpOnly Strict cookie. The
cookie embedded a password-derived credential tag; there was no persisted
session inventory. `Change Password`, administrator password reset, role
change and disablement invalidated stateless authorization indirectly. The
global middleware already enforced origin/Referer checks, streamed body limits,
CSP and private API responses. `UserAudit` was append-only but required an
actor.

Existing links remain authoritative and separate: `StaffMember.userId` links
staff accounts; `User.guardianId` and `StudentGuardian` link Parent accounts;
`Student.admissionNo`, Staff email/mobile, Guardian email/mobile, Student phone
and `User.email` are profile/contact data. AUTH-2B does not automatically turn
any of those fields into a login or recovery alias.

## Additive data model

Migration `20260731130549_auth_verified_recovery_session_registry` is the only
AUTH-2B migration. It adds `User.credentialVersion` and five tables:

- `AuthLoginAlias`: globally unique normalized value, governed type, masked
  display, pending/verified/removed lifecycle, school-governed flag, optional
  exact Student link for admission-number aliases, and expected version.
- `AuthVerificationChallenge`: HMAC code hash, alias/user/purpose/credential
  binding, expiry, attempt ceiling, use and invalidation state.
- `AuthPasswordResetToken`: HMAC token hash, verified destination alias,
  selected channel type, credential version, expiry, attempts, single-use and
  invalidation reason.
- `AuthSession`: user, token hash, credential version, created/last-seen/expiry,
  revocation, safe device/browser summary, masked network evidence and expected
  version.
- `AuthSecurityEvent`: append-only, privacy-safe security history with optional
  subject and actor.

Database checks constrain alias type/status, admission linkage, verification
state, recovery purpose/channel and attempt ceilings. The migration backfills
only current usernames as verified, school-governed aliases. It does not
promote `User.email`, Staff/Guardian email/mobile, Student phones or admission
numbers.

## Login identifiers

Allowed types are `USERNAME`, `WORK_EMAIL`, `PERSONAL_EMAIL`, `MOBILE` and
`ADMISSION_NUMBER`. Username/email case, strict E.164 mobile formatting and
school admission syntax are normalized exactly; no substring, phonetic or
other fuzzy match exists. `normalizedValue` is globally unique, so a duplicate
cannot become a second account's login. Candidate ambiguity fails closed.

Email/mobile aliases remain pending until a six-digit possession code succeeds.
Codes are never stored or logged in plaintext, expire after ten minutes, are
single-use, permit five attempts and have a three-send window. Admission-number
aliases require an exact Student foreign key and `isSchoolGoverned=true`; the
self-service API cannot add, change or remove them. School-governed username
aliases follow the existing authorised user-management lifecycle. A user cannot
remove a governed alias or the last verified usable identifier. Every request,
verification and removal creates an append-only security event without the raw
destination.

The login field resolves only verified alias rows. Nonexistent, wrong-password,
pending/unverified, ambiguous and inactive-account attempts return the same
public message. Dummy scrypt remains. Both account/source and broad-source
buckets are bounded. The client retains its repeated-submit guard and current
role-aware redirect UX.

## Recovery

`/forgot-password` accepts one login identifier and only a channel type. Work
email and personal email are available choices; mobile is rendered only when a
governed adapter is configured. The response is always the same and never
shows a stored destination. An eligible request selects an already verified
alias of the chosen type, invalidates older reset records and creates a random
256-bit token. Only its HMAC is stored.

The delivery link uses `/reset-password#token=...`. URL fragments are not sent
in HTTP requests; the client moves the token into memory and immediately
removes the fragment before submitting it in a bounded JSON body. Reset records
expire after fifteen minutes, allow five attempts, bind user/purpose/credential
version, become single-use and are invalid after a newer reset, password change
or security-state change. A successful reset rejects the current password,
increments the credential version and revokes every active session.

No live provider is implemented or enabled. `DISABLED` is the default. The
only concrete adapter is `LOCAL_TEST_SINK`; it requires an existing copied
database under an ignored `tmp` root, refuses release environments and
`prisma/dev.db`, and writes one private mailbox delivery for possession testing.
The mailbox is delivery output, not application/audit logging, and is destroyed
with copied QA.

## Central sessions

Each login creates a random opaque session secret and a separately signed cookie
envelope. Middleware verifies the signature; only the secret SHA-256 and session
reference are stored. Authenticated authorization then requires an existing
unrevoked, unexpired registry row, an active user and exact credential version.
Legacy stateless cookies fail the new envelope check and require a fresh login.

`lastSeenAt` writes are bounded to one update per five minutes. Stored client
evidence is restricted to Desktop/Mobile/Tablet/Unknown, a small browser family
and an IPv4 `/24`-style mask or IPv6 `/48`-style prefix; exact IP and raw user
agent are not stored. Account Security marks the current session and supports
one-session, other-session and all-session revocation. All-session revocation
requires an explicit current-session checkbox in an accessible in-app dialog.
Logout revokes the current registry row before clearing the cookie. Password,
role and status changes revoke stale sessions and pending recovery state.

## Routes and UI

Public, no-store and no-index surfaces:

- `/forgot-password`
- `/reset-password`
- `/api/auth/recovery/request`
- `/api/auth/recovery/reset`

Authenticated, server-authorized and no-store surfaces:

- `/account-security`
- `/api/auth/security`
- `/api/auth/security/aliases`
- `/api/auth/security/sessions`

Actions are at least 44 px, controls are labelled, recovery status uses live
regions, and destructive decisions use `role="dialog"` with no native
`alert`, `confirm` or `prompt`.

## Verification and operator boundary

`pnpm.cmd qa:auth2b` creates an ignored database copy, deploys all migrations,
and uses synthetic AUTH2B fixtures for the retained Super Admin baseline,
enabled/disabled users, three recovery channels, pending and duplicate refusal,
an explicitly Student-linked admission alias and multiple sessions. It proves
verification, masked evidence, recovery, single use, session revocation,
security events, database cleanup and unchanged operational DB identity.

Independent QA also runs `pnpm.cmd qa:auth2b:independent`, isolated HTTP probes,
exact desktop/mobile Browser checks, and each migration/restore rehearsal twice.
The release verification commands run sequentially:

```powershell
pnpm.cmd routes:list
pnpm.cmd lifecycle:backfill
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd backup
pnpm.cmd git:safety-check
```

Version-37 backup now carries an optional `authSecurity` evidence section for
aliases, verification history, reset history, session history and append-only
security events. Password hashes, verification-code hashes, reset-token hashes
and session-token hashes are excluded. Restore invalidates verification/reset
records and restores every session as revoked with a non-secret replacement
reference, so no backup can revive a session or credential. Older version-37
documents without `authSecurity` remain valid.

See `AUTH_2B_INDEPENDENT_QA_CLOSURE.md` for the independent matrix, Browser
evidence, migration/restore results, cleanup and release boundary.
