# Secure Invitation and First Login

## Invitation contract

An invitation uses 32 random bytes and is short-lived (currently 24 hours). Only its hash is persisted. The hash is bound to purpose, environment and invitation identity; the durable row also binds user, request, approved-role snapshot and credential version. Tokens are single-use, revocable and never included in ordinary event details.

Issuing a new invitation revokes prior unused invitations for the same governed request. Validation refuses malformed, altered, expired, revoked, used, wrong-environment, stale credential-version, disabled, unlinked or role-snapshot-changed invitations. Acceptance atomically consumes the invitation and creates a 30-minute activation session.

The QA delivery sink is loopback-only and returns a preview for reserved synthetic identities. It places the one-time value after `/activate#token=`, not in a query parameter. The browser removes the fragment and exchanges it for an HttpOnly, `SameSite=Strict`, bounded-path activation cookie. Activation responses are `private, no-store`, `Referrer-Policy: no-referrer` and `nosniff`. No open redirect parameter exists.

No Email, SMS, WhatsApp or real address delivery is implemented. Invitation content includes system name, intended role, expiry, one-time warning, non-sharing warning, support/recovery placeholder and no password.

## First-login sequence

1. Validate and atomically accept the invitation.
2. Show only safe reviewed identity/role detail.
3. Establish an approved password; no password is emailed or logged.
4. Enrol TOTP or passkey when the approved role requires MFA.
5. Complete every server-owned current training module/version.
6. record the current draft policy acknowledgement.
7. confirm the exact approved roles.
8. revalidate feature/environment, eligibility, person link, scope, role snapshot and credential version.
9. atomically activate the user and assignments, consume the activation session and revoke prior sessions/invitations.
10. show recovery guidance without redisplaying secrets.

## Password boundary

Existing password hashing uses salted `scrypt` and timing-safe verification. The shared policy enforces 12–128 characters and blocks known default/common values. Readiness additionally requires 15 characters for a password-only account; an MFA-backed flow may use the existing minimum. Arbitrary composition rules are not added. Password changes/recovery increment the credential version, revoke relevant sessions/tokens and preserve audit.

## Abuse resistance

Invitation validation, activation and authentication reuse the existing Security Resilience/Valkey abstraction with bounded bodies and generic controlled errors. Regression coverage includes purpose/environment binding, single use, alteration resistance, stale role/credential/link/account state, replay, rate limiting, referrer/history handling and secret-free serialization/logging. Live-provider and real-recipient behavior remains an external gate.

