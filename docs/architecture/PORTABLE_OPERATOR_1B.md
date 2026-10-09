# Portable operator foundation 1B

The executable interface is `pnpm portable:operator COMMAND --manifest ABSOLUTE_JSON_PATH --target ABSOLUTE_TARGET_PATH`.
Commands: `preflight`, `doctor`, `install`, `initialise`, `migrate`, `backup`, `restore`, `upgrade`, `rollback`, `uninstall`.
Omitting `--apply` is a dry run. `doctor` performs read-only health/migration probes.
`--resume` requires the same explicit operation ID and manifest. There is no purge option.
Uninstall removes only application/proxy/worker containers, preserving data services,
volumes, encrypted backups, keys and receipts. Cleanup of the disposable CI environment
is a separate workflow-owned action; it is never operator uninstall behavior.

The adapter currently admits only an explicit GitHub-hosted ephemeral exact-head target:
`WORKSPACE/tmp/portable-operator/nalanda-ci-RUN_ID-SUFFIX`. It never discovers deployments.
Operational host adapters/activation remain a separate admission gate. Profiles describe
local-single-node (one web replica) and generic-vps (two replicas); both use PostgreSQL 17,
one canonical application image and v45 logical backups. Managed-cloud capabilities are
contracts only. Local development is separate; local-resilient hardware/UPS/storage
admission is deferred. Kubernetes is deferred.

A manifest has schemaVersion 1, classification INTEGRATION_TEST_ENVIRONMENT, profile,
project, target, architecture (amd64 or arm64), image (immutable local sha256 image ID),
releaseCommit (40 hexadecimal characters), composeSha256, postgresMajor 17,
backupVersion 45, migration (exact image/source/ledger migration name), and operationId
(16 hexadecimal characters). Restore also requires restoreArtifact.id and its
ciphertextSha256. Upgrade/rollback require previous.image, previous.releaseCommit,
previous.migration and previous.backupVersion. Only matching schema contracts can roll back.

Preflight validates runner/target provenance, image identity and native architecture,
non-root runtime, source/image migration contracts, CPU/memory/free disk and source Compose
hash. Apply validates owned targets, internal networks, loopback ports, file permissions,
mount provenance and named resource ownership. Secrets must already be generated under the disposable CI staging root
(WORKSPACE/tmp/portable-staging), separate from operator state, by the approved fixture. Install never bootstraps demo accounts.
Fixture identities and backup profiles are created only by the separately explicit synthetic
CI fixture stage. There is no production credential, account or provider provisioning.

Each mutating step records intent before invoking Compose and completion afterward.
An operation-bound verified backup or restore result can reconcile a completed effect.
Ambiguous committed migration/recovery effects stop for review; they are never replayed
blindly. Stale locks can resume only when the same operation owns the lock and its process
is verifiably absent. Stale evidence is retained. Live or reused process IDs block resume.
No automatic transaction retry, down migration or production rollback is implemented.
Restores reserve a new empty synthetic PostgreSQL schema and preserve partial data on failure.

## Next.js 15.5.21 configuration audit

Build settings include NEXT_PUBLIC_PWA_BUILD_VERSION and Next configuration headers (including
any build-time HSTS choice); changing these requires a new build. NEXT_PUBLIC values are
compiled into browser bundles. They are not provider settings that change on container startup.
Server runtime secrets use the existing validated *_FILE contract and remain server-only.
The force-dynamic Technical Operations page projects only the strict public runtime allowlist:
schema version, profile, telemetry health, externalTelemetry=false and certification state.
Unknown optional configuration degrades diagnostics without hiding school health.
No DSN/key/endpoint/identity field can enter this projection.

Official versioned references: [Next 15 environment variables](https://nextjs.org/docs/15/app/guides/environment-variables),
[Next 15 self-hosting](https://nextjs.org/docs/15/app/guides/self-hosting),
and [Caddy environment substitution](https://caddyserver.com/docs/caddyfile/concepts#environment-variables).

One image release means one OCI index with linux/amd64 and linux/arm64 manifests.
Each has its own image ID, native dependency probe, provenance, SBOM, Trivy and Grype
result. The CI matrix uses native runners and asserts architecture; no physical-machine
or provider certification follows. The same-image retag/recreation rehearsal inherited
from portable 1A remains labeled as such, not a cross-version schema rollback proof.

SYNTHETIC_FULL_STACK_CI_EXCEPTION = OWNER_AUTHORIZED

Scope: EPHEMERAL_EXACT_HEAD_CI_ONLY. This is INTEGRATION_TEST_ENVIRONMENT,
not operational deployment, private staging, provider certification or activation.

The full-stack script exercises recovery helpers directly. Complete operator lifecycle and
partial-failure/resume behavior are verified through isolated filesystem/process adapters;
that distinction is retained in release evidence. Telemetry remains a library foundation
and is not automatically wired into live school transactions.
