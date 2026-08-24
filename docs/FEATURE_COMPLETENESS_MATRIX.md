# Feature Completeness Matrix

**As-of:** 2026-08-24<br>
**Source:** `docs/REQUIREMENTS_REGISTER.md`

This matrix separates presence from completeness. `Complete` requires tested workflow and release evidence; `Partial` means meaningful code or planning exists but a required outcome is absent.

| Product area | Scope | Current disposition | Why it is not stronger | Governing evidence / next phase |
| --- | --- | --- | --- | --- |
| Core single-Student fees and receipts | V1 | Complete | Family collection is a different requirement | Existing fee/receipt tests and releases |
| Auth, recovery, sessions and IAM | V1 | Complete | Maintain regression; no live deployment implied | AUTH-2B / IAM-1A releases |
| Student/Guardian lifecycle | V1 | Complete | Real-data onboarding still gated | Prompt 15 evidence |
| Staff/attendance/leave/substitutes | V1 | Complete | Salary-document requests separate | Prompt 12/13 evidence |
| Timetable | V1 | Complete | Exact Teacher scope must stay server-derived | Teacher-scope release |
| Examination schemes and marks | V1 | Complete | Historical layouts/formulas are not assumed | EXAM-RC-IMPL-1/2 releases |
| Principal-controlled marks authority and scoped non-teaching delegation | V1.1 security correction | Complete / independently QA-cleared | Ordinary Teacher write authority is removed prospectively; exact non-teaching delegation, linked-child denial, session revocation and immutable history are independently proved | [ACADEMIC-INTEGRITY-1A-QA clearance](evidence/ACADEMIC_INTEGRITY_1A_QA_CLEARANCE.md); [v1.1 architecture](ACADEMIC_INTEGRITY_V1_1_PRINCIPAL_MARKS_ENTRY.md) |
| Issued report publication and Parent delivery | V1 | Complete | Canonical visual/print approval separate | EXAM-RC-IMPL-3 release |
| Admissions CRM | V1 | Complete | Do not reopen; real onboarding unauthorised | Prompt 23H release |
| Communications | V1 | Complete software / operational configuration pending | In-app/MOCK foundations are cleared; live providers remain unauthorised | Separate deployment/provider gate |
| Expenses/budgets/misc income/Cash Book | V1 | Complete | Family fee instruments separate | Prompt 16/FIN evidence |
| Library | V1 | Complete | Inaccessible Schoolknot screens remain comparison evidence gaps | Prompt 16E-J evidence |
| Certificates/Class X packages/ID cards | V1 | Complete | Report-card template catalog separate | Prompt 18 evidence |
| Backup/restore/migrations | V1 | Complete | Every new model must extend it | DEVOPS-1B/1E evidence |
| Staff Payslip Request and Secure Delivery | V1 | Complete local/private | Governed request/upload/protection/reveal/delivery/replacement/audit workflow independently verified | Deployment prerequisites and approved retention policy remain before real use |
| Family/Multi-Student Mixed-Tender Fee Collection | V1 | Complete locally/private | Provider activation, deployment, real-data onboarding and physical-printer acceptance remain gated | `FIN-FAMILY-PAY-1` implementation and independent QA |
| Canonical report-card template library/physical print | V1 | Complete | R8 digital/physical acceptance is retained and tagged; future edits require a governed version | `report-card-print-acceptance-v41-2026-08-14` |
| Safe staging/release/client update | V1 | Complete local/private | Software/rehearsal is released; actual hosting/deployment remains unauthorised | `release-operations-v41-2026-08-10` |
| Parent/Staff support/complaints/feedback | V1 | Complete | Privacy/retention wording and deployment remain operational gates | `support-complaints-v37-2026-08-09` |
| Observability and operational health | V1 | Complete software / operational configuration pending | Local/private health, alerts and runbooks are released; live hosting telemetry is not active | `observability-operations-v40-2026-08-10` |
| Bulk Student/Guardian/Staff onboarding | V1 | Complete locally/private | IMPORT-1A and independent QA prove controlled templates, private upload, bounded validation, explicit duplicate decisions, expiring dry-run approval, atomic/idempotent execution, lineage/reconciliation, dependency-safe rollback, OBS-1A metrics, backup v41 recovery and exact operational migration preservation | Real onboarding requires a separately approved maintenance/import phase; deployment and account activation remain gated |
| Final corrected-scope cross-module QA | V1/V1.5 current main | Acceptance implemented / requires fixes | Runtime flag enforcement is red; dependency audits are clean, but no merge/tag is authorised while any mandatory local gate fails | [Final corrected-scope acceptance](FINAL_CORRECTED_SCOPE_ACCEPTANCE.md) |
| Staging/pilot/reconciliation/cutover | V1 | Operational configuration pending | Explicit operational approval has not been granted | Separate operational release gate |
| Full payroll automation/salary ESS | V1.5 | Complete | Product scope moved from V1; statutory integrations remain gated | Prompt 23I release preserved |
| Super Admin Command Center | V1.5 | Complete locally/private | Deployment and real-user operation remain separate | `SUPER_ADMIN_COMMAND_CENTER_CLEARED` |
| Super Admin Diary / Tasks / Contacts | V1.5 | Complete locally/private | Exact-owner role/API/browser/recovery/security acceptance passed; operational migration and deployment remain separate | `SUPER_ADMIN_WORK_CLEARED`; Universal Search is also cleared |
| Universal Search | V1.5 | Complete locally/private | Exact-Super-Admin deterministic normalized retrieval is independently cleared; no AI/provider authorization | `UNIVERSAL_SEARCH_CLEARED` |
| Grounded Smart AI Foundation | V1.5 | Complete locally/private | Exact-Super-Admin, Universal-Search-only, read-only, citation-validated and independently QA-cleared; runtime remains disabled and there is no persistent history, cloud provider or action authority | `SMART_AI_CLEARED`; [independent QA clearance](evidence/SMART_AI_1A_QA_CLEARANCE.md) |
| Smart AI Local Runtime | V1.5 | Complete software / provider default-off | Loopback-only local runtime is cleared; committed provider remains `DISABLED`; cloud inference and AI Actions remain prohibited | `smart-ai-local-runtime-v42-2026-08-23` |
| Event Media | V1.5 | Complete software / public gallery default-off | Private governed media is cleared; public activation and AI image processing are not authorised | `event-media-v1-5-v42-2026-08-22` |
| KG developmental reports | V1.5 | Complete software / operational activation off | Software is cleared while real-school activation and physical-printer acceptance remain gated | `kg-report-cards-v1-5-v42-2026-08-22` |
| Parent Meetings, Appointments and Follow-up | V1.5 | Complete software / operational activation off | Exact linked-child and assigned-Teacher workflow is cleared on current main; Search/AI integration and real operational use remain separate | `parent-meetings-v1-5-v43-2026-08-24` |
| Transport | V1.5 | Deferred | School does not provide service | Optional future decision |
| Cafeteria | V1.5 | Deferred | School does not provide service | Optional future decision |
| AI educational programme | V2 | Deferred | Planning/mock foundations are not the programme | Future V2 with Teacher approval |

## V1 launch-blocker order

1. Remediate and independently re-run the `FINAL-SCOPE-QA-1A` runtime-flag gate, including a governed `bulk-exports` surface map.
2. Preserve Optional Operations as a separate release-blocked branch until its exact-SHA external gate can run; Parent Meetings is already cleared on current main.
3. Obtain separate approval for staging, controlled pilot, reconciliation and cutover.
