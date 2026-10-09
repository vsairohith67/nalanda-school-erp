# Actual candidate validation

Preparation snapshot: 2026-10-02 IST. This file records candidate observations separately from historical PR28 evidence. Terminal HANDOFF.md identifies the local source commits and final tree.

| Check | Observed result | Limit |
| --- | --- | --- |
| Package-specific supported correction | PASS, dry-run then precise update tauri-utils2.9.3→2.10.1 | Not an unrestricted upgrade; complete mandatory/rebinding delta in DEPENDENCY_CANDIDATE.md |
| Production/synthetic-QA locked metadata | PASS;631packages; feature difference only application synthetic-qa | Resolution, not compilation |
|24locked target/profile graphs | PASS,12targets×2profiles; no UNIC | Windows/Linux/macOS/Android/iOS graph coverage; no unavailable-platform compile claim |
| Candidate minimum1.90 metadata | Supported declared floor; highest declared dependency floor1.90 | NOT_EXECUTED at1.90; no installed toolchain; omitted dependency metadata prevents demonstrated-minimum claim |
| Same frozen verified RustSec baseline/candidate | PASS audit processes;0vulnerabilities,9→4warnings |3461c0d8f85d084552dd999c58d97c7123a9e0fd; causal comparison only |
| Final complete fresh audit | Actual exit0,5187ms,stdout8766bytes/stderr0;0vulnerabilities,4warnings | DBran46826f29→a3319ac0516bc5c6f084f3edfc39348c7edc7a10;1278advisories; drift recorded |
| Unchanged native report verifier | Actual exit1/NATIVE_RUST_WARNINGS_REQUIRE_REVIEW | Expected policy refusal: bincode/paste/proc-macro-error/glib still block native admission |
| Root/app production pnpm reports | Both exit0,279bytes,zero findings | Workspace lock metadata only, no artifact admission |
| Native production Rust tests | PASS13/13; exit0;240484ms; actual Windows compile | Source520d86d; installed Rust1.97.1; no historical result reused |
| Synthetic-QA Rust/profile compile tests | PASS13/13 plus substituted-profile hash refusal and production QA-input refusal; exit0;169375ms | HARNESS_FIXTURE_ONLY; no application launch/admission |
| Three new upstream ACL/Unicode/local-capability regressions | PASS in both profiles | Actual Tauri wrapper; permitted origin success, foreign/malformed/encoded/Unicode denial; capability stays local-only |
| Existing real isolated TLS and callback projection controls | PASS in both profiles | Wrong hostname/CA/expired leaf refused; credentials absent from callback projection; no trust-store/ERP/controller/real device contact |
| Available Windowsx64 native compile | PASS production and synthetic-QA on1.97.1 | Other targets and1.90 unavailable; no toolchain installed; compiler/linker warnings retained |
| Existing JS callback tests | PASS14/14 in2files; exit0;1750ms process/596ms Vitest | Request/state manipulation refusal, cancellation/storage/listener lifecycle, signed proof/version contracts; no MFA/ERP launch |
| Source provenance checker | PASS279files/4heads/4backupcontracts | Apps subtree excluded by existing checker; reviewed native delta separately |
| Access publication safeguard | PASS | Existing scanner unchanged |
| Onboarding publication safeguard | PASS after source report citation repair | Initial refusal of12digit public job coordinate retained; run-level link replacement, no checker relaxation |
| Git safety/diff check | PASS | Candidate/staged/tracked source checks; owned raw receipts excluded/ignored |
| Independent review | COMPLETE, independent read-only GPT-6 Astra source and terminal evidence review | No material source/scope defect; stale audit and JS-in-progress wording corrected; tracker readback follows actual writes |
| Six mandatory runtime jobs + optional producer | NOT_EXECUTED | No hosted dispatch/push/retry |
| Backend/native artifact admission; real-school rollout | BLOCKED/NOT_CLEARED | Audit exit0 is not zero-warning admission |

The complete scanner stdout/stderr and subprocess receipts were persisted before parsing, in owned ignored tmp/overnight-parallel-1a. Final audit tool and lock/source/database identity, times, exit/signal, byte sizes and raw hashes are transcribed in DEPENDENCY_CANDIDATE.md. Initial current scan and frozen comparison remain retained; the final fresh scan corrected capture metadata completeness. This final observation supersedes the analyst report's earlier working audit snapshot; it does not erase it.

No heavy validation began on apparent process quiet alone. The primary owner explicitly declared local timing probes complete and subsequent validation hosted, then declared no further test cycle and completed its turn. The coordinator notified that owner before using the window. Production compilation ran20:16:58–20:20:58UTC; QA controls20:22:35–20:25:25UTC; own filtered frozen dependency fetch20:25:27–20:26:19UTC. No shared node_modules/generated Prisma client/env/database/port/build output was used; Cargo used task-owned target/TMP/TEMP and two jobs. No primary MFA timing investigation was run.

Production command: cargo test --locked --manifest-path apps/nalanda-cross-platform/src-tauri/Cargo.toml. QA positive command adds --features synthetic-qa. The task-owned adaptation of existing scripts/portable/qa-native-profile-compile.ts changes only relative import, positive check→test with stdout forwarding, and compiler timeout180000→900000ms; original negative check assertions and tracked script remain unchanged. The transient fixture signs fresh synthetic public profile/trust and creates an isolated CA without trust installation; its finally block removed the precisely owned fixture, including private temporary key. No private fixture was committed or published.

Both native receipts bind source520d86d238c3e8d16379d6f4784f1d20a921508c and identical before/after lock hash42e83ce078779d6d97bef9b790a853960365493a28563958b9445af278e2943b. Production stdout1319bytes/SHA25676fc9648b5f980c4ba7d61693235cd8a98703d6b0046aa6f81f2f0a9a846ced9, stderr31436bytes/SHA256994eb6e5a326ef99e134156c5a8d8f6929cc98cfb660e73a68299a3aaf70acf8. QA wrapper stdout1511bytes/SHA2566a6b924e1384bdfdfff8e4fc87067826e90fb920833c26f406906a49bc426638, stderr552bytes/SHA256a09198de633795b15c09722222bf43769361af8b0606d82c7631fe16e0f7f40d. Existing helper captures successful child compiler stderr internally; QA wrapper receipt is not a complete transcribed compiler-diagnostic stream. Production dead-code warnings and libsodium PDB/linker LNK4099 are retained, not suppressed or confused with RustSec warnings. Seven build-generated permission TOMLs had newline-only changes, inspected and restored individually to committed bytes in this worktree after compilation; no semantic permission change is included.

Callback command: pnpm.cmd --dir apps/nalanda-cross-platform exec vitest run src/auth.test.ts src/auth-lifecycle.test.ts --maxWorkers 1. Output286bytes/SHA2560bce4e557e47990753d0cb5c5255d743bb5565ffb29bad9cf2a7d978b5b85473; stderr0. Before this check, pnpm11.21.0 performed a worktree-owned frozen install filtered to @nalanda/cross-platform-app with --ignore-scripts and task-owned store;226packages,52343ms, exit0. No Prisma generation/install lifecycle or product installation occurred. pnpm-lock.yaml has no Git diff against HEAD; Cargo lock before/after hash unchanged. No unused dependencies were added to the manifests.

Raw receipts remain private, no operational database/vault was read/copied/hashed/cleaned. No synthesized passing result, policy waiver, admitted artifact, controller contact, installation or real-user activation.
