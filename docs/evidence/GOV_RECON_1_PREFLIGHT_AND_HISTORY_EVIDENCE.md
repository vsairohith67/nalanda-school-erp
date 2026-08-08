# GOV-RECON-1 Preflight and History Evidence

**Captured:** 2026-08-08 IST<br>
**Mode:** read-only operational evidence; documentation-only working branch

## Before state

| Check | Evidence |
| --- | --- |
| Authoritative current main | `71f671b8b6ee946884e5b79a9786581f237a6437`; local `main`, `origin/main` and fetched remote agreed; ahead/behind `0/0` |
| Expected private repository | `vsairohith67/nalanda-school-erp`; GitHub reports private; default branch `main` |
| Working branch | `governance/prompt-history-reconstruction-v1-scope`, created from current main |
| Git safety | `pnpm.cmd git:safety-check` passed before edits |
| Current released baseline | tag `payroll-ess-v37-2026-08-08` reaches current main |
| Admissions release reachability | `admissions-crm-v37-2026-08-03` at `0d6cc25` is an ancestor of current main |
| Migration status | Prisma reported 11 migrations and database schema up to date |
| Operational database SHA-256 | `DD39C1491AB8F604EC3BAD8598F7D80FE95DBBF81F6C2792276948A57DA92F72` (`prisma/dev.db`, 6,893,568 bytes) |
| Business baseline | Students 0; active enrollments 0; Payments 0 / INR 0; Guardians 0; Staff 0 |
| Account baseline | Users 4, roles 4; one active owned Super Admin; ADMIN/ACCOUNTANT/VIEWER inactive; no sessions, profiles or overrides |
| Operational runtime | No concurrent workspace runtime retained after preflight |

No operational database write was performed. Existing ignored backup files were observed but not opened, copied, deleted or added to Git.

## Accessible history boundary

- Earliest recoverable requirements summary: Notion Prompt Library created 2026-06-19, covering Phase 1 and Phase 2/Prompt 1 onward.
- Earliest accessible Git commit: `2d1ac63` on 2026-07-22 (`baseline-sec1-management-2026-07-22`). Earlier file-introduction/commit history was collapsed into that baseline and cannot be reconstructed from Git.
- Current reachable release: Prompt 23I at `71f671b`, tagged 2026-08-08.
- GitHub PR evidence: #1 AUTH-2B, #2 Prompt 23H Admissions CRM and #3 Prompt 23I Payroll/ESS.
- The exact original wording of Phase 1, Phase 2/Prompt 1 and other historical prompts was not found in the repository or fetched external sources. Summaries and dated code/release evidence are not quotations.

## Tag inventory summary

Twenty-four release/evidence tags are reachable from the baseline sequence: baseline SEC-1/Management, clean-install v37, staging readiness, finance integrity, Schoolknot consolidation, receipt governance, reconciliation, data provenance/clean baseline, account hardening, operational migration, Teacher scope, UX shell, three exam/report phases, AUTH-2B, IAM-1A, Parent timetable, calendar, classwork, consolidated reporting, Admissions CRM and Payroll/ESS. `docs/PROMPT_LEDGER.md` maps these tokens and commits chronologically.

## Evidence classifications

- `EXACT_SOURCE`: exact Git objects, repository file contents and current external object state.
- `IMPLEMENTED_CODE_EVIDENCE`: models/routes/services/UI found in source.
- `QA_RELEASE_EVIDENCE`: tests, QA documents, commits, tags and PR closure.
- `INFERRED_FROM_REPOSITORY`: bounded reconstruction from dated repository evidence.
- `MISSING_OR_UNAVAILABLE_SOURCE`: exact original prompt/source or asset was not recovered.
- `SUPERSEDED`: preserved record replaced by a dated authoritative decision.
- `DEFERRED`: explicitly later scope.
- `CONFLICTING_RECORD`: sources disagree and the conflict is recorded rather than erased.

## Closure confirmation before commit

The documentation-only working tree passed `git diff --check`, validation of relative links across all 20 changed/new Markdown files, the focused `tests/docs-index.test.ts` test, and `pnpm.cmd git:safety-check`. No application source, Prisma schema or migration file changed.

Read-only Prisma status still reported 11 migrations and an up-to-date schema. The operational database remained 6,893,568 bytes with SHA-256 `DD39C1491AB8F604EC3BAD8598F7D80FE95DBBF81F6C2792276948A57DA92F72`. The exact baseline remained Students 0, active enrollments 0, Payments 0 / INR 0, Guardians 0, Staff 0, Users 4, role assignments 4, sessions 0, permission profiles/entries/assignments/overrides 0, and one active owned Super Admin with ADMIN/ACCOUNTANT/VIEWER inactive.

The Browser tab and its exact verified Codex browser kernel were closed after the Canvs batch. Final inspection found zero Node runtimes tied to this workspace and zero GOV-RECON temporary databases. No credentials, payslip/salary document, operational database, backup or private runtime artifact is part of the candidate changes. No merge, release tag or deployment was performed.
