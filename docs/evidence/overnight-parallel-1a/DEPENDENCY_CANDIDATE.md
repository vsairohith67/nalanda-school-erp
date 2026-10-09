# Lane A — independent UNIC dependency correction candidate

Status: REVIEWABLE_LOCAL_CANDIDATE; native/backend admission BLOCKED. This package does not advance PR28. Source baseline `4f60dca86f8fe20b77bfbbd6862b3c16ed043bfe`, tree `0db07108217f2c0238cc1e6514da9cd1ff1b028a`. Separate primary observed `29db9c61c82f43ecf263cf72c03896f18af92695`; no import. Reports use committed shared ledger read-only.

## Supported path and minimum contract

[Official 2.10.0 release](https://github.com/tauri-apps/tauri/releases/tag/tauri-utils-v2.10.0), [2.10.1 release](https://github.com/tauri-apps/tauri/releases/tag/tauri-utils-v2.10.1), trusted HTTPS sparse registry and independently rehashed published archives establish tauri-utils2.10.1 (edition2024/Rust1.90/urlpattern^0.6). urlpattern0.6.0 uses ICU identifier sets in place of UNIC. Package-specific dry-run and actual `cargo update -p tauri-utils@2.9.3 --precise 2.10.1 --manifest-path apps/nalanda-cross-platform/src-tauri/Cargo.toml` succeeded. Supported resolution established within 16 minutes of start, below the 60-minute cap. No unrestricted update, unused direct dependency, checksum rewrite, local patch/fork or suppressed warning.

The application's rust-version changes1.77.2→1.90; application edition remains2021. Installed rustc1.97.1 (8bab26f4f,2026-07-14) and Cargo1.97.1 (c980f4866,2026-06-30) independently queried. Only stable and1.97.1 toolchains, Windows x64 target installed. **1.90 is the lowest justified candidate declared floor**, because tauri-utils requires it and no resolved package declares a higher floor. It is NOT a demonstrated minimum: many dependencies omit rust-version; no1.90 toolchain is available and none installed. Newer-compiler success cannot certify1.90. Earlier1.77.2 declaration exists from foundation commit6022430; reviewed operations/ADR and CI use1.97.1, and inherited dependencies already declare1.85/1.88. No discovered explicit independently tested1.77.2 support promise; whether owners promised that externally remains UNKNOWN. Candidate-only reconciliation does not authorize production support withdrawal.

Support implication: builders below1.90 cannot build this candidate; target OS floors/features unchanged. Later review must approve the minimum contract, add a separate minimum-compiler check for production and signed synthetic-QA on applicable platform(s), and run existing Windows/Android/iOS plus Linux/macOS coverage on the combined source. Current cross-platform workflow already uses1.97.1; workflow files remain unchanged tonight. Full security/artifact qualification is independent.

All immediate U parents stay at their existing versions: tauri2.11.5 (normal/build), tauri-build2.6.3, tauri-codegen2.6.3, tauri-macros2.6.3, tauri-plugin2.6.3, tauri-runtime2.11.3, tauri-runtime-wry2.11.4 require^2.9.3; deep-link2.4.9 normal/build requires^2.8. Both ranges admit2.10.1. Retained complete U closure and four direct plugin paths are in [pinned matrix](https://github.com/vsairohith67/nalanda-school-erp/blob/4f60dca86f8fe20b77bfbbd6862b3c16ed043bfe/docs/evidence/RELEASE_RECOVERY_1C.md). No Stronghold/GTK/GLib/framework migration.

## Registry integrity and complete lock delta

Archives rehashed against trusted registry: tauri-utils2.10.1,158887bytes,2ff55a614843b9a3f010f211df637c94df2607175b8d0f6e0f4a7c19e18621ee; urlpattern0.6.0,36902bytes,df16f50ef4cc145211879a3867ba757076b25dfee812040dcb0658bd9ae7904b. Added identities' lock checksums independently match fetched registry records. Original630→candidate631 packages. Cargo itself upgrades lock format3→4, compatible with proposed1.90. Checkout baseline raw locke7bcff746d3b4832e4a09bbed0934054ae6a565dfc9f1ec33c4e6160f845bdff (CRLF); candidate42e83ce078779d6d97bef9b790a853960365493a28563958b9445af278e2943b (LF). Historical ledger hash differs from current checkout newline encoding; parsed baseline identities match. All later locked commands preserve candidate hash.

| Removed identity | Added identity and direct dependency rationale |
| --- | --- |
| tauri-utils2.9.3 | 2.10.1; supported parent correction |
| urlpattern0.3.0 + five UNIC0.9.0 | urlpattern0.6.0→already-resolved ICU properties; no UNIC copy remains |
| infer0.19.0/cfb0.7.3 | infer0.22.0/cfb0.14.0; upstream requires infer^0.22 |
| ctor0.8.0/ctor-proc-macro0.0.7/dtor0.3.0/dtor-proc-macro0.0.6 | ctor1.0.13; upstream requires^1.0, old chain unused |
| No old corresponding copy removed | brotli9.0.0/decompressor6.0.1/alloc-stdlib0.3.0/alloc-no-stdlib3.0.0; compression generation9 required; older codegen generation retained |
| No old corresponding copy removed | dom_query0.28.0→cssparser0.37.0/macros0.7.1/selectors0.38.0/html5ever0.39.0/markup5ever0.39.0; upstream requires^0.28, wry retains0.27 |
| No old corresponding copy removed | json-patch4.2.0/jsonptr0.7.1; upstream requires^4, build/codegen retain3 |
| windows-core0.62.2/windows-result0.4.1/windows-strings0.5.1 | No newer replacement added; Cargo reuses existing compatible0.61.2/0.3.4/0.4.2 |

Cargo also rebinds existing broad windows-sys constraints and tempfile/getrandom and tauri-utils/toml edges without updating those packages' versions/checksums. These are resolver side effects, not new parent version requirements, and are listed below. A separate metadata-only public baseline fixture using the same precise offline update with command-local incompatible-rust-versions=allow produces a parsed-equivalent lock; no global setting changed and no validation refusal bypassed. Candidate retains Cargo-generated supported resolution. Independent review must assess these rebindings; all changed package identities and edge details are explicit.

### Every same-version package entry changed

Dependency labels becoming qualified/unqualified only are lock representation changes; an edge with a different resolved version is a real graph change.

| Package/version | Before dependency list | After dependency list |
| --- | --- | --- |
| alloc-stdlib 0.2.4 | alloc-no-stdlib | alloc-no-stdlib 2.0.4 |
| brotli 8.0.4 | alloc-no-stdlib, alloc-stdlib, brotli-decompressor | alloc-no-stdlib 2.0.4, alloc-stdlib 0.2.4, brotli-decompressor 5.0.3 |
| brotli-decompressor 5.0.3 | alloc-no-stdlib, alloc-stdlib | alloc-no-stdlib 2.0.4, alloc-stdlib 0.2.4 |
| cssparser 0.36.0 | cssparser-macros, dtoa-short, itoa, phf, smallvec | cssparser-macros 0.6.1, dtoa-short, itoa, phf, smallvec |
| dirs-sys 0.5.0 | libc, option-ext, redox_users 0.5.2, windows-sys 0.61.2 | libc, option-ext, redox_users 0.5.2, windows-sys 0.59.0 |
| dom_query 0.27.0 | bit-set, cssparser, foldhash, html5ever, precomputed-hash, selectors, tendril | bit-set, cssparser 0.36.0, foldhash, html5ever 0.38.0, precomputed-hash, selectors 0.36.1, tendril |
| errno 0.3.14 | libc, windows-sys 0.61.2 | libc, windows-sys 0.52.0 |
| html5ever 0.38.0 | log, markup5ever | log, markup5ever 0.38.0 |
| iana-time-zone 0.1.65 | android_system_properties, core-foundation-sys, iana-time-zone-haiku, js-sys, log, wasm-bindgen, windows-core 0.62.2 | android_system_properties, core-foundation-sys, iana-time-zone-haiku, js-sys, log, wasm-bindgen, windows-core |
| json-patch 3.0.1 | jsonptr, serde, serde_json, thiserror 1.0.69 | jsonptr 0.6.3, serde, serde_json, thiserror 1.0.69 |
| muda 0.19.3 | crossbeam-channel, dpi, gtk, keyboard-types, objc2, objc2-app-kit, objc2-core-foundation, objc2-foundation, once_cell, png 0.18.1, serde, thiserror 2.0.20, windows-sys 0.61.2 | crossbeam-channel, dpi, gtk, keyboard-types, objc2, objc2-app-kit, objc2-core-foundation, objc2-foundation, once_cell, png 0.18.1, serde, thiserror 2.0.20, windows-sys 0.60.2 |
| quinn-udp 0.5.15 | cfg_aliases, libc, once_cell, socket2, tracing, windows-sys 0.61.2 | cfg_aliases, libc, once_cell, socket2, tracing, windows-sys 0.52.0 |
| rustix 1.1.4 | bitflags 2.13.1, errno, libc, linux-raw-sys, windows-sys 0.61.2 | bitflags 2.13.1, errno, libc, linux-raw-sys, windows-sys 0.52.0 |
| selectors 0.36.1 | bitflags 2.13.1, cssparser, derive_more, log, new_debug_unreachable, phf, phf_codegen, precomputed-hash, rustc-hash, servo_arc, smallvec | bitflags 2.13.1, cssparser 0.36.0, derive_more, log, new_debug_unreachable, phf, phf_codegen, precomputed-hash, rustc-hash, servo_arc, smallvec |
| socket2 0.6.5 | libc, windows-sys 0.61.2 | libc, windows-sys 0.60.2 |
| tao 0.35.3 | bitflags 2.13.1, block2, core-foundation, core-graphics, crossbeam-channel, dbus, dispatch2, dlopen2, dpi, gdkwayland-sys, gdkx11-sys, gtk, jni, libc, log, ndk, ndk-sys, objc2, objc2-app-kit, objc2-foundation, objc2-ui-kit, once_cell, parking_lot, percent-encoding, raw-window-handle, tao-macros, unicode-segmentation, url, windows 0.61.3, windows-core 0.61.2, windows-version, x11-dl | bitflags 2.13.1, block2, core-foundation, core-graphics, crossbeam-channel, dbus, dispatch2, dlopen2, dpi, gdkwayland-sys, gdkx11-sys, gtk, jni, libc, log, ndk, ndk-sys, objc2, objc2-app-kit, objc2-foundation, objc2-ui-kit, once_cell, parking_lot, percent-encoding, raw-window-handle, tao-macros, unicode-segmentation, url, windows 0.61.3, windows-core, windows-version, x11-dl |
| tauri-build 2.6.3 | anyhow, cargo_toml, dirs 6.0.0, glob, heck 0.5.0, json-patch, schemars 0.8.22, semver, serde, serde_json, tauri-utils, tauri-winres, walkdir | anyhow, cargo_toml, dirs 6.0.0, glob, heck 0.5.0, json-patch 3.0.1, schemars 0.8.22, semver, serde, serde_json, tauri-utils, tauri-winres, walkdir |
| tauri-codegen 2.6.3 | base64 0.22.1, brotli, ico, json-patch, plist, png 0.17.16, proc-macro2, quote, semver, serde, serde_json, sha2, syn 2.0.119, tauri-utils, thiserror 2.0.20, time, url, uuid, walkdir | base64 0.22.1, brotli 8.0.4, ico, json-patch 3.0.1, plist, png 0.17.16, proc-macro2, quote, semver, serde, serde_json, sha2, syn 2.0.119, tauri-utils, thiserror 2.0.20, time, url, uuid, walkdir |
| tauri-plugin-deep-link 2.4.9 | dunce, plist, rust-ini, serde, serde_json, tauri, tauri-plugin, tauri-utils, thiserror 2.0.20, tracing, url, windows-registry, windows-result 0.3.4 | dunce, plist, rust-ini, serde, serde_json, tauri, tauri-plugin, tauri-utils, thiserror 2.0.20, tracing, url, windows-registry, windows-result |
| tempfile 3.27.0 | fastrand, getrandom 0.4.3, once_cell, rustix, windows-sys 0.61.2 | fastrand, getrandom 0.3.4, once_cell, rustix, windows-sys 0.52.0 |
| tray-icon 0.24.2 | crossbeam-channel, dirs 6.0.0, libappindicator, muda, objc2, objc2-app-kit, objc2-core-foundation, objc2-core-graphics, objc2-foundation, once_cell, png 0.18.1, serde, thiserror 2.0.20, windows-sys 0.61.2 | crossbeam-channel, dirs 6.0.0, libappindicator, muda, objc2, objc2-app-kit, objc2-core-foundation, objc2-core-graphics, objc2-foundation, once_cell, png 0.18.1, serde, thiserror 2.0.20, windows-sys 0.60.2 |
| uds_windows 1.2.1 | memoffset 0.9.1, tempfile, windows-sys 0.61.2 | memoffset 0.9.1, tempfile, windows-sys 0.60.2 |
| webview2-com 0.38.2 | webview2-com-macros, webview2-com-sys, windows 0.61.3, windows-core 0.61.2, windows-implement, windows-interface | webview2-com-macros, webview2-com-sys, windows 0.61.3, windows-core, windows-implement, windows-interface |
| webview2-com-sys 0.38.2 | thiserror 2.0.20, windows 0.61.3, windows-core 0.61.2 | thiserror 2.0.20, windows 0.61.3, windows-core |
| winapi-util 0.1.11 | windows-sys 0.61.2 | windows-sys 0.52.0 |
| windows 0.61.3 | windows-collections, windows-core 0.61.2, windows-future, windows-link 0.1.3, windows-numerics | windows-collections, windows-core, windows-future, windows-link 0.1.3, windows-numerics |
| windows-collections 0.2.0 | windows-core 0.61.2 | windows-core |
| windows-core 0.61.2 | windows-implement, windows-interface, windows-link 0.1.3, windows-result 0.3.4, windows-strings 0.4.2 | windows-implement, windows-interface, windows-link 0.1.3, windows-result, windows-strings |
| windows-future 0.2.1 | windows-core 0.61.2, windows-link 0.1.3, windows-threading | windows-core, windows-link 0.1.3, windows-threading |
| windows-numerics 0.2.0 | windows-core 0.61.2, windows-link 0.1.3 | windows-core, windows-link 0.1.3 |
| windows-registry 0.5.3 | windows-link 0.1.3, windows-result 0.3.4, windows-strings 0.4.2 | windows-link 0.1.3, windows-result, windows-strings |
| wry 0.55.1 | base64 0.22.1, block2, cookie, crossbeam-channel, dirs 6.0.0, dom_query, dpi, dunce, gdkx11, gtk, http, javascriptcore-rs, jni, libc, ndk, objc2, objc2-app-kit, objc2-core-foundation, objc2-foundation, objc2-ui-kit, objc2-web-kit, once_cell, percent-encoding, raw-window-handle, sha2, soup3, tao-macros, thiserror 2.0.20, url, webkit2gtk, webkit2gtk-sys, webview2-com, windows 0.61.3, windows-core 0.61.2, windows-version, x11-dl | base64 0.22.1, block2, cookie, crossbeam-channel, dirs 6.0.0, dom_query 0.27.0, dpi, dunce, gdkx11, gtk, http, javascriptcore-rs, jni, libc, ndk, objc2, objc2-app-kit, objc2-core-foundation, objc2-foundation, objc2-ui-kit, objc2-web-kit, once_cell, percent-encoding, raw-window-handle, sha2, soup3, tao-macros, thiserror 2.0.20, url, webkit2gtk, webkit2gtk-sys, webview2-com, windows 0.61.3, windows-core, windows-version, x11-dl |

### All locked duplicate versions

| Package | Candidate copies |
| --- | --- |
| alloc-no-stdlib | 2.0.4, 3.0.0 |
| alloc-stdlib | 0.2.4, 0.3.0 |
| base64 | 0.13.1, 0.21.7, 0.22.1, 0.23.1 |
| bitflags | 1.3.2, 2.13.1 |
| brotli | 8.0.4, 9.0.0 |
| brotli-decompressor | 5.0.3, 6.0.1 |
| chacha20 | 0.10.2, 0.9.1 |
| constant_time_eq | 0.1.5, 0.3.1, 0.4.2 |
| cpufeatures | 0.2.17, 0.3.0 |
| cssparser | 0.36.0, 0.37.0 |
| cssparser-macros | 0.6.1, 0.7.1 |
| dirs | 4.0.0, 6.0.0 |
| dirs-sys | 0.3.7, 0.5.0 |
| dom_query | 0.27.0, 0.28.0 |
| getrandom | 0.2.17, 0.3.4, 0.4.3 |
| hashbrown | 0.12.3, 0.14.5, 0.16.1, 0.17.1 |
| heck | 0.4.1, 0.5.0 |
| html5ever | 0.38.0, 0.39.0 |
| indexmap | 1.9.3, 2.14.0 |
| jni-sys | 0.3.1, 0.4.1 |
| json-patch | 3.0.1, 4.2.0 |
| jsonptr | 0.6.3, 0.7.1 |
| markup5ever | 0.38.0, 0.39.0 |
| memoffset | 0.6.5, 0.9.1 |
| png | 0.17.16, 0.18.1 |
| proc-macro-crate | 1.3.1, 2.0.2, 3.5.0 |
| r-efi | 5.3.0, 6.0.0 |
| rand | 0.10.2, 0.8.8 |
| rand_chacha | 0.3.1, 0.9.0 |
| rand_core | 0.10.1, 0.6.4, 0.9.5 |
| redox_users | 0.4.6, 0.5.2 |
| reqwest | 0.12.28, 0.13.4 |
| rust-argon2 | 1.0.0, 2.1.0 |
| schemars | 0.8.22, 0.9.0, 1.2.2 |
| selectors | 0.36.1, 0.38.0 |
| serde_spanned | 0.6.9, 1.1.1 |
| syn | 1.0.109, 2.0.119, 3.0.4 |
| thiserror | 1.0.69, 2.0.20 |
| thiserror-impl | 1.0.69, 2.0.20 |
| toml | 0.8.2, 0.9.12+spec-1.1.0, 1.1.4+spec-1.1.0 |
| toml_datetime | 0.6.3, 0.7.5+spec-1.1.0, 1.1.1+spec-1.1.0 |
| toml_edit | 0.19.15, 0.20.2, 0.25.13+spec-1.1.0 |
| windows | 0.36.1, 0.61.3 |
| windows-link | 0.1.3, 0.2.1 |
| windows-sys | 0.45.0, 0.52.0, 0.59.0, 0.60.2, 0.61.2 |
| windows-targets | 0.42.2, 0.52.6, 0.53.5 |
| windows_aarch64_gnullvm | 0.42.2, 0.52.6, 0.53.1 |
| windows_aarch64_msvc | 0.36.1, 0.42.2, 0.52.6, 0.53.1 |
| windows_i686_gnu | 0.36.1, 0.42.2, 0.52.6, 0.53.1 |
| windows_i686_gnullvm | 0.52.6, 0.53.1 |
| windows_i686_msvc | 0.36.1, 0.42.2, 0.52.6, 0.53.1 |
| windows_x86_64_gnu | 0.36.1, 0.42.2, 0.52.6, 0.53.1 |
| windows_x86_64_gnullvm | 0.42.2, 0.52.6, 0.53.1 |
| windows_x86_64_msvc | 0.36.1, 0.42.2, 0.52.6, 0.53.1 |
| winnow | 0.5.40, 0.7.15, 1.0.4 |

rustls remains exactly0.23.45; active Stronghold chacha20 remains0.9.1 and corrected optional RNG chacha20 remains0.10.2. No crypto/serialization algorithm or vault format change. Production reqwest TLS verification, CA/hostname/validity checks, redirects, profile limits and permissions stay unchanged. Feature flags/schema/migrations/v48/Georgia Bold unaffected.

## Behavioral inspection and directly missing regressions

Actual Tauri RemoteUrlPattern wrapper remains behaviorally unchanged (acl/mod.rs diff formatting/import ordering only): constructor still defaults omitted pathname/search/hash to wildcard and tests a parsed URL fail-closed. This is ACL matching, not the native application's origin/callback validation. urlpattern tokenizer changes owned chars→UTF8 borrowed slices, ignores CR/LF/TAB, and replaces UNIC ID_Start/ID_Continue with ICU sets. Upstream matching/parser/canonicalization/options/serialization/testdata also change; version-only equivalence is not assumed. Inspecting these sources led to three tests in the existing registered lib.rs: actual upstream exact-origin/port/path/encoded-separator/foreign/custom-scheme denial and malformed parsing; Unicode named-segment positive/negative matching; unchanged local-only capability/no opener grant. Existing callback-manipulation, production/profile substitution and real isolated TLS tests remain required, with no widened origin, CA or permissions.

### Resolved feature changes

| Existing package | Added features | Removed features |
| --- | --- | --- |
| windows-sys@0.52.0 | Win32_Networking, Win32_Networking_WinSock, Win32_Storage, Win32_Storage_FileSystem, Win32_System_Console, Win32_System_Diagnostics, Win32_System_Diagnostics_Debug, Win32_System_IO, Win32_System_SystemInformation |  |
| windows-sys@0.60.2 | Win32_Globalization, Win32_Networking, Win32_Networking_WinSock, Win32_System_IO, Win32_System_SystemServices, Win32_System_WindowsProgramming, Win32_UI_Accessibility, Win32_UI_Controls, Win32_UI_HiDpi, Win32_UI_Input, Win32_UI_Input_KeyboardAndMouse, Win32_UI_Shell |  |
| icu_properties@2.3.0 | default |  |
| windows-sys@0.61.2 |  | Win32_Globalization, Win32_System_Com, Win32_System_Diagnostics, Win32_System_Diagnostics_Debug, Win32_System_SystemInformation, Win32_UI_Accessibility, Win32_UI_Controls, Win32_UI_HiDpi, Win32_UI_Input, Win32_UI_Input_KeyboardAndMouse |
| windows-sys@0.59.0 | Win32_Globalization, Win32_System_Com, Win32_UI_Shell |  |

Prod/QA metadata differ only by application synthetic-qa feature (default retained). App features stay default=[]/synthetic-qa=[]; no target or platform removed. 24 locked selected graphs cover Windowsx64; Linuxx64/arm64; macOSx64/arm64; Androidaarch64/armv7/i686/x64; iOSdeviceaarch64/simulatoraarch64/x64, each production/QA. All tree commands exit0. None selects UNIC. Graph inspection is not compilation. Linux still selects GTK/GLib/proc-macro-error; unselected other-platform crates remain visible in whole-lock security reports. New duplicate HTML/CSS/compression/JSON generations follow separate supported parent constraints.

## Complete audit and retained policy effects

Complete raw stdout/stderr/process receipts are private under owned ignored tmp/overnight-parallel-1a, persisted before parsing. No raw audit/private artifact published. Baseline and candidate at frozen verified3461c0d8f85d084552dd999c58d97c7123a9e0fd (2026-10-01T09:31:41+02:00) each exit0: nine→four warnings, zero vulnerabilities. The five UNIC IDs0081/0075/0080/0100/0098 genuinely removed; bincode0141/paste0436/proc-macro-error0370/glib0429 unchanged. No warning duplicates/new finding. Frozen no-fetch used only for causal comparison; final mandated current fetch retained independently.

Final command: `cargo audit --json --db tmp/overnight-parallel-1a/rustsec-db --file apps/nalanda-cross-platform/src-tauri/Cargo.lock`; cargo-audit0.22.2, binary SHA256fc6e9d818d73ba07ecf28650793d46b74cf90aeb70c17405563c16454a4ba62d; Cargo launcher SHA25686478e53f769379d7f0ebfa7c9aa97cb76ca92233f79aa2cc0dbee2efaac73c7. Start2026-10-01T20:07:29.708521+00:00, end2026-10-01T20:07:35.055322+00:00, 5187ms, actual exit0/signalnull; stdout8766bytes/SHA2567e1d299b11aafad13c1b41dc1364c7314a6fbb70d078eb484acebdaebb95f6f9, stderr0bytes. Source pinnedHEAD plus candidate lockhash above. Advisory DB before46826f29f4a85faf4a5e4e087a4623e84c09f618 2026-10-01T21:14:05+02:00; aftera3319ac0516bc5c6f084f3edfc39348c7edc7a10 2026-10-01T22:05:58+02:00; parsed report count1278. Database drift is recorded and not credited to remediation; finding identities unchanged versus frozen comparison. Initial current scan3657ms/8766bytes preceded a capture-helper metadata completeness correction; final fresh scan retains actual audit-binary hash and before/after DB identity. All attempts remain private.


| Remaining record | Actual scope/policy effect |
| --- | --- |
| bincode1.3.3/RUSTSEC-2025-0141 | iota_stronghold2.1.0→plugin2.3.1, runtime all OS; unchanged unmaintained warning blocks native |
| paste1.0.15/RUSTSEC-2024-0436 | stronghold_engine2.0.1→iota_stronghold→plugin, host proc macro all OS; unchanged warning blocks native |
| proc-macro-error1.0.4/RUSTSEC-2024-0370 | glib-macros/gtk3-macros through retained G closure, selected Linux build; whole-lock warning blocks native |
| glib0.18.5/RUSTSEC-2024-0429 | retained GTK/WebKit G closure, selected Linux runtime; unsound warning blocks native |

Existing unchanged non-launching verifyNativeSecurity actually executes against both new pnpm production audit bytes and complete current Rust bytes: exit1/NATIVE_RUST_WARNINGS_REQUIRE_REVIEW. No signer, controller, launch or admission receipt. Both pnpm reports exit0/279bytes/no findings; metadata-only scope, not independent actual-artifact scans. One wrapper setup error before root audit execution is retained; corrected capture distinguishes cargo-audit from pnpm audit. No favorable-result retry or suppression. Node native type stripping + small task-owned relative-extension resolver executes original TS functions unchanged; no shared node_modules or package installation needed.

## Validation boundary (updated by terminal VALIDATION.md)

Locked production/QA metadata and24target graphs PASS. Exact baseline comparison/current audit and actual policy rejection established. Source checker PASS279/fourheads/fourbackupcontracts; access publication PASS. Onboarding publication initially refuses a12digit public GitHub job coordinate in analyst report; analyst changed it to run-level citation without weakening scanner. Recheck after all report changes. Native compilation, Rust production/QA13tests (including real isolated TLS), compiler/profile controls and JS callback/native regressions are initially NOT_EXECUTED awaiting explicit noncontending host window. No1.90 compiler or non-Windows target installed. Terminal VALIDATION.md must distinguish later actual outcomes from this preparation snapshot. Historical PR28 successes are not candidate tests.

No push/newPR/hosted dispatch/merge/rebase/cherry-pick. Primary work/ledger, main/P1PR29/K30PR30/Ask Nalanda and all protected policies unchanged. Six mandatory runtime jobs and optional native producer NOT_EXECUTED; native/backend admission and real-school release remain separately BLOCKED. No operational DB/vault read/copy/hash/cleanup, real contacts, paid runner, controller/trust/DNS/profile provisioning, authenticated Windows, app-stack launch, installation/deployment or admission waiver.
