# Documentation Reconciliation Report

**Phase:** `GOV-RECON-1`<br>
**As-of:** 2026-08-08<br>
**Status:** independent repository QA gates passed; approved for fast-forward governance closure, subject to final external re-fetch

## Reconstructed coverage

The reconstruction covers the earliest available post-hoc Prompt Library evidence created 2026-06-19 (Phase 1, Phase 2/Prompt 1 and subsequent summaries), the repository Prompt History, all 56 accessible Git commits from the consolidated 2026-07-22 baseline through Prompt 23I, 24 tags, all local/remote branches, GitHub PRs #1–#3, repository code/tests/docs, and current Notion/Asana/Basic Memory/Canvs state.

Exact original Prompt 1 wording was not recovered. No reconstructed summary is presented as a quotation. `docs/PROMPT_LEDGER.md` records the exact missing-source ranges and the Prompt 23F heading omission conflict.

## Authoritative scope correction

- V1 now retains Staff Payslip Request and Secure Delivery but excludes automatic payroll calculation.
- Full payroll automation and salary self-service are V1.5, even though Prompt 23I is already implemented/released.
- Family/multi-Student mixed-tender collection, canonical report-card templates/physical print acceptance and safe release/client update are V1 launch requirements.
- Parent/Staff support, observability, governed bulk onboarding, final cross-module QA and controlled pilot/cutover are also V1.
- Transport and Cafeteria are optional V1.5.
- V2 is the governed AI lessons/video programme and never includes payroll.

Historical releases remain valid and are not deleted or reopened. Conflicting roadmap/task statements are marked superseded as of 2026-08-08.

## Requirements totals

The authoritative register contains 32 requirements: V1 23, V1.5 3 and V2 6. Status totals are Complete 13, Partial 7, Missing 2, Deferred 9 and Superseded 1.

## Audit outcomes

### Family/multi-Student mixed tender

The current engine is not sufficient. It supports one Student per receipt and tested cash/UPI splitting for that Student. The receipt invariant rejects a second Student, duplicate UPI-reference refusal is absent, and no family collection/allocation/credit/online-plan model exists. The exact requirement is not independently tested. `FIN-FAMILY-PAY-1` is the recommended next implementation phase.

### Staff payslip request and delivery

Prompt 23I provides Staff-owned no-store payslip download, immutable snapshots and SHA-256, but the V1 request, upload, status, permission separation, password channel, download audit and governed replacement workflow are absent. This remains partial and follows the finance blocker.

### Report-card templates and print

Four code-defined template families and digital PDF/package QA exist. No original Nalanda report-card PDF/screenshot/template asset, `Student Progress Report Card.zip`, or prior named safe catalog/manifest/sync package was found under the project Documents tree. QA reconstructed privacy-safe metadata for distinct KG, primary, middle and secondary families without importing document bytes or Student data. Physical colour/black-and-white acceptance evidence is still missing. The exact upload checklist and print protocol are recorded without fabricating a layout.

### Safe release and client updates

Existing migration, backup and staging-readiness work is reusable. Separate staging operation, complete preview/pilot/reconciliation flow, production monitoring and safe client version-discovery/update UI remain partial. No deployment is authorised by this phase.

## Source-of-truth governance

1. Git is the authoritative technical and version-controlled record.
2. Notion is the executive roadmap/completion/decision surface.
3. Asana is actionable task tracking.
4. Basic Memory Cloud is a searchable durable-decision mirror, never the only authority.

The external reconciliation uses summaries and identifiers only. No credentials, database contents, personal/salary/payment data or document bytes are allowed.

## External reconciliation result

### Notion

Re-fetched before editing, prepended the dated scope-correction notice, and re-fetched successfully:

- Completion Index — `38fc9801-27a8-81d9-b386-ff7845d436f4`;
- Forward Roadmap — `3a3c9801-27a8-8146-9be9-c1eb1033acfa`;
- Personal Command Center — `37cc9801-27a8-81c4-b47f-c01a5aaa5e01`;
- Security Hardening — `3a2c9801-27a8-818b-978a-df5bcbac59fc`;
- Staging Deployment Readiness and Release Gates — `3a6c9801-27a8-811d-a98e-d907c3de8604`;
- School Operations — `37cc9801-27a8-81f5-bbb8-f1450c24edd7`.

Created and re-fetched the authoritative page `Nalanda ERP Requirements Register and Prompt Ledger`, ID `3b6c9801-27a8-81da-bcbd-cbd62189364d`, URL `https://app.notion.com/p/3b6c980127a881dabcbdcbd62189364d?pvs=204`.

### Asana

Re-fetched private project `1217028055529910`, renamed task `1217205169419490` to `V1 — Staff Payslip Request and Secure Delivery`, and corrected its description to exclude payroll calculation. Created five deduplicated tasks:

- family payment `1217296323242729`;
- safe release/client update `1217296233773943`;
- report-card template/print acceptance `1217296323209432`;
- governance reconstruction `1217296323242793`;
- V1.5 full payroll `1217296422857648`.

Re-fetch confirmed all six corrected/new tasks in their intended sections. Optional Transport/Cafeteria task `1217205126458625` and V2 AI task `1217028119049877` remain open and unchanged. Admissions release task `1217126537950462` and Prompt 23I release task `1217309162402892` remain completed. Project status update `1217296422855837` records the correction.

### Basic Memory Cloud and Canvs

Basic Memory sync completed and was re-read at the permalink recorded in `BASIC_MEMORY_SYNC_PACKAGE.md`. The supplied Canvs room `1LzTSjaWjpOaHppTtyXqICkMbEgHbT6T-` was initially empty; it now contains a 37-element Mermaid-derived scope/source-of-truth diagram. The Browser tab used to complete client-side rendering was closed immediately after verification.

## Before/after safety boundary

Preflight evidence is in `docs/evidence/GOV_RECON_1_PREFLIGHT_AND_HISTORY_EVIDENCE.md`. Independent QA passed `git diff --check`, 227-file relative-link validation, 41 focused tests across six files, Git safety and read-only migration status with 11 migrations current. The operational database remained 6,893,568 bytes with SHA-256 `DD39C1491AB8F604EC3BAD8598F7D80FE95DBBF81F6C2792276948A57DA92F72`; the exact zero-business/four-account baseline was unchanged. No application source, schema, migration, operational data, runtime, temporary database, raw report-card source, private document, deployment or provider was added.

## Independent QA correction record

- Confirmed 56 accessible pre-governance commits, 24 resolvable tags and merged GitHub PRs #1–#3; the governance commit is the 57th currently accessible commit.
- Confirmed all 32 requirements and unchanged counts: V1 23, V1.5 3, V2 6; Complete 13, Partial 7, Missing 2, Deferred 9 and Superseded 1.
- Added explicit evidence-class tokens to the 15 register rows that previously relied on prose alone.
- Recorded that full payroll/ESS is technically cleared yet remains V1.5 operational scope, may stay disabled or permission-restricted in `main`, and does not complete the V1 payslip-request workflow.
- Reconfirmed the finance matrix as seven `PARTIALLY_IMPLEMENTED`, nine `MISSING` and one `UNSAFE_OR_AMBIGUOUS`; `FIN-FAMILY-PAY-1` remains next.
- Corrected the current documentation index so optional Transport is not described as the next implementation phase.
