# Cross-platform apps 1A security and privacy review guide

Status: implementation security baseline. It is not a physical-device, infrastructure, signing or production-activation certificate.

## Threat model

| Threat | Control | Residual boundary |
|---|---|---|
| Remote page invokes native APIs | only bundled `main` has a capability; `online-erp` has none | framework/webview defects remain dependency risks |
| Arbitrary exfiltration endpoint | Rust accepts an enum of fixed API paths and one exact build origin; redirects fail | a separately approved build profile is required |
| Password theft | native app never receives ERP passwords; login stays in system browser | browser/server login security remains authoritative |
| Authorization-code interception | PKCE S256, state, nonce, 90-second one-use code, exact app ID/redirect | custom-scheme interception is reduced, not equivalent to claimed-app links |
| Stolen bearer credential | short access lifetime, hashed server storage, device signature on domain operations | unlocked-device compromise can access in-memory credentials |
| Refresh replay | rotation history plus committed family revocation on reuse | requires security-event monitoring when activated |
| Copied local SQLite | all domain payloads are AES-GCM ciphertext with record-bound AAD | PIN strength and endpoint security still matter |
| Private-key export | Ed25519 key is generated and used inside Stronghold procedures | Stronghold is treated as software protection, not hardware backing |
| Replay/tampering | timestamps, nonces, body hashes, canonical paths, signatures, DB uniqueness | clock skew is bounded to five minutes |
| Lost/stolen device | server device revocation, session revocation, app auto-lock, owner-confirmed local wipe | remote wipe is not implemented or claimed |
| Stale IAM | every request rechecks lifecycle, role assignment, permission and auth versions | activation depends on the server being reachable |
| Conflict corruption | server-authoritative validation and explicit conflict state; no auto-merge | owner review is still operational work |

## Session and key lifecycle

- Device identity: Ed25519 SLIP-10 seed and private key remain in Stronghold. The server stores only a normalized public JWK and hash.
- App content key: 32 random bytes in Stronghold. It is loaded only while unlocked and cleared with the rendered draft state on lock/background.
- App PIN: accepted only as 8–12 digits. Rust derives the Stronghold vault key with Argon2id, 64 MiB, three iterations, one lane and a cryptographically random 32-byte per-install salt stored separately in the private app-data container. A vault without its matching salt fails closed; a salt is created only for a confirmed first run. No claim of biometric, TPM, Android hardware-backed Keystore or Secure Enclave protection is made.
- Access token: opaque, ten-minute lifetime, held in memory, HMAC hash at rest on the server.
- Refresh token: opaque, seven-day sliding limit inside a 30-day absolute session, stored in Stronghold, rotated on use. Previous hashes remain in append-only replay history.
- Authorization code: opaque, 90 seconds, exact request/app/redirect/PKCE/device binding, single-use trigger.
- App unlock governor: failure count and the retry deadline persist in the local SQLite metadata table. After five failures, delays increase from 30 seconds and are capped at five minutes; a successful Stronghold unlock clears the counter. This governor contains no PIN or verifier and complements Stronghold Argon2id rather than replacing it.
- Reset: the security screen requires the exact phrase `ERASE LOCAL DRAFTS`. It attempts server logout when a session is reachable, verifies removal of the Stronghold content key, refresh token, device identifier and Ed25519 seed/private key, saves and unloads the vault, then deletes the app ciphertext cache. A secure-removal failure is surfaced and never reported as success. The UI states that unsynced drafts cannot be recovered. Remote device revocation remains a separate server control.

## Privacy-safe observability

Security events record event type, user relation, internal subject reference and bounded facts such as platform or rotation number. Logging helpers reject detail keys that resemble passwords, secrets, tokens, codes, addresses, phone numbers, email or network identifiers. Rust network errors use fixed codes and never echo response headers, request bodies, tokens, URLs or local payloads.

The native client keeps at most 500 allow-listed event codes for seven days in a dedicated local table containing only timestamp and event code. It has no arbitrary message input. The opt-in diagnostic view returns app version, platform, generation time, safe event codes and sync-state counts—never a request, draft, person, financial reference, amount, secret or decrypted value. No third-party crash analytics are enabled.

The server database intentionally has no native password, PIN, private-key, plaintext access-token, plaintext refresh-token or local-draft column. The native SQLite intentionally has no person/finance-domain columns.

## Security review checklist

- Confirm `local-main.json` still names only `main`.
- Confirm no capability contains a remote URL and no remote webview label appears.
- Confirm `NativeApiOperation` remains an allow-listed enum and `Policy::none()` remains.
- Confirm origin profiles are compile-time, HTTPS except explicit loopback development, and the committed profile is unconfigured.
- Confirm app ID and callback remain exact constants.
- Confirm both feature flags remain default false and zero rollout.
- Confirm authorization/refresh secrets are hashed before Prisma writes.
- Confirm native access always pairs `resolveNativeSession` with `verifyOfflineRequest` on data endpoints.
- Confirm every native data proof device equals the device bound to the bearer session before nonce, last-seen, read or write effects.
- Confirm externally reachable native routes require authenticated trusted-edge identity; direct mode is limited to explicit non-production loopback development.
- Confirm the installed Stronghold capability grants only the three required destructive commands to local `main`, and lock/wipe propagate failures.
- Inject Stronghold save/unload/removal and cache-reset failures: the UI must not claim a completed lock or reset before the operation succeeds, and the error must remain visible.
- Restore a backup captured before session revocation: the restored session must be revoked with fresh browser authorization required before any token can work.
- Direct loopback development requests require a valid per-install device identifier for isolated local rate-limit buckets; production still rejects direct native ingress entirely.
- Confirm refresh replay revocation commits and has an adversarial copied-DB test.
- Confirm operational DB before/after hashes match and QA contains synthetic records only.
- Confirm dependency advisories, lockfile policy, SBOM and licenses before release.
- Confirm generated Android builds apply `FLAG_SECURE`, disable cleartext, and exclude app data from broad backup. iOS snapshot-obscuring behavior remains a simulator/physical-device certification item; no untested protection is claimed.
- Treat platform signing, store distribution, device attestation, biometrics, keychain/keystore hardware claims and production activation as out of scope until separately evidenced.
