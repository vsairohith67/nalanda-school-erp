# NPS laptop lab source package D1P

This is a small, dependency-free Node package for **HARNESS_ONLY** source tests.
It has a connected scenario scheduler, response correctness checks, resource and
portable-counter processing, and offline JSON/CSV/HTML reports. It cannot start
the ERP, send HTTP, create a database, start containers, or launch a browser.

Run from the independently owned worktree, using existing Node 24.19.0 or a
compatible already-installed Node with `node:test`. No installation is needed.

```powershell
node --test scripts/laptop-lab/lab.test.mjs
node scripts/laptop-lab/cli.mjs preflight --target memory://nps-d1p-fixture
node scripts/laptop-lab/cli.mjs sample --target memory://nps-d1p-fixture --output example-one
node scripts/laptop-lab/cli.mjs report --input scripts/laptop-lab/outputs/example-one/result.json --output report-one
node scripts/laptop-lab/cli.mjs runtime
```

The last command **must exit 1**. It is a refusal check, not a launcher. Output
names must be fresh simple names, never paths. Existing output is not overwritten.
`sample` executes only an invented in-memory fixture with a virtual event clock;
its times and rates are not measured wall time or ERP throughput. The output
directory is `scripts/laptop-lab/outputs/<name>/`. Reports are readable offline.
Do not use the Codex browser or any denied Task C resources to view them.

For an edited scenario, copy `exampleConfig()` fields into a small JSON file,
then provide `--config FILE --expected-config SHA256 --target memory://nps-d1p-fixture`.
The expected hash is SHA-256 of `JSON.stringify(config)` in its saved key order;
use exported `hash` and `preflight` when consuming the API. Explicit source/tree,
fixture subject, profile and hash must all match. A hash binds configuration,
not authority: no value in JSON can grant actual runtime permission. Credentials,
personal IDs and arbitrary URLs are not accepted configuration fields.

## Existing facilities and finite scope

The existing `scripts/security-resilience-local-load.ts` checks pure rate-limit,
semaphore and provider-timeout behavior. It has no reusable scenario/report
scheduler. This package follows that local-adapter approach with Node built-ins,
without a second monitoring platform or changes to dependencies.

Operations come from the actual `app/api/certificates/requests/route.ts`:

| Operation | Actual route | Fixture correctness |
|---|---|---|
| Read | GET /api/certificates/requests | JSON, status 200, exact ordered invented IDs |
| Disposable mutation | POST /api/certificates/requests | JSON, status 201, expected request/student, SUBMITTED, one separately read in-memory effect |

The default disposable mix is four reads to one creation, 2 virtual users,
maximum 2 in flight, maximum 20 action starts/second, 100 ms think time,
150 ms action timeout, 1,000 ms maximum virtual duration, and 12 actions.
These are proposed source-fixture controls, not a production action mix or SLA.
Mutation is forbidden in the distinct `read-only` scenario. No failed write is
retried; timeout/cancelled/failed mutations remain potentially uncertain.
The fixture map is discarded with the process; it is not PostgreSQL persistence,
authentication, authorization, financial correctness or recovery evidence.

`runScenario` consumes an injected clock, transport, expected-state reader,
metric sampler and ownership checker. Only the memory fixture is supplied.
Its bounded scheduling and action records are real code exercised by the tests;
an admitted host adapter is still required to connect that code to the ERP.
Timeouts bound observation even for an uncooperative promise. A future transport
must implement actual abort/cleanup and independent serving-target readback.

## Measurement semantics

Virtual users, peak in-flight work, configured arrival cap, action starts/second,
completed business operations/second, and HTTP requests/second are separate.
HTTP rate is null for the memory transport. Counts include success, failure,
timeout, cancellation and refusal, with unscheduled actions explicit. The
error fraction includes failed/timed-out/refused actions; cancellation has a
separate fraction. Percentiles use nearest rank over successful operation
latencies in milliseconds. Empty samples are null. Fewer than 100 successful
samples are explicitly insufficient for tail inference.

Samples use fixed aggregate names and units: CPU percent normalized across
available processors (0–100), memory/swap/disk/network bytes, connection/wait/lock
counts, safe aggregate query and disk timing in milliseconds, generator CPU ms,
and Celsius only when trusted tooling provides it. Host/app/database fields and
generator overhead are separate. Missing or malformed fields remain unavailable
or invalid. Cumulative rates use actual sample elapsed milliseconds; reset or
missing endpoints produce null, not a negative rate or zero. No cross-reset delta
is inferred. The `portableMetrics` input consumes the existing fixed names from
`lib/portable-runtime/observability.ts` and `/api/internal/metrics`; labels and
unknown names are discarded. This task never calls that endpoint.

Memory pressure, low disk, memory growth, available temperature limit, sustained
consecutive errors, cancellation, elapsed deadline and loss of ownership stop
new work. Unknown sensors cannot establish a safe real-run window; the later
owner must decide sufficient monitoring before execution. Sampling is every
100 virtual ms in these tests. Per-action timeouts and scheduling ticks are
bounded; no silent retries. A stopped run retains its reason and partial coverage.

Reports contain no response bodies, cookies, tokens, passwords, fixture IDs,
query parameters, SQL, personal paths, free-form errors or external assets.
JSON result validation constructs an allowlisted output instead of copying input.
HTML escapes text and blocks external requests with CSP. The writer refuses
foreign output, symlinks and path traversal; cleanup validates exact ownership,
file names and hashes before deleting only its five known report files.

## Read-only host preflight and later integration

`./scripts/laptop-lab/host-preflight.ps1` reads bounded Windows OS/CPU/RAM/system-
disk capabilities and command availability. It does not inspect personal
processes, query daemons, start WSL, test temperatures or change the host.
Missing tools/permissions stay unknown. The captured capability snapshot is in
`evidence/host-capabilities.json`; it is neither an idle baseline nor a benchmark.

Existing `pnpm portable:operator COMMAND --manifest ABSOLUTE_JSON_PATH --target
ABSOLUTE_TARGET_PATH` remains the deployment/recovery interface. The executable
`scripts/portable/operator-adapter.ts` restricts its consumer to GitHub-hosted
ephemeral Linux, not this laptop. Merely selecting `local-single-node` does not
remove that restriction. Do not spoof environment variables or substitute WSL.
`lib/portable-runtime/operator.ts` currently specifies PostgreSQL 17 and backup
version 48; older operator prose saying v45 is stale. Preserve Valkey, object
storage, current Compose and canonical image contracts. No shared registrations,
admission resolver, workflow, pin, Dockerfile or production flags are changed.

Next finite integration dependency: the existing portable/runtime owner must
approve and implement an exact-artifact laptop-consumer profile/adapter, with
owned synthetic target, artifact/source/config binding, authentication/readback,
safe metric access and abort/cleanup. Task A must separately supply a qualified
and admitted artifact. This package deliberately has no alternative authority
receipt or operator exception. D1P stops after local handoff.

## D4 connected consumer source increment — 4 October 2026

The existing `plan` command now validates a distinct typed local consumer and
prints a read-only structured plan. It reads source/profile bytes and bounded
Git metadata; it makes no Docker call, creates no output and disables the
TypeScript loader's disk cache. D1P's original commands remain available.

```powershell
node scripts/laptop-lab/cli.mjs plan
node scripts/laptop-lab/cli.mjs plan --profile ABSOLUTE_PROFILE_JSON --expected-profile PROFILE_SHA256
node --import tsx --test scripts/laptop-lab/consumer-connection.test.ts
node node_modules/typescript/bin/tsc --noEmit -p scripts/laptop-lab/tsconfig.consumer.json
```

D4 uses the already installed project TypeScript/tsx runtime; it adds no dependency.
The profile's producer fields identify genuine CI evidence. Its independent
32-hex consumer token selects only this lab's fresh namespace and output. A hash
binds exact configuration and observed source, and grants no permission. Regenerate
the plan/profile after a source commit: observed HEAD/tree are part of code identity.

`runtime --profile ABSOLUTE_PROFILE_JSON --expected-profile PROFILE_SHA256`
connects to the real evidence/admission path and still refuses before Docker or
output reservation. The unchanged artifact hold, unapproved local consumer
authorization contract remain separate requirements. The certificate adapter is
connected and source tested, but execution remains gated. Supplying JSON or CI
environment values cannot clear the source-level holds.

The concrete conditional lifecycle renders the existing portable recipe, pins
cached images, enforces bounded child capture, records exact owned resources,
binds image/database/network identity and settles only newly owned resources.
Focused test ports exercise that code, the original scheduler and existing reports.
They classify simulated service actions separately from actual harmless Node
child capture. They do not establish HTTP/ERP performance. Detailed evidence,
review corrections, source registration and later serial-owner handoff are in
`HANDOFF.md`; original D1P/D2/D3 history is retained.

D4-R1 connects the existing certificate-request GET/POST operations through
verified loopback TLS, the actual serving container/database, ordinary OFF-state
login and persisted-session readback. The original runner, bounded scheduler and
JSON/CSV/HTML reporting remain in use. Tests use controlled seams and HARNESS_ONLY
classification; they are not ERP latency or capacity measurements.

After genuine artifact admission and separate consumer authorization, the
conditional lifecycle stages a task-bound manifest and supplied secret bytes from
the fixed ignored `tmp/laptop-lab/consumer-<local-token>` directory. The exact
manifest binds profile/source/producer run/attempt/image and every recipe secret
plus `fixture-password`. It grants no approval. No keys or passwords are generated
by the host lab. After readiness, the existing OFF fixture initializes only a
proved-empty isolated synthetic database through its existing guarded foundation.
Actual fixture/user/container/database/session/CA identities are resolved then.
Unexpected MFA, initialization refusal or target/session changes remain incomplete.
The retained a48 producer example predates these helpers. A real compatible
producer must contain the five reviewed fixture/readback/foundation/session source
blobs and genuine exact-image CI evidence. The normal source qualifier refuses
missing or changed helper bytes before runtime. LF normalization permits identical
bytes across checkouts; producer SHA/tree need not equal the consumer's identity.
