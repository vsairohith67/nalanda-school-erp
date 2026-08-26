# Follow-up implementation prompts

These prompts are intentionally not executed by CROSS-PLATFORM-APPS-1A.

## CROSS-PLATFORM-APPS-1B — Private Staging and Physical Device Certification

After `POSTGRES-READINESS-1A` and `PRIVATE-STAGING-1B` are separately cleared, implement `CROSS-PLATFORM-APPS-1B` in a new isolated worktree. Configure one exact private-staging HTTPS origin at build time, keep production absent, and use synthetic data and dedicated non-personal test devices only. Prove TLS/origin navigation, distributed fail-closed rate limiting, server minimum-version policy, PKCE/deep-link behavior, dual feature flags, platform install/upgrade/uninstall, background lock, OS backup behavior, accessibility, offline retention, power/network loss, clock skew, lost-device revocation, and encrypted storage inspection. Hardware-backed or biometric claims require platform evidence. Do not publish, activate production, or onboard a real user/device.

## WINDOWS-SIGNING-STORE-1A

Inventory current Windows Authenticode, certificate-custody, timestamping, SmartScreen, MSIX/NSIS, Microsoft Store, update, SBOM/attestation, approval, rollback, and private-channel requirements using official sources. Add protected CI only after named credential owners approve it. Prove unsigned-to-signed provenance without exposing a key or identity. Do not publish until a separate owner gate authorizes the exact package.

## ANDROID-PLAY-READINESS-1A

Inventory current Android release-keystore custody, Play App Signing, target/API policy, manifest/data-backup/security declarations, Data safety, accessibility, internal testing, dependency/SBOM, approval, rollback, and staged-release requirements using official sources. Use a protected CI environment and synthetic internal-test track only after named approval. Do not upload or publish under the foundation gate.

## IOS-TESTFLIGHT-READINESS-1A

Inventory current Apple Developer roles, certificate/profile custody, bundle/entitlement/privacy-manifest requirements, App Store Connect, TestFlight review, export compliance, accessibility, internal testers, protected CI, dependency/SBOM, approval, rollback, and staged-release requirements using official sources. Prove exact signed provenance and simulator-to-device configuration separation. Do not request personal Apple account data, expose signing identities, or submit under the foundation gate.

## NATIVE-PUSH-NOTIFICATIONS-1A

Design push only as an optional, default-off, server-authoritative notification channel. Compare APNs, FCM, and Windows delivery using official sources; define consent, token privacy, per-user/device ownership, revocation, minimal payloads, no sensitive lock-screen content, retry/idempotency, quiet hours, provider credentials, abuse controls, audit, monitoring, cost, rollback, and in-app fallback. Push must never authorize a finance/academic action or carry a bearer/refresh token. Do not activate a provider or use a real user/device.
