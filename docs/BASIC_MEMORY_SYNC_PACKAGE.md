# Basic Memory Cloud Sync Package

**Package:** `GOV-RECON-1-BASIC-MEMORY`<br>
**Project target:** `personal/main` (`877cb956-3ef4-4e2e-8e89-31243b43b03f`)<br>
**Prepared:** 2026-08-08

This package is complete even if the connector is unavailable. The repository remains authoritative. Store summaries and identifiers only; never store credentials, recovery addresses, private salary data, payslip/document bytes or passwords, Student personal data, payment references, database contents or encryption keys.

## Durable note payload

**Suggested title:** `Nalanda ERP GOV-RECON-1 V1 Scope and Requirements Decision — 2026-08-08`

### V1/V1.5/V2 decision

V1 requires existing cleared foundations, Staff Payslip Request and Secure Delivery, family/multi-Student mixed-tender fee collection, canonical report-card templates with physical print acceptance, safe staging/release/client updates, support, observability, governed bulk onboarding, final cross-module QA and controlled pilot/cutover. Automatic payroll calculation is excluded. Full payroll automation is V1.5; Transport/Cafeteria are optional V1.5. V2 is AI lessons/videos with Teacher approval, source grounding, privacy/quality/cost controls and no automatic Student publication.

### Staff payslip request workflow

V1 is an own-account request-and-secure-delivery workflow for existing monthly documents. Director/Super Admin queue; preparation/upload/issue permissions separable; Accountant optional explicit preparation/upload; Principal denied by default. Issued versions immutable, private/no-store, hashed and tamper-evident; password channel is separate. Salary calculation/generation/posting is excluded.

### Family/multi-Student mixed tender

V1 blocker. Current released engine supports one Student per receipt and same-Student tender split, but not one atomic family collection across children. Required invariant: instruments equal Student allocations plus explicitly approved credit plus approved refund/reversal. Full allocation is the default. Next phase identifier: `FIN-FAMILY-PAY-1`.

### Report-card template library

V1 requires canonical privacy-safe source samples per distinct layout family, immutable mapping/versioning and physical colour and black-and-white print acceptance. Current code has four digital renderer families and publication QA but no original approved layout assets or physical print evidence.

### Safe update strategy

V1 requires feature branches, tests, copied-database migration rehearsal, preview/separate staging with synthetic fixtures, flags, compatible migrations, backup/restore rehearsal, smoke/pilot/monitor/rollback, release tags/notes and safe web/PWA version discovery. Routine updates do not refresh dirty forms or in-flight requests. Forced updates require an approved critical case.

### Source-of-truth hierarchy

Git is authoritative technical/versioned record; Notion is executive roadmap/completion/decisions; Asana is actionable tracking; Basic Memory Cloud is a searchable mirror and never the only authority.

### Latest verified release checkpoint

Current released `main`: `71f671b8b6ee946884e5b79a9786581f237a6437`, tag `payroll-ess-v37-2026-08-08`. Admissions tag `admissions-crm-v37-2026-08-03` remains reachable. Prompt 23I release history is preserved while full-payroll product scope is reclassified to V1.5.

## Connector result

`BASIC_MEMORY_SYNC_COMPLETE`

- Action: created, then re-read successfully.
- Project: `personal/main` (`877cb956-3ef4-4e2e-8e89-31243b43b03f`).
- Title: `Nalanda ERP GOV-RECON-1 V1 Scope and Requirements Decision — 2026-08-08`.
- Permalink: `personal/main/projects/nalanda-erp/governance/nalanda-erp-gov-recon-1-v1-scope-and-requirements-decision-2026-08-08`.
- Stored content: summaries, scope decisions, safe identifiers and release checkpoint only.
- Re-fetch check: V1/V1.5/V2 decision, payslip workflow, `FIN-FAMILY-PAY-1`, template requirement, safe update strategy, source hierarchy and latest release checkpoint were present.

If authenticated Basic Memory tools are unavailable, leave this package unchanged and report `BASIC_MEMORY_SYNC_PENDING`. Do not claim a successful sync without a returned note identifier and a re-fetch/read.
