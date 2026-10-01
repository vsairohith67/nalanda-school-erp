# BIOMETRIC-DESKTOP-COMPANION-1A evidence

## R1 continuation checkpoint

Preserved final 1A source `d63c2351f2761b4faaf4665797a530fb731463c2`: [run 36786458187](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/36786458187), job `110128903788`, was verified PASS with its exact head before editing. This adds the final-head reference without replacing historical 76fc8a6 evidence below or rerunning unchanged code for that reference. Released base remains `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`; branch/worktree/PR30 retained, PR28 untouched.

SDK acquisition/contract/provenance/usage/architecture results are independently recorded in [SDK_ADMISSION_R1.md](SDK_ADMISSION_R1.md). Both official communication downloads succeeded HTTP 200 and match the supplied archives. Licence, firmware-family and remaining contract gates prevent native adapter admission; no DLL was invoked. A simulator is still a simulator.

R1 local affected checks: 23 component tests PASS (queue, recovery and approved-summary Excel regressions retained), component typecheck/build PASS, authored JS syntax/PowerShell parsing PASS. Excel source/output was not regenerated. Hosted isolation results must come from the exact changed-source focused workflow; authored coverage is not yet execution evidence.

The new disposable-runner harness shares the production ACL policy, uses a genuinely nonadministrator token, checks denial codes rather than arbitrary failures, and exercises required virtual-service reads/runtime writes, encrypted fresh polling, administrative restart, child crash recovery and same-body held-batch resume. Its approved nonsensitive health/report access is a readonly synthetic export policy; private runtime health/queue stay protected. It makes no hostile-local-administrator, signing, school-account, boot/logoff or hardware claim. Cleanup checks account, physical profile, protected service, Job Object descendants and all task-created fixtures; any cleanup failure fails acceptance.

Evidence categories are independent. No MSI/school service was registered or started. No operational DB access performed; this is not a fresh before/after DB hash check. No live terminal, private LAN, vendor MDB, saved credential, template or real staff report was accessed. Production transport remains OFF.

## Executed locally, synthetic inputs only

- pnpm install --frozen-lockfile --ignore-scripts: PASS; existing root lock unchanged.
- pnpm --filter @nalanda/biometric-bridge test: PASS, 23 tests (5 released + 18 task tests), including long-name/multiline-row presentation.
- Component typecheck/build: PASS.
- Released tests/biometric-staff-attendance-1a.test.ts: PASS, 11 tests; Prisma client generation read schema only, with no DB query.
- .NET build: PASS, 0 warnings/errors; Windows console harness PASS.
- PowerShell parsing: PASS for tooling and SCM harness, without invoking machine-changing tooling.
- Loopback receiver verified actual Ed25519 signature, exact body SHA256, persisted body replay after lost response, duplicate full ACK, unknown-user exception records and timeout. Other tests exercise malformed/partial ACK, >1,000 rejected/review records, disk-full injected write, original queue preservation, wrong key/corruption, sequence reset/conflict, held-batch resume, old ACK tombstones, health and metadata expiry/outage.
- Console harness demonstrated same-identity machine DPAPI, refusal to replace a secret, one owned child/duplicate denial, child crash/restart, stop during 60-second wait, stable saved interval, queue restart, host-crash Job Object cleanup and wrong-DPAPI fail-closed. Category: WINDOWS_CONSOLE_NOT_SCM.
- Actual XLSX readback passed numeric types/values 0, 0.5, 1, 1.5, 2.5; nonalphabetical manifest order, both sections, literal formula-looking text, source immutability, private sidecar provenance and refusal of synthetic final-approved export. Bundled artifact-tool independently imported/inspected and rendered the synthetic XLSX; rendering inspected.
- Root dependency audit: FAIL inherited released baseline, 2 critical (Next 15.5.21), 1 high (sharp 0.35.2), 3 moderate. Root dependency ownership is read-only; none repaired or copied from PR28. .NET vulnerable-package query: no vulnerable packages reported. This is not overall security clearance.

## Toolchain and side effect record

A task-local portable .NET SDK 10.0.401 was downloaded from official Microsoft metadata filtered to releases on/before 2026-10-01. Source: https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.401/dotnet-sdk-10.0.401-win-x64.zip ; SHA512 24b670ad3d923bfcf47df6c3b034152398b42f6dbc388e10d783aee1cfb5e5817d399fc0ae2a12cfa822a55e61d34830ccb15c50ef6efee437ab874bb7c79430. Microsoft.Extensions.Hosting.WindowsServices / ProtectedData 10.0.9 are pinned with component-local NuGet lock. Binary downloads/build outputs are ignored local temporary material, not published.

The first SDK invocation unexpectedly created an untrusted current-user ASP.NET development certificate. The exact newly created thumbprint/date was checked, only that certificate was removed, and absence was read back. Later calls disabled certificate generation/telemetry. This cleaned-up side effect is not hidden under a claim of no OS mutation; no service/account/device installation occurred.

Self-contained publish initially exposed an invalid publish flag and missing win-x64 lock graph. The task workflow was corrected to RestoreLockedMode=true and an explicit win-x64 graph; follow-up publish PASS, and the console harness also PASS against that published DLL. The local package is unsigned and is not deployment-admitted.

## Independent review

Initial read-only reviewer identified eight actionable gaps: host lock under read-only config; untrusted file ownership; ancestor junctions; legitimate upgrade worker misclassified as duplicate; path validation after service mutation; stale PID lock race; no held-batch recovery; SCM process existence overstated as DPAPI success. Corrections move lock to writable queue, set Administrator ownership, check ancestors/subtrees, recognize only owned service child and stop/recheck, validate paths before mutation, serialize lock acquisition, add explicit same-body resume, and require successful poll plus encrypted queue under virtual service identity in hosted SCM QA. Incremental review also corrected custom-SID/untrusted-ancestor permissions, stale health after restarted children, and long-name/multiline report row height. Reviewer final: no actionable residual findings; original eight resolved. This is source-review clearance only.

## Hosted Windows SCM evidence and runtime correction

[Focused run 36785748268](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/36785748268) PASS on source head 76fc8a6c77584e977c9e579415d0d4e3aefdb18f. Category: ACTUAL_SCM_DISPOSABLE_HOSTED_WINDOWS, distinct from local console and school acceptance. All TS checks, locked self-contained publish, console lifecycle and SCM steps passed. SCM used a unique virtual service identity, read-only configuration/secret access and a writable runtime subdirectory. It required fresh HEALTHY lastPollAt/updatedAt and encrypted queue after both starts and child-crash restart, verified zero children after stop, then deleted its unique service and verified cleanup. Machine DPAPI successfully crossed the provisioning user/service identity on that disposable machine. This does not prove standard accountant ACL isolation, boot/logoff, deployment signing or hardware.

Earlier focused runs 36785080113 (3e3c8ef) and 36785374209 (26555f4) FAILED in hosted console startup; SCM was SKIPPED. Safe stage/numeric diagnostics localized queue path admission: normalized queue was compared to a raw configuration-root spelling. Both now normalize before the same containment guard; an absolute private/../bridge.json regression passes locally and on the hosted runner. Independent incremental review cleared both diagnostics and containment correction with no findings. No Job Object or security check was bypassed.

Public source/artifact/secret scans PASS (3,045 files; zero forbidden artifacts/candidate secrets) before initial push; later scoped changes passed git-safety and diff checks. [Draft PR30](https://github.com/vsairohith67/nalanda-school-erp/pull/30) retains the source. Base and ownership remain unchanged; released worktree prepare-qa reports SAFE, clean/upstream attached and no cross-worktree overlap.

## Separate unexecuted or gated evidence

Actual SCM evidence above is restricted to the disposable hosted Windows runner; running/console/compiled categories cannot replace it. School boot/logoff/reboot, real standard-account file/service denial, school accountant admin membership, signed full package, SDK licensing/architecture/firmware, actual K30 log retrieval and collector cutover: NOT EXECUTED / owner and vendor gates. No real monthly-summary adapter exists. Fingerprint mirroring: NOT IMPLEMENTED. Inherited broad ERP CI failed, including the released root Next/sharp audit; focused companion success does not clear those independent gates.

This uniquely named workflow contains no upload-artifact, release, package publication or production secrets; shared workflows were read-only. Public-repository/secret scans must pass over exact staged source before push. Only source, docs and invented fixtures may enter the draft PR. No merge/tag/deployment is authorized.
