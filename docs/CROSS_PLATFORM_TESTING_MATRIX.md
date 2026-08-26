# Cross-Platform testing matrix

| Surface | Local evidence | Exact-head CI evidence | Deferred boundary |
| --- | --- | --- | --- |
| Shared/server | Typecheck, focused auth/contract tests, copied-DB migration and protocol QA, full ERP regression | Server/shared job | Production activation |
| Web UI | Unit tests, production web build, desktop/mobile browser checks, keyboard/responsive/app-lock checks | Shared frontend build | Physical assistive-technology certification |
| Rust/native | Unit tests, Clippy, fixed-origin/operation/ciphertext checks, dependency audit | Windows, Android, and iOS native jobs | Device hardware-backed-keystore certification |
| App lock/privacy | Restart/background/explicit lock contracts, persistent bounded retry governor, local wipe, bounded diagnostic schema | Shared native tests; Android `FLAG_SECURE` hardening | iOS app-switcher and physical-device capture certification |
| Windows | Local compiler/package gate where available | Unsigned NSIS job and checksum | Signing, Store, physical-device lifecycle |
| Android | Project/config static checks | Unsigned debug APK job and checksum | Emulator lifecycle if unavailable locally; Play/signing/real device |
| iOS | Project/config static checks | Unsigned simulator compile/test and checksum | Interactive simulator if unavailable; TestFlight/signing/real device |
| Security | Secret/dependency/license scans and Codex Security diff review | Security-sensitive tests in jobs | Production penetration test |
| Data integrity | Copied/synthetic DB only; operational DB hash before/after | No operational DB in CI | Operational migration/real data |
| Backup/restore | Native binding, revocation and version-policy coverage; raw-credential exclusion; restore twice | Shared copied-DB job | Operational restore rehearsal |

Skipped platform runtime checks must be reported as pending, never as passed.
