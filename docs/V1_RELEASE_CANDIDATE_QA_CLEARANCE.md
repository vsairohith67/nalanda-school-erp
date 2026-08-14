# V1 Release-Candidate Independent QA Clearance

**Phase:** `V1-FINAL-1A-QA`

**Candidate:** Nalanda ERP V1 Release Candidate 1 (`NALANDA_ERP_V1_RC1`)

**Date:** 2026-08-14

**Boundary:** local/private release-candidate acceptance only

Independent QA inspected the complete implementation diff from protected base `16154c395459dcfe27052204c4dbcecfa7ddd169`, recreated the final school profile from fresh migrations under prefix `V1FINALQA`, and repeated the critical Auth, IAM, admissions, family-payment, academic/calendar/reporting, payslip, support, Safe Exit, bulk-onboarding, release-operations, migration, backup/restore, security, performance and Browser matrices. No operational database, real user, real school record, provider, DNS, hosting or deployment target was used.

## Independent results

- Fresh migration and schema equivalence passed with 18 migrations, 292 models/tables, 1,432 indexes and 508 foreign keys. Migration deploy and restore paths were repeat-safe.
- The fresh exact-scale school passed with 800 Students, 1,200 Guardians, 80 Staff, 45 Teachers, 800 Student-Guardian links, 1,600 enrollments, two academic years, 80 cohorts, sibling groups of two/three/four, 4,480 lineage outcomes, idempotent replay and exact rollback.
- Independent performance recorded 120 authenticated-style reads and 30 independent writes: read p50/p95/p99 0.79/0.94/1.02 ms; write p50/p95/p99 4.13/4.72/5.41 ms; ordinary p99 4.72 ms; zero errors; zero `SQLITE_BUSY`; 125 ms CPU; 139,264-byte RSS growth; 5,305,832-byte heap delta. These local measurements satisfy the 2 s/3 s/5 s acceptance budgets but are not a production sizing promise.
- Auth/IAM, role denial, context separation, linked-child isolation, last-Super-Admin safety, session invalidation, concurrent actions and exact restore/cleanup passed on fresh copied databases.
- Family payment passed the full mixed-tender, sibling, duplicate-reference, retry, concurrency, locked-day, cancellation/correction, ledger/Cash Book, backup/restore and exact operational-fingerprint matrix.
- Admissions, calendar/year classification, consolidated academic reporting, payslip delivery, support/private attachments, Safe Exit and Release Operations passed their independent lifecycle and recovery suites.
- Final Release Operations packaging passed with 10,953 verified files, a matching payload checksum, exclusive-release locking, injected low-space refusal, zero provider calls, no private artifact and an unchanged operational baseline.
- qpdf 12.3.2 was obtained from the official QPDF release, its archive identity was verified against the published SHA-256, and all three encrypted-PDF runtime tests passed: AES-256 protection, print allowed/edit restricted and malformed/active-content refusal. The QA binary was temporary and is not packaged or committed.
- The final dependency review is clear: `pnpm audit --prod` reports no known vulnerabilities. Next.js is pinned at 15.5.21, Sharp at 0.35.2, with Nanoid 3.3.18 and PostCSS 8.5.23 overrides.
- The full post-correction suite passes 216 test files and 1,916 tests with zero skips when the verified temporary qpdf runtime is supplied. The production build and route generation pass.
- Final in-app Browser QA passed at exact 390x844 and 1280x720, with the automated accessibility matrix retaining the other required viewports. Super Admin, Director, Principal, Accountant, Computer Operator, Gate Staff, Student, Teacher/Parent, Parent and Viewer boundaries were exercised. Parent linked-child switching, fail-closed Teacher no-scope state, Viewer bounded dashboard access, multi-role context separation, light/dark themes, visible 2 px focus, 44 px targets, zero overflow, PWA manifest/service-worker privacy rules and zero console warnings/errors passed. No raw internal identifier appeared in rendered evidence.

## Decision

All local/private V1 software gates are cleared for a private HTTPS staging decision. V1.5 and V2 deferrals remain controlled and unavailable by default. Public deployment, hosting purchase, DNS, live providers, real-data onboarding, real-user activation, training, pilot and production cutover remain separate pending gates.

The governed release identity is the retained feature branch plus annotated tag `nalanda-erp-v1-rc1-v41-2026-08-14`. This document does not authorize `STAGE-1A` or any deployment.
