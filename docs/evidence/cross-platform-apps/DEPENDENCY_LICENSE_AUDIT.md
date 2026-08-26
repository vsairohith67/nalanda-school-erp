# Dependency and license audit

Date: 2026-08-26
Scope: `CROSS-PLATFORM-APPS-1A`

## JavaScript

`pnpm.cmd audit --prod --audit-level high` completed with exit code 0 and `No known vulnerabilities found`.

Direct production licenses were MIT/Apache-2.0 for the Tauri API and plugins, MIT for React/React DOM and scheduler, ISC for Lucide React, and compatible dual-license combinations. The lockfile remains committed and CI installation is frozen.

## Rust

`cargo audit --file Cargo.lock` loaded 1,226 RustSec advisories, scanned 630 locked packages, reported no vulnerability that caused a failing result, and exited 0. It reported 19 allowed maintenance/unsoundness warnings.

The only unsoundness advisory was `RUSTSEC-2024-0429` for `glib 0.18.5`. Target-specific reverse-tree checks produced `nothing to print` for `x86_64-pc-windows-msvc`, `aarch64-linux-android`, and `aarch64-apple-ios`; the dependency is in Tauri's Linux GTK/WebKit target graph and is not compiled into the Windows, Android, or iOS artifacts in this scope. The remaining warnings are unmaintained transitive packages, mostly in that Linux graph plus general build/runtime dependencies. They are tracked supply-chain debt, not a hidden pass, and any later Linux application would require a separate resolution gate.

Rust license metadata contained primarily MIT, Apache-2.0, BSD, ISC, Unicode-3.0, Zlib, MPL-2.0, Unlicense, and compatible combinations. The two LGPL-containing expressions were optional alternatives for `r-efi`; the project crate itself is private and intentionally has no published-package license field.

## CI supply-chain controls

GitHub Actions are pinned to exact commit SHAs, Node/pnpm/Rust versions are pinned, package installation uses both lockfiles, artifacts are unsigned/private with seven-day retention, and each platform job writes SHA-256 checksums. No signing, deployment, store, provider, or operational-data secret is present in the workflow.
