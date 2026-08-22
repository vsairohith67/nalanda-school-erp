# KG Report Cards V1.5 Software Clearance

**Prompt:** `KG-REPORTS-V1_5-1A`

**Software verdict:** `KG_REPORTS_V1_5_CLEARED`

**Operational state:** `SOFTWARE_CLEARED_OPERATIONAL_ACTIVATION_OFF`

**Date:** 2026-08-22

## Governed boundary

The existing Notion source **LKG & UKG Report Card — Source Reference and Digital Specification** (`39fc9801-27a8-8165-a186-d49f68d5c0aa`) remains authoritative for the ten-page booklet structure. Academic Integrity v1.1 supersedes the older Teacher-write policy: only Principal and Super Admin have permanent KG rubric/overall-grade write authority. Report-card editing does not reuse delegated marks-entry authority.

The production feature flag remains false with zero rollout. The only clearance override is a fail-closed non-production sentinel that requires an isolated copied or synthetic database and rejects the operational `prisma/dev.db` path. This release does not deploy, onboard live data or activate KG reporting.

## Completed capability

- Academic year, class, section, Student and Evaluations I-V.
- Source-locked criterion definitions and allowed response sets, overall grade where applicable, 20 G/S/N personality traits, comments and governed acknowledgements.
- June-April attendance derived in bulk from the authoritative Attendance module and refreshed into the immutable issue snapshot; there is no manually editable attendance truth.
- Height in centimetres and weight in kilograms for Evaluations I, III and V with bounded validation and no medical inference.
- Draft editing while unlocked, immutable issued versions, append-only correction revisions with actor, timestamp, reason and approval chain, and retained superseded versions.
- Final promotion display references the approved Academic Progression record and never progresses a Student automatically.
- Linked-child Parent access to issued current/historical versions only, plus append-only Parent/Guardian acknowledgement.
- Ten-page A4/booklet-friendly colour and true-monochrome PDF output with Georgia Bold school name and mobile Parent presentation.

## Independent focused QA

All mutation tests used the copied database at `tmp/kg-reports-v1-5-qa/kg-reports-copied.db` with synthetic records. The operational database SHA-256 remained `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA` before and after QA.

The independent harness passed with 24 synthetic LKG Students and 2 UKG Students, all five evaluations, 21 rubric criteria, all permitted response sets, 20 personality traits, 11 attendance months, growth observations, comments, acknowledgements, issue and correction. It verified 27 immutable versions, a two-version correction chain, linked-child Parent acknowledgement, Principal and Super Admin allow, permanent Teacher denial, delegated/operator/viewer/future-role denial, cross-object IDOR/BOLA denial, invalid and malicious inputs, and constant bounded cohort query counts (12 reads for both 2 and 24 Students).

No schema change was required. Existing durable report-card, version, event, attendance and progression models were reused, so no migration or rollback operation was introduced.

## PDF and Browser QA

Four synthetic packs were generated: colour and native monochrome for representative LKG and UKG Students. Each pack contained exactly 10 A4 pages. All 40 rendered pages passed nonblank/white-background checks, digital contact-sheet inspection showed no clipping or overflow, and all 20 monochrome pages had zero chromatic pixels. Physical printer acceptance remains a later operational gate.

Browser QA covered Principal at 1366x768 and 390x844 in light and dark themes, Super Admin desktop, Parent desktop/mobile issued-only views, and Teacher desktop/mobile denied-write behavior. Pages had no document-level horizontal overflow, visible keyboard focus, labelled fields/errors, 44px interactive targets, and no console or hydration errors. Wide report tables use bounded internal horizontal scrolling on mobile. Direct Teacher KG-entry access returned 404 and exposed no write controls.

## Final regression and release reconciliation

The terminal sequential regression completed in the required order:

| Gate | Result |
| --- | --- |
| `pnpm.cmd routes:list` | Passed; 339 page routes and 553 API routes, including the linked-Parent acknowledgement API |
| `pnpm.cmd lifecycle:backfill` | Passed dry-run; 336 active synthetic/copied Students scanned, zero missing enrollments and no data changed |
| `pnpm.cmd typecheck` | Passed across all application, API, component, library, tool and test TypeScript projects |
| `pnpm.cmd test` | Passed; 220 files and 1,964 tests, with 3 intentional qpdf-adapter skips because the separately pinned `QPDF_EXECUTABLE_PATH` and SHA-256 were not configured in this worktree |
| `pnpm.cmd build` | Passed; Prisma Client generation plus both Next.js Turbopack compile and generate phases |
| `pnpm.cmd backup` | Passed; logical backup version 41 created under the ignored local backup boundary |
| `pnpm.cmd git:safety-check` | Passed; no detected secret or private runtime artifact in candidate, staged or tracked files |

Focused security, report-card, Academic Integrity and release-boundary regression also passed: 5 files and 62 tests. Canonical/report-card print regression passed after the bundled `pdftoppm` resolver was made deterministic. The operational database remained byte-identical at SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.

The retained release branch is `feature/kg-reports-v1-5-1a`. The annotated software-clearance tag is `kg-report-cards-v1-5-v41-2026-08-22`. Canonical Notion and Canvs surfaces are updated only after the terminal merged/tagged release verdict and read back once.

## Remaining operational gates

- Deployment and live-school data onboarding.
- Explicit operational feature activation and rollout approval.
- Physical printer/booklet acceptance on the school's chosen device and paper.
- Any later policy change to delegated report-card authority.
