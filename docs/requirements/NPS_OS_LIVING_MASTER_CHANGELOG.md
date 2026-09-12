# Living Master Requirements changelog

## 1.0.0 — 2026-09-05

First exact 46-item owner inventory reconciled against 4a4df050d194104cfc497a6de790ca9553a69db6 (tree d4075661063fc127740bb3806abe51d83b406e61). Normalized specification SHA-256: 618824d76329b924230fede309b30df1d7aa7a94fa52c4b4a849647432421c89. No prior canonical register exists; historical V1/V1.5 ledgers remain unchanged evidence. Status totals: {"COMPLETE":9,"PARTIAL":23,"MISSING":8,"DEFERRED":3,"BLOCKED":2,"NEEDS_CONFIRMATION":1,"SUPERSEDED":0}. Owner intent is preserved; approval/release gates are pending. No migration, backup-version increment, production feature change or operational activation is part of this version.

Testing infrastructure also gains Android-only, guarded hosted-runner cleanup after two JNI-packaging disk-exhaustion failures. The first corrected run reclaimed 11,422,088 KiB and completed four-ABI packaging, then exposed the Pixel emulator profile's 7.2 GiB userdata allocation as larger than the remaining 4.2 GiB. Emulator 37.1.11 retained that allocation after both a 2 GiB AVD-file setting and a 2048 MiB command-line option. The final workflow instead verifies the packaged APK, removes only the exact disposable Rust build-intermediate tree after all four ABIs have compiled, records the reclaimed capacity, re-verifies the APK, and then executes the unchanged Pixel 6 emulator assertions and release gates.


## 2026-09-05 — register 1.1.0, portable foundation 1B source phase

Prior register SHA-256 (exact Git blob bytes): `2e00c1ef24edbf16bb281620a0b341c9c4e36df2d901d828fb953e2d021a773e`.
The 1.0.0 bytes are retained in `config/requirements-history/master-register-1.0.0.json`.
Only NPS-REQ-040, NPS-REQ-041 and NPS-REQ-046 evidence changes. All 46 dispositions,
source intentions and unrelated records remain unchanged. No approvedAt is fabricated.
The original generated task remains historical; the current register records its explicit
owner start. The historical no-implementation test now permits only the enumerated
portable source surfaces; schemas, migrations, release flags and all other application
source remain protected by the original audit digests.

`SYNTHETIC_FULL_STACK_CI_EXCEPTION = OWNER_AUTHORIZED`; scope `EPHEMERAL_EXACT_HEAD_CI_ONLY`.
This permits disposable synthetic integration CI and does not permit operational deployment,
private staging, provider certification, hardware certification or production activation.
Terminal source release gates are tracked in `docs/evidence/PORTABLE_DEPLOYMENT_OBSERVABILITY_FOUNDATION_1B.md`.
