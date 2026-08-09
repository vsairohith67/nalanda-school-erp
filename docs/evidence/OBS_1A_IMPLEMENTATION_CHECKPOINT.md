# OBS-1A implementation checkpoint

**Date:** 2026-08-10  
**Branch:** `ops/technical-observability-super-admin`  
**Release state:** `OBSERVABILITY_OPERATIONS_READY_FOR_QA`

## Delivered boundary

OBS-1A adds a private, provider-neutral Technical Operations control plane with 13 health domains, four distinct operational conclusions, aggregate-only adoption/security evidence, safe logging, governed deep checks, alert/incident/maintenance lifecycles, advisory client-version policy, role-specific UI, backup version 40, runbooks and privacy/threat-model guidance.

The implementation does not deploy the ERP, activate an external monitoring or message provider, transmit telemetry, onboard real users, expose school identities, or treat `NOT_CONFIGURED` as a failure.

## Permission and privacy evidence

- Super Admin receives the full evidence and governed-action surface.
- Director receives a concise summary only by default.
- Viewer and other roles fail closed at the server route.
- Raw paths, filenames, IP addresses, request bodies, passwords, tokens, salary, marks, payment references and school-user identities are excluded from technical evidence.
- Deep checks are bounded, rate-limited, count-only for business integrity and never repair operational data.
- Optional providers render from configuration state without network calls or activation.

## Verification evidence

| Gate | Result |
| --- | --- |
| Route inventory | 329 page routes; 537 API routes |
| Lifecycle backfill | Dry-run; 0 scanned/created; no data changed |
| TypeScript | Full `pnpm.cmd typecheck` passed; heap budgets normalized across partitions |
| Focused OBS tests | 7/7 passed |
| Focused permission/auth/backup regression | 10 files; 66 tests passed |
| Full suite | 198 passed files, 1 skipped; 1,757 passed tests, 3 skipped |
| Production build | Passed; `/technical-operations` generated successfully |
| Copied-database harness | 13 definitions; governed checks; alert/incident/maintenance/policy lifecycles; backup v40; restore twice; stable counts |
| Browser | Super Admin full view/actions, Director summary, Viewer denial, light/dark, 1366x768 and exact 390x844, final console errors 0 |
| Cleanup | Synthetic browser database/runtime removed and empty cleanup repeated |
| Backup | Logical backup created with version 40 contract |
| Git safety | Candidate/staged/tracked secret and private-runtime scan passed |

## Operational isolation

The operational SQLite database remained byte-identical throughout implementation verification:

- SHA-256: `F0101B30697EB20D78733F3A2AED914BC6DD1D50CE546924240FB97C38BF9D2E`
- size: `8052736` bytes
- business baseline: Students 0; active Enrollments 0; Payments 0; collected amount 0
- account baseline: Users 4; active role assignments 4; active Super Admins 1
- applied migration count remains 16 before independently authorised operational migration

## Independent QA handoff

Independent QA must rerun migration deploy twice, restore twice, lifecycle/concurrency/privacy/adversarial checks, Browser role and responsive evidence, the full serialized release sequence, cleanup twice and operational fingerprint verification. Merge, operational migration and release tag remain prohibited until that QA passes.
