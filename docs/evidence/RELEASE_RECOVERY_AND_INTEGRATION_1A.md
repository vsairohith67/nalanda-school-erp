# RELEASE-RECOVERY-AND-INTEGRATION-1A

Status: IN_PROGRESS. No release clearance, merge to main, tag or activation.
Started 2026-09-12, approximately 14:55 UTC. One writing owner, retained branch
`release/recovery-integration-1a`, dedicated sibling worktree `recovery-integration-1a`.

## Admission

Released main `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`, tree
`2c7f1a129e6b98abb9689abf7c989b0ed8468561`, v45, independently fetched and verified.
The primary local main remains at `e8ed29363eae30ea7a1a091744213a838bfd77d9`;
it was neither switched nor updated. The released worktree helper hardcodes
`feature/`; normal `git worktree add -b` created the required `release/` branch.

| Source | Requested committed head | Admission |
| --- | --- | --- |
| PR24 | 5bf70e4c4be07b706224debe01a27c54fd0af096 | Verified OPEN; pending incorporation |
| PR25 | 67c504be6230f763663cf19faf50d9bc46dc6902 | Verified OPEN; pending incorporation |
| PR26 | d784262ccc78ae431a72a3934ced45198e4bfb4c | Verified OPEN; pending incorporation |
| PR27 | c653ce91791d600027e92a2bb127c710af065cbf | Advanced to 283718fb5bedbc505302e55d7bc5214d8fa4d553; reviewed committed delta admitted |
| Excluded PR19 | 1ba360b123ded770f1554d59fbd21c86b9943427 | OPEN, excluded and unchanged |

PR27 additional commits: `12cb4cb` isolated hosted layout and actors; `0c4b6a1`
valid expiry fixture chronology; `62be2eb` downloaded filter/denied-role/revocation
probes; `283718f` retained acceptance evidence. Student page delta is line endings
only. These changes are within requested acceptance scope. PR27 has uncommitted
package.json and pnpm-lock.yaml changes in its own worktree: not read, copied or
admitted. That outstanding divergence must be rechecked before any release.
PR26 iOS job 103564368076 in run 34697869406 completed SUCCESS at
2026-09-12T14:27:01Z; the earlier pending snapshot is superseded. This is source
branch simulator evidence, not integrated or physical-device acceptance.

## Dependency checkpoint

Reproduced released lock with pnpm 11.21.0 `install --frozen-lockfile`.
All-workspace audit: 2 Critical, 1 High, 2 Moderate; no Low/Info.

| Advisory | Path / exposure | Before | Corrected pin |
| --- | --- | --- | --- |
| GHSA-p293-qw3h-jr36 | root > next / production | 15.5.21 | 15.5.25 |
| GHSA-2xp9-vwfh-vxw4 | root > next / production | 15.5.21 | 15.5.25 |
| GHSA-rgj7-g3m4-5g8c | root > sharp; root > next > sharp / production | 0.35.2 | 0.35.4 |
| GHSA-82fw-gwwq-j7x9 | root/native-client/biometric-bridge > vitest / development | 3.2.7 | 4.1.11 |
| GHSA-82fw-gwwq-j7x9 | same three > vitest > @vitest/mocker / development | 3.2.7 | 4.1.11 |

Official evidence: [Next middleware advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36),
[Next image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4),
[15.5.25 release](https://github.com/vercel/next.js/releases/tag/v15.5.25),
[Sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c),
[Vitest advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).
Next 15.5.25 preserves corrected AVIF optimization; Vitest 4.1.11 is the supported
fixed 4.x release, with no 3.x backport. Its Vite peer range includes retained 6.4.3.
React/ReactDOM remain 19.2.8; SWC platform packages are 15.5.25. No framework migration.
Lock regenerated through pnpm, then frozen installation passed. Both full and
production-only audits returned zero findings. No override/suppression added.

Actual Windows x64 runtime before: Sharp 0.35.2, libvips 8.18.3, libheif 1.23.0.
After: Sharp 0.35.4, libvips 8.18.6, libheif 1.23.2 (including Next's resolved copy).
All Sharp platform entries upgraded to 0.35.4 and libvips packages to 1.3.3.
The native Linux architectures remain NOT_EXECUTED under the runtime hold.
`scripts/recovery-dependency-probe.mjs` passed PNG/JPEG/WebP/AVIF decode/resize,
four PDF serialization/readback probes, and malformed-image refusal.
Focused authentication/PDF: 5 files / 29 tests PASS under Vitest 4.1.11.
Native shared-client unit tests: 2 files / 6 PASS. Bridge unit tests: 1 file / 5 PASS.
Production build: PASS (Next compile and generate phases, telemetry disabled,
synthetic DB URL, no server launched). Development-only audit separately returned
zero findings. No test assertions or coverage thresholds changed.

## Bounded runtime recheck, 2026-09-12

Independent read-only review completed 15:10 UTC; no image rebuild was justified.
`EXTERNAL_RUNTIME_BLOCKED / ZLIB_VENDOR_FIX_UNAVAILABLE` remains mandatory.
Debian glibc 2.41-12+deb13u4 fixes [5450](https://security-tracker.debian.org/tracker/CVE-2026-5450)
and [5928](https://security-tracker.debian.org/tracker/CVE-2026-5928), but
[5435](https://security-tracker.debian.org/tracker/CVE-2026-5435) remains vulnerable.
Debian [zlib 85091](https://security-tracker.debian.org/tracker/CVE-2026-85091)
remains unfixed. [Ubuntu's September 11 adjudication](https://ubuntu.com/security/CVE-2026-85091)
reports no developer fix available and deferred vulnerable 24.04 packages.
[Node 24.21.0](https://nodejs.org/en/blog/release/v24.21.0) updates the zlib revision,
but its disputed gzwrite.c is byte-identical to 24.20.0 (Git blob
13a3700a83c7ca7f35608eda1f68b933c8e2e343; SHA256
2ce783294c688330c716bfe106f43167d3dae5be84994176bc304d205d4f5b04), retaining gz_vacate.
OS package status does not adjudicate Node's bundled copy. No waiver, alternate
scanner clearance, unsupported library transplant or local runtime fork accepted.
Operator lifecycle, architecture-native execution, fresh image scans, SBOM,
provenance, OCI index and dependent full-stack acceptance: NOT_EXECUTED, runtime hold.

## Protected data

Actual operational file: `C:/Users/rohit/Documents/school software/prisma/dev.db`.
Before: SHA256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`,
8,409,088 bytes, UTC mtime `2026-08-10T10:55:19.8897824Z`; no WAL/SHM/journal.
Only read-only metadata/hash access. No real workbook access. All DB writes, if any,
must use synthetic task-owned files. Final readback pending.

## Remaining acceptance

Source incorporation complete; final validation remains in progress. See checkpoint below.
No operational flags, release markers, provider settings or deployment changed.

## Integration checkpoint - 12 September 2026

All merges are normal two-parent commits on release/recovery-integration-1a:

| Source | Incorporated head | Merge checkpoint |
|---|---|---|
| PR24 | 5bf70e4c4be07b706224debe01a27c54fd0af096 | 38dd04dde8c9419fd1984057545871928e2038ac |
| PR25 | 67c504be6230f763663cf19faf50d9bc46dc6902 | 9243fc327ed51b1ad24ad5e04e72cb674838e88b |
| PR26 | d784262ccc78ae431a72a3934ced45198e4bfb4c | deb6e9e205f2ccc19732b42ea0b97f9c46c48c37 |
| PR27 | 283718fb5bedbc505302e55d7bc5214d8fa4d553 | 729df3f85263da5f82603de7d282aaf285452333 |

Dependency repair 9b692bff182f59a00ee86a82a7f17efdb6b448f0 precedes these merges.
Original feature refs are not written. PR27 uncommitted package/lock divergence was observed in its separate worktree and excluded. OCR PR19 ancestry remains excluded.

Conflict decisions: preserve both certificate and concession models, scripts, flags, middleware/security behavior and historical evidence; retain patched dependency graph. Both original feature migration names and checksum identities remain intact. Paired schemas now contain 375 models, SQLite has 29 migrations and PostgreSQL six; generated trigger parity contains 201 triggers. No historical migration was edited. The integration ledger records original source hashes separately from current reconciliation hashes; generation is not independent-review clearance.

The explicit format is NALANDA_RECOVERY_INTEGRATED:v48:certificates-concessions-items. config/recovery-source-contracts.json records all four source formats, discriminators, schema fingerprints, migration identities and exact collection/count inventories. v48 contains 307 arrays; v45 298, v46 301, v47 304. Legacy payloads did not emit schema fingerprints; registry matching validates the reviewed format and does not authenticate origin of arbitrary bytes. Missing/unknown collections, versions and identities fail before writes. Formats older than v45 require a separately reviewed adapter and are no longer presented as verification-compatible merely by integer comparison.

Nonempty SQLite original-source exports v45/v46/v47 and integrated v48 restored into union targets twice: 4/4 PASS before the additional migration-ledger and adversarial checks. Retained certificate service fixtures cover real generated Georgia Bold PDFs, charges, reissue, void, bulk resume and snapshot hashes. Combined v48 contains those records plus liabilities, payment attribution, active relief, reversal events, encrypted zero-income support and frozen dated item receipts. Additional review required strict scalar-field admission, supersession graph checks, artifact completeness and atomic rollback; those fixes and an expanded Prisma migration-ledger/upgrade/repeat matrix are now under validation. PostgreSQL remains PENDING hosted service CI; this is not Browser/HTTP acceptance.

PR27 source repairs: 67 export-like routes reviewed (45 bulk, 22 non-bulk), Student-only conditional flag mapping retained without gating historical finance; uncapped legacy roster reported honestly; governed roster download now enforces delegated own-child denial and logs the refusal. New guard regression 2 tests PASS; export contracts plus guard 7 PASS. Unsafe example contacts are nonnumeric placeholders; real contact validation remains unchanged. Recovery fixture builds a synthetic schema/users instead of depending on a missing or operational database. Fixture/workbook/export group 25 tests PASS. Master historical evidence now binds to admitted source commits plus the dated integration delta; 15 tests passed before later operator source changes were inventoried.

Independent review found and addressed download enforcement, misleading Student clearance, ungated HTTP, ignored registry errors, incomplete export capability checks and restore collision/timestamp gaps. Latest deeper backup findings are being validated; no final independent security clearance yet.

Runtime hold is explicit and reviewed: oci-image and synthetic-http have job-level false conditions, with a source comment naming EXTERNAL_RUNTIME_BLOCKED. Dependent index/Compose/full-stack jobs remain skipped. Removing the hold requires a reviewed fixed candidate and mandatory scans; it is not a waiver or green acceptance. No automatic rebuild is useful while upstream zlib remains unresolved. The operator v48 protocol has been reconciled, but its harness still rebuilds rather than consuming the exact scanned architecture artifact and has not proved the entire public CLI lifecycle. These remain named acceptance gaps.

Previously pending PR26 iOS job is now terminal SUCCESS: run 34697869406 / job 103564368076, completed 2026-09-12T14:27:01Z. That is historical PR26 simulator evidence, not integrated-candidate or physical-device acceptance.

Full regression, final TypeScript/build, hosted platform/PG results, protected DB final readback and tracker updates remain pending at this checkpoint. No main merge, release tag, deployment, real records, providers, messages, actual payments or operational activation.
