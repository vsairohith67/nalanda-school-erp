# PORTABLE-STAGING-FOUNDATION-1A QA evidence

Release verdict: `PORTABLE_STAGING_FOUNDATION_PARTIAL_EXTERNAL_TOOLCHAIN_GATE`.

This is foundation evidence, not a deployment record. The provider is undecided, DNS is unchanged, no cloud or VPS exists, no real user or school data was activated, and production flags remain off.

## Isolation and database integrity

- Isolated base: `46cf0c75c71b08ba3f1951090789041a4fd418ee`.
- Operational SQLite before QA: 8,409,088 bytes; UTC mtime `2026-08-10T10:55:19.8897824Z`; SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`; no sidecars.
- No operational records or attachments were read. All write-capable QA used generated SQLite data, disposable PostgreSQL schemas, and synthetic object-store volumes.
- Operational SQLite after local QA: the same size, UTC mtime, SHA-256, and no sidecars. Byte identity is confirmed; it must still be rechecked if any later local write-capable QA is introduced.

## Local foundation evidence

- Routes: 356 page routes and 614 API routes enumerated. The lifecycle backfill dry run made no changes.
- TypeScript: all 19 project partitions passed; the final affected tool and test partitions were rerun after the last edits.
- Build: the two-phase Next.js production build passed and generated 324 static pages.
- Regression: resource-bounded full Vitest execution passed 237 files with one intentionally skipped file and 2,188 tests with three intentional skips after all product fixes. The only remaining failure in that run was a temporary local change to the canonical `test` command; it was reverted to `vitest run`, and the supply-chain and portable-runtime tests then passed 11/11. Exact canonical full regression remains required in CI.
- Inherited focused acceptance: 32 files, 457 tests, zero skips, and copied-database integrity `MATCH`.
- UDISE privacy/read-only evidence: 24/24 tests passed. This does not change the existing planning-only and evidence-partial boundary.
- Cross-platform server and shell: 28/28 tests passed, app typecheck passed, and copied-database acceptance preserved revocation with the operational source byte-identical. Physical-device certification remains pending.
- Offline Sync: 79 accepted, three conflicts, one rejected, 84 events, two restore passes, and operational source byte-identical.
- Search extension: safe-metadata coverage passed with 50-result limits, owner isolation, forbidden sentinels excluded, and the designated synthetic source byte-identical.
- Security Resilience: 48/48 focused tests passed; local load accepted 98, rejected 51 with HTTP 429, returned four controlled 503 responses, and recovered without operational database access.
- PostgreSQL parity: schema, 168-trigger contract, and version-44 baseline were in sync; seven provider/parity tests passed.
- Dependencies: `pnpm audit --audit-level high` reported no known vulnerabilities.
- Git safety: candidate, staged, and tracked content passed after distinguishing generated synthetic credentials and deployment access-policy documents from actual secrets or backup output.
- Security diff scan: completed with complete changed-file coverage and zero reportable findings. The sealed local scan records its own final working-tree snapshot digest outside the repository.

## Portable stack evidence

- Compose started PostgreSQL 17, Valkey, MinIO, Caddy, and two non-root web replicas. Only loopback HTTPS port 8443 was published; the data services remained private.
- HTTPS, live/readiness health, protected internal metrics, structured request logs, two-replica routing, distributed rate limiting, and single-winner scheduled-job locking passed.
- The multi-key Valkey test made exactly 100 attempts: 30 allowed and 70 blocked across two replicas. The job-lock test admitted exactly one of two contenders.
- PostgreSQL, Valkey, and object-store outage drills failed closed and recovered. Upgrade and rollback rehearsals preserved availability and schema history.
- Private object QA passed checksum idempotency, copied-object integrity, bounded signed access, traversal rejection, anonymous denial, and control-plane denial.
- Backup format version 44 was encrypted before remote storage, read back from the private S3-compatible destination, and restored four times across two independent disposable schemas. The final recorded dataset contained 800 students, 2,400 payments, one disabled restore operator, 1,000 parent meetings, and 2,000 offline mutations.
- The final retention dry run produced immutable plan digest `3771e6451530cdfde60f2f9a311fd9af6519134356023e6e45ab6b827fc9f1f4` and deleted zero versions. Deletion requires a separately authorized second step using that exact digest and version IDs.
- The minimized pre-commit image used pinned distroless Node 24.20.0 on Debian 13, ran as `65532:65532`, contained no `.git` or SQLite database, and had local image ID `sha256:9890a73a68625b6d41d4fde2d701a46ff41234dc95e347d5391f398cecc63034`. Docker Scout reported 185,976,213 image bytes (881 MB local uncompressed footprint), indexed 237 packages, generated a 530,732-byte SPDX SBOM, and found zero Critical or High vulnerabilities. This is not the release digest; exact-head CI must rebuild and publish the immutable digest, archive checksum, SBOM, and vulnerability result.

## External toolchain gates

- The in-app browser reached the local Caddy endpoint but rejected the synthetic Caddy authority with `ERR_CERT_AUTHORITY_INVALID`. The browser policy did not permit bypassing certificate validation. HTTPS and CA validation succeeded with the generated CA through the command-line client. Public-certificate browser acceptance remains a provider-activation gate.
- No production signing identity or remote registry is configured. CI generates an SPDX SBOM and fails on high or critical image vulnerabilities; production image signing and transparency evidence remain external provider/toolchain work.
- Exact-head GitHub Actions, normal merge proof, the annotated tag, and tracker read-back are retained as external release records rather than hard-coded into this source snapshot.

## Release boundary

The provider-neutral software foundation is cleared through the repository release gate. Public-certificate Browser acceptance and production image signing remain external provider/toolchain gates. This clearance does not authorize cloud purchase, DNS changes, public exposure, real-data ingestion, real-user onboarding, managed-provider configuration, or deployment.
