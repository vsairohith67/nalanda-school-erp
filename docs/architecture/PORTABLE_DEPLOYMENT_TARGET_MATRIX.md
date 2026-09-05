# Portable deployment target matrix

Audit: `4a4df050d194104cfc497a6de790ca9553a69db6`, tree `d4075661063fc127740bb3806abe51d83b406e61`. Architecture inspection entails no operational deployment. Existing isolated synthetic CI fixtures may start and are destroyed by their regression harness; they do not execute the generated 1B task. Historical portable acceptance is evidence for its tested synthetic environment, not certification of every target below.

## Decision

Keep **one canonical OCI application image + one environment/secrets contract + small deployment profiles and provider overlays**. The root `Dockerfile` already builds a non-root distroless runtime with web, migration and job commands from the portable bundle. Preserve that architecture. Managed services replace capability endpoints; they do not require application forks. SQLite remains a local development/QA option; the portable operational contract uses PostgreSQL 17.

| Source inspected | Present behavior | Remaining acceptance |
| --- | --- | --- |
| `Dockerfile`, `scripts/portable/bundle.mjs`, `scripts/portable/runtime-command.ts` | Pinned multi-stage image, standalone app, migration dependencies, non-root UID, command dispatch | Verify current complete workspace dependency closure, build both x86_64/arm64, provenance/SBOM/scanner evidence per architecture; compare image digest rather than a mutable label |
| `deploy/portable/compose.yml`, `Caddyfile`, entrypoints | Synthetic reference stack, isolated data networks, loopback TLS entry, PostgreSQL/Valkey/MinIO, two web replicas, resource limits | Extract local-single-node and generic-VPS profiles; real trusted TLS/host disk encryption are operator gates. Two replicas on one host do not prove host resilience |
| `lib/portable-runtime/config.ts`, `secrets.ts`, `docs/PORTABLE_CONFIGURATION_AND_SECRETS.md` | Validated synthetic mode and external secret-file injection | One versioned contract for profile inputs, required/optional fields, rotation, permissions and diagnostic safe errors; no stored production secrets |
| PostgreSQL schemas/migrations, `scripts/postgres/*`, `lib/portable-runtime/health.ts` | Separate migration/runtime identities, expected migration pin, liveness/readiness and protected diagnostics | Drift-aware migrate/upgrade plans; provider service/version/role certification remains separate |
| `private-object-store.ts`, MinIO policies, `scripts/portable/backup-worker.ts` | Private S3-compatible adapter, scoped identities, encrypted versioned backup and restoration foundations | Host/provider encryption, independent key custody, off-host copies, retention/capacity and recovery objective approval |
| `job-lock.ts`, `scheduled-jobs.json`, `scheduled-job.ts` | Scheduled command inventory, distributed single-winner locks | Operator schedule installation and stale-job/retry diagnostics; provider outages must produce clear recoverable states |
| `docs/PORTABLE_UPGRADE_AND_ROLLBACK.md`, `PORTABLE_DISASTER_RECOVERY.md` | Documented provenance/backup/migration/readiness order, schema-compatible rollback and synthetic rehearsal | Unified operator commands, partial-failure recovery, safe uninstall, resource sizing and measured rehearsals for each admitted profile |

## Profiles

| Profile | Intended arrangement | Current evidence and next boundary |
| --- | --- | --- |
| local-development | Local source workflow, isolated SQLite or disposable PostgreSQL, local-only diagnostics | Existing tooling; never use the operational database for QA |
| local-single-node | One Linux OCI host, one web replica plus PostgreSQL 17, coordination, private object store and proxy | Components exist; consolidated profile/preflight/install/restore acceptance remains |
| local-resilient | Failure domains, independent backups, recovery procedures, optional redundant application/data tiers | Specification only beyond existing two-replica synthetic tests; needs availability target and host/storage design |
| generic-vps | Same canonical image and capability contract on an admitted VM; external trusted TLS/secrets/storage | Profile and operator tools remain; no provider, region, budget or resource selected |
| managed-cloud | Same image; endpoints for managed PostgreSQL 17, compatible coordination and private object storage | Interface/overlay contract only; compatibility, identity, routing and recovery must be certified later |
| future-kubernetes | Same image and contract expressed as orchestration objects | Deliberately deferred until scale/availability/operational staffing justify it; no Helm/cluster work in this phase |

## Target admission

| Target | Required admission | Result in this audit |
| --- | --- | --- |
| School desktop | Sufficient resources, Linux container runtime/VM, protected disks, controlled power/sleep, backup/restore operator | Conditional target; no desktop certification |
| School mini-PC | Same contract; measured RAM/CPU/storage endurance, UPS/recovery and off-host backups | Conditional target; no hardware certification |
| Linux server | Supported OCI host with persistent encrypted volumes and trusted network/TLS | Primary portable host category; exact distribution/host acceptance pending |
| Compatible Windows container/virtualisation host | Linux virtualization/container capability for the existing Linux image; Windows-native containers alone do not satisfy this image contract | Requires exact host/virtualization/network/storage qualification |
| Generic Indian or international VPS | OCI execution, required endpoints, secrets, persistence, network policy and backup capability | Capability-based admission; geography/provider/legal gates remain |
| DigitalOcean-style VM/container provider | VM or container plan meeting the same contract; managed capabilities optional | No vendor-specific app fork or resource provisioning |
| GoDaddy VPS/dedicated/container-capable plan | Explicit container/runtime and resource/storage/network support | Ordinary shared hosting is not assumed compatible; exact plan requires later verification |
| AWS, Microsoft Azure, Google Cloud | OCI execution plus certified PostgreSQL 17, coordination, S3-compatible interface or reviewed adapter, trusted TLS/secrets/backup | Interface targets only; no account/provider configuration or certification claim |
| Future compatible OCI provider | All contract capabilities and recovery evidence, regardless of brand | Admitted only after later operator certification |

Every operational target needs PostgreSQL 17; Valkey/Redis-compatible atomic coordination; private S3-compatible objects; trusted reverse proxy/TLS; external secrets; persistent encrypted storage; a migration job; health/readiness probes; scheduled jobs; explicit outbound-network policy; resource limits; safe log/metric export; backup/restore; schema-compatible upgrade/rollback. Interface compatibility must include authentication, TLS, command semantics and recovery, not just product labels.

## One-command gap ledger

| Operator action | Present | Work for the later 1B prompt |
| --- | --- | --- |
| preflight | Config validation and migration checks | Host/runtime/CPU/disk/ports/TLS/secret/endpoint/resource checks, safe codes and dry-run plan |
| doctor | Technical Operations and internal health | Bounded redacted diagnostic report with explicit remediation and no automatic mutation |
| install / initialise | Compose, bootstrap and synthetic fixture primitives | Idempotent profile workflow, step receipts, explicit empty-target check; never seed demo users into operational mode |
| migrate | Separate migrator and expected migration readiness | Lock, pre-backup, drift/compatibility checks, fail-closed restart/resume |
| backup / restore | Encryption, verification, isolated rehearsal and repeat restore | One operator entry point, target isolation, integrity proof, recovery-key boundary |
| upgrade / rollback | Source runbook and runtime command foundations | Exact image/provenance, compatibility plan, failure recovery; no destructive down migration |
| uninstall | No unified non-destructive operator flow proven | Stop/remove app resources only; preserve volumes/data/backups/keys by default; separate explicit destructive purge gate |
| disaster recovery | Synthetic rehearsal/runbook | Repeat on each admitted target and measure agreed RPO/RTO; do not invent availability claims |
| sizing / runbooks | Compose limits and historical synthetic measurements | Small/standard/resilient capacity profiles with load, headroom, storage growth and operator checklists |

No provider prices are claimed. Later costs must be dated, configurable estimates with explicit owner budget approval. All certification entries above are requirements, not executed deployments.
