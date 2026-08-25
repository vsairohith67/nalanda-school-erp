# ADR: Cross-platform application framework

- Status: Accepted for `CROSS-PLATFORM-APPS-1A`
- Decision date: 2026-08-25
- Scope: unsigned, default-off Windows, Android and iOS software foundation

## Decision

Use **Tauri 2** with one bundled React/TypeScript shell and a small Rust core. The bundled shell is the only privileged webview. The remote ERP webview receives no Tauri capability and is subject to an exact build-time HTTPS origin and navigation allow-list. Native commands remain narrow, typed operations; there is no shell plugin, generic filesystem access, generic HTTP proxy, arbitrary SQL command, or remote capability grant.

The existing Next.js ERP and its server-side authorization remain authoritative. This app does not copy the ERP backend, finance rules or synchronization protocol. It reuses the cleared Offline Sync contracts and implements a native encrypted-record adapter behind them.

## Evidence and current toolchain

Official sources were checked on 2026-08-25:

- [Tauri overview](https://v2.tauri.app/start/) describes one HTML/CSS/JavaScript frontend with Rust, Swift or Kotlin integration across desktop and mobile.
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) requires Microsoft C++ Build Tools and WebView2 on Windows, Android Studio/JDK/SDK/NDK for Android, and macOS/Xcode/CocoaPods for iOS.
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/) scopes permissions by window/webview and platform. Remote code has no API access by default; remote access must be explicitly granted. The documented Android/iframe distinction is why this design never grants a remote capability and never embeds the ERP in a privileged page.
- [Tauri distribution](https://v2.tauri.app/distribute/) defines `tauri build`, `tauri android build` and `tauri ios build`; [Windows installer guidance](https://v2.tauri.app/distribute/windows-installer/) supports MSI or NSIS packages.
- [Tauri Stronghold](https://v2.tauri.app/plugin/stronghold/) supports Windows, Android and iOS, but this ADR treats it as software-encrypted secret storage. It does not claim hardware backing, Secure Enclave use, Android hardware-backed keys or Windows TPM protection.
- [Capacitor](https://capacitorjs.com/docs) officially targets iOS, Android and web/PWA. Windows would require a second desktop shell.
- [React Native Windows](https://microsoft.github.io/react-native-windows/) adds Windows to React Native, and its [support policy](https://microsoft.github.io/react-native-windows/support/) has a rapid version support cadence. The existing DOM/Next.js UI cannot be reused directly.
- [Flutter supported platforms](https://docs.flutter.dev/reference/supported-platforms) covers Windows, Android and iOS, but would require a Dart UI and shared-core rewrite.
- [GitHub-hosted runner images](https://github.com/actions/runner-images) provide current Windows, Ubuntu and macOS labels. The current macOS 15 image documents Xcode and iOS simulator SDKs; the Windows 2025 image documents Visual Studio, Android SDK and NDK components.

Version discovery at decision time reported Tauri CLI 2.11.4, JavaScript API 2.11.1 and Rust crate 2.11.5. Repository manifests pin the selected compatible versions and CI uses the lockfiles.

Local audit found Windows 11 Home (build 26200), an 11th-generation Intel Core i7-11800H with 16 logical processors and 39.7 GiB RAM, Node 24.19.0, pnpm 11.21.0, and Rust/Cargo 1.97.1. Rust successfully linked the native test binary on Windows, although `cl.exe` and a standalone WebView2 registry entry were not discoverable. No local JDK, Android SDK/emulator, macOS/Xcode, signing identity, or physical test device was available to this task. Therefore the final Windows package and both mobile compiler gates use approved GitHub-hosted runners; iOS compilation remains macOS-only.

## Comparison

Scores are 1 (poor) to 5 (strong) for this repository, not general framework rankings.

| Criterion | Weight | Tauri 2 | Capacitor + desktop shell | React Native + RN Windows | Flutter |
|---|---:|---:|---:|---:|---:|
| One governed framework for Windows/Android/iOS | 14 | 5 | 2 | 4 | 5 |
| Existing React/TypeScript and web UI reuse | 14 | 5 | 5 | 2 | 1 |
| Next.js/server architecture compatibility | 8 | 5 | 4 | 3 | 2 |
| Bundled trusted shell plus unprivileged remote ERP | 12 | 5 | 3 | 3 | 3 |
| Least-privilege capability/IPC model | 12 | 5 | 3 | 3 | 4 |
| Fixed native SQLite/encryption operations | 8 | 5 | 4 | 4 | 4 |
| Secure secret-storage integration path | 8 | 4 | 4 | 4 | 4 |
| Windows/mobile CI and packaging | 8 | 4 | 3 | 3 | 4 |
| Binary/memory footprint | 4 | 4 | 3 | 3 | 3 |
| Offline Sync integration | 6 | 5 | 4 | 3 | 2 |
| Dependency maintenance/platform parity | 6 | 4 | 2 | 2 | 4 |
| **Weighted total / 500** | **100** | **474** | **340** | **300** | **304** |

## Rejected alternatives

### Capacitor plus a separate Windows shell

Capacitor is the lowest-effort mobile wrapper for existing web code, but Windows is not an official primary target in its platform set. A second desktop framework would duplicate native IPC, storage, authentication, release configuration and security review.

### React Native with React Native Windows

It is viable for a native-widget product, but the project would reimplement the current ERP web experience and native modules across Swift/Objective-C, Kotlin/Java and C++/C#. That is the opposite of the requirement to reuse the governed ERP UI and keep shared logic narrow.

### Flutter

Flutter has strong platform coverage and tooling, but adopting Dart would create a second frontend stack and reduce reuse of the cleared TypeScript contracts. It brings no compensating security benefit for this bounded web-shell/offline-workspace product.

## Security and release consequences

1. `main` is the bundled local shell. Only it is named in capability files.
2. `online-erp` is a separately labelled external webview. No capability includes that label or a `remote.urls` entry.
3. Navigation rejects unknown origins, redirects, credentials in URLs and `javascript:`, `data:`, `file:` or unapproved custom schemes. Approved external links require explicit user action and the restricted opener boundary.
4. Native HTTP accepts only fixed operations against the signed build profile; it is not exposed as an arbitrary URL command.
5. SQLite stores opaque IDs, bounded state metadata and authenticated ciphertext envelopes. Rust owns SQL and key operations; UI code cannot submit SQL.
6. Production and private-staging origins remain inactive. The committed profile is `NO_REMOTE_SERVER_CONFIGURED`/local development only.
7. Automatic updates, production signing, store publication, real-device activation, physical-device certification and operational Offline Sync remain outside this release.
8. Missing local Android/iOS compilers are handled by exact-head private CI. A missing or non-running mandatory runner is an external platform gate, never a fabricated pass.

## Revisit triggers

Re-evaluate this decision if Tauri removes a required platform, cannot maintain capability-free remote content on one target, fails a mandatory unsigned build on a supported runner, or cannot meet the encrypted storage/device-key contract without broad IPC. Any framework change requires a new ADR and rerunning every platform/security gate.
