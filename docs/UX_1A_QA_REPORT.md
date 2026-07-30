# UX-1A Implementation QA Report

Date: 2026-07-30
Branch: `ux/shared-login-shell-redesign`
Merge status: not merged; independent UX-1A-QA required.

## Scope result

Implemented the shared login, authenticated header, navigation/profile
presentation, design tokens, change-password handoff, health/readiness split,
responsive/accessibility behaviour, safe state pages, copied-database fixture,
tests, and documentation. No Prisma schema, migration, report-card logic,
Teacher-attendance scope, operational account status, or operational business
record changed.

## Preflight evidence

- Synchronized `main`: `b62270972b0df19fba00e1d5604bf0738c146a00`.
- Prompt 23C tag `teacher-attendance-scope-v37-2026-07-29` is reachable.
- Repository: private `vsairohith67/nalanda-school-erp`.
- Git safety: passed.
- Prisma migration: one completed `20260722_clean_install_baseline`, clean.
- Pre-edit typecheck: passed with bounded 4 GB heap.
- Operational business baseline: 0 Students, 0 enrollments, 0 Payments,
  INR 0, 0 Guardians, 0 Staff.
- Operational accounts: one active Super Admin; one inactive Admin,
  Accountant, and Viewer.
- Operational database SHA-256:
  `9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`.
- Backup version: 37.

The legacy `deployment:integrity-check` script still expects the historical
8 / 8 / 19 business baseline and no `_prisma_migrations` row. It therefore
fails against the governed current zero-data and DEVOPS-1E baselines. UX-1A
does not widen into that unrelated verifier repair; the exact live read-only
checks above and `qa:ux1a operational-check` are authoritative for this phase.

## Browser evidence

Production runtime, isolated copied database, synthetic accounts only:

- Login: light/dark, generic failure, password visibility, busy semantics,
  policy/support links, no native dialog.
- Shell: all eight role defaults and permission-derived navigation.
- Mobile: exact header order, 64 px header, one year control, 44 px targets.
- Drawer: focus moves to Close, Shift+Tab wraps to last link, Tab wraps to
  Close, Escape closes, focus returns to Open.
- Account: human designation, no raw enum, Change Password, Appearance,
  Logout.
- Change Password: current/new/confirmation form and strong-password guidance
  visible; final password submission is covered by code/unit/copied-database
  security checks rather than browser-changing a credential.
- Permission denial: Viewer direct access to Users redirects to
  `/unauthorized` with `Viewer / Auditor`, no raw enum.
- 404: neutral Page not found state with recovery action and no native dialog.
- Health: separate Core application health and Deployment readiness for an
  authorised health role.
- Exact viewports: 1440×900, 1366×768, 1024×768, 768×1024, 390×844,
  375×667, and 320×568; zero document-level horizontal overflow.

Privacy-safe screenshots are under `docs/evidence/ux1a/`.

The final production-only retest caught one defect before closure: the new
transparent PNG was not yet in the middleware public-asset allowlist, so image
optimization received redirected HTML. The allowlist and regression test were
corrected, the complete suite and production build were repeated, and the
replacement 320×568 evidence proves 48×48 natural logo dimensions, zero
overflow, zero console errors, and no native dialog.

## Copied-database fixture

`pnpm.cmd qa:ux1a prepare|inspect|operational-check|cleanup|destroy`:

- creates only an isolated byte copy under ignored `tmp/devops1b`;
- creates eight random-password synthetic users;
- never prints the synthetic password;
- refuses the operational database as a target;
- records and rechecks the operational hash;
- removes only the namespaced fixtures;
- verifies the copied database’s non-QA logical digest after cleanup; and
- removes copied database/state artifacts after sign-off.

## Final verification

- `pnpm.cmd routes:list`: passed, 274 page routes and 378 API routes.
- `pnpm.cmd lifecycle:backfill`: passed on the isolated copy, 0 active
  Students scanned and no data changed.
- `pnpm.cmd typecheck`: passed with the bounded 4 GB heap.
- `pnpm.cmd test`: passed on final source, 1,585 tests in 171 files.
- `pnpm.cmd build`: passed on final source, including 212/212 static entries.
- `pnpm.cmd backup`: created the version-37 backup
  `nalanda-fee-control-backup-2026-07-30-09-20.json`.
- Operational SHA-256 before and after backup remained
  `9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`.
- Copied-database cleanup passed twice; both checks restored the non-QA
  logical digest. Destroy removed the copied database and ignored credential
  state. Two subsequent filesystem inspections found no runtime, scratch
  copy, UX-1A log, credential state, or credential-shaped material.
- Final read-only SQLite verification: 0 Students, 0 enrollments, 0 Payments,
  INR 0, 0 Guardians, 0 Staff, 0 UX-1A fixture users, exact four-account
  baseline, one finished migration, `integrity_check=ok`, and 0 foreign-key
  violations.
- Canvs master architecture board:
  <https://app.canvs.io/?room=o7G35Y52TrwiRc9J--W1>, re-fetched with 25
  elements and the compact Shared UX Shell node.
- Canvs Login & App Shell phase board:
  <https://app.canvs.io/?room=4MUz0WeqLBCxuBod8K_h>, re-fetched with 68
  elements and the detailed phase/boundary/QA flow.
- The feature branch remains unmerged. GitHub private-branch and Notion page
  re-fetches are closure gates performed after the final commit exists; their
  exact commit evidence belongs in the implementation handoff and external
  records.

UX-1A implementation is eligible only for independent `UX-1A-QA`; this report
does not authorize merge or begin that QA phase.
