# Release recovery 1C — engineering checkpoint, 2026-09-20

**RELEASE_RECOVERY_1C_PARTIAL_WITH_NAMED_GAPS**

This checkpoint starts at `a2180b6e8b073ba84f61c494d44e84d13a77c373`, tree `4d64b07e635d7fcf29b0a8c80213ef7ea4264190`, on retained PR28 / `release/recovery-integration-1a`. Released main remains `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`. The earlier `73d8dbd` baseline and all admitted PR24–27 source history remain reachable. OCR PR19 remains excluded. No application, dependency, database-schema or migration pin/version changed. The integrated backup contract remains `NALANDA_RECOVERY_INTEGRATED:v48:certificates-concessions-items`.

## Concrete changes and limits

- Removed latent public `oci-layout/` and `oci-release/` uploads. They were behind disabled jobs; no new disclosure was observed. Exact allowlisted projections contain source identifiers, hashes and result metadata only. Native private-only guards remain. No historical artifact was deleted.
- Extended the existing genuine-exporter recovery suite to independent A/B targets for every v45/v46/v47/v48 contract and both providers. Each target is checked empty except exact migration-authored reference rows, restored fresh, and restored again. Independent sentinel writes, source snapshots, financial sums, artifact bytes/hashes, ownership, history and provider/session safety are asserted. A separate mapped-account probe verifies restored sessions are revoked; it is not counted as another fresh restore. Failed cases cannot emit passed matrix rows.
- Added raw-report/receipt validation binding source, current input hashes, architecture, pinned bases, configuration digest, architecture manifest/index digests, SBOM, scan reports, scanner/database metadata and provenance. Artificial descriptors are labelled `HARNESS_FIXTURE_ONLY` and cannot qualify runtime. Missing, malformed, stale, conflicting, suppressed High/Critical and substituted evidence fails closed. No editable pass boolean grants admission.
- Moved future stack execution onto each architecture's image runner. Compose has no application build directive and consumes the admitted configuration digest with pulls disabled. Exact infrastructure pins are preloaded and scanned separately. Full running-image checks reject tag substitution and application-code mounts. Independent workflow teardown is retained alongside harness `finally`; repeated cleanup verifies absence rather than reconstructing removed secrets.
- Corrected a proven latent workflow defect: inherited Trivy action commit `a9c7b0f06e461e9d4b4d1711f154ee024b8d7ab8` returns upstream HTTP422/no commit. The intended upstream **v0.36.0** resolves to `ed142fd0673e97e23eac54620cfb913e5ce36c25`; that exact commit is now pinned. Severity thresholds were not lowered. [Upstream action](https://github.com/aquasecurity/trivy-action/tree/ed142fd0673e97e23eac54620cfb913e5ce36c25).
- The public CLI parser/dispatcher is exercised across all ten commands through bounded in-process adapters, including failures and durable resume. A real CLI subprocess denial test proves no target creation before qualification. A separate real-process runner implements a subset of deployed lifecycle scenarios and explicitly fails completion while its pending scenarios remain.
- Added a partial authenticated production-OFF HTTP driver with independent business-table snapshots, actual login, preview receipt and flag-denial assertions. It requires exact image admission, a nonempty synthetic fixture, owned PostgreSQL namespace, loopback resolution and explicit synthetic CA trust. **It is not executed and fixture preparation is not complete.** Discovery records all required ON/browser/native scenarios as pending, not passing.

## Newly executed local evidence

`tmp/recovery-1c/restore-sqlite-v4.log`: four contract tests pass, **8 independent fresh SQLite restores +8 repeats**. Every contract v45, v46, v47 and v48 has distinct A/B files, with source and sibling isolation proven. Collision, ownership omission, atomic interruption, valid retry, unknown/fingerprint/version rejection, missing collection and altered artifact checks remain. Genuine historical exporters and migration checksums are preserved. Business/security tables are empty before each initial restore; SQLite's seeded reference counts are IamSafetyLock1, SupportQueue8, SupportCategoryPolicy18 and OperationalCheckDefinition13. PostgreSQL runs through the existing hosted financial workflow after push; no local PostgreSQL service or unqualified historical server was started.

Focused publication/artifact/operator/discovery/release-state checks: **132 passed**. Broader retained register/portable/feature-flag regressions: **193 passed across13 files** (includes those132). Affected tools/tests TypeScript partitions and portable source bundle passed before this checkpoint. Twelve fresh package audits (root plus three workspace packages; all/prod/dev separately) returned zero findings. Public-source/private-artifact scan passed. YAML parsed for all workflows, the seven canonical portable job IDs are preserved, PowerShell parsed, and whitespace checks are required before commit. Final exact-head full regression/build/database/native source workflows remain a post-push gate; this document does not predeclare their outcome.

Earlier failed local restore attempts are retained: exact migration-seeded baseline correction; missing local user/session mapping expectation correction; Prisma Decimal JSON-transport cloning correction. No production restore code, validation check or historical migration was weakened to fix these harness assumptions.

One independent read-only reviewer examined publication bypasses, raw-report semantics, image substitution, receipt timing and source/target isolation. Findings corrected include ARG-based Dockerfile pins, admitted image propagation, supported Compose flags, suppressed findings, full running-container inspection, infrastructure preload, independent teardown and HTTP hostname/CA prerequisites. This is source review, not runtime qualification.

## Mandatory coverage mapping and remaining work

| Existing group | Location after change | Execution / limitation |
|---|---|---|
| Server/database | `server-and-database` | Existing full source tests/build retained |
| OCI/native supply chain | each native `oci-image` runner | Hard disabled; no image built/scanned here |
| Multiplatform index | `oci-release-index` | Explicit metadata aggregate only; no deployable OCI index retained |
| Portable stack | `qa-stack.ps1` inside image runner; `portable-stack` verifies both receipts | Same-runner orchestration implemented; NOT_EXECUTED |
| Distributed/resilience/offline/shared client | `distributed-runtime` | Existing commands retained; runtime-dependent skip remains mandatory blocker |
| Object/recovery | `object-storage-and-recovery` | Existing commands retained; runtime-dependent skip remains mandatory blocker |
| Full synthetic / focused products | `full-synthetic-acceptance` | Existing commands retained; source builds are not substituted for the scanned app |

| Type | Remaining prerequisite / concrete action | Required proof | More code? |
|---|---|---|---|
| Engineering | Finish the distinct independent-target public-CLI object restore, initialisation target, deployed interruption/resume and data/key readbacks | Real CLI subprocesses, separate empty target, authoritative contents, bounded failures, verified teardown | Yes |
| Engineering | Reconcile immutable PostgreSQL production artifact with the existing SQLite-only synthetic QA-ON mechanism | Narrow independently reviewed test profile; production remains OFF; no auth bypass | Yes |
| Engineering | Complete PR25/26 ON HTTP fixture/actions and wire retained PR27 flows; finish actual browser/native drivers | All required business state/audit/download/payload/focus scenarios; no mocked success | Yes |
| Engineering/privacy | Resolve inherited onboarding happy-path contact fixtures without plausible real numbers or weakening real-contact validation | Valid synthetic fixture design; public scanner and real validation both pass | Yes / reviewed fixture design |
| External runtime | Preserve 1B's unresolved vendor OS/bundled-Node findings; no new vendor experiment in 1C | Supported exact amd64/arm64 artifacts, current zero-unresolved-Critical/High scans, native/SBOM/provenance evidence | Conditional |
| Historical runtime | Distinct qualified historical/current image pair with compatible schema/backup contracts | Actual upgrade and compatible rollback; incompatible rollback refusal | Qualification plus harness completion |
| Runtime acceptance | Execute completed harnesses only after artifact/dependency admission | Authenticated OFF/ON HTTP, browser and actual operator evidence; cleanup readback | Execution plus above fixes |
| Owner / environment | Approved private artifact retention and staged/pilot/cutover/privacy decisions; required installed Windows and physical Android/iPhone/iPad access, signing where required | Separate evidence for packaging, PIN launch, authenticated installed app, physical devices; owner decisions recorded | No substitute source test |

No new requirement is marked complete. Canonical release readiness still requires exactly one PASSED result per mandatory and additional gate. Expected private-publication skips remain separate from mandatory runtime skips. Compilation/PIN evidence is not installed/authenticated/physical-device proof.

## What is now ready when the runtime qualifies?

The existing `Portable Staging Foundation exact-head` workflow contains the future same-runner sequence: build, inspect, two scans, native probe, `scanner-metadata.mjs`, `capture-artifact-evidence.ts`, `qa-stack.ps1`, independent cleanup, metadata projection. **Do not dispatch it expecting acceptance until the reviewed hard hold and engineering gaps above are resolved.** `admit-artifact.ts` retains a non-overridable `EXTERNAL_RUNTIME_BLOCKED` exception.

Safe source commands now: `pnpm exec vitest run tests/portable-artifact-handoff.test.ts tests/portable-publication-1c.test.ts tests/portable-operator-cli-1c.test.ts tests/portable-acceptance-discovery.test.ts`; `pnpm exec tsx scripts/portable/operator-acceptance.ts --discover`; `pnpm exec tsx scripts/portable/integrated-acceptance.ts --discover`. Discovery is not acceptance. The existing financial workflow runs the real provider restore matrix and uploads only its exact sanitised summary file. No synthetic fixture can clear real artifact qualification.

## Safety and final readback

Before-work operational DB file hash matched `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, size8409088, mtime2026-08-10T10:55:19.8897824Z; no WAL/SHM/journal. The pre-push read-only hash/size/mtime and absence of sidecars match again; final live refs are required in the terminal report. No SQL connection to that file. All25 flags remain OFF/0%; all46 requirement IDs, owner corrections and migrations remain unchanged.

No application server, image build or container stack was started in this pass. Synthetic local fixtures/logs remain under ignored task-owned paths. The old policy-denied recovery residue and five other-task PR27 packages were untouched. No merge, tag, original PR closure, registry, purchase, deployment, real contact/record processing, communication, payment, OCR/model/provider activation or production telemetry occurred.

Final SHA/tree, terminal run/job links, hosted PostgreSQL matrix, elapsed time, DB readback and narrow tracker results belong in `tmp/recovery-1c/final-report.md` and PR28's dated delta after CI. Tracker failures require an explicit unapplied patch. This checkpoint is intentionally partial; it does not claim all independently requested harness code is finished.
