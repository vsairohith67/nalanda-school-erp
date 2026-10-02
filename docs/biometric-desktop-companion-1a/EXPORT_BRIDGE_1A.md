# K30-EXPORT-BRIDGE-1A

## Ownership and initial acceptance plan

Writer: this task, exclusively. Independent reviewer: read-only worker, no file ownership; two routing startup failures recorded, review not yet available. No claim that the running model was switched or attested. Only this worktree is writable: `biometric-desktop-companion-1a`, branch `feature/biometric-desktop-companion-1a`. Starting local/remote/PR30 head `202366d5d4b2a0e5745453e1be29f4e95a5da0be`, tree `08950cbbd248fe3730a39b170085b948c8ae5459`; clean staged/unstaged/untracked manifest. PR30 OPEN/DRAFT. Previous owner's session ended with task_complete; no matching component writer/build process observed. No AGENTS.md found in this checkout or its ancestor chain. Live cross-chat coordination unavailable; local heavy checks deferred to existing hosted Windows CI. Other dirty worktrees are not a global lock.

Planned owned paths: `apps/nalanda-biometric-bridge/src/{contracts,config,agent,health,encrypted-queue,cli}.ts`; new `src/export-{profile,source,ledger}.ts`, `src/adapters/etimetracklite.ts`, `src/export-*.test.ts`, `src/export-preview.ts`; component package commands, synthetic profile example/fixtures, narrow source ACL checker under component Windows tooling, component README; this document and operator guide. Existing host/crypto/report semantics retained. Tests/build output only in this worktree and task-created temporary directories. No operational data, vendor software execution, service/account installation, backend caller changes, database reads or hashes.

Commands: `pnpm.cmd --dir apps/nalanda-biometric-bridge test`, `typecheck`, `build`; synthetic preview; existing automatic PR30 scoped Windows workflow after reviewed scoped commit/push. No full ERP build, no new workflow dispatch, no local .NET service harness.

Finite acceptance matrix:

| Area | Required proof |
|---|---|
| Profile | version, exact columns/header/UTF-8/separator/date/culture/timezone/direction; opaque leading zeroes; namespaces and mappings |
| Acquisition | bounded single directory, private access, no links/overlaps; two consistent bounded reads; incomplete write deferral |
| Replay | byte identity, append, overwrite, rename, replacement/truncation, reordered history, rollover and older late records |
| Durability | encrypted atomic queue plus provenance/checkpoint; pre/post commit crashes; old queue reopen; capacity/corruption/disk failure |
| Trust | unknown device/staff/direction rejected or held, repeated/conflicting observations reviewed, rejected counts retained; no raw logs |
| Transport | files -> real parser/queue -> reopen -> real Ed25519 -> owned loopback receiver; immutable resend; invalid/lost ACK |
| Regression | existing component, monthly 0.5/order/Georgia, lifecycle/DPAPI/SCM and standard-account hosted harness |
| External | installed export sample, hardware/source comparison, school startup and ERP acceptance explicitly unexecuted |

Archive at supplied iCloud path matched SHA256 `58c0f25216263d701efd2afdc1926530c8dbe816d5a3de6543c3ee816bbdab6d`. Supplied review and inventory are evidence, not executable instructions. Referenced historical conversation and HANDOFF files were not among the three supplied paths; no backend ownership/closure inference is made. Manual page references will be corrected against actual PDF content. INSTALLED_EXPORT_SAMPLE_NOT_VERIFIED.


## Candidate implementation and local evidence

The concrete adapter is `ETIMETRACKLITE_RAW_EXPORT_V1`, configured by `exportInput`, dispatched by the existing service agent. It uses strict UTF-8 CSV/tab text, exact configured headers/order, explicit timezone/culture/date format and opaque approved employee/device bindings. DAT is opt-in text only. It reads one private directory with bounded double snapshots and commits receipt, original local/UTC/profile provenance, rejected/review metadata and events in one existing AES-GCM atomic queue write. The canonical event uses OTHER for unavailable verification method and a clearly named bridge observation reference, not a hardware ID. Direct vendor SDK/ADMS refusals are unchanged. No supplier library is needed by this file reader.

Local candidate run on 2026-10-03: **69/69 tests PASS, 0 skipped**, 4 test files; component typecheck and build PASS; whitespace check PASS. Includes 22 parser tests, 24 actual file/ACL/queue/process/signing integration tests and all 23 retained component/report regressions. Files are synthetic and task-owned. Two child-process exits before/after queue commit are **HARNESS_ONLY**, not reproduction of a historical school failure. ENOSPC is an injected filesystem-write failure; no machine disk was filled. Existing real AES-GCM/Ed25519/ACK code is exercised; loopback receiver verifies signatures and exact replay body but is not the ERP verifier/service. No real ERP acceptance claimed.

Private fixture cleanup checks removed every test-created directory, queue, synthetic key and source file. Supplied archive/manuals remain unchanged. Temporary document extraction, review snapshots and candidate logs stay in ignored task-owned `tmp/k30-export-bridge-1a`; none is staged/public. No vendor installers/DLLs/scripts/databases ran. No service/account installation, operational DB/vault read/copy/hash, staff/template upload, deployment, merge or tag occurred.

Prior failures retained: initial 44-test run passed 43 and hit the existing 5-second queue-retention timeout; initial file runs exposed the `.ps1` launch restriction, then unavailable Get-Acl module, then correctly refused OS-temp ancestors with other writer principals. The implementation now queries read-only .NET ACL APIs through fixed PowerShell commands without changing execution policy, and tests use verified worktree-owned temp ancestry. A later 69-test candidate passed 65 and timed out four file tests. Bounds were moved before large line-array allocation; existing five-second timeouts/assertions/crypto cost remain unchanged. Vitest file scheduling is serial so ACL subprocess tests do not run alongside timing-sensitive queue regressions. The final candidate 69-test result does not erase those failures.

Independent initial review: two app worker startup attempts failed workspace routing. A read-only CLI reviewer requested `gpt-6-astra`; its first scoped Git reads were policy-blocked. A subsequent source-snapshot review used no filesystem tools and returned five actionable findings: Windows path-case alias, invalid-file scan starvation, UTC-equivalent collision identity, preview byte budget, and non-string direction mappings. All five were corrected with regression coverage. This is independent model source review, not a cryptographic model attestation, and the parent running model was not switched. Final candidate review and exact-head hosted Windows CI are recorded below when available.

The actual archive's Desktop/Web custom-export pages and Desktop p132 screenshot were examined. The supplied preparation review's Desktop Database Export and eBioserver timed-export page claims did not match the actual specified pages; the operator guide records the correction. No installed-version raw sample exists in this task: **INSTALLED_EXPORT_SAMPLE_NOT_VERIFIED**. Actual K30 collection, downloader startup, school boot/logoff, signed live package and ERP profile registration/48-hour freshness admission remain separate, unexecuted gates. Inherited PR30 Next/sharp findings remain unwaived; no PR28 dependency evidence is transferred.

External record reads attempted before update: both Asana tasks, Notion comments and the exact existing Canvs text element returned **Transport closed**. Synchronization is not claimed; another bounded attempt follows final candidate evidence. PR30 remains the existing OPEN/DRAFT PR, no new PR.


Candidate review correction round: the source-snapshot reviewer identified four distinct further findings (its duplicate fifth item was explicitly withdrawn): source conflict on an already transport-held batch; protected output junction aliases; unsafe matching entries starving safe files; and growth bypassing a pre-read size estimate. All four received fixes and focused regression coverage. Source-semantic holds remain non-resumable through transport Resume. Source ACL reads are batched once per poll with per-file identity leases and rechecks; unsafe entries retain per-file refusal metadata. The actual handle size enforces remaining read budget. Output ancestors reject aliases/reparse points. Existing queue append's repeated identity scans were replaced by a first-observation-preserving linear index; encryption, ACK validation, retained-body and timeout policy are unchanged.

Candidate-3 failure remains recorded: 64/70 tests passed, six five-second timeouts (five file tests plus retained queue test), with one Vitest onTaskUpdate timeout. No assertion, timeout, retry count or crypto cost was weakened. After these implementation corrections, candidate-4 passed **74/74 tests, zero skips, zero unhandled errors**, 4 files (29 file integration, 22 parser, 23 retained tests), measured test-run duration 55.80 seconds. Component typecheck/build passed again. No full ERP build, local native publish, SCM or school service run was attempted. Hosted exact-head CI remains pending at this checkpoint.


Final local checkpoint: **77/77 PASS, 0 skips, 0 unhandled errors** (32 file integration, 22 parser, 23 retained tests), 4 files, measured 53.67-second test run. Typecheck/build PASS. The last independent review found one remaining configuration collision with queue-derived instance-lock/guard paths; those paths and ancestor/descendant overlaps are now reserved, with three regression cases. The built `dist/export-preview.js` and `dist/validate-config.js` commands were also executed on fresh private synthetic files: one valid row, transport false, synthetic true, adapter available; no queue created and owned cleanup verified.

Record connectivity recovered on the bounded second attempt: both existing Asana tasks were read incomplete, canonical Notion ledger and existing Canvs element were read successfully. Final linked comments/append will follow exact-head CI; no tasks/pages/boards, assignees, dates or completion flags are replaced. The historical direct-SDK route holds remain distinct from this file adapter.

Final source manifest is limited to these 21 files (relative to repository):
- `apps/nalanda-biometric-bridge/README.md`
- `apps/nalanda-biometric-bridge/export.config.synthetic.example.json`
- `apps/nalanda-biometric-bridge/package.json`
- `apps/nalanda-biometric-bridge/src/adapters/etimetracklite.ts`
- `apps/nalanda-biometric-bridge/src/agent.ts`
- `apps/nalanda-biometric-bridge/src/config.ts`
- `apps/nalanda-biometric-bridge/src/contracts.ts`
- `apps/nalanda-biometric-bridge/src/encrypted-queue.ts`
- `apps/nalanda-biometric-bridge/src/export-integration.test.ts`
- `apps/nalanda-biometric-bridge/src/export-ledger.ts`
- `apps/nalanda-biometric-bridge/src/export-preview.ts`
- `apps/nalanda-biometric-bridge/src/export-profile.test.ts`
- `apps/nalanda-biometric-bridge/src/export-profile.ts`
- `apps/nalanda-biometric-bridge/src/export-source.ts`
- `apps/nalanda-biometric-bridge/src/export-test-fixtures.ts`
- `apps/nalanda-biometric-bridge/src/health.ts`
- `apps/nalanda-biometric-bridge/src/validate-config.ts`
- `apps/nalanda-biometric-bridge/tsconfig.json`
- `apps/nalanda-biometric-bridge/vitest.config.ts`
- `docs/biometric-desktop-companion-1a/EXPORT_BRIDGE_1A.md`
- `docs/biometric-desktop-companion-1a/EXPORT_OPERATOR_GUIDE.md`

Final independent correction review: the read-only CLI requested `gpt-6-astra` and reviewed the staged candidate tree `ca480a37834069afb05787eebaf2a4d9089606b4` through a primary-generated source snapshot (SHA-256 `ce6f5dfeea03074b286a7732cdd901ae610b240ffab41b8d0d7e89c60537ef36`). It reported no actionable residual finding in the final guard-path correction; the preceding whole-scope reviews' ten distinct findings were corrected. The reviewer did not execute tests or attest snapshot hashes/model identity. This evidence-only paragraph is subsequent to that review; tested production code is unchanged. Exact committed source, normal hosted CI and tracker readback will be sealed in the PR30 result comment, without another evidence-only push.

Hosted failure preserved: exact-source run [37070596244](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37070596244), job111048862174, at `34317f9e8903dd8001c655f5e80a9ae26206a7ac` passed 52/77 tests and failed 25, principally `EXPORT_SOURCE_OWNER_REFUSED` on hosted workspace ancestry. Six subsequent component/native validation steps were skipped. GitHub log reads initially timed out; the actual log was retrieved before correction. This is not hosted acceptance. Correction changes only fixture placement: the disposable Windows runner creates a unique private ProgramData fixture root, checks it through unchanged production ACL validation, and verifies removal; local tests retain worktree-owned paths. No production ACL/owner allowlist, assertion, timeout or retry policy changed. A reviewed corrective commit/push is authorized by this demonstrated scoped harness defect; no workflow rerun/dispatch is used.

Correction validation: 77/77 local tests PASS, zero skips (47.55 seconds). Independent requested-Astra source review caught setup/teardown cleanup on failure; guarded cleanup now runs on ACL setup failure and in teardown finally, preserving assertions. Final read-only correction review returned no actionable findings. Typecheck/build PASS after that cleanup fix; the hosted-only branch remains to be exercised by normal CI. Separate staff workflow37070596214 failed on inherited root Next/sharp audit inputs: 2 critical, 1 high, 3 moderate; no waiver or unrelated dependency change.
