# Final Corrected-Scope Cross-Module Acceptance

**Prompt:** `FINAL-SCOPE-QA-1A` / `FINAL-SCOPE-QA-1A-R1`<br>
**Evidence window:** 2026-08-23 to 2026-08-24<br>
**Current verdict:** `LOCAL_MANDATORY_ACCEPTANCE_GREEN / EXACT_HEAD_CI_PENDING`<br>
**Candidate branch:** `feature/final-scope-qa-1a`<br>
**Authorized current main:** `3d51164b8214211d26e48c2c6f9920286ef9c689`

This is local/private release acceptance evidence. It does not authorize deployment, operational activation, real-data migration, provider activation, merge or release tagging.

## R1 remediation outcome

The three previously red default-off capabilities now fail closed at trusted server boundaries. `real-data-imports` guards every discovered operational import commit plus the shared onboarding execution service; safe zero-write preview and template behavior remains available. `public-admissions-form` guards the public page, application page, every public submission/document API and the two public write services without disabling authenticated Admissions CRM. `payroll-ess-pilot` guards the Staff self-service page, API, payslip download and self-request service without broadening the flag over leadership Payroll administration.

The committed defaults remain false with zero-percent rollout. A QA-only activation path requires a non-production process, a loopback application origin, an explicitly named synthetic-copy mode, a file database under a copied/test temporary path and a known allowlisted flag key. Client query, body, cookie and header values cannot affect evaluation. Focused copied-database Browser acceptance proved OFF denial and ON availability for the intended synthetic actor at desktop and 390×844 mobile width, with direct-URL, multi-role context, overflow and focus checks.

Bulk-export discovery now classifies all 60 export-like API routes: 40 are governed bulk exports and 20 are explicitly single-record or otherwise not bulk exports. The machine validator fails on an unclassified future surface and checks server authorization evidence, private/no-store behavior, CSV neutralisation, hidden-field selection, mapping consistency and bounded manifest metadata. The real `bulk-exports` flag means newly released bulk surfaces; zero current cleared surfaces are mapped to it, so existing governed exports retain their per-surface authorization and bounds rather than being placed behind an invented global switch.

All local mandatory gates are green. Exact-head GitHub validation is the remaining release boundary. No QA release tag has been created and this branch has not yet been merged to main.

## Historical first-run checkpoint

The 2026-08-24 first run correctly returned `FINAL_SCOPE_QA_REQUIRES_FIXES`: `real-data-imports`, `public-admissions-form` and `payroll-ess-pilot` lacked complete server-side runtime enforcement, while `bulk-exports` lacked an authoritative governed-surface map. That checkpoint remains the reason for R1 and is not rewritten as a pass.

## Current-main inventory

| Evidence | Result |
| --- | --- |
| Page routes | 350 |
| API routes | 590 |
| Main test files | 225 |
| Candidate test files | 228 |
| Active ordered migrations | 22 |
| Prisma models/tables after fresh migration | 320 |
| Backup format | v43; 269 durable collections |
| Reachable annotated tags | 47 |
| Cleared requirement/tag mappings | 27 verified |

The full candidate suite passed 227 test files with one intentionally skipped test file, and 2,071 tests with three intentional skips out of 2,074 total. The skips are the existing qpdf/environment-dependent payslip checks; they were recorded as skips, not passes. TypeScript validation and the production build passed.

## Cross-module acceptance

Focused programmatic checks exercise the current authentication/session, IAM, Academic Integrity, Parent linked-child ownership, Super Admin owner isolation, Universal Search, Smart AI Foundation and loopback-only local runtime, Event Media, KG Reports, Parent Meetings, feature-flag, finance, attendance, timetable, Safe Exit, backup/restore and migration contracts. Synthetic copied databases were used for every write rehearsal. No new interactive Browser run was made mandatory; retained Browser evidence was checked where the governing release already required it.

Smart AI remains `DISABLED` by committed default, accepts only loopback local endpoints when explicitly enabled, has no cloud-AI or arbitrary external inference path, and has no ERP mutation authority. Event Media public publishing, KG Reports operational activation and Parent Meetings operational activation remain off by default.

## Feature-flag inventory

All ten release flags are committed false with zero-percent rollout.

| Flag | Runtime acceptance |
| --- | --- |
| `real-data-imports` | `ENFORCED` |
| `online-payments` | `NO_RUNTIME_PROVIDER_CAPABILITY` |
| `live-messaging` | `COMPENSATING_CONTROL` |
| `ai-ocr-live-processing` | `COMPENSATING_CONTROL` |
| `bulk-exports` | `ENFORCED_NO_MAPPED_SURFACES` |
| `public-admissions-form` | `ENFORCED` |
| `payroll-ess-pilot` | `ENFORCED` |
| `kg-report-cards-v1-5` | `ENFORCED` |
| `transport-v1-5` | `ENFORCED` |
| `cafeteria-v1-5` | `ENFORCED` |

All runtime classifications now have executable evidence. Operational activation remains separately prohibited.

## Migration, backup and restore

The 22 active migration names are unique and ordered. Fresh deployment produced 320 models/tables, schema equivalence reported 1,577 indexes and 549 foreign keys, and a representative copied existing database upgraded from 292 to 320 models/tables without changing its business baseline. The backup v43 contract included 269 durable collections and restore completed twice with record counts, ownership, collision handling, audit/immutable data and role state preserved. No business migration was added by this task.

The operational database was resolved and hashed before copied-database work, was never used as a write target, and matched byte-for-byte at the final integrity check. Private paths and digest values are intentionally excluded from this document.

## Security, dependencies and repository safety

Production-only and full dependency audits both reported zero Critical, High, Medium, Low or informational findings. The tracked-secret/configuration review found no plausible live credential, private key, token or provider secret; synthetic fixtures and explicit placeholders were not misclassified. Safe committed defaults remain in place for AI, communications, payments, publishing, optional features and development/runtime identity.

Changed QA/tooling code was reviewed for command construction, bounded path handling, temporary-file containment, Git invocation, database-copy targeting, secret handling and evidence output. The security-diff review reported no actionable finding. Git safety, merge-marker, focused-test/skip-integrity, tracked-artifact, model-binary, backup/database and unexpected-large-file checks passed.

R1's pre-release diff review identified one Medium QA-path canonicalisation issue in the first locally green head: a trusted non-production file URL was classified by raw path text. It was corrected before push by canonicalising the file URL and requiring containment beneath the worktree QA roots or operating-system temporary directory, while rejecting the canonical operational database name. Traversal, encoded-path and unapproved-root tests now fail closed. The final exact-head security scan must show zero unresolved findings before external CI.

## Release and branch consistency

Current main contains the retained cleared releases for Academic Integrity, Universal Search, Smart AI Foundation, Smart AI Local Runtime, KG Reports, Event Media, Whiteboard Bridge, Command Center, My Work, parallel-worktree safety, Parent Meetings and Optional Operations. Their annotated tags resolve to commits contained in current-main history and their declared activation boundaries remain distinct from software clearance.

Parent Meetings is `CLEARED / OPERATIONAL_ACTIVATION_DEFAULT_OFF` on current main at `parent-meetings-v1-5-v43-2026-08-24`.

Optional Transport and Cafeteria are `CLEARED / OPERATIONAL_ACTIVATION_DEFAULT_OFF` on current main at `optional-ops-v1-5-v43-2026-08-24`. Their retained branch is contained in the release, and the mandatory exact-SHA GitHub validation recorded by that release passed. No real service, route assignment, meal, deployment, provider or operational activation is implied.

No current committed remote feature branch remains classified as release-blocked by this acceptance manifest.

Current main also contains the authorised Universal Search Extension 1B release at annotated tag `universal-search-extension-v43-2026-08-24`. Reconciliation preserved the earlier Smart AI mutation/IAM denials and the extension's image-analysis, health-data and new-source write denials. Two narrow QA-only typing defects exposed by the complete typecheck were corrected without changing runtime Search behavior.

## Exact next action

Commit and push the final evidence head, run the approved exact-SHA GitHub validation, and release only if that exact head receives runner allocation, checkout and all mandatory green jobs. The three remediated flags, Optional Operations, Parent Meetings, KG Reports and every provider remain operationally inactive.
