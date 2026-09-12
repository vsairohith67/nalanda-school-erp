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

Source incorporation, combined schema/restore contract, full regression, independent
integration review, exact-head CI, public-artifact checks and tracker readbacks pending.
No operational flags, release markers, provider settings or deployment changed.
