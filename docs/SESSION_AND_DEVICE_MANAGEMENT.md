# Session and Device Management

The account-security workspace shows safe own-account state: current and other web sessions, approximate browser/device labels, created/last-used times, revocation state, MFA factor names/types, and separately classified native or Offline Sync devices. It never reveals raw tokens, public-key bytes, TOTP secrets, recovery codes or broadly visible raw IP addresses.

## Distinct resource types

- web browser session: server-side hash and current active role assignment;
- native app device/session: PKCE/device-signing identity and rotating refresh family;
- Offline Sync device: independently approved signing key, nonce and revocation lifecycle;
- biometric bridge/device: separate attendance hardware governance;
- passkey authenticator: WebAuthn public credential and counter.

These are not merged into one ambiguous trusted-device record. A web session label does not grant native, Offline Sync, biometric or passkey trust.

## Revocation

Existing controls support one session, all other sessions and all sessions. Security recovery and credential-version changes revoke applicable sessions. Readiness offboarding additionally revokes web sessions, native sessions/refresh families, Offline Sync devices, active MFA factors, recovery codes, invitations, activation sessions, MFA challenges and step-up grants.

Mass or high-risk administrative revocation uses current permission checks and step-up. Revocation is server-side and effective on the next request; hiding a row in the client is never considered revocation. Account disablement and stale credential/authorisation versions fail closed even if a token's nominal expiry has not elapsed.

Native and Offline Sync foundations remain default-off and synthetic-tested. This phase does not certify a physical Windows, Android or iOS device or publish an app package.

