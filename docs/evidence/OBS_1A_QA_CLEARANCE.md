# OBS-1A independent QA and release clearance

**Date:** 2026-08-10

**Retained branch:** `ops/technical-observability-super-admin`

**Release tag:** `observability-operations-v40-2026-08-10`

**Result:** `OBSERVABILITY_OPERATIONS_CLEARED`

## Cleared boundary

OBS-1A is cleared locally/private as a provider-neutral Technical Operations control plane. It covers 13 separately reported health domains; safe structured logging; bounded lightweight and deep checks; deduplicated alerts; incident and maintenance timelines; release/client policy; exact Super Admin and Director evidence boundaries; private in-app critical notification; runbooks; and backup version 40.

This clearance does not deploy the ERP, activate monitoring or message providers, transmit telemetry, onboard real users/data, or authorise production cutover. `NOT_CONFIGURED` remains distinct from failure.

## Independent QA corrections

- Alert upsert now re-queries inside its transaction, deduplicates five concurrent occurrences, reopens a resolved alert on recurrence and auto-resolves on recovery.
- Business-integrity checks include count-only private-asset recovery, Safe Exit evidence, release-manifest, receipt/allocation, family-payment, report, payroll and Parent-context invariants without automatic repair.
- The allowlisted repository runbooks are served through a private app route gated by `VIEW_TECHNICAL_OPERATIONS_SUMMARY`; `/docs` is excluded from the public robots/sitemap boundary.
- The low-storage signal now links to the existing low-storage runbook rather than a nonexistent filename.

## Verification matrix

| Gate | Result |
| --- | --- |
| Route inventory | 330 page routes; 537 API routes |
| Lifecycle backfill | Dry-run; zero changes |
| TypeScript | All application, library, tool and test partitions passed |
| Focused OBS contracts | 10/10 passed |
| Full suite | 198 passed files, 1 skipped; 1,760 passed tests, 3 skipped |
| Production build | Passed; Technical Operations and private document viewer compiled |
| Copied-database QA | 13 definitions; two governed deep checks; concurrent dedup; auto-resolution; critical in-app notification; alert/incident/maintenance/client-policy lifecycles |
| Recovery | Backup v40 restore passed twice without duplication; synthetic databases removed and inspected twice |
| Browser | Super Admin full evidence/actions; Director summary; Viewer denial; light/dark; 1366x768 and exact 390x844; final console errors 0 |
| Git safety | Candidate, staged and tracked scans passed |

## Protected operational migration

Before migration, the operational database was verified at 16 applied migrations, zero Students/active Enrollments/Payments/collected amount, four Users/role assignments and one active Super Admin. A protected byte-identical rollback artifact was created at the same `8052736`-byte size and SHA-256 `F0101B30697EB20D78733F3A2AED914BC6DD1D50CE546924240FB97C38BF9D2E`.

The additive `20260810100000_technical_operations_observability` migration applied once; the second deploy reported no pending migrations. Post-migration verification proved:

- 17 applied migrations and 13 operational check definitions;
- `PRAGMA quick_check = ok` and zero foreign-key violations;
- unchanged zero-business and protected-account counts;
- zero check runs, metrics, alerts/events, incidents/events, maintenance/events, release manifests, client policies and background-job runs;
- logical backup version 40 and copied-database restore-twice proof.

The expected post-migration database hash is `0D84B0E65FAF68BABE7D661506401345B0B2E223AE0749C7D18C488125B73BFE` at `8327168` bytes. The protected rollback and logical backup remain outside Git.

## Release conclusion

The retained feature branch, private `main` and annotated release tag are required to resolve identically at closure. The canonical Canvs release card and privacy-safe Notion, Asana and Basic Memory mirrors are reconciled after Git release. Git remains the authoritative technical record.
