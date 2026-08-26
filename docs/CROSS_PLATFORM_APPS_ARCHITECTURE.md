# Cross-Platform Apps architecture

Prompt: `CROSS-PLATFORM-APPS-1A`

The selected foundation is one Tauri 2 application for Windows, Android, and iOS. It reuses the existing React/TypeScript concepts and the existing ERP server. It does not introduce a second ERP backend, finance engine, synchronization protocol, or source of truth.

## Trust zones

The bundled local shell is the only privileged UI. It contains app lock, device bootstrap, encrypted draft storage, sync state, conflict review, and version status. Its Tauri capability grants only the named native commands required by that shell.

The online ERP opens as an unprivileged remote surface on one build-time origin. It receives no native capability. Unexpected origins, redirects, and active-content schemes are rejected; approved external links require a user action and open in the system browser.

## Server authority

Native tokens are narrow transport credentials. Every sensitive request rechecks the active user, role, permission, approved device, app compatibility, `CROSS_PLATFORM_APPS_1A`, and `OFFLINE_SYNC_1A`. Existing Offline Sync services still own reference packs, validation, idempotency, conflicts, and final posting.

## Platform boundary

The repository contains the shared source, native Rust shell, generated development icons, build commands, and private CI matrix. Store signing, public distribution, private HTTPS staging, real-device certification, real users, and real school data are separate future gates.

See [the framework ADR](adr/ADR_CROSS_PLATFORM_APP_FRAMEWORK.md), [authentication bridge](NATIVE_AUTHENTICATION_BRIDGE.md), [offline storage adapter](NATIVE_OFFLINE_STORAGE_ADAPTER.md), and [security model](CROSS_PLATFORM_SECURITY_MODEL.md).
