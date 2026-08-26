# Cross-Platform Apps security model

## Assets and boundaries

Protected assets are ERP authorization, native refresh material, device private keys, local finance drafts, reference packs, conflict details, and release artifacts. The key boundaries are the browser-to-app callback, local webview-to-Rust IPC, app-to-ERP HTTPS, Stronghold-to-process unlock, SQLite ciphertext, server authorization, and CI artifact publication.

## Controls

- Both release flags fail closed on the server and remain committed OFF at 0%.
- Remote ERP content has no Tauri capability; local commands are individually allowlisted.
- Origins are build-time constants. Production/staging require HTTPS and authenticated trusted-edge ingress; only the explicit non-production local profile accepts loopback HTTP.
- Native requests use a fixed operation enum, fixed paths, no redirects, bounded bodies/timeouts, pre-allocation response streaming limits, and a small response-header allowlist.
- Authentication uses PKCE S256, state, nonce, exact callback matching, cold-start/background callback replay after unlock, one-time codes, exact session-to-proof device binding, device signatures, rotating refresh tokens, reuse detection, and current server-side authorization.
- Local secrets stay in Stronghold; SQLite contains ciphertext envelopes only. An 8–12 digit PIN, per-install random salt, Argon2id and persistent retry governor protect software-vault unlock without making a hardware-backed claim.
- Logical backup contains durable native session/device bindings, credential hashes, rotation/reuse history, revocation state and the fixed app-version policy snapshot. It excludes authorization requests/codes, raw tokens, PIN material, private keys, local content keys/databases and build artifacts. Restore is idempotent, preserves revocation, refuses identity collisions, cannot lower deployment policy, and restores every newly created session as revoked so an older backup can never reactivate a retained token.
- Logs and evidence exclude tokens, passwords, private keys, school data, device identifiers, and signing identities.
- CI has read-only repository permissions, no signing/deployment/store step, private artifacts, seven-day retention, and verified checksum manifests co-uploaded with each platform artifact.

Security clearance requires zero unresolved Critical/High findings and zero authorization, privacy, or financial-integrity Medium findings. Store publication, signing, staged activation, and physical-device acceptance remain explicitly outside this release.
