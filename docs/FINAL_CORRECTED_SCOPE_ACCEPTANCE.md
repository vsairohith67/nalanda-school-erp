# Final Corrected-Scope Cross-Module Acceptance

**Prompt:** `FINAL-SCOPE-QA-1A`<br>
**Evidence window:** 2026-08-23 to 2026-08-24<br>
**Current verdict:** `FINAL_SCOPE_QA_REQUIRES_FIXES`<br>
**Candidate branch:** `feature/final-scope-qa-1a`<br>
**Authorized current main:** `e8742564cf9d54651521fbeba35548b45ff9b7e0`

This is local/private release acceptance evidence. It does not authorize deployment, operational activation, real-data migration, provider activation, merge or release tagging.

## Outcome

The reusable acceptance and release-evidence harness is implemented and the current-main regression, build, migration, restore, backup, security, dependency, secret/configuration and operational-database integrity checks pass. Release acceptance is still red because three declared default-off flags are not consumed by their active server-side write surfaces and one declared flag lacks an authoritative governed-surface map. UI hiding and a zero-percent configuration value are not sufficient server-side enforcement.

No QA release tag was created and this branch was not merged to main.

## Current-main inventory

| Evidence | Result |
| --- | --- |
| Page routes | 346 |
| API routes | 575 |
| Main test files | 224 |
| Candidate test files | 225 |
| Active ordered migrations | 21 |
| Prisma models/tables after fresh migration | 308 |
| Backup format | v43; 257 durable collections |
| Reachable annotated tags | 46 |
| Cleared requirement/tag mappings | 25 verified |

The full candidate suite passed 224 test files with one intentionally skipped test file, and 2,046 tests with three intentional skips out of 2,049 total. The skips are the existing qpdf/environment-dependent payslip checks; they were recorded as skips, not passes. TypeScript validation and the production build passed.

## Cross-module acceptance

Focused programmatic checks exercise the current authentication/session, IAM, Academic Integrity, Parent linked-child ownership, Super Admin owner isolation, Universal Search, Smart AI Foundation and loopback-only local runtime, Event Media, KG Reports, Parent Meetings, feature-flag, finance, attendance, timetable, Safe Exit, backup/restore and migration contracts. Synthetic copied databases were used for every write rehearsal. No new interactive Browser run was made mandatory; retained Browser evidence was checked where the governing release already required it.

Smart AI remains `DISABLED` by committed default, accepts only loopback local endpoints when explicitly enabled, has no cloud-AI or arbitrary external inference path, and has no ERP mutation authority. Event Media public publishing, KG Reports operational activation and Parent Meetings operational activation remain off by default.

## Feature-flag inventory

All nine release flags are committed false with zero-percent rollout.

| Flag | Runtime acceptance |
| --- | --- |
| `real-data-imports` | `UNENFORCED_EXPOSED_SURFACE` |
| `online-payments` | `NO_RUNTIME_PROVIDER_CAPABILITY` |
| `live-messaging` | `COMPENSATING_CONTROL` |
| `ai-ocr-live-processing` | `COMPENSATING_CONTROL` |
| `bulk-exports` | `BLOCKED_BY_EVIDENCE` |
| `public-admissions-form` | `UNENFORCED_EXPOSED_SURFACE` |
| `payroll-ess-pilot` | `UNENFORCED_EXPOSED_SURFACE` |
| `kg-report-cards-v1-5` | `ENFORCED` |
| `future-transport-cafeteria` | `NO_RUNTIME_CAPABILITY` |

The red surfaces are deliberately recorded rather than silently expanded in this QA-only workstream.

## Migration, backup and restore

The 21 active migration names are unique and ordered. Fresh deployment produced 308 models/tables, schema equivalence reported 1,516 indexes and 532 foreign keys, and a representative copied existing database upgraded from 292 to 308 models/tables without changing its business baseline. The backup v43 contract included 257 durable collections and restore completed twice with record counts, ownership, collision handling, audit/immutable data and role state preserved. No business migration was added by this task.

The operational database was resolved and hashed before copied-database work, was never used as a write target, and matched byte-for-byte at the final integrity check. Private paths and digest values are intentionally excluded from this document.

## Security, dependencies and repository safety

Production-only and full dependency audits both reported zero Critical, High, Medium, Low or informational findings. The tracked-secret/configuration review found no plausible live credential, private key, token or provider secret; synthetic fixtures and explicit placeholders were not misclassified. Safe committed defaults remain in place for AI, communications, payments, publishing, optional features and development/runtime identity.

Changed QA/tooling code was reviewed for command construction, bounded path handling, temporary-file containment, Git invocation, database-copy targeting, secret handling and evidence output. The security-diff review reported no actionable finding. Git safety, merge-marker, focused-test/skip-integrity, tracked-artifact, model-binary, backup/database and unexpected-large-file checks passed.

## Release and branch consistency

Current main contains the retained cleared releases for Academic Integrity, Universal Search, Smart AI Foundation, Smart AI Local Runtime, KG Reports, Event Media, Whiteboard Bridge, Command Center, My Work, parallel-worktree safety and Parent Meetings. Their annotated tags resolve to commits contained in current-main history and their declared activation boundaries remain distinct from software clearance.

Parent Meetings is `CLEARED / OPERATIONAL_ACTIVATION_DEFAULT_OFF` on current main at `parent-meetings-v1-5-v43-2026-08-24`.

Optional Operations remains committed and independently tested on `origin/feature/optional-ops-v1-5-1a`, but is not contained in main. At this evidence point it is 14 commits behind and 9 ahead of current main, and remains `LOCAL_ACCEPTANCE_COMPLETE / RELEASE_BLOCKED_EXTERNAL_CI` because its mandatory exact-SHA workflow was rejected before checkout by the external GitHub Actions billing/spending condition. Its functionality and local totals are excluded from current-main acceptance.

## Exact next action

Implement a separately reviewed, narrow server-side enforcement change for `real-data-imports`, `public-admissions-form` and `payroll-ess-pilot`, and create an authoritative governed-surface map for `bulk-exports`. Then independently rerun this exact-head acceptance package. Only after every local mandatory gate is green should the approved exact-SHA external CI gate be attempted and merge/tag reconsidered.
