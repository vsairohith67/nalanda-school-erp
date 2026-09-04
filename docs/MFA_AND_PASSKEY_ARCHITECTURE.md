# MFA and Passkey Architecture

## Factor hierarchy and policy

1. WebAuthn/passkey is the phishing-resistant option where the current browser/platform can support it.
2. TOTP is the broadly compatible enrolled fallback.
3. Individually one-use recovery codes provide governed emergency access.
4. SMS OTP is not a primary privileged-role factor.

MFA is mandatory for Super Admin, Director, Principal, Accountant and high-risk specialised access. The catalogue also treats permissions for IAM, releases/features, backup/restore, bulk export, finance, report publication, biometric governance and Offline Sync governance as privileged. This phase enforces the policy only in synthetic QA; no real factor is enrolled.

## TOTP

The implementation follows RFC 6238-compatible 6-digit, 30-second TOTP with a one-step bounded clock window. Each 160-bit secret is generated randomly, shown only during enrolment and stored as an authenticated AES-256-GCM envelope. Associated data binds the user and authenticator. The environment-supplied JSON keyring has an explicit active version; rotation decrypts and re-encrypts under that version without deriving any key from a password.

Enrolment remains pending until a valid confirmation code is consumed. The last accepted time step is stored atomically, so the same code cannot replay. Attempts use the shared security limiter. Recovery codes are generated only after confirmation, shown once, hashed with purpose/user/environment binding, counted without disclosure and individually consumed/revoked.

## WebAuthn/passkeys

The server and browser use maintained SimpleWebAuthn libraries. Registration and authentication have separate short-lived single-use challenges. Verification requires the exact RP ID, exact allowed origin, challenge, credential ID and user verification. Durable storage contains public credential bytes, credential ID, signature counter, backup/device metadata, transports and a user label—never a private key.

Authentication updates the signature counter atomically and rejects a stale/cloned counter result according to the verifier. A user can hold multiple named authenticators and each may be revoked. Failure never downgrades MFA; the user must use another already-enrolled factor or governed recovery.

## Environment boundary

Only the explicit synthetic policy admits `localhost` or loopback HTTP during local QA. Non-synthetic operation requires an exact HTTPS origin whose host equals the RP ID. Wildcards, arbitrary request origins and an inactive future production hostname are refused. Future mobile/physical passkey behavior remains a real-device/platform gate; server protocol tests are not device certification.

## Secret and backup boundary

TOTP key material comes only from the existing secrets environment and is never committed. Backups may contain the encrypted/versioned envelope and WebAuthn public credential metadata; they exclude QR images, manual keys, plaintext recovery codes, transient challenges, active session tokens and passkey private material.

