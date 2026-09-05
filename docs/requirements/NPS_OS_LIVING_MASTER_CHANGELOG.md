# Living Master Requirements changelog

## 1.0.0 — 2026-09-05

First exact 46-item owner inventory reconciled against 4a4df050d194104cfc497a6de790ca9553a69db6 (tree d4075661063fc127740bb3806abe51d83b406e61). Normalized specification SHA-256: 618824d76329b924230fede309b30df1d7aa7a94fa52c4b4a849647432421c89. No prior canonical register exists; historical V1/V1.5 ledgers remain unchanged evidence. Status totals: {"COMPLETE":9,"PARTIAL":23,"MISSING":8,"DEFERRED":3,"BLOCKED":2,"NEEDS_CONFIRMATION":1,"SUPERSEDED":0}. Owner intent is preserved; approval/release gates are pending. No migration, backup-version increment, production feature change or operational activation is part of this version.

Testing infrastructure also gains an Android-only, guarded hosted-runner cleanup of unused toolchains after two JNI-packaging disk-exhaustion failures. The first corrected run reclaimed 11,422,088 KiB and completed four-ABI packaging, then exposed the emulator profile's 7.2 GiB default userdata allocation as larger than the remaining 4.2 GiB. The synthetic AVD now uses an explicit 2 GiB userdata partition; all build targets, packaged-app emulator assertions and release gates are retained, with capacity and the applied AVD setting measured in CI.
