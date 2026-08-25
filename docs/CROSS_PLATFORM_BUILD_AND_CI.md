# Cross-Platform build and CI

Local commands are exposed from the root package:

- `pnpm.cmd app:typecheck`
- `pnpm.cmd app:test`
- `pnpm.cmd app:build:web`
- `pnpm.cmd app:rust:test`
- `pnpm.cmd app:windows:build`
- `pnpm.cmd app:android:init` and `pnpm.cmd app:android:build`
- `pnpm.cmd app:ios:init` and `pnpm.cmd app:ios:build`
- `pnpm.cmd qa:cross-platform-apps`

`.github/workflows/cross-platform-apps.yml` provides server/shared, Windows, Android, and macOS/iOS jobs. The jobs install pinned package-manager/toolchain inputs, compile or test the shared source, produce unsigned development artifacts, generate and verify checksum manifests with artifact-root-relative paths, co-upload each portable manifest with its package, and retain artifacts privately for seven days. Checksum generation excludes the manifest itself. The path gate includes the trusted-ingress helper and generated-project hardener. No workflow requests signing secrets, deploys a server, publishes to a store, enables a feature flag, or reads an operational database.

Windows builds an unsigned NSIS development package. Android builds an unsigned debug APK. iOS builds an unsigned simulator target. A successful simulator compile is not interactive simulator or physical-device certification.
