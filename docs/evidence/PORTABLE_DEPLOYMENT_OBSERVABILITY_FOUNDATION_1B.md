# Portable Deployment and Observability Foundation 1B

State: RELEASE_BLOCKED_BY_OCI_SECURITY_GATE. Source implementation and scoped corrections are retained in PR #24. No clearance, merge, phase tag or activation is asserted.

## Owner-authorized synthetic CI exception

`SYNTHETIC_FULL_STACK_CI_EXCEPTION = OWNER_AUTHORIZED`

Scope: `EPHEMERAL_EXACT_HEAD_CI_ONLY`.

The owner explicitly authorized the inherited mandatory disposable full-stack CI rehearsal and equivalent isolated jobs in its dependency graph, including new operator commands against disposable synthetic targets. Its classification is `INTEGRATION_TEST_ENVIRONMENT`. This is not an operational deployment, private staging deployment, provider certification, hardware certification or production activation. The inherited gate must not be skipped or made optional.

Only ephemeral hosted runners may start the full synthetic stack. Resources, generated credentials and TLS material must be scoped to the run, bounded and removed with readback. Internal synthetic PostgreSQL 17/Valkey/MinIO/proxy/application communication is permitted; external telemetry and providers are prohibited. Cleanup failure blocks a successful rehearsal receipt.

No operational database records, real users/data, provider accounts/credentials, production secrets, public certificates/DNS, resource provisioning, OCR/models or flag activation are authorized. Backup remains v45. The exact original task remains the canonical scope; this evidence records the owner's later narrow exception without rewriting its historical generated prompt.

## Admitted base and retained protected work

- Fetched main: `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`; tree `2c7f1a129e6b98abb9689abf7c989b0ed8468561`.
- Ordered parents: `4a4df050d194104cfc497a6de790ca9553a69db6`, `c090c6fa8a6a253173ad62d3ff406adbfa2ec605`.
- Reconciliation tag: `master-requirements-reconciliation-v45-2026-09-04`; object `c93e5ea34cf4a8e3664f1ae408e22518c9ce0f68`; peeled commit equals main.
- Existing branch retained: `feature/portable-deployment-observability-foundation-1b`; no new task/branch created for the exception.
- PR #23 eight required feature-head runs verified completed/success: `33956729402`, `33956729398`, `33956729397`, `33956729399`, `33956729395`, `33956729403`, `33956729396`, `33956729400`, all at `c090c6fa8a6a253173ad62d3ff406adbfa2ec605`. Post-merge `33958115630` verified separately. These are prior-release passes.
- OCR PR #19 remains OPEN/unmerged at `1ba360b123ded770f1554d59fbd21c86b9943427`.
- Current visibility PUBLIC; main protected:false; repository and applicable rulesets empty. No settings changed, and passing CI is not evidence of enforced branch protection.
- Operational database fingerprint independently rechecked at continuation: SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, 8,409,088 bytes, UTC mtime `2026-08-10T10:55:19.8897824Z`, no WAL/SHM/journal. Its private absolute path remains in local admission evidence, not public source. No business records queried or used as fixtures.

## Inherited findings

Carry forward PR #23 scan `6ff2ab19-e579-4356-a6c2-447516d2c70d` Low findings `supply-chain.unverified-chocolatey-package` and `supply-chain.mutable-postgres-service-tag`. They concern disposable synthetic CI and remain recorded; this phase does not declare the inherited baseline vulnerability-free. Final changed-file scan and terminal exact-head CI are still required.

## Source implementation and measured local verification

All eight authorized source areas are implemented. Operator commands are `preflight`, `doctor`,
`install`, `initialise`, `migrate`, `backup`, `restore`, `upgrade`, `rollback`, `uninstall` through
`pnpm portable:operator COMMAND --manifest ABSOLUTE_JSON_PATH --target ABSOLUTE_TARGET_PATH`.
Dry-run is the default; `--apply` remains limited to explicit disposable hosted CI admission.
Complete lifecycle orchestration, partial failures, durable receipts, resume and data preservation
are tested through isolated filesystem/process adapters. The stack script invokes recovery
helpers directly; it does not prove the entire CLI lifecycle against running services.

Measured local evidence (2026-09-05):

- Focused corrected foundation: 81 tests, 3 files; operator 54, telemetry 21, OCI 6.
- Register validation: 13 tests. Additional portability/Technical Operations/parity-focused suites passed.
- Full Vitest before final scoped corrections: 250 files passed, 1 skipped; 2364 tests passed,
  3 qpdf tests skipped locally. All three subsequently passed using the inherited official qpdf
  12.4.1 archive, SHA-256 `3cd016cd433ef7232e42f4c13348a49cc14907a3c7278ef4f99120593126f7a6`.
  Corrected-surface tests supplement this earlier full run; exact-head CI remains authoritative.
- All 20 TypeScript partitions and production build passed; PostgreSQL parity 7 tests passed.
  Tools-core TypeScript passed after final operator corrections.
- Both inherited public-source scanners passed all 37 changed files with zero detected
  secret/contact/binary violations. Dependency audit reported zero advisories for the package graph.
  No dependency/lockfile change. License inventory retained existing obligations; no legal certification.
- Isolated real-component browser harness: 17 browser cases and 9 server-page permission/configuration
  cases; desktop/mobile, light/dark, keyboard/focus, reduced motion, permitted/denied roles,
  disabled/degraded and overflow states; zero observed console/hydration errors or external requests.
  Synthetic screenshots retained locally; harness listener stopped and read back absent.
  This is not a live Next deployment, physical-device or assistive-technology certification.
- Strict synthetic telemetry accepts only validated immutable enums/counters, bounds queues,
  strips no arbitrary log strings, and has no network transport. Existing certificate-request
  service tests preserve linked-child authorization, writes, return values/errors and single invocation
  with telemetry absent, disabled, failed and saturated. Telemetry is a library foundation;
  no production school transaction instrumentation or provider exporter is activated.

Independent operator/platform/accessibility/architecture reviews covered source, application security,
identity, privacy, school administration, finance, HR/child safety and release boundaries. Review corrections
include exact saved Compose comparison, competing operation reconciliation, operation-bound recovery
results, bounded image probes, source-bound cleanup admission and Windows synthetic path canonicalization.
The mutation admission check is repeated under lock before accepting a receipt or issuing effects.

## Immutable review and first exact-head CI

PR: https://github.com/vsairohith67/nalanda-school-erp/pull/24

First feature head: `4fe7042f7bc49d75b1d89d34ca1b3438123440c6`.
Changed-file security scan `be6a0d7e-f6dd-41ee-b947-27faa201d38f` sealed all 37 changed files
and found two Low CI evidence-integrity issues: `ci.unchecked-image-content-probe` and
`ci.unchecked-cleanup-inventory`. Both are corrected in subsequent source: a direct correctly quoted
probe propagates failure, and standalone checked inventory assignments refuse unknown cleanup state.
Exact extracted Bash blocks were tested without Docker: synthetic subprocess failure now returns 42;
empty successful inventory returns 0. No scanner finding is silently erased. A final corrected-head
scan and CI results must be read before any later release decision.

First feature-head runs:

- PostgreSQL readiness `33971764198`: all four jobs passed.
- Portable `33971764163`: server/database and both native image builds reached scanning;
  Grype failed both architectures. OCI index/full-stack/distributed/recovery/acceptance jobs skipped
  by the mandatory dependency graph. No synthetic full-stack cleanup or runtime pass is asserted.
- Biometric `33971764139`, onboarding `33971764199`, communication `33971764180`, IAM `33971764170`,
  master requirements `33971764140`, cross-platform `33971764135`: failed on four new Windows
  synthetic adapter tests caused by a temporary-path alias. Fixtures now canonicalise their newly
  created temporary directories; production symlink checks remain strict. These runs are not passes.

## Per-architecture security gate

Run `33971764163` built natively (no emulation requested; native dependency probe/provenance stages
were skipped after scanner failure, so full native evidence is incomplete):

| Architecture | Image ID | Bytes | Grype | Trivy |
| --- | --- | ---: | --- | --- |
| linux/amd64 | sha256:a073226886bdc1cd3eebcd270171eaa9138cec61a5512be60b504a011b9de97c | 623259411 | 1 Critical, 3 High blocking matches | 0 reported matches |
| linux/arm64 | sha256:38098089aa5a9683f6f88aba4968ee0bbd05b67d2548df66b559b275b225d004 | 625356714 | 1 Critical, 3 High blocking matches | 0 reported matches |

Both have SBOM and scanner artifacts retained by the workflow. Grype matched libc6
`2.41-12+deb13u3`: CVE-2026-5450 (Critical), CVE-2026-5928 and CVE-2026-5435 (High),
and zlib1g `1:1.3.dfsg+really1.3.1-1+b1`: CVE-2026-85091 (High).
The official Debian tracker lists the installed packages as affected. Its lower urgency for
some glibc issues does not override the owner's unresolved Critical/High release rule.
No ignore rule, scanner-threshold reduction, owner exception or baseline vulnerability-free claim
is introduced. Stable-runtime remediation and passing both architecture scanners remain mandatory.
Changing to an unreviewed distro or custom C library is not claimed as a safe completed correction.

Official source readback: [5450](https://security-tracker.debian.org/tracker/CVE-2026-5450),
[5928](https://security-tracker.debian.org/tracker/CVE-2026-5928),
[5435](https://security-tracker.debian.org/tracker/CVE-2026-5435),
[85091](https://security-tracker.debian.org/tracker/CVE-2026-85091).

## Remaining gates and closure boundary

Mandatory OCI security, native dependency/provenance/index completeness, disposable full-stack
runtime/recovery/load/cleanup, corrected exact-head full CI and final independent security readback
remain gates. These are foundation release failures/incomplete evidence, not merely deferred
provider/hardware certification. Provider/hardware/private staging/real data/users/activation remain
separate operational gates in every case. No merge, tag or tracker closure is authorized by partial
success. Existing trackers are left unchanged until verified release. Branch and PR remain retained.
