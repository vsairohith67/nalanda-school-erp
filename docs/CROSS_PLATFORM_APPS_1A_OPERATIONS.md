# Cross-platform apps 1A build, test and operator guide

All commands run from the repository root in Windows PowerShell unless a private CI job is named. Use `pnpm.cmd` on Windows.

## Local prerequisites

Common: Node 24.19, pnpm 11.21, Rust stable and the checked-in lockfiles.

Windows native packages additionally need Microsoft C++ Build Tools and WebView2. Android needs JDK 17, Android SDK/NDK and Rust Android targets. iOS compilation requires macOS, Xcode and iOS simulator targets. The 2026-08-26 local audit found Windows 11 Home build 26200, an Intel Core i7-11800H, 16 logical processors, 39.7 GiB RAM, Node 24.19.0, pnpm 11.21.0 and Rust/Cargo 1.97.1. Rust successfully linked the native tests, while `cl.exe`, a standalone WebView2 registry entry, a JDK, Android SDK/emulator, macOS/Xcode, signing identity and physical test device were not discoverable. Private CI therefore owns all three final platform compiler gates.

## Reproducible checks

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec prisma generate --schema prisma/schema.prisma
pnpm.cmd app:typecheck
pnpm.cmd test:cross-platform
pnpm.cmd app:build:web
pnpm.cmd app:rust:test
```

Copied-database adversarial QA must point explicitly to the approved operational database. The script hashes the live SQLite artifact set before and after, migrates only a copy under `tmp`, uses synthetic identities and removes its temporary directory unless `--keep` is supplied.

```powershell
$env:CROSS_PLATFORM_APPS_OPERATIONAL_DB='C:\approved\path\prisma\dev.db'
pnpm.cmd qa:cross-platform-apps
```

Never point `DATABASE_URL` at the operational database for this QA.

## Private CI compiler gates

`.github/workflows/cross-platform-apps.yml` has four read-only jobs:

- Ubuntu contracts, focused tests and bundled web shell;
- Windows 2025 unsigned NSIS build;
- Ubuntu Android unsigned debug APK build;
- macOS 15 unsigned iOS simulator build.

Artifacts remain private for seven days. The workflow has `contents: read`, no deployment environment, no signing secret, no notarization, no store credential and no publishing step. A runner-start failure is not compiler evidence. Record the exact workflow run, job, attempt and commit SHA only after steps actually execute.

## Manual test matrix

Use synthetic data and approved emulators/simulators only.

1. First launch with no remote profile shows the unconfigured warning and cannot contact a server.
2. A new 8–12 digit PIN creates a Stronghold snapshot and separate random installation salt; wrong PIN, corrupt vault, or missing salt fails without creating replacement key material.
3. Save each of the three allowed draft types; restart and unlock; values restore from ciphertext.
4. Background the app; verify it locks and decrypted draft state disappears.
   Inject a vault save/unload failure and verify the UI does not claim a completed lock. Inject each reset failure and verify no successful-reset state is shown.
5. Enter five incorrect PINs; confirm a persistent 30-second delay and increasing bounded backoff, then confirm a successful unlock clears the counter.
6. With the local synthetic server profile, start sign-in; verify the system browser opens only the exact `/native/authorize` origin.
7. Tamper state, challenge, proof, app ID, redirect, PKCE verifier and code; each must fail.
8. Unknown device becomes pending; it receives no code. Approve only the named synthetic device, then retry.
9. Exchange once; replay the code; replay must fail.
10. Send valid, stale, bad-body-hash, bad-signature and repeated-nonce native requests.
10a. Create two active synthetic devices for one user; prove a bearer session for device A rejects a correctly signed proof from device B before any nonce or last-seen mutation.
11. Rotate refresh; reuse the old refresh; the entire native session must be revoked.
12. Change password/credential version, role assignment, permission, user lifecycle and device status; each must invalidate subsequent access.
13. Exercise accepted, duplicate, conflict, rejected and retry-later Offline Sync results; verify no conflict auto-overwrites.
14. Confirm only the user's own device conflicts appear.
15. Navigate the online ERP webview to another origin and `/api/`; navigation must be refused and no Tauri API must be available.
16. Inspect SQLite schema/data and logs for plaintext school/person/finance data or credentials. Generate the opt-in diagnostic report and confirm it contains only version/platform, timestamps, safe event codes and counts.
17. With synthetic unsynced drafts, type the exact reset phrase. Confirm the UI warned of permanent loss, server logout was attempted when reachable, ciphertext was deleted and fresh device approval is required.
18. Confirm Windows, Android and iOS CI checksum manifests exclude themselves, verify successfully and are retained beside the exact unsigned package or simulator artifact.
    Download each artifact into an empty directory and verify its manifest from the artifact root; Android and iOS entries must not contain repository-prefixed paths.
19. Restore a copied synthetic backup captured while a native session is active; confirm the restored row is revoked and the retained access/refresh material is rejected until fresh browser authorization.

## Rollback and recovery

Software rollback is server-first and fail-closed:

1. Disable `cross-platform-apps-1a` or use the emergency release disable.
2. Revoke affected native sessions and devices.
3. Preserve encrypted local data until the owner decides retention/recovery; do not silently delete unsynced drafts.
4. Revert the app build through the normal exact-head release process if required.
5. Database tables are additive. Do not drop them during an incident; preserve refresh-reuse and authorization evidence.

Lost PIN recovery is destructive. The in-app reset is available only after unlock; when the PIN is unavailable, an owner-authorized operating-system app-data reset may remove the whole app container. Either path permanently destroys unsynced local drafts and requires fresh device approval. The operator must explain and record that boundary before acting.

## Activation gates not satisfied by this release

Real remote profile selection, production/private-staging configuration, device enrollment, physical-device validation, signing identities, notarization, Play/App Store packaging, MDM deployment, DNS/TLS/infrastructure changes, real-school-data use, biometrics, hardware-backed keys and public distribution each need a separate approval and evidence package.
