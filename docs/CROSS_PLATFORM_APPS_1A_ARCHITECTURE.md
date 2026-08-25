# NPS ERP cross-platform apps 1A architecture

Status: software foundation, default off, zero rollout. Updated 2026-08-26.

## Outcome and limits

The repository now contains one Tauri 2 application for Windows, Android and iOS. It provides an installable bundled shell, a PIN-unlocked encrypted local finance-draft workspace, system-browser authentication and a governed online ERP window. The existing Next.js server, IAM rules and Offline Sync 1A services remain authoritative.

This work does not activate a remote server, enroll a real device, use real school data, sign a package, distribute through a store, deploy infrastructure or certify a physical device. Both `cross-platform-apps-1a` and `offline-sync-1a` must pass the server release gate before native endpoints exist. The committed native build profile is `NO_REMOTE_SERVER_CONFIGURED`.

## Trust boundaries

```text
Bundled local shell (capability: local-main)
  ├─ Stronghold: PIN-derived vault, content key, Ed25519 private key, refresh token
  ├─ Web Crypto: AES-GCM encrypt/decrypt in trusted bundled code
  ├─ Rust SQLite: opaque ciphertext envelopes only
  └─ Rust network: fixed operation enum → exact configured origin → no redirects

System browser
  └─ existing ERP cookie login → explicit device confirmation → fixed app callback

Online ERP webview (label: online-erp, no Tauri capability)
  └─ exact HTTPS origin and navigation handler; server authorization remains authoritative

Next.js server
  ├─ PKCE S256 + state + nonce + one-use authorization code
  ├─ approved Ed25519 device + replay nonce
  ├─ opaque hashed access/refresh credentials + rotation history
  ├─ current user, credential version, authorization version and role assignment
  └─ existing Offline Sync validation, idempotency, conflicts and finance services
```

Remote content never receives Tauri commands. The `local-main` capability names only the bundled `main` window. The separately created `online-erp` webview is absent from every capability. There is no shell plugin, arbitrary filesystem permission, generic URL fetch, arbitrary SQL command or remote capability grant.

## Native authentication flow

1. The unlocked app creates an S256 verifier/challenge, state, nonce and stable device UUID. Stronghold creates and retains an Ed25519 private key; only its public JWK leaves the device.
2. `/api/native-auth/request` accepts the fixed app ID, fixed custom callback, three supported platforms and bounded public metadata. It returns a five-minute opaque request and challenge.
3. The device signs the browser challenge. The app opens the exact server `/native/authorize` path in the system browser.
4. The existing cookie session displays an explicit confirmation. The server rechecks the active account, current role assignment and `USE_OFFLINE_SYNC` permission. Unknown devices become `PENDING_APPROVAL`; only an already approved active device receives a 90-second one-use code.
5. The app validates state and request ID, then exchanges the code using PKCE, nonce and a fresh device signature.
6. The server returns a ten-minute opaque access token and a rotating refresh token. Only HMAC hashes are stored server-side. The refresh token is held in Stronghold; the access token is memory-only.
7. Refresh requires a new timestamped Ed25519 proof and replay nonce. Reuse of a rotated refresh token commits a family revocation before returning an error.
8. Every native finance request rechecks both feature flags, access expiry, device state, user lifecycle, credential/authorization versions, role assignment, effective permission, request signature, timestamp, body hash and replay nonce.

The app never collects or stores the ERP password. App PIN unlock and ERP server authentication are deliberately separate.

## Local data and synchronization

Only `FEE_PAYMENT`, `EXPENSE_DRAFT` and `MISC_INCOME` drafts are supported. Draft payloads are serialized, encrypted with AES-256-GCM using a 96-bit random nonce and record-bound additional authenticated data, then written to native SQLite as:

- record ID and type;
- nonce;
- ciphertext plus authentication tag;
- AAD hash;
- update time.

No student name, admission number, payer, description, amount or decrypted payload has a SQLite column. The content-encryption key remains in Stronghold and decrypted drafts are cleared when the app locks or backgrounds. A separate bounded diagnostic table has only timestamp and allow-listed event code; the persistent unlock governor has only failure count and retry deadline.

Synchronization calls the existing `validateOfflineSyncBatch` and `processOfflineMutation` services. Server outcomes stay explicit: accepted, duplicate accepted, conflict, rejected or retry later. Conflicts are listed only for the authenticated user and device; the client never auto-merges or overwrites server records.

## Platform capability matrix

| Capability | Windows | Android | iOS | Activation state |
|---|---|---|---|---|
| Bundled React shell | Tauri WebView2 | Tauri Android WebView | Tauri WKWebView | built, default off |
| Encrypted SQLite envelopes | rusqlite bundled | rusqlite bundled | rusqlite bundled | implemented |
| Secret/key vault | Stronghold software vault | Stronghold software vault | Stronghold software vault | implemented; no hardware claim |
| Deep-link callback | `nalandaps-erp://` | app link scheme | URL scheme | implemented in configuration |
| System browser auth | OS opener | OS opener | OS opener | implemented |
| Single instance | enabled | not applicable | not applicable | desktop only |
| Sensitive-screen capture | normal OS window policy | generated project applies `FLAG_SECURE` | no untested claim | iOS snapshot certification pending |
| Privacy-safe diagnostics | 500 allow-listed codes / 7 days | same | same | implemented; opt-in redacted view |
| Compiler gate | Windows 2025 runner | Ubuntu + Android SDK | macOS 15 + Xcode | private CI workflow |
| Signing/store delivery | absent | absent | absent | separately governed future work |

## Versions and compatibility

The app package version is `0.1.0`; native cache and auth schemas are version 1. The private/no-store context endpoint returns server version, minimum/recommended application versions, current/minimum sync schema, maintenance state and only the two relevant feature-availability booleans. The app explicitly blocks mutation for update-required, older-server/schema, maintenance and disabled-feature states while preserving encrypted local drafts. Database changes are additive and existing browser ECDSA P-256 devices continue to verify alongside native Ed25519 devices.

Rollback is fail-closed: disable either feature flag, revoke the device or revoke native sessions. Already encrypted local records remain device-local until an owner-authorized reset or retention process removes them.
