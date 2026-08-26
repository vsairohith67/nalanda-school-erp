# PRIVATE-STAGING-1B-R1

Task title: NPS ERP private synthetic staging deployment, PostgreSQL 17 operationalization, access/storage/rate-limit controls, recovery rehearsal, and exact-head acceptance.

This is a separate deployment task. Begin from the released PostgreSQL-readiness tag and revalidate its exact merge SHA. Do not infer deployment approval from software clearance.

## Authorized boundary

Deploy one private, access-controlled, synthetic-only staging environment after an explicit cost/provider approval. Do not migrate operational SQLite data, onboard real users, send live communications, enable payment/provider traffic, change the production site, publish stores, or activate a pilot. Preserve current DNS; use a staging-only hostname and rollback-safe records.

## Required architecture

- PostgreSQL major: 17.
- Prisma schema: `prisma/postgresql/schema.prisma`.
- Migration command: `pnpm.cmd db:migrate:postgres` using the direct migrator `DIRECT_URL`.
- Runtime: pooled TLS-valid `DATABASE_URL` using `nalanda_runtime`; never run the app as `nalanda_migrator`.
- Separate `nalanda_backup` and `nalanda_readonly_diagnostics` identities.
- Valkey/Redis-compatible distributed rate limiting that fails closed with controlled 503 when its store is unavailable.
- private object storage for governed assets/backups; no public bucket.
- Cloudflare Access and authenticated Tunnel/proxy with trusted-header enforcement.
- secret-store values only; never commit or print URLs, passwords, tokens, client keys, or dumps.

## Execution gates

1. Cost, region, provider, owner, retention, RPO/RTO, and data-processing approval.
2. Exact-head source/CI and PostgreSQL-readiness evidence recheck.
3. Provision private networked PostgreSQL 17, Valkey, object storage, runtime, backup, monitoring, and secret identities.
4. Verify certificate-validating TLS and pool/direct URL separation.
5. Back up the empty target, run migration precheck/status, apply the governed baseline through `DIRECT_URL`, repeat deploy, and verify 330-table/168-trigger/constraint/index parity.
6. Restore the approved synthetic v44 fixture only; run restore twice, checksum/money/status/relationship reconciliation, concurrency, Search/Smart AI, Offline Sync, native auth, and application health.
7. Rehearse `pg_dump`/managed restore and application rollback. Prove the previous exact release can be restored without destructive schema reversal.
8. Deploy the exact CI-cleared SHA. Keep all live providers/default-off flags off and access restricted to named testers.
9. Run desktop/mobile Browser acceptance, log review, security scan, dependency/secret scan, and read-only operational integrity proof.
10. Record a terminal verdict in existing Notion/Canvs records only, then read back. Do not create duplicate hubs/boards.

## Rollback and stop conditions

Stop on any data/financial discrepancy, failed backup/restore, migration mismatch, authorization/privacy defect, unresolved High/Critical or relevant Medium, distributed limiter fail-open, public exposure, DNS conflict, or unavailable exact-head CI. Roll back traffic/runtime; preserve database evidence and do not reset a shared database.

Final status must distinguish `PRIVATE_STAGING_1B_R1_CLEARED` from software-ready, blocked, or partial external-toolchain states. Clearance still means synthetic private staging only, not pilot or real-user/data activation.
