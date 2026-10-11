# RECOVERY-BACKEND-CONTRACT-CALLER-2B

LOCAL / UNMERGED. Starting commit `65f7c383dcf7bedd4cace9133795a75ed362fb9f`,
tree `9824733ba7b5909ddecff716491a82bfdb3f4ce2`. Existing owner chat
`01a0fdb5-9685-7992-968a-3c82fc815479` resumes its clean branch and worktree.
The direct user request renews exclusive implementation ownership. The duplicate
caller chat is idle; K30 is active in its separate worktree. No other writer is
delegated here. Existing certificates and the 2A packet remain unchanged.

## Acceptance matrix and ownership

| Missing connection | Coordinator-owned implementation | Required evidence |
| --- | --- | --- |
| Authenticated, noncircular input contract | `scripts/portable/product-input-contract.ts` | Strict schema, independent expected trust/identity, component/raw security and Node coverage, freshness and mutation refusals |
| Verified source to production command | `scripts/portable/product-build-scan.ts`, existing `rootless-build-command.ts` | Exact immutable context, production target, no QA trust, no mutable build network |
| Owned child and rootless lifecycle | Existing `producer-process.ts`, `synthetic-build-lifecycle.ts`, `qa-rootless-build.ts`, `qa-build-tools.ts` where needed | Harmless real children, retained startup/exit/timeout/interruption outcomes, unsettled/foreign cleanup refusal; original QA behavior |
| Exact OCI output and original reports | Existing `backend-build-scan.py` adapters plus adjacent bounded bridge | Descriptor/config/platform/layer binding, complete product reports, capture before parse, unchanged policy |
| Normal entrypoint and production trust refusal | Existing Python caller and TypeScript production wrapper | No fixture/environment trust override; retained blocked inputs cause no build or download |
| Source registration and review | `config/recovery-integration-source-delta.json`, this document; tests `product-*` and existing Python tests | Narrow registry delta, focused tests/typechecks/publication/Git checks, exact-candidate independent read-only review |

Production trust registration is unavailable. Test trust is generated privately
per test, outside supplied evidence, and only authenticates HARNESS_ONLY data.
No production authority or security exception is created. One heavy job at a
time in this task; independent review is read-only and runs no heavy job.

## Contract and connected enforcement

`NALANDA_PREBUILD_INPUTS_DRAFT_V1` is a bounded Ed25519-signed private envelope.
The verifier reuses the existing canonical JSON/schema, SHA256 and scanner policy
primitives and Node's standard Ed25519 verification. Expected key, exact envelope
subject, repository/workflow/source/tree/run/attempt/job/architecture, time and
complete executable/archive/version pins come from an independent `InputPolicy`.
Evidence cannot nominate any of those expected values. The normal resolver reads
`product-trust-registration.json`, which remains literal `null`. A non-null value
also refuses until a separately reviewed resolver registration is provided.
There is no CLI/environment key, test mode, operational enable flag or signing
service. No authority, approval, real signature, vendor assertion or timestamp
was invented. Generated test key pairs exist only inside ephemeral HARNESS_ONLY
fixtures; production rejects that namespace and the normal CLI records refusal.

Coverage is per component: runtime, builder and Dockerfile frontend OCI indexes,
selected platform manifests, configurations and all layers; ten executable tools
including BuildKit's runc; separate Node binary/source/provenance/inventory and
bundled OpenSSL/zlib/applicability evidence wherever Node is present; original
Trivy/Grype/SBOM bytes, process stdout/stderr/outcome hashes, tool identities and
fresh database identities. Runtime Node evidence cannot cover builder Node.
Missing/unknown schema, duplicate keys, malformed UTF-8, invalid JSON, excessive
structures, stale/altered bytes, unsupported metadata, suppressed findings and
unresolved applicability fail closed. Authentication does not replace security
policy evaluation. HIGH/unfixed coverage and existing publication/admission
policy are unchanged.

The caller reconstructs the complete Git tree from the authenticated inventory
and binds the raw Git commit to that tree. It copies only those source bytes to
an exclusive owned context and checks source, copied context, tool, OCI input,
database and command-map bytes before children. The reviewed recipe and effective
configuration are signed together. Local OCI layouts feed the shared production
command through named contexts and a deny-by-default BuildKit source policy;
network execution is disabled. The retained recipe's apt/corepack/package-install
acquisition has no qualified offline material contract and explicitly refuses
before a build. This is a real-input blocker, not a fabricated cache or permission
to modify Dockerfile pins.

The Python entrypoint now calls the TypeScript production orchestration after
host/source/registration guards. A fresh checkout with unregistered trust emits
bounded refusal metadata without requiring tsx installation or starting a child.
The orchestration invokes the existing rootless lifecycle and shared production
command, then identifies the exact OCI archive/index/manifest/config/platform,
uses existing scanner command adapters, captures every available original report
before parsing, and applies the unchanged report policy. Output archives/layouts
and individual reports are rechecked between stages; base-image reports cannot
substitute for the product. Scanner database cache files are complete and pinned:
Trivy `db/trivy.db` plus `db/metadata.json` (schema2), and Grype
`6/vulnerability.db` plus `6/import.json` (client schema6.1.4). Metadata, path,
size, uniqueness and every raw hash are checked; actual offline scanner status
commands must confirm the materialized database before a build can start.

Production tool archives additionally match existing `qa-build-tools.json` and
`backend-build-scan-tools.json`; buildctl/buildkitd/runc share the BuildKit archive.
Python/Node/Git executable and archive pins still require independently registered
production policy. No dependency or pin configuration was changed.

The production process runner uses argument arrays, a minimal environment and
bounded private outputs. It records executable/command hashes, exit/signal,
timeout/interruption/startup/I/O states, duration and settled status. Rootless
daemon diagnostics use that same capture machinery, with startup readiness owned
before events, PID/kernel-start cleanup and intentional shutdown distinguished
from premature failure. Every post-spawn path collects an outcome; an unclosed
child after termination is unsettled and retains its root. Existing QA defaults,
commands, process behavior and deadlines remain unchanged.

Failures stay separate from cleanup failures. A successful cleanup cannot erase
a failed phase. Missing/foreign/substituted ownership, uncertain child settlement
or unavailable diagnostic capture prevents destructive cleanup. No adoption of
unknown roots, global cache pruning, foreign process termination or cleanup of
other worktrees occurs. Original private reports/process output are retained
until owned cleanup; public results contain bounded byte identities/outcomes,
not raw reports, credentials or private paths. Historical diagnostics are not
removed. Hard process termination may leave owned residue for later inspection;
there is no automatic resurrection or invented ownership receipt.

The three decisions remain independent: verified pre-build inputs (A), a
built/scanned but unadmitted artifact (B), and existing runtime/release admission
(C). A never requires a future product admission receipt. B never calls C.

## Independent review and corrections

A separate read-only reviewer was requested using the configured GPT-6 Astra
model; the tool accepted that request. No independent model attestation is
claimed. The reviewer ran no tests/builds/scans and made no writes. Material
findings corrected in source and affected tests:

- Bind verified OCI input layouts and frontend to the real BuildKit command;
  deny registry/HTTP/Git fallback and refuse unresolved recipe acquisition.
- Bind raw process output and scanner databases; distinguish builder/tool Node,
  verify Node bytes in image layers, tool archive members and ancestor overlays.
- Preserve readiness retry semantics; prevent further launches after unsettled
  children; publish fresh-checkout trust refusal; propagate cancellation.
- Reject invalid UTF-8/JSON tokens; bind scanner-map bytes and returned executable.
- Materialize complete offline database caches and enforce existing tool pins.
- Capture daemon diagnostics, distinguish intentional shutdown, own startup
  events before awaiting and finalize unexpected process-identity errors.

Pinned primary-source checks informed the source implementation only:
[BuildKit v0.33 command options](https://raw.githubusercontent.com/moby/buildkit/v0.33.0/docs/reference/buildctl.md),
[Dockerfile forwarding](https://raw.githubusercontent.com/moby/buildkit/v0.33.0/frontend/dockerfile/builder/build.go),
[gateway named contexts](https://raw.githubusercontent.com/moby/buildkit/v0.33.0/frontend/gateway/gateway.go),
[Trivy offline database requirements](https://raw.githubusercontent.com/aquasecurity/trivy/v0.70.0/pkg/db/db.go),
[Trivy metadata](https://raw.githubusercontent.com/aquasecurity/trivy-db/a833f47f8f0d/pkg/metadata/metadata.go),
[Grype cache layout](https://raw.githubusercontent.com/anchore/grype/v0.110.0/grype/db/v6/installation/curator.go),
[Grype import metadata](https://raw.githubusercontent.com/anchore/grype/v0.110.0/grype/db/v6/import_metadata.go),
and [Grype schema](https://raw.githubusercontent.com/anchore/grype/v0.110.0/grype/db/v6/db.go).
These reads are not Linux qualification, scanner execution or vendor clearance.

## Validation scope and remaining real inputs

All connected positive execution is HARNESS_ONLY: generated synthetic trust,
fabricated component evidence, inert OCI bytes and harmless actual Python child
processes. This proves caller connections, byte/report binding and failure paths;
it does not prove real Docker/BuildKit, scanner, Linux namespace or ERP behavior.
Windows cannot prove descendant teardown after interrupted/timeout children, so
those production cleanup results remain unsettled/root-retained as designed.
The test fixture only disposes its own known finite synthetic children and files.

Real ERP image NOT_BUILT. Real build/scan qualification NOT_EXECUTED.
Production trust registration/evidence UNAVAILABLE: an owner must register the
expected authority, workflow/run custody and subject resolution, complete pinned
host tools, independently qualified runtime/builder/frontend, separate Node
bundled-library applicability, complete fresh scanner evidence and a reviewed
fully qualified offline recipe/material set. Existing real base/Node findings,
backend/native/runtime admission, device/MSRV/non-Windows and genuine artifact
qualification blockers are preserved. Installation/release NOT_CLEARED.
K30 untouched. No operational database/vault read, copy or hash occurred.

## Later serial integration checklist (NOT_EXECUTED)

1. Review this local contract/caller candidate and resolve the named independent
   trust/evidence owners and inputs. No supplied document selects its authority.
2. Recheck the actual primary and companion commits, concurrent ownership and
   exact source delta; independently review any integration conflicts.
3. Only under later authorization, integrate serially, rerun affected source and
   publication checks, then qualify real immutable materials on the permitted
   Linux architecture with the registered authority and complete private custody.
4. Any later product build/scan remains B only. Existing independent C admission,
   runtime/native acceptance and installation/release gates remain separate.

## Measured execution record

First measured 2B checkpoint: 2026-10-03 01:27:51 IST. Implementation/review and
harmless QA continued in this owned worktree; no claim of background execution
is made beyond terminal handoff. Account usage/cost and exclusive CPU/wait time
were not measured. Wall intervals and final exact-candidate checks follow below.

Investigative failures were retained and corrected: Python bytecode added an
unexpected context file (fixed using `-B`); a positive harness exceeded the
unchanged 15-second deadline (removed redundant Python recheck launches while
retaining direct byte checks); two type issues were fixed. No original assertion,
skip, crypto strength, worker count or deadline was weakened. Earlier runs passed
43 new cases, then150 combined cases, then122 cases across three matching files.
The three-file invocation accidentally used two nonexistent filter names; the
subsequent corrected five-file invocation passed178 tests at03:32:37 in79.35s.
That run preceded final daemon-event repairs; affected retests are required and
recorded separately, not silently represented by the earlier result.



Final full-suite command:
`node node_modules/vitest/vitest.mjs run tests/product-contract-caller.test.ts tests/product-build-command.test.ts tests/portable-qa-artifact-producer.test.ts tests/portable-artifact-handoff.test.ts tests/portable-publication-1c.test.ts --reporter=dot`.
Final run at03:42:21 IST: **178 PASS, 0 FAIL, 0 SKIP**, 92.99 seconds
(71 new contract/caller/daemon cases plus107 existing related cases). This includes
actual harmless child startup, file writes, nonzero exits, timeout, interruption,
partial/malformed/missing/substituted outputs and independent report preservation.
The earlier strengthened CLI test exposed a test-launcher failure (Windows import
URL and external fixture cwd's tsconfig resolution), not a valid trust refusal;
that launcher was fixed and the final test reads the real refusal result and empty
process list. A diagnostic run hit Vitest's sourcemap error rendering the child
loader error. Neither failure was counted as passing trust evidence.

`python -B tests/backend-build-scan.test.py`: **35 PASS**, 0.070 seconds, including
normal Python bootstrap refusal with no Node/build child and original34 tests.
Both affected TypeScript partitions (`tsconfig.tools-core.json` and
`tsconfig.tests-m-r.json`) passed using the existing noEmit commands; no framework,
application, DB, dependency or native build was run. Final logs and measured shell
intervals are retained in ignored `tmp/contract-caller-2b/`.

Source registration/check: **PASS**,286 files,4 source heads and4 backup source
contracts. Only the nine owned portable implementation entries changed; existing
base/heads/provenance/schema contracts and checker rules are unchanged. Both
public-repository scans **PASS** (490 changed files relative to existing
origin/main,8/10 required artifacts, no real data processing/activation). Git
safety and diff whitespace checks **PASS**. These source checks do not read an
operational database or vault.

Final independent read-only review found no remaining material source finding.
Its nine-file working-byte fingerprint is
`d7b144ff9c8563094c82cf6ee67d53197ba3c358d363ce6be74ebf7d3d6251f4`:
SHA256 of LF-joined `lowercase-file-sha256 relative-path` rows ordered as
product-input-contract, product-build-scan, product-scan-adapter, producer-process,
qa-rootless-build, rootless-build-command, synthetic-build-lifecycle,
backend-build-scan and product-trust-registration under scripts/portable.
The coordinator independently reproduced that fingerprint. Git's normal CRLF/LF
index conversion is not a source-semantic change; commit binding is recorded
below. Reviewer clearance is source-only and does not certify coordinator-run
QA, Linux, actual scanner/image/runtime or release qualification.

## Immutable local candidate

Source/test/registration commit `37dfe7ca57332e49bce64c50eda66446a0db6f55`,
tree `33fbe3fe785324d9326687aedb8c237e2be5352a`; parent is the exact reported
`65f7c383dcf7bedd4cace9133795a75ed362fb9f`. Prior ef006773 certificate fix,
c67c146a command preparation and65f7c383 documentation remain ancestors.
No amend/rebase/push/integration occurred. Source commit manifest:

- `config/recovery-integration-source-delta.json`
- `scripts/portable/backend-build-scan.py`
- `scripts/portable/producer-process.ts`
- `scripts/portable/product-build-scan.ts`
- `scripts/portable/product-input-contract.ts`
- `scripts/portable/product-scan-adapter.py`
- `scripts/portable/product-trust-registration.json`
- `scripts/portable/qa-rootless-build.ts`
- `scripts/portable/rootless-build-command.ts`
- `scripts/portable/synthetic-build-lifecycle.ts`
- `tests/backend-build-scan.test.py`
- `tests/helpers/product-contract-fixture.ts`
- `tests/product-contract-caller.test.ts`

Final documentation only adds this companion and appends a bounded2B section
to the existing HANDOFF.md. The earlier HANDOFF prefix is preserved byte-for-byte;
OWNERSHIP.md, MORNING_DECISIONS.md and TASK_DELTA.md are unchanged.
Protected Dockerfile, root manifest/lockfile, workflows, pins, null QA trust, flags,
schema/business/native/admission source have zero delta from the starting65f7c383.
Other owners may advance primary (live PR28 was observed OPEN/DRAFT at7566699862c34b18e98345cdf0d3ea1342e27748);
this task neither changes nor freezes their work. Previous companion/main/K30/P1
and their ledgers were not written.


## Terminal result and record readback

**BACKEND_CONTRACT_CALLER_SOURCE_VALIDATED_EXECUTION_GATED** — LOCAL / UNMERGED.
The independent reviewer bound source clearance to exact commit37dfe7ca/tree33fbe3fe,
confirmed all nine implementation blobs modulo only Git newline normalization,
and independently checked all nine registry hashes/provenance plus final refusal
test changes. No remaining material source-review finding; real execution gates
above remain unchanged.

One concise terminal result was appended to each existing record after a fresh
read. Actual written content was read back and compared:

| Record | Actual readback |
| --- | --- |
| [GitHub PR28 comment5962360886](https://github.com/vsairohith67/nalanda-school-erp/pull/28#issuecomment-5962360886) | Body matches the written UTF-8 source. PR remains OPEN/DRAFT at7566699862c34b18e98345cdf0d3ea1342e27748; refs unchanged by this update. |
| Asana recovery task1218421699989887 | Comment1219121164702860 exact text matched; notes, completed=false, assignee, due/start fields unchanged. |
| Notion requirements ledger3b6c9801-27a8-81da-bcbd-cbd62189364d | Comment3edc9801-27a8-81a1-b5aa-001ddc3fdb63 in the existing discussion; exact text and all18 prior comments preserved. |
| Canvs existing backend text | Exact appended text retrieved on303-element board. Prior target text, geometry, bindings and all302 other elements unchanged. No K30/P1 card changed. |

No parent task was marked complete. No connector fallback or duplicate append was
needed. Readback proof is retained privately under the task's ignored log directory.

Measured final validation: final full Vitest shell interval94.08s (Vitest92.99s);
Python plus first final tools typecheck12.11s; tests typecheck12.17s; frozen two
partitions23.98s; source/publication/Git safeguards30.71s. Source was frozen in a
local commit at approximately03:46 IST; tracker writes/readbacks03:48-03:49.
These are measured wall intervals, not CPU/account consumption. Earlier iterative
runs/failures are recorded above, not added into an invented usage total.

**ONE next action:** review the local contract/caller candidate and resolve its
named trust/evidence inputs before later authorized integration and genuine
artifact qualification.
