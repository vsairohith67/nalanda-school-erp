# Nalanda Public School ERP app

Tauri 2 foundation for Windows, Android and iOS. The committed build is unsigned, default off and has no remote server configured.

From the repository root:

```powershell
pnpm.cmd app:typecheck
pnpm.cmd app:test
pnpm.cmd app:build:web
pnpm.cmd app:rust:test
```

Architecture, security, CI and operator boundaries are documented in `docs/CROSS_PLATFORM_APPS_1A_ARCHITECTURE.md`, `docs/CROSS_PLATFORM_APPS_1A_SECURITY.md` and `docs/CROSS_PLATFORM_APPS_1A_OPERATIONS.md`.
