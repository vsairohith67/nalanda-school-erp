# BIOMETRIC-DESKTOP-COMPANION-1A evidence

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

## Separate unexecuted or gated evidence

Actual SCM tests are restricted to an admitted disposable hosted Windows runner with unique service name and verified cleanup. Until that focused job succeeds: NOT EXECUTED. Running/console/compiled categories cannot replace it. Boot/logoff/reboot, real standard-account file/service denial, school accountant admin membership, signed full package, SDK licensing/architecture/firmware, actual K30 log retrieval and collector cutover: NOT EXECUTED / owner and vendor gates. No real monthly-summary adapter exists. Fingerprint mirroring: NOT IMPLEMENTED.

This uniquely named workflow contains no upload-artifact, release, package publication or production secrets; shared workflows were read-only. Public-repository/secret scans must pass over exact staged source before push. Only source, docs and invented fixtures may enter the draft PR. No merge/tag/deployment is authorized.
