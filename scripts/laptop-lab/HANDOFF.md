# NPS-LAPTOP-LAB-D1P local handoff — 3 October 2026

Status: **D1P_SOURCE_PACKAGE_VALIDATED_EXECUTION_PENDING**. Local reviewed source only.

## Ownership and provenance

Sole implementation chat: `01a101a9-50f2-73f0-bc64-724876f081a2`.
Managed worktree: `%USERPROFILE%/.codex/worktrees/nps-laptop-lab-d1p/school software`.
Branch: `codex/nps-laptop-lab-d1p`. Only `scripts/laptop-lab/` is reserved.
The managed tool created and attached a new checkout from live-verified PR28
source `baa49c738e009f99c5e741a04bc3fe8f8862a848`, tree
`ee2b3a2f9eb3a5b45d456eb54547a983ab5991dd`. It was still the current committed
source at discovery; no historical rollback or dirty Task A copy was used.
No applicable AGENTS.md was found in the source or inspected parent chain.
See `OWNERSHIP.json`, `README.md` and `evidence/source-files.json` for reviewed
executable bytes. Final local commit identifiers are recorded in the terminal
addendum below; there is no public source branch or integration acceptance.

Task A confirmed no path overlap, its reviewer completed, and both heavy checks
finished. Before the D1P review, live task state was A active, B/C idle. D1P used
one implementation worker and one read-only reviewer, with no heavy job. C's
closure was accepted as owner-supplied handoff only; no C resource was inspected,
adopted or restarted. Its URL-verification denial remains unchanged.

## Three readiness decisions

| Decision | State | Evidence |
|---|---|---|
| PREPARATION_READY | YES | Managed independent branch, narrow ownership, available worker slot; non-network source tests |
| LOCAL_HARNESS_EXECUTION_READY | PENDING separate target/resource preflight | C1 owner-reported closure does not authorize a new listener, browser or load run |
| ERP_MEASUREMENT_READY | NO | No admitted artifact and no approved laptop consumer adapter/profile; no uncontended measurement window |

All executed scenario results are **HARNESS_ONLY**. Actual ERP, HTTP, database,
container, browser, idle baseline, recovery drill, thermal test and soak:
**NOT_EXECUTED**. No purchase, installation, paid rental, CI dispatch, source
push, release, merge, DNS/tunnel, real data access or account creation occurred.

## Package and validation

`config.mjs` validates explicit identities and bounds; `runner.mjs` schedules
and records correctness/outcomes with cancellation; `fixture.mjs` provides the
virtual clock and disposable invented map; `metrics.mjs` normalizes samples and
portable counters; `report.mjs` validates/summarizes/escapes offline evidence;
`output.mjs` owns bounded report files and cleanup; `cli.mjs` connects commands.
`host-preflight.ps1` is separately read-only. `lab.test.mjs` is the focused suite.

Commands executed in this owned worktree:

```powershell
node --test scripts/laptop-lab/lab.test.mjs
node scripts/laptop-lab/cli.mjs preflight --target memory://nps-d1p-fixture
node scripts/laptop-lab/cli.mjs sample --target memory://nps-d1p-fixture --output sample-d1p
node scripts/laptop-lab/cli.mjs sample --target memory://nps-d1p-fixture --output final-sample
node scripts/laptop-lab/cli.mjs report --input scripts/laptop-lab/outputs/final-sample/result.json --output final-report
node scripts/laptop-lab/cli.mjs runtime
```

Initial 31 tests passed. Review identified a cancellation race and malformed
stored portable-counter acceptance. Both were corrected with regression tests;
the suite now has 35 passing tests, no failures/skips, 318.9 ms test-run wall time
at the latest implementation checkpoint. The fixture now stores mutations in a
map before a separate readback, and database CPU/memory fields exist explicitly.
Independent final re-review found no remaining material source issue and reran
35/35 tests with zero failures/skips in 214.2 ms. CLI sample and offline report
commands passed; serialized JSON roundtrip was byte-identical. The runtime
refusal command exited 1 as required. All eight MJS files passed `node --check`;
PowerShell AST parsing and scoped publication/privacy/import checks passed.
The source imports no HTTP/socket/process-launch APIs. No whole-ERP regression
or installation was necessary. See `evidence/REVIEW.md` for review disposition.

The first sample recorded 12 actions in **670 virtual ms**, not elapsed load-test
time. No HTTP rate/capacity is claimed. The reviewed sample in `examples/` also
has 12 successful actions in 670 virtual ms, 7 sample ticks and no failures;
both are source fixture evidence. These are deliberately tiny execution times,
not a smoke run, idle baseline, sustained benchmark or compressed soak.
Tests removed their own report directories after validating ownership/hashes.
Retained sample reports are small task-owned files; no runtime cleanup was needed.

## Host, limits and sizing

Bounded read-only discovery: Windows 11 Home Single Language 10.0.26200,
Intel Core i7-11800H, 8 physical cores / 16 logical processors,
39.71 GiB usable RAM; retained snapshot at 12:26:36 UTC (17:56:36 IST) shows
16.05 GiB free RAM and system-disk free space 106.86 GiB of 932.85 GiB.
These free values are transient and not idle baselines.
Docker/WSL CLI presence is established; daemon, distribution, virtualization,
trusted temperature tools and throttling visibility are NOT_PROBED/UNAVAILABLE.
No host setup prerequisite has yet been proven absent, so no install decision
or request is justified by this source task.

Measured ERP envelope: UNAVAILABLE. Application bottleneck: UNMEASURED.
Smallest comfortable VPS recommendation and confidence: NOT_ESTABLISHED.
Existing profile floors (4 CPU, 8 GiB, 20 GiB free for local-single-node) are
configuration minima, not a measured sizing recommendation or laptop-to-VPS
equivalence. Same-host generator overhead remains a later measurement limitation.

Hyperscale remains the supplied quote only: INR 3,999 + GST/month and backup
INR 6/GB, billing basis/retention to confirm. No refreshed pricing or purchase
recommendation is made. NPS infrastructure accounting remains separate from
ARKAVIQ. A VPS comparison must use the same admitted artifact, scenario and
duration later, after explicit authorization; no provider comparison ran here.

## Next finite stage, not executed

1. Runtime owner approves/implements the laptop consumer through existing portable
   interfaces; Task A supplies exact qualified/admitted artifact identities.
2. Independently permitted target preflight confirms synthetic scope, owned ports,
   output, cleanup, monitoring and an uncontended window; then smoke/correctness.
3. Collect a real idle baseline and conservative representative steps (2, 5, 10,
   25, then 50 sessions only if measured headroom and owner limits support them).
4. Reuse existing portable backup/restore verification on disposable data. Do not
   build another recovery engine or fill the system disk.
5. Separately authorize a 6–24-hour wall-time soak after short tests pass, with
   maintenance window, ownership and shutdown controls. Nothing is scheduled here.

The mutation slice tested here is not a sufficient full-school action mix. Add
reviewed operation adapters under the same real admission boundary as needed;
do not infer school capacity from these tests or student counts. No automated
transition from this handoff into execution is authorized.

## Terminal local candidate and tracker readback

Reviewed implementation commit: `6c92a8137d3374b7a729194c53c6d4d62d4680dd`.
Implementation tree: `929e64c62def1cf2fa4711e83caf97626b189eb7`.
Exact staged manifest: 19 files, all under `scripts/laptop-lab/`; no foreign
staging. A following documentation-only commit records this addendum and the
sanitized tracker text. The implementation remains local and unmerged.

PR28 terminal comment: [5969185177](https://github.com/vsairohith67/nalanda-school-erp/pull/28#issuecomment-5969185177).
Actual content readback VERIFIED (2,452 characters after newline normalization).
The initial PowerShell comparison incorrectly treated command output lines as
an array; corrected JSON-body readback verified the same posted content. No
duplicate update was sent. PR28 was rechecked OPEN/DRAFT at unchanged baa49c7.

NPS board `1LzTSjaWjpOaHppTtyXqICkMbEgHbT6T-`, existing card
`nps-owner-decisions-custody-localfirst-text-20261003`: concise terminal append
VERIFIED byte-for-byte. Geometry x/y/width/height unchanged, 305 elements before
and after, zero unrelated element changes. No new task/card or mass overwrite.
Task A received the narrow local-only integration dependency and capacity closeout.

Final retained resources: three tiny generated report directories (`sample-d1p`,
`final-sample`, `final-report`) and the source bundle under ignored `outputs/`.
All test-owned temporary report directories were removed through exact manifest
cleanup. No process, listener, container or database was created by D1P.

The source bundle contains tracked lab paths plus START-HERE.txt; extract to a
fresh directory and run the README commands with existing Node. It requires no
school credentials, network connection, operational database or package install.
Archive entries and SHA-256 contents are checked against their source files.
Source files are local candidates, not published or admitted ERP artifacts.

## D2 — actual host and external storage preflight, 3 October 2026

**D2_HOST_STORAGE_PREFLIGHT_COMPLETE. This is not ERP_RUNTIME_READY.**
Resumed registered `codex/nps-laptop-lab-d1p` at
`94a1a82ca5d69a4e52bb6c8a3d791c44ddd57205`, tree
`27da2abe1e46105f08ff83e2ce361a911b436ae5`, with clean index/diff.
Both D1P commits were preserved. No rebase, code/framework change, 35-test rerun,
source push, CI or primary integration. Only this handoff, the aggregate D2 JSON
and ignored task-owned diagnostics/probe files were added. One worker sufficed.

| Item | State | Actual observation |
|---|---|---|
| Windows/resources | INSPECTED | Windows 11 Home Single Language 10.0.26200.9457; i7-11800H, 8 cores/16 logical; 39.71 GiB usable RAM, 19.20 GiB free; C: NTFS/NVMe, 105.67 GiB free at 17:47:12 UTC / 23:17:12 IST |
| WSL | INSPECTED | WSL 2.7.12.0, kernel 6.18.33.2-2, default version 2; default distro docker-desktop |
| Distribution state | INSPECTED | Initially all stopped. After owner reported starting Docker, docker-desktop Running; Ubuntu-24.04 and Ubuntu-22.04 still Stopped. No distro entered or started by this task |
| Docker local endpoint | PROBED_SUCCESSFULLY | No DOCKER_HOST/DOCKER_CONTEXT overrides; existing desktop-linux context points to npipe:////./pipe/dockerDesktopLinuxEngine; explicit context used, global default unchanged |
| Docker engine | PROBED_SUCCESSFULLY | Client/server 29.7.2, Compose 5.3.1; Linux x86_64, 16 CPUs, 20,815,958,016-byte memory ceiling (19.39 GiB), overlayfs; daemon root /var/lib/docker |
| Existing Docker usage | INSPECTED | Summary only: 54 images, 26 containers (1 active), 34 volumes, 213 build-cache items. No names/files/env/secrets/mounts inspected; no pruning or changes |
| Linux filesystem free space / VHD physical location | UNKNOWN | Ordinary distributions were stopped; Docker's managed distro was not entered. Windows C: space and Docker summary sizes do not establish Linux free space |
| External target | INSPECTED, OWNER CONFIRMED | D: Seagate Expansion HDD model, USB, exFAT; 931.48 GiB volume, 679.03 GiB free before write; reported Healthy/Online. Stable volume identity retained privately and rechecked before writes/copyback |
| Physical media/SMART/encryption/thermal | UNKNOWN | Model name is not a media/SMART certification. No sensor utility, repair, encryption or trust change |
| Tiny archive roundtrip | PROBED_SUCCESSFULLY | 1,048,576 invented bytes copied out and back; source/external/returned hashes and byte comparisons match; external/internal manifests reread identically |
| Container start / persistence | NOT_EXECUTED | No pull, build, hello-world, Compose up or container mutation |
| Real ERP smoke/load/recovery/soak | NOT_EXECUTED | Artifact/consumer/runtime gates unchanged; no timing or throughput claim |
| Sensitive-data backup / A3 custody | NOT_APPROVED_BY_THIS_TASK | USB archive usability does not establish runner-reachable Linux custody or permission to store private evidence |

Commands and exits: `wsl --version`, `wsl --status`, `wsl --list --verbose`
(before/after owner startup), `docker --version`, `docker compose version`,
`docker context show`, `docker context ls --format '{{.Name}}'`, filtered
`docker context inspect`, `docker context inspect --help`, `docker info --help`,
explicit-context filtered `docker version`, `docker info`, and summary-only
`docker system df` all exited 0. Each CLI query had a 12-second deadline;
none timed out. `wsl --help` returned its supported options but exit -1; retained
as that observed nonzero help result, not silently labeled PASS. No retry,
installation or reconfiguration followed. Original `host-preflight.ps1` ran
unchanged. Disk/volume metadata and archive script completed with exit 0.
Exact arguments, timestamps and aggregate values are in
`evidence/D2_HOST_STORAGE_PREFLIGHT.json`.

The user explicitly selected D: after seeing its minimal candidate metadata.
`D:/NPS-Lab` was absent; its new parent and the fresh child were created without
overwriting an existing path, after checking path type/reparse metadata:

`D:/NPS-Lab/preflight-20261003-811b929d43fb42f5bcbef6e55c202e65/`

Only `synthetic-archive.bin` and `manifest.json` exist as task-created files in
that child. They remain retained. Payload SHA-256:
`631B84027D6B9E52B539C4E8373622D23032DFADC64D60AF87339C9037E4F769`.
All writes used exclusive new files; source/external/return streams were closed
and reopened. No claim is made about hardware flush, power loss or cached-I/O
speed. Payload across all three copies totals 3,145,728 bytes; probe readback
counted 3,164,206 retained bytes including diagnostics/manifests, below 16 MiB.

Ignored internal directory `scripts/laptop-lab/outputs/d2-20261003-1791049576174/`
retains `.owner`, `bounded-query.ps1`, `host-current.json`,
`selected-volume-private.json` (stable volume identity; not for publication),
`synthetic-source.bin`, `synthetic-returned.bin`, `archive-roundtrip.json`, and
the 15 tagged CLI observation JSON files listed in the aggregate evidence.
Later tracker request/readback files are also task-owned metadata. No cleanup,
drive unplug, school-file copy, key generation or existing-data access occurred.
An initial diagnostic display accidentally counted an array's Length as byte
size; explicit `Measure-Object -Property Length -Sum` produced the retained
3,164,206-byte total above. Integrity comparisons were unaffected.

Storage split for a later approved lab: keep active Linux/container/database
working storage internal; use the external drive for completed synthetic
archives and only separately approved backup copies. Docker recommends Linux
filesystem paths for Linux-container bind mounts, rather than Windows-mounted
paths ([official guidance](https://docs.docker.com/desktop/features/wsl/best-practices/)).
No worktree, active database or Docker/WSL disk was relocated. A future real
restore belongs in a fresh isolated fast target. The archive copy is not that
restore test, and the external drive is not an A3 custody substitute.

No missing install prerequisite was demonstrated: the local daemon is reachable
after owner startup. Ordinary Ubuntu startup is unnecessary for this completed
bounded inspection; its filesystem capacity remains unknown. No service or
host action will be started automatically. **One next execution step:** obtain
explicit approval for one isolated synthetic container-start/persistence test
on the verified local `desktop-linux` engine, preserving existing workloads.
Actual ERP execution still separately requires its exact admitted artifact and
approved laptop consumer profile.

D2 tracker readbacks: the single aggregate-only append to existing D1P PR28
comment `5969185177` is VERIFIED (4,306 total characters including preserved
D1P history). Existing NPS owner-decision card append is VERIFIED; x/y/width/
height unchanged, 305 elements before/after, zero unrelated element changes.
Only these two records were updated; no claim of synchronization to other
trackers is made. PR28 remains OPEN/DRAFT, currently observed at a48c077; this
does not rebase or alter the independent D1P source. Final local documentation
commit contains only this append and the aggregate D2 evidence JSON.

## D3 — real isolated container persistence, 3 October 2026

**D3_CONTAINER_PERSISTENCE_VALIDATED_ERP_PENDING.** Independent source and
captured real execution evidence review PASSED; cleanup COMPLETE. This is a
synthetic environment result, not ERP admission or measurement readiness.
Resumed the same registered branch at
`de6b33953113e959389fa67eabf3fd8c8dfdcb11`, tree
`2e56eb7aabd3e583fdfcd413fb3a795399bee7ad`, preserving both D1P commits,
D2 history and the original ownership record. The owner's D3 request supplied
permission only for this bounded experiment; historical D1P runtimePermission
remains false for ERP execution. No donor/source copying, framework rebuild,
D1P 35-test rerun, remote push, CI or primary integration occurred.

Endpoint was rechecked before mutation: no DOCKER_HOST/DOCKER_CONTEXT override,
unchanged default `desktop-linux`, exact local
`npipe:////./pipe/dockerDesktopLinuxEngine`; every engine command supplied that
context explicitly. Linux x86_64, 16 CPUs, 20,815,958,016-byte daemon ceiling and
overlayfs observed again. Only existing IDs/states were captured privately;
26 pre-existing containers retained identical states, including one running.
No existing container environment, mounts, logs or contents were inspected.

The already-local helper was
`gcr.io/distroless/nodejs24-debian13@sha256:774b7d020b24214835769e24c3544835526cd0288f0b094eae48e8b2c2429a79`.
Its exact inspected local ID is that same sha256; Linux amd64, default UID65532,
no declared volumes and entrypoint `/nodejs/bin/node`. Both local image identity
and digest were unchanged after execution. The retained vendor authentication
in `docs/evidence/BACKEND_VENDOR_NODE_REMEDIATION_1A.md:33` identifies this exact
immutable base index; cached name alone was not the origin basis. This historical
Cosign evidence is not fresh scanning or product admission. No registry contact,
image acquisition, build, package installation or ERP image execution occurred.

| Stage | Actual result |
|---|---|
| First setup attempt | PARTIAL before any helper start: Docker canonicalized CHOWN as CAP_CHOWN, causing the strict representation assertion to refuse the stopped initializer. Its new container and volume were removed and confirmed absent; existing states unchanged |
| One permitted corrected retest | Fresh token/names/labels and volume; only CAP_ spelling normalized, no isolation/privilege relaxation. All 35 Docker command records exit0, no timeout/log overrun |
| Initializer | Empty ordinary local volume, no driver options or population; root with only CHOWN added, chmod0700 and chown65532:65532, exit0; removed |
| Writer | UID:GID65532:65532; exclusive payload.bin and manifest.json mode0600; fsync both files and directory, close/reopen/read/compare; 65,536 bytes, exit0/no OOM/stopped; removed before reader creation |
| Different reader | Distinct new container ID and exact same helper; named volume mounted read-only, actual file read/byte/hash/manifest/metadata comparison passes; exit0/no OOM/stopped |
| Read-only enforcement | Exclusive new probe open actually failed EROFS and no file appeared; no simulated refusal |
| Retest cleanup | Three settled exact owned container IDs removed, then exact owned unreferenced volume removed. All removal exits0; final ps and volume-list stdout confirm absence |
| Preservation | All26 previous container states identical, one still running. Cached helper/D2 files/external drive preserved. No newly owned Docker residue or running helper remains |

Host/writer/reader SHA256 is
`3e1ad9f8adf58c1ab4b4b6f5ff2f168e401400b5a55a71040704ea7fa011fc48`.
Expected bytes were computed on Windows from a fresh token; both helpers
actually read payload.bin and verified complete bytes, length and hash plus
the exclusive manifest. Reader file ownership65532:65532,0600, regular file,
single link and exact two-file set passed. The 64KiB payload plus tiny manifest
stayed below the1MiB payload/16MiB intended-output limits; the named volume has
no enforced16MiB quota claim.

Effective settings were inspected before each start and again after each exit:
`--pull=never`, overridden Node entrypoint, network none, IPC none, no host PID,
ports/devices/bind/socket/anonymous mounts; read-only rootfs, drop ALL caps,
no-new-privileges, non-privileged, restart no,1CPU,256MiB memory and256MiB total
memory+swap,64PIDs. Writer/reader added no capabilities; initializer added only
CAP_CHOWN and mounted only the new volume. No tmpfs was required. Container
environment exactly matched the inspected image defaults; no user/envfile
secrets were supplied. Fixed helper phases had60-second deadlines and bounded
262,144-byte command logs; ordinary queries had15-second deadlines. Recorded
retest window was18:20:01–18:20:09 UTC; this is not a throughput measurement.

Writer and reader both observed filesystem type61267,4096-byte blocks,
263,940,717 total blocks,218,366,687 available blocks /894,429,949,952 available
bytes through the new mount. This is Linux filesystem visibility, not physical
VHD placement, Windows allocated free space, encryption, thermal or performance
evidence. Fsync plus container recreation does not prove power-loss survival;
EROFS refusal is not comprehensive security qualification. No database,
backup/restore, host failure or ERP capacity experiment ran.

Retained small source helper `container-persistence-helper.mjs` SHA256:
`0182b8a686757173c52d7625783aebcab89aa535f63811cf0b8d12d11579d8dc`.
Inline Node program SHA256:
`7bba953b8da4f8e3667d557b0e309205d62d665acbdbb2db1ff8c2cd79ed1ab9`.
Exact executed corrected recipe SHA256:
`b5ce7dfcd60fd1928d493361976fe47f8eeb967e4a9c9e9e0e3fd02dee960f17`.
Three focused source tests passed in both the primary and independent reviewer
run. Reviewer independently recomputed the host expectation and reviewed all35
raw command records, effective settings, actual start stdout, identities,
writer-before-reader cleanup sequence and final absence/preservation queries.
This was source AND captured execution evidence review; no independent Docker
rerun, scanner clearance or device/power-loss testing is claimed.

Exact executed host invocations:

```text
node --test scripts/laptop-lab/container-persistence-helper.test.mjs
node --check scripts/laptop-lab/container-persistence-helper.mjs
node --check scripts/laptop-lab/outputs/d3-1791051003676/execute.mjs
node scripts/laptop-lab/outputs/d3-1791051003676/execute.mjs
node --check scripts/laptop-lab/outputs/d3-retest-1791051590896/execute.mjs
node scripts/laptop-lab/outputs/d3-retest-1791051590896/execute.mjs
```

The first experiment invocation exited1 on the pre-start assertion; corrected
invocation exited0. The two fresh ignored output directories preserve their
`.owner`, immutable experiment scripts, run-private.json and all tagged command
JSON stdout/stderr/exits. Concrete resource names/IDs/labels and EXACT Docker
argument arrays reside there, rather than publishing unrelated workload IDs.
Retest command tags08/09 create/inspect the fresh volume;10–16 initializer,
17–23 writer,24–30 reader;31–33 volume ownership/reference check and removal;
34/35 final actual container/volume lists. Each create uses volume-nocopy and
the inspected exact image ID. Every new resource ID was written to the private
manifest before inspection/start. Captured phase-effective-settings.json files
preserve final exit/security/mount results. First failure evidence is retained;
there was exactly one corrected retest, no policy-denial workaround.
Diagnostic/metadata files totaled437,657 bytes at closeout capture. Aggregate
publication-safe observations are in `evidence/D3_CONTAINER_PERSISTENCE.json`.
These diagnostics remain internal; no broad cleanup or old residue was touched.

D3 single append to existing PR28 lab comment5969185177 is VERIFIED by exact
JSON-body readback (6,479 total characters, D1P/D2 history preserved). Existing
NPS decision card append is VERIFIED byte-for-byte: x/y/width/height unchanged,
305 elements before/after and zero unrelated element changes. PR28 remains
OPEN/DRAFT at observed `a48c077cf7d803fa2e690d4fed7d0a6421924f8b`; its refs and
other writers were not changed. No duplicate discussion, card or task was made.

No missing install/helper prerequisite remains for this completed bounded
experiment. **One next ERP execution step:** existing portable-runtime owner
must approve/implement the laptop consumer/profile through its existing
interfaces, coordinated with Task A release-input owner supplying the exact
qualified/admitted artifact and relevant runtime execution authorization.
Those inputs are still pending; D3 neither produces nor approves them. Do not
start ERP or request another persistence test without a new demonstrated need.
External D: remains untouched by D3; D2 archive success does not establish
private student-data or signing-key custody. No restart/reconfiguration,
school records, keys, release change, installation, hosting or deployment.


## D4 — connected laptop consumer source, execution gated (4 October 2026)

**D4_LAPTOP_CONSUMER_SOURCE_VALIDATED_EXECUTION_GATED — LOCAL / UNMERGED.**
Implementation is source validated; profile approval is PENDING, artifact
admission is BLOCKED, and actual ERP execution is NOT_EXECUTED. D3 remains
complete and separately attributed. This is no new container experiment.

Starting local source:
`81f34a89e906c5a132638c94ad1a5feb88b93ff5`, tree
`cc3aabccc69fec2673697d3ee142b6199fba78d8`.
Existing branch `codex/nps-laptop-lab-d1p` and owner are retained.
D1P `6c92a8137d3374b7a729194c53c6d4d62d4680dd` /
`94a1a82ca5d69a4e52bb6c8a3d791c44ddd57205`, D2
`de6b33953113e959389fa67eabf3fd8c8dfdcb11` and D3 starting HEAD remain
ancestors. The reviewed comparison is
`a48c077cf7d803fa2e690d4fed7d0a6421924f8b`, tree
`d12b1745b376646fa5cba86bd9dea33a79cb9381`.
Its needed admission, target and process interfaces match the lab base.
No broad rebase, newer Task A source import or dirty-owner-file copy was needed.

Task A's existing owner performed read-only overlap checks before shared edits:
`http-target.ts`, the exact source registry and later `producer-process.ts`
were clean, without an active path-specific edit/reservation at that checkpoint.
This is observed coordination, **not** accepted reservation, runtime approval
or ownership transfer. The release lane retains future serial integration.
Original `OWNERSHIP.json` is a historical D1P scope record; D4's direct user
authorization extends this local source proposal to the two narrow interfaces
and exact candidate registrations. No Task A working file was changed.

| Connection | Implemented source |
|---|---|
| Existing CLI / typed profile / source binding | `cli.mjs` -> `consumer-profile.ts`, `consumer-identity.ts`; exact fields, source/tree/bytes, separate producer and consumer IDs, canonical owned paths and resource ceilings |
| Safe plan | `consumer-plan.ts`; exact profile/code identity, names, lifecycle, missing inputs, adapter availability and PLANNED_NOT_EXECUTED; bounded read-only Git, no Docker/file output/cache effects |
| Producer / execution prerequisites | `consumer-connection.ts:qualifyProducer`; genuine producer source/tree/raw CI reports -> unchanged `verifyArtifactEvidence` -> unchanged `assertRuntimeAdmission` -> distinct consumer authorization |
| Local endpoint / bounded lifecycle | `consumer-lifecycle.ts:LocalLifecycle`; fixed desktop-linux pipe, fresh output/collision checks, local exact image inspections, narrow overlay on existing Compose, owned create/dependencies/migration/readiness |
| Serving target / database / ownership | Optional typed local binding in `http-target.ts`; default hosted five-argument contract retained. Exact project/labels/images/database-secret path, localhost proxy, every service's owned network name/ID and no DNS overrides |
| Existing scenario / reports | `consumer-runner.mjs` invokes original `runScenario` and `reports`; original correctness, scheduling, cancellation, counters and writer reused. JSON/CSV/HTML retain HARNESS_ONLY and distinguish SIMULATED_SERVICE, SIMULATED_PROCESS and HARMLESS_CHILD_CAPTURED |
| Capture / failure / cleanup | Existing `captureProductProcess` with optional smaller output bound, unchanged 64MiB default. Immutable private resource snapshots; settled cleanup re-inventories exact owned resources and checks absence; no force/prune/global cleanup |

The production lifecycle constructs real fixed argument arrays at the existing
process seam: existing portable Compose `config --no-interpolate`, exact cached
`image inspect`, `create --no-build --pull never`, dependency/start
`up --no-recreate --no-build --pull never`, migrator attach/exit inspection,
readiness and serving inspection. It excludes seed, web-2, backup and QA services.
All nine services use explicit per-service CPU/memory+swap/PID ceilings and no
automatic restart. Its two owned volumes have no physical capacity/quota claim.
Effective limits, capabilities/rootfs/security, approved mounts and internal
network/volume drivers are checked. Partial launch/output, cancellation and
cleanup denial stay incomplete; uncertain Windows descendants forbid deletion.

No actual Docker query or command was executed in D4. The conditional lifecycle
was exercised through finite in-process Docker response doubles and actual
harmless Node children. The authenticated certificate adapter is explicitly
UNAVAILABLE; there is no memory-fixture fallback or user-selectable test bypass.
Actual fixture/authentication/readback/monitoring approval is a future input.

Exact remaining enforcement points are:
1. `scripts/portable/artifact-handoff.ts:assertRuntimeAdmission` still throws
   `EXTERNAL_RUNTIME_BLOCKED` after qualified hosted evidence. It is unchanged.
2. `consumer-connection.ts:REAL_PORTS.authorize` refuses
   `LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED`. Producer evidence cannot authorize
   a laptop. The portable/release owner must separately review the consumer
   authorization contract; no local boolean/file grants authority.
3. Real selection in `executeConsumer` / `runConnectedScenario` refuses
   `REAL_OPERATION_ADAPTER_UNAVAILABLE` before launch when the actual adapter
   is missing. `LocalLifecycle.bind` verifies the target but does not fabricate
   an authenticated operation adapter.

These require broader reviewed source/owner decisions before execution, even
after raw artifact inputs arrive. A3's actual identities/custody/materials and
product admission are not supplied or approved by this increment.

Focused final validation is **62/62 PASS**, independently rerun by the single
read-only reviewer; narrow consumer TypeScript check exit0/no diagnostics.
Original D1P **35/35 PASS** and four hosted portable regression files **93/93
PASS** were run by the primary. They cover HTTP target, artifact handoff,
operator CLI and QA producer/process contracts. These are 190 distinct source
tests across those groups; reviewer reruns are not counted again. No measured
HTTP/ERP throughput, scanner clearance or independent real runtime run is claimed.

Review corrected cleanup reconciliation/absence, output ceiling, exclusive
owned snapshots, exact observed source/transitive binding, all-report process
classification, specific refusal assertions, loader cache mutation and
per-service network names/IDs. Final review has no material source findings.
Reviewer actually ran the 62 tests and narrow TSC; it did not rerun hosted/D1P
suites, Docker, scanners or organizational approval. Reviewed shipping hashes
are recorded in `evidence/D4_CONSUMER_CONNECTION.json`.

Executed checks (existing installed Node/tsx/TS/Vitest; no installation):
```text
node --import tsx --test --test-reporter=spec scripts/laptop-lab/consumer-connection.test.ts
node --test scripts/laptop-lab/lab.test.mjs
node node_modules/vitest/vitest.mjs run tests/portable-http-target-1c.test.ts tests/portable-artifact-handoff.test.ts tests/portable-operator-cli-1c.test.ts tests/portable-qa-artifact-producer.test.ts --maxWorkers=1
node node_modules/typescript/bin/tsc --noEmit -p scripts/laptop-lab/tsconfig.consumer.json
node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.tools-core.json
node scripts/recovery-source-evidence.mjs
node --import tsx scripts/git-safety-check.ts
node --import tsx scripts/qa-real-data-onboarding-preparation-1a-public-repo-scan.ts
node scripts/laptop-lab/cli.mjs plan
node scripts/laptop-lab/cli.mjs runtime --profile ABSOLUTE_OWNED_PROFILE --expected-profile EXACT_PROFILE_SHA256
```
TS checks and test commands used TSX_DISABLE_CACHE=1 where applicable.
The first fixture run was 35 PASS/17 FAIL because invented Trivy rows omitted
Target; fixtures were corrected without verifier changes. Intermediate52,
54 and58 matrices passed. A later narrow TSC found a test-map possibly-undefined
type; explicit assertion corrected it, final reviewer TSC passed. A private
diagnostic wrapper initially encoded a path space incorrectly; fileURLToPath
fixed it before that wrapper successfully launched validation. Failures remain
attributed; no earlier failure is presented as a passed command.

The broader tools-core check is separate: it found missing local
`@tauri-apps/api/core` and `@tauri-apps/plugin-stronghold` and resulting
implicit-any in unchanged `apps/nalanda-cross-platform/src` files.
No package installation, stub declaration or native-source change was made.
D4's affected graph typecheck passes; baseline attribution and final safeguard
outcomes are recorded in the D4 aggregate evidence.

The starting-source compiler overlay reproduced exactly the same three native
diagnostics; it emitted/changed no source. The existing full publication scan
also exited1 on the unchanged D3 helper test's invented token literal
(`SECRET_LIKE_CONTENT_REFUSED`). Its bytes match the starting HEAD; no private
credential is represented by that deterministic synthetic test value. The
checker was not weakened and D3's test/evidence files were not rewritten.
Git candidate/staged/tracked safety check passes. Full publication clearance
remains BLOCKED on that prior literal; source-validation status is not a
publication pass. The later serial owner must resolve its classification before
any publication. D4 makes no push or publication claim.

Safe observed example: `node scripts/laptop-lab/cli.mjs plan` exited0 with
PLANNED_NOT_EXECUTED, runtimeSideEffects0 and no reserved output. It selected
the reviewed a48c077 producer source/tree, Linux amd64, independent fresh local
token, desktop-linux named pipe, nine containers/four internal networks/two
volumes, 1CPU/1536MiB memory+swap/128PIDs per service, 60s phase deadline,
1MiB combined command output and only 127.0.0.1:8443. No endpoint was probed.
The five listed missing requirements were:
PRODUCER_RAW_CI_EVIDENCE, QUALIFIED_ARTIFACT_ADMISSION,
LOCAL_CONSUMER_PROFILE_AUTHORIZATION, TASK_BOUND_PRIVATE_FIXTURE_AND_SECRET_BUNDLE,
AUTHENTICATED_SCENARIO_ADAPTER. Each appeared once. Real certificate_list was
UNAVAILABLE/fallback false. The ordinary CLI with its exact saved profile/hash
exited1 with PRODUCER_RAW_CI_EVIDENCE_REQUIRED and created no output.
Complete concrete profile/plan and refusal record are in this task's ignored
D4 validation directory. Regenerate profiles after commits, because observed
HEAD/tree and shipping bytes bind code identity.

The final public increment and exact changed paths are enumerated in the D4
aggregate evidence; final local commit/tree identifiers are in the terminal
packet and retained ignored closeout record, avoiding a self-referential commit
claim inside its own tree. Existing registration schema/base/historical heads
and foreign entries are retained. Only exact lab and two shared interface entries
are candidate proposals; combined-primary hash reconciliation remains a later
serial release-lane operation. Source registration is no admission clearance.

D4 diagnostics/new synthetic test directories are small, ignored and retained;
no recursive cleanup or previous denied cleanup was attempted. A new ignored
node_modules junction reuses the already installed runtime in the release
worktree; its target was never removed and no dependency/package files or
machine configuration were changed. D2/D3 tracked evidence/helper
bytes and historical output directories are preserved. D4 did not re-observe
the 26 old container states; those observations remain D3 evidence. No Docker/
WSL restart/storage move, external-drive write, real school-data access, key/
signing action, ERP/DB/listener/browser, image build/download, hosting, push,
CI dispatch, primary merge or PR state change occurred.

For the portable owner's serial source review: apply only this local increment
after the stated starting HEAD; the two shared optional interfaces retain hosted
defaults and are proposals until that owner reconciles/integrates them. Keep
profile approval, producer artifact admission and actual execution separate.
Tracker append/readback is PENDING at this source checkpoint; the terminal
record reports the final observed outcome. No exact separate lab Asana/Notion
identities were supplied, so none were inferred or duplicated.

**One next execution operation**, only after the missing approved inputs and
reviewed enforcement/adapter amendments exist: run the existing bounded
`node scripts/laptop-lab/cli.mjs runtime --profile ABSOLUTE_APPROVED_PROFILE --expected-profile EXACT_APPROVED_PROFILE_SHA256`.
D4 does not execute that step.

D4 local source checkpoint is `be7bc8c2809e330bee8da7f07b2257464695906a`,
tree `febce923c7e8e5ea2f7858050301ae8fff8cd261`; 21 exact changed paths are
listed in the aggregate evidence. This later documentation-only closeout records
the actual tracker outcome and source checkpoint; terminal final HEAD/tree
remain in the separate local closeout record. The eight reviewed source hashes
still match after commit, and no shipping code changed during this closeout.

PR28 existing lab comment5969185177 append is VERIFIED by exact body readback,
9,397 total characters with original D1P/D2/D3 history retained. Known board
card append is VERIFIED: exact new text/history, unchanged x/y/width/height,
305 elements before/after and zero unrelated changes. Fresh PR28 read is
OPEN/DRAFT at the reviewed a48c077 release SHA. No separate Asana/Notion lab
identity was inferred. Source registration passes325 files/four source heads/
four backup contracts; final closeout hashes are rechecked before committing.

At the 04:27:38 UTC diagnostic-size observation, this assignment's165 D4
synthetic/validation directories contained2,631 regular files totaling
21,123,237 bytes. Sixteen owned test links were counted without following them.
Directories/logs remain ignored and retained; no previous resource was cleaned.
The wall interval starts03:20:30 UTC; final observed end/elapsed are recorded in
the ignored closeout JSON, without claiming the planning allowance as work time.

## D4-R1 source qualification and adapter closure — 2026-10-04

This continuation starts at actual D4 final4020783, treeeeea2ae, preserving
reviewed be7bc8c source and D1P/D2/D3 history. One implementation writer and the
existing independent reviewer handled this increment. The existing release owner
explicitly transferred exclusive primary integration ownership at a48c077,
with individual amendments for acceptance-readback, acceptance-fixture and the
synthetic-foundation parameter type. Its only unstaged A3 HANDOFF is reserved
unchanged and is never imported or staged by this lab.

Pinned pnpm11.21.0 frozen offline installation in a fresh managed candidate
reused226 cached packages and downloaded none. Manifest/workspace/pin/lockfile
and approved build-script policy did not change. Pinned Prisma6.19.3 generated
only this candidate's client from the existing schema, without a DB connection.
The exact formerly blocked tools-core command now exits0; the three native
diagnostics disappear. No fake declarations, dependency graph changes, flags,
typecheck exclusions or skipLibCheck changes were introduced.

The full scanner first exposed the retained D3 test token, then a filesystem
availability byte count in D3's public aggregate and a D1P report-test sentinel.
The generating code proves these are synthetic test/observed filesystem values.
Future sentinels now use the established fresh UUID convention while preserving
the assertions. D3 filesystem availability is represented in MiB, exactly derived
from its old byte count; the original whole public JSON was copied privately
with its SHA256 before editing. Immutable old commits, original executed payload
bytes/hashes, helper source and private D2/D3 receipts remain intact. No experiment
was repeated. Scanner rules, severity, paths, exemptions and controls are unchanged.
The exact full scanner passes after these corrections.

Normal source flow is cli.mjs -> loadConsumerProfile/validateConsumerProfile ->
qualifyProducer -> verifyArtifactEvidence -> assertRuntimeAdmission ->
REAL_PORTS.authorize -> createLocalLifecycle -> resolve/reserve/prepare/launch ->
bind/prepareCertificateInputs -> boundCertificateAdapter/createCertificateAdapter
-> runConnectedScenario/runScenario -> existing reports/writeReports.
The former unconditional real adapter stub was a demonstrated missing connection.
It is replaced by the existing GET /api/certificates/requests (VIEW_CERTIFICATES)
and POST (MANAGE_CERTIFICATE_REQUESTS), using BONAFIDE request schema and same
serving DB readback. Unsupported operations refuse; no memory fallback exists.

Post-readiness preparation reuses the guarded synthetic foundation, existing OFF
fixture and ordinary OFF login. All application tables are locked and counted
inside the same serializable transaction before foundation upserts; a populated
or unproved database refuses. The private supplied password travels over bounded
stdin, never argv/environment/receipt. The actual owned proxy's public CA is read
through the existing fixed Caddy command; TLS verification remains enabled.
Actual container/user/session/database identities are resolved after readiness,
with a current actor-bound persisted session proved before the first business
request. Unexpected MFA or setup requirement refuses without changing feature
flags or invoking signed ON QA. Absolute total HTTPS deadlines complement socket
inactivity limits. Every POST ordinal is attempted once and an uncertain result
is never retried. Redirects, HTML/error/denied/malformed/partial/wrong-subject/
duplicate/stale-source/session/cancelled results cannot count as success.

| Enforcement point | Current behavior | Missing input or source amendment | Existing owner | Proof |
| --- | --- | --- | --- | --- |
| Pinned dependency/typecheck | Intended packages installed, exact check passes | None for this owned source candidate | Laptop lab | Frozen offline install and tools-core exit0 |
| Full publication | Synthetic fixture/representation collisions corrected | None for local and combined source | Laptop lab / release lane | Exact scanner and refusal controls |
| qualifyProducer / realSource / verifyArtifactEvidence | Genuine source/tree/run/attempt/architecture/image/scanner binding plus five reviewed operation helper blobs | Compatible producer source and genuine raw CI artifact evidence; old a48 image lacks these contracts; unresolved findings remain blocking | Existing artifact producer / release lane | Real CLI refuses missing raw evidence before effects; missing/changed helper bytes refuse PRODUCER_OPERATION_SOURCE_REQUIRED |
| assertRuntimeAdmission / RUNTIME_ADMISSION_HOLD | Unconditional EXTERNAL_RUNTIME_BLOCKED retained | Reviewed source-level admission amendment, qualified artifact and authorized execution; JSON cannot clear it | Existing portable/release owner | Symbol and source refusal tests unchanged |
| REAL_PORTS.authorize | Unconditional LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED retained | Separately approved exact local profile and reviewed enforcing amendment; producer receipt grants no consumer authority | Existing portable owner / Rohith | Independent identity/authorization tests |
| LocalLifecycle.bind / certificate adapter | Connected existing operation, fixture/login/current-target/session/readback path | Supplied task-bound private operands after the two prior holds are lawfully cleared | Existing portable owner / laptop lab | Controlled actual-source lifecycle/service/transport tests |
| Keys, custody, real data | Decisions preserved | Real keys deferred; production custody/retention and separate real-data approval unresolved | Rohith / existing A3 workstream | No key, signing, operational data or runtime action here |

Primary source populations are95 focused (original62 plus30 adapter plus3 producer-helper controls),38 original
D1P/future-D3 (35 plus3), and161 Vitest (including original93 portable plus
publication/service/bound-transport/foundation/stdin controls):294 unique cases.
Repeated primary/reviewer reruns are not added to that total. All are source,
controlled transport or harmless child evidence, never actual ERP performance.
Exact tools-core and affected tests-g-l checks pass; public scanner and Git safety
pass. Independent final reruns, scoped registration and combined integration/CI
state are recorded in D4R1_ADAPTER_CLOSURE.json and the immutable local terminal
record when observed. Review is source review, not organizational approval.

All private generated diagnostics/operands stay in existing ignored outputs/tmp.
The policy-denied old junction-removal command did not execute and was not retried;
the original D4 junction/dependency target and historical evidence remain intact.
Ten newly created synthetic test operand directories were retained by a bounded
native move into this task's ignored output after ownership/path checks.
No previous files/configurations/workloads or denied residue were cleaned.
Actual ERP execution, laptop capacity, hardware/native/browser acceptance,
Docker/WSL/storage probes, images, external-drive writes, hosting and admission
remain NOT_EXECUTED. Source publication status never substitutes for those gates.

One next execution step, only after the stated genuine inputs and reviewed source
amendments exist: run the existing bounded
`node scripts/laptop-lab/cli.mjs runtime --profile ABSOLUTE_APPROVED_PROFILE --expected-profile EXACT_APPROVED_PROFILE_SHA256`.
This continuation does not execute it.

### Managed serial integration checkpoint

The reviewed local donor is79c2701aca2f0a39d8746e504c8d3648e447ca4b,
tree5af0ef0e59dd752250ccf852d1366095922380b1. Its complete necessary
delta from commonbaa49c738e009f99c5e741a04bc3fe8f8862a848 is57 files:
47 existing lab source/evidence paths, five reserved portable paths, and five
new focused test files. Private outputs and the donor registry were excluded.
The immutable revision-two manifest retains every normalized file hash and
patch hash. All57 imported files matched exactly before the checkpoint.

Actual recoverya48c077cf7d803fa2e690d4fed7d0a6421924f8b was preserved;
its five shared starting blobs equal the true common source, so the reviewed
patch applied without conflict. Combined registration was recomputed from its
current299 records to346:47 new lab records, five existing shared hash updates,
all foreign records and their order preserved. Source, workflows, pins/lockfile,
schema, permissions, OFF flags, A2/A3 safeguards and admission holds outside
the exact58-path manifest (57 source/test/evidence plus registry) are unchanged.

The local integration checkpoint is141d6210bacfe4c99f0810520bf9e0794fc82aaa,
treed22f295414b068034730f64ddcc94accb7ce76b7. Its own pinned frozen offline
setup reused226 packages with zero downloads and generated the existing pinned
Prisma client without database access. Against its clean immutable HEAD, all294
unique source/control cases and exact tools-core, tests-g-l and narrow consumer
typechecks pass. This does not add reruns to the earlier294 population.

A first uncommitted preparation run is retained as95 attempted/38 passed/57
failed: the existing identity guard correctly refused old HEAD plus unbound
historical lab files, and the new owned diagnostics root lacked the original
runner marker. Review cleared the immutable source checkpoint, and the exact
marker was exclusively created after proving all root contents were newly owned.
The clean committed rerun passes without changing either safeguard.

Final combined publication/registration/Git checks, independent readback and the
single consolidated source push are recorded when observed. This checkpoint
does not claim remote CI completion or runtime/organizational approval. Public
source CI remains separate from the two unconditional runtime holds. The reserved
primary A3 HANDOFF remains unstaged with its original verified SHA256; it is never
part of this integration. Actual ERP execution and capacity remain NOT_EXECUTED.

Prepublication source review and checks are now complete: independent combined
95 focused and161 eleven-file cases, exact tools-core, full568-path scanner,
346-file registration/four historical heads/four backup contracts, Git safety,
and ordinary CLI plan/refusal all pass. All31 shipping hashes match the reviewed
donor and stayed unchanged during validation. The independently rerun population
is256 distinct cases; the complete primary population remains294. Current346
registration and historical donor334 are separately labelled. One consolidated
reviewed push and ordinary exact-source CI remain pending at this immutable
publication checkpoint. No product/runtime/native/signing/deployment workflow
was enabled, and the existing OCI source hold remains unconditional.

## D4 R2 — publication and immutable-source CI closure (4 October 2026)

Starting hosted source is e534120cb0ae015dc2cbd267ff8fb1dc6916294e,
tree 5a4bb7f9ef26aa784867814d706fbdaa2b69d44b. The separate unpublished R1
closeout remains 69ff618ca44fe6d57d9a1de19c3872de9f364cc8, tree
deebede2d983fde94c8d272570e47b90a46561d3, parent 41701f7. Its three metadata
changes were inspected and retained in its original worktree, not merged here.
Explicit bounded R2 primary ownership was transferred by the existing release
owner after confirming R1 return, no newer reservation, current source/index
and unchanged reserved A3 bytes. One implementation writer; independent AI
source review is separate from organizational registration authority.

Fresh paginated e534120 readback: nine workflows terminal, four SUCCESS and
five FAILURE; 29 successful, six failed and seven skipped jobs. P is the exact
five-path publication refusal; I is the same sixteen fixture-identity failures
repeated in three workflows; B is separate base-only amd64/arm64 qualification.
No current CVE inventory or overall-green claim is inferred.

The five reviewed regular text blobs are admitted only through the existing
communication scanner exact-path mechanism: .gitignore (9 bytes),
consumer-runner.d.mts (731), fixture.d.mts (186), output.d.mts (252) and
examples/operations.csv (218), all under scripts/laptop-lab. Their real MJS
declarations, generated-output exclusion and two bounded synthetic example rows
were read and checked. Generic extensions, roots, required artifacts, size,
prohibited extensions and every existing secret/contact check remain unchanged.
This does not introduce a binary-signature detector or expand contact screening.
Actual scanner controls cover reviewed files, unreviewed siblings/lookalikes,
invented secret patterns, oversize, prohibited extension, private output and
school-location refusal. No real secrets or records are used.

Old QA was executed in this fresh owned candidate at committed e534120 before
edits: the twelve product tests passed but only the tracked register changed,
to SHA256 835d7e1bab887193c82a82a4b0591559a95f3d9d39b976ed28de977c8c82c78c.
All sixteen bound-port cases then genuinely refused LOCAL_UNBOUND_SOURCE_DELTA
during setup, before adapter assertions. The original failures and bytes/hashes
are retained separately. No reset/restore was used to conceal the mutation.

Register derivation is now separate from CLI effects. QA selects --check; the
maintenance inventory command selects explicit --write. Default invocation
checks; unknown/combined arguments refuse before writing. Matching, stale,
malformed and missing checks never repair their input. Only CRLF is normalized
for Git's Windows representation; meaningful/format drift otherwise refuses.
Traversal and route/file ordering use documented UTF-16 ordinal comparison,
with LF JSON output and no time/random fields. All seven original inference
helpers are unchanged. All 365 pages remain; the resulting register is byte
identical to the old generator's actual output above.

Reconciliation is broader than a title edit: two certificate pages have six
stale indexed property changes. The print title now follows its rendered
Governed Graduation document heading. Graduation's index follows current
Graduation Certificates heading, inferred roles including PRINCIPAL/ADMIN,
VIEW_CERTIFICATES-only page literal, shared empty pattern and absent local
form/table audit state. The former appended graduation record moves into
canonical order. These are source-index inferences, not access grants; app,
permission, role, schema and adapter code are untouched.

New owned dependency setup reused the frozen pnpm 11.21.0 graph: 226 cached
packages, zero downloads. Prisma 6.19.3 was generated only into this candidate.
Package changes select the two inventory modes; dependency graph, pins, lock
and approved build-script policy stay unchanged. Original adapter/CLI/profile/
lifecycle/runner/reports and all 31 connection-source blobs remain unchanged.
EXTERNAL_RUNTIME_BLOCKED and LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED remain
unconditional. Artifact, custody, key, local profile and runtime approvals
remain separate. Rohith's owner self-review, deferred real keys and unresolved
production custody are preserved.

Implementation controls currently pass 31 distinct new cases. An initial
two-case test argument-table defect was corrected and retained; this was not
an application failure. Required committed-source prelude, sixteen-case,
full-regression, type/publication/registration and independent execution
results are recorded only when actually observed. At this checkpoint they
are pending, and no publication-ready or source-validation verdict is claimed.
Diagnostics stay outside tracked inputs. The scoped current registry preserves
foreign entries and ordering; the register's reviewed source hash above is
explicit because the existing registry verifier does not include this config
path in its protected-path population.

Actual ERP execution and capacity measurement are NOT_EXECUTED. No Docker,
WSL, external-drive, image, hosting, real-data, production-key or admission
action is authorized here. Next bounded action is the committed-source real
QA preparation sequence followed by all sixteen cases and full regression.

### R2 terminal readback — 4 October 2026, post-CI

Verdict: D4_R2_INTEGRATION_SOURCE_VALIDATED_RELEASE_GATED. Published source is
2113fa17bcda1acfb3edf5fa0d6ca9c2a21e8c7c, tree
c0aca53c31abef391ce4e4f6390325b57ce8bcdb. This is the only
new published code-bearing candidate; no retry, manual dispatch, cosmetic push,
main merge or tag. The starting e534120 SHA/tree and unpublished 69ff618
SHA/tree/parent remain as recorded above. Its exact three metadata-file delta
was preserved separately. The original A3 working-copy SHA256 remains
7725b5b23565871b81630e8eb0f4928ef4f021897ca0178c5fd11aab54ba480c;
it was never copied, staged or edited by R2.

The exact nine published paths are:
- scripts/qa-communication-delivery-foundation-1a-public-repo-scan.ts
- scripts/product-experience-screen-inventory.ts
- scripts/product-experience-screen-register.ts
- package.json
- config/product-experience-screen-register.json
- tests/laptop-publication-admission.test.ts
- tests/product-experience-inventory.test.ts
- config/recovery-integration-source-delta.json
- scripts/laptop-lab/HANDOFF.md

The reviewed five existing lab blobs are unchanged; admission is exact-path
only, as described above. All 31 connection-source blobs, D3 persistence
evidence and D4R1_ADAPTER_CLOSURE.json remain unchanged. Only two package script
values changed, with no dependency, lock, workflow, application, schema,
native, trust, key or profile changes. The final 348-file registry preserves
the 346 foreign-record order; two generator records were appended and only
three owned existing hashes changed. Tests and the register retain explicit
manifest hashes rather than widening the existing verifier's population.

Observed preparation and execution on this exact committed tree:
- Fresh owned synthetic target: migrate deploy 08:04:00.557–08:04:31.263 UTC;
  release-CI synthetic seed 08:04:32.007–08:05:49.679. No school records/default
  foreign DB were selected. The compatibility DB was created only from this
  newly owned synthetic baseline.
- Common real-prelude superset 08:06:05.501–08:16:07.172:
  qa:certificate-graduation; routes:list; lifecycle:backfill (DRY_RUN);
  migration:fresh-check; migration:existing-db-check; migration:restore-check;
  backup; Git safety; security:resilience:acceptance; qa:synthetic-pilot;
  qa:onboarding-preparation; qa:product-experience; qa:portable-runtime;
  qa:offline-sync; IAM/offline/security tests; test:cross-platform;
  app:typecheck; app:build:web; app:rust:test; corrected-scope acceptance;
  then actual qa:product-experience and all bound-port cases. Every command
  receipt binds HEAD/tree and tracked content before/after.
- Final non-writing QA: 12 PASS, 08:15:51.374–08:15:54.161. Then all sixteen
  bound-port cases PASS, 08:15:55.178–08:16:07.172, including the intended
  operation/deadline/transport assertions. This contrasts with the retained
  old twelve-pass QA/register mutation and sixteen genuine setup refusals.
- Regression populations, separately overlapping: baseline Node 38 PASS;
  connected consumer/adapter Node 95 PASS; related eleven Vitest files
  161 PASS; new scanner/inventory tests 31 PASS. The real unregistered tracked
  delta negative still refuses LOCAL_UNBOUND_SOURCE_DELTA before effects.
- Full unfiltered single-worker regression after preparation:
  321 PASS / 1 SKIPPED files; 3266 PASS / 3 SKIPPED cases, 08:18:27.293–
  08:42:20.346 UTC (1433.053 seconds). Existing deadlines, assertions,
  provider rules and cryptographic work were retained. The three local qpdf
  tests remain gated because QPDF_EXECUTABLE_PATH and QPDF_EXECUTABLE_SHA256
  were absent; no local tool install or skip override was used.
- tools-core, tests-m-r, tests-g-l and narrow consumer TypeScript PASS;
  cross-platform app types/web/Rust prelude PASS. Native Cargo generation
  left seven raw tracked TOML files byte-identical to HEAD; the verified
  exact-path index-stat refresh changed no bytes, index tree or source.
- All four required publication commands PASS with real comparison base
  104aacc7bd314cae82e60bb02b5c8a965c7ffedd: communication 572 paths/6 required;
  onboarding 572/10; real-user 572/8; biometric 3390 files. Registration
  348 files/four historical heads/four backup contracts and Git safety PASS.
  pnpm audit --audit-level high PASS with one MODERATE finding; this is
  not a zero-vulnerability or runtime-admission verdict.

Independent read-only AI source reviewer used configured GPT-6 Astra;
this is capability reporting, not model attestation or organizational
registration authority. Actual reviewer execution 07:52:36.473–07:56:42.084
UTC (245.611 elapsed seconds, check durations total 158.768 separately)
reran QA 12 -> bound 16 -> new controls 31 (59 distinct cases/four files),
affected TypeScript partitions, actual communication scanner, registration
and Git. It also reviewed actual five contents, nine-path manifest,
original inference helpers, final full-suite receipts and byte-preservation
evidence. No material finding remained; full-suite review was evidence
review, not an independent second full execution. Final hosted review:
independently reverified all nine terminal runs, 42 jobs and six source logs; no material finding or required source failure remains.

Exact manifest SHA256:
b12ee906f01a7ebf2b7537b9044ab7d4dd695c5c440b7ffd4f691607a1aace56.
One serial FF/push 08:46:39.658–08:46:43.903 UTC reverified ownership,
A3, remote ancestry, exact manifest and exclusion of 69ff618. PR28 remains
OPEN/DRAFT; PR29/P1, PR30/K30 and main remain untouched.

Fresh paginated normal PR CI on the exact published SHA, attempt 1, was
terminal at 2026-10-04T09:25:36.858Z. Nine workflows: eight SUCCESS, one FAILURE.
Forty-two jobs: 33 SUCCESS, two FAILURE, seven SKIPPED; zero pending, missing,
queued, cancelled or timed-out jobs. No source-regression failure remains.
The actual normal cycle ran from 08:46:47 to last job completion 09:24:21 UTC
(37 minutes 34 seconds elapsed; runs updated through 09:24:22).
Normal job coverage, provider parity, financial, native/simulator and compiler
checks remained intact.

Master's actual communication scan accepted 572 changed paths/six required
artifacts; its non-writing check covered all 365 pages; all sixteen bound
cases executed and passed. The subsequent full Windows suite completed
322 files / 3269 cases PASS, zero skips, at 09:09:40 UTC. Normal pinned qpdf
path/checksum enabled the three cases absent locally. Typecheck and production
build passed; genuine CI service metadata preparation, final validation and
allowlisted retention all passed. This was genuine hosted identity, not
locally fabricated GITHUB variables. Biometric, Communication and Real-User
each passed their real prelude and all sixteen cases in full regression;
their actual logs show 3266 PASS / three existing qpdf SKIPs. Onboarding and
Portable server also show all sixteen PASS and 3266 PASS / three existing
qpdf SKIPs.

Only failures are Portable base-input jobs arm64 111400082856 and amd64
111400083036, in 'Inspect and scan exact current input bytes privately';
actual private logs report BUILD_SCAN_ONLY_NOT_ADMITTED and exit 1.
A current CVE inventory was not derived, and no exception was applied.
The six mandatory holds are OCI image/supply chain, OCI release index,
portable stack, distributed runtime, object storage/recovery and full
synthetic acceptance. The optional same-run private Windows QA artifact
producer is also SKIPPED. These are NOT_EXECUTED/held, not passes.
Overall CI remains not green solely because of independent base qualification.

Every run/job below binds source 2113fa17bcda1acfb3edf5fa0d6ca9c2a21e8c7c,
attempt 1, completed status. The final paginated response retains full step
metadata, timing and URLs locally.

| Workflow run | Name | Outcome |
| --- | --- | --- |
| [37190024507](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024507) | Student items and prior-year concessions exact-head | SUCCESS |
| [37190024520](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024520) | Real-Data Onboarding Preparation 1A exact-head | SUCCESS |
| [37190024548](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024548) | Portable Staging Foundation exact-head | FAILURE |
| [37190024541](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024541) | Biometric Staff Attendance 1A | SUCCESS |
| [37190024516](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024516) | Communication Delivery Foundation 1A exact-head | SUCCESS |
| [37190024558](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024558) | PostgreSQL readiness dual-provider gate | SUCCESS |
| [37190024602](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024602) | Cross-platform apps 1A | SUCCESS |
| [37190024508](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024508) | Real-User Access Readiness 1A exact-head | SUCCESS |
| [37190024557](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/37190024557) | Master Requirements Reconciliation 1A exact-head | SUCCESS |

| Run | Job ID | Job | Outcome |
| --- | --- | --- | --- |
| 37190024507 | 111400082479 | exact-head-financial-contract (postgresql) | SUCCESS |
| 37190024507 | 111400082629 | exact-head-financial-contract (sqlite) | SUCCESS |
| 37190024520 | 111400082671 | Exact-head PostgreSQL 17 parity and provider-independent preparation | SUCCESS |
| 37190024520 | 111400082798 | Exact-head synthetic validation, security and full ERP regression | SUCCESS |
| 37190024548 | 111400082856 | Backend build/scan input qualification (arm64) | FAILURE |
| 37190024548 | 111400083032 | 1 - server and database | SUCCESS |
| 37190024548 | 111400083036 | Backend build/scan input qualification (amd64) | FAILURE |
| 37190024548 | 111404167877 | 2 - OCI image and supply chain | SKIPPED |
| 37190024548 | 111404168218 | oci-release-index | SKIPPED |
| 37190024548 | 111404168755 | 3 - portable stack | SKIPPED |
| 37190024548 | 111404169059 | 4 - distributed runtime | SKIPPED |
| 37190024548 | 111404169486 | 5 - object storage and recovery | SKIPPED |
| 37190024548 | 111404169757 | 6 - full synthetic acceptance | SKIPPED |
| 37190024541 | 111400082805 | Exact-head software, security and ERP regression | SUCCESS |
| 37190024541 | 111400082878 | Exact-head PostgreSQL biometric migration and parity | SUCCESS |
| 37190024516 | 111400082535 | Exact-head PostgreSQL 17 migration, repeat deploy, constraints and parity | SUCCESS |
| 37190024516 | 111400082699 | Exact-head communication, security, shared-platform and full ERP regression | SUCCESS |
| 37190024558 | 111400082953 | SQLite existing release gate | SUCCESS |
| 37190024558 | 111400083077 | PostgreSQL schema and migrations | SUCCESS |
| 37190024558 | 111400083102 | Cross-provider parity and recovery | SUCCESS |
| 37190024558 | 111400083105 | PostgreSQL application regression | SUCCESS |
| 37190024602 | 111400082993 | TypeScript, contracts and bundled shell | SUCCESS |
| 37190024602 | 111400083069 | Draft Rust 1.90 Linux aarch64-unknown-linux-gnu | SUCCESS |
| 37190024602 | 111400083103 | Draft Rust 1.90 macOS aarch64-apple-darwin | SUCCESS |
| 37190024602 | 111400083110 | Unsigned Windows NSIS compiler gate | SUCCESS |
| 37190024602 | 111400083123 | Draft Rust 1.90 Windows production and QA tests | SUCCESS |
| 37190024602 | 111400083158 | Draft Rust 1.90 Linux x86_64-unknown-linux-gnu | SUCCESS |
| 37190024602 | 111400083159 | Draft Rust 1.90 iOS aarch64-apple-ios | SUCCESS |
| 37190024602 | 111400083161 | iOS simulator build and shared UI gate | SUCCESS |
| 37190024602 | 111400083162 | Draft Rust 1.90 macOS x86_64-apple-darwin | SUCCESS |
| 37190024602 | 111400083169 | Draft Rust 1.90 Android i686-linux-android | SUCCESS |
| 37190024602 | 111400083171 | Draft Rust 1.90 Android aarch64-linux-android | SUCCESS |
| 37190024602 | 111400083178 | Android debug build and emulator UX gate | SUCCESS |
| 37190024602 | 111400083180 | Draft Rust 1.90 iOS x86_64-apple-ios | SUCCESS |
| 37190024602 | 111400083215 | Draft Rust 1.90 Android x86_64-linux-android | SUCCESS |
| 37190024602 | 111400083246 | Draft Rust 1.90 iOS aarch64-apple-ios-sim | SUCCESS |
| 37190024602 | 111400083269 | Draft Rust 1.90 Android armv7-linux-androideabi | SUCCESS |
| 37190024602 | 111400083855 | Same-run private Windows QA artifact evidence | SKIPPED |
| 37190024508 | 111400082683 | Exact-head PostgreSQL 17 migrations, constraints and parity | SUCCESS |
| 37190024508 | 111400082729 | Exact-head synthetic identity, security and full ERP regression | SUCCESS |
| 37190024557 | 111400082850 | Exact-head PostgreSQL 17 migration, repeat deploy, constraints and parity | SUCCESS |
| 37190024557 | 111400082935 | Exact-head requirements, security, shared-platform and full ERP regression | SUCCESS |


Artifact producer identity remains separate from local consumer identity.
EXTERNAL_RUNTIME_BLOCKED and LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED remain
unconditional. Owner self-review is still labelled as such; independent
organizational registration, genuine artifact/custody/key/profile/admission
decisions remain unresolved. Actual laptop ERP execution and capacity
measurement remain NOT_EXECUTED. No Docker/WSL/drive probe, container/image,
ERP listener, real data, keys, grants, hosting or new infrastructure was used.
Owned evidence and synthetic QA resources remain retained; previous denied
residues and unknown resources were not touched or retried for cleanup.

This post-CI appendix is intentionally unstaged in the legitimate primary
checkout; it is not part of the immutable published/qualified tree. It does
not rewrite the source registry or trigger another CI cycle. Tracker result
comments/readbacks and primary-ownership return are recorded separately in
the local terminal receipt. Measured test/review/CI intervals are listed
separately, without summing overlaps or claiming measured account usage.

One next action: the existing release owner obtains the genuine owner
decision for the already-recorded artifact, custody, local profile and
admission prerequisites before any runtime execution. R2 authorizes no
automatic follow-on runtime work.


Tracker closure: PR28 comment5969185177 append/prefix/exact readback VERIFIED;
Asana recovery1218421699989887 comment1219131803472513 exact readback VERIFIED,
prior comments/dates preserved and task/parent1218201854539166 still incomplete.
Canvs batch text exact readback VERIFIED: all 305 elements retained, the selected
card history/geometry/bindings preserved and all other elements unchanged.
Notion ledger page-level comment3efc9801-27a8-81ee-8005-001d7a26810a creation
was acknowledged, but repeated page/discussion reads still show the older
comment population: readback PENDING, no duplicate posted or page replaced.
Primary source editing is finished; exclusive ownership return follows through
the existing release owner and its recorded acknowledgement.
