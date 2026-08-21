# ACADEMIC-INTEGRITY-1A Implementation Checkpoint

Release line: Nalanda ERP v1.1 — Academic Integrity Release

Phase: `ACADEMIC-INTEGRITY-1A`

QA phase: `ACADEMIC-INTEGRITY-1A-QA`

Base checkpoint: `467204394a0ca891fe6e9ac4d55fe59d0814aa17`

Frozen historical tag: `super-admin-command-center-v41-2026-08-21` (unchanged)

## Implemented controls

- Principal and Super Admin are the only permanent marks-write authorities.
- Teacher marks entry is denied in defaults, immutable IAM governance, navigation, routes, APIs and mutation services, including multi-role and assignment-derived attempts.
- `MARKS_ENTRY_OPERATOR` reuses current IAM profile assignments for explicit, auditable, revocable exact-scope delegation to eligible non-teaching users.
- Legacy assessment and governed examination-component scopes are derived from server records and matched exactly.
- Grant/revoke changes increment authorisation state and revoke active sessions.
- Existing Guardian/Student linkage, when present, denies a delegated operator editing their linked child and audits the denial.
- Existing formulas, templates, immutable publications, calculation snapshots, audit history and V1 release evidence are unchanged.
- No schema migration is required or introduced.

## Implementation verification

- Focused Vitest: 7 files, 74 tests passed. Coverage includes permanent Teacher denial, exact delegation/tampering, expired/revoked/multi-role denial, reserved-profile mass-assignment protection, legacy/governed mutation routes, IAM precedence, report-card read-only compatibility and existing backup validation.
- `pnpm.cmd typecheck`: passed across the repository's partitioned app, API, component, library, tool and test TypeScript projects.
- Copied-database Browser QA: Principal at 1366x768 and 390x844; Super Admin at 1366x768; exact delegated Computer Operator at 1366x768; Teacher denied attempt at 1366x768.
- Browser findings: no page-level horizontal overflow, no console/hydration errors, visible 2 px focus, important controls at least 44 px, useful Teacher policy denial, Teacher Academic Reports retained, one-scope operator selector and no operator delegation-management action.
- Browser fixtures used an ignored copy of the operational SQLite database. The source operational database was not mutated; the copied fixture and private credentials are cleanup-bound.

## Parallel development isolation

The concurrent `SUPER-ADMIN-WORK-1A` branch overlapped these shared files: `app/globals.css`, `docs/FEATURE_COMPLETENESS_MATRIX.md`, `docs/INDEX.md`, `docs/PROMPT_HISTORY.md`, `docs/PROMPT_LEDGER.md`, `docs/REQUIREMENTS_REGISTER.md`, `docs/V1_5_AND_POST_RC_ROADMAP.md`, and `lib/access-rules.ts`. This implementation was transferred to and committed from an isolated worktree based directly on checkpoint `467204394a0ca891fe6e9ac4d55fe59d0814aa17`; no Diary, Tasks, Contacts, Super Admin Work, schema, or migration change was included.

Independent QA must re-run its own copied/synthetic database probes and must not treat this implementation checkpoint as acceptance.

Policy marker: `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`
