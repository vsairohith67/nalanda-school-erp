# Feature Completeness Matrix

**As-of:** 2026-08-08<br>
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
| Issued report publication and Parent delivery | V1 | Complete | Canonical visual/print approval separate | EXAM-RC-IMPL-3 release |
| Admissions CRM | V1 | Complete | Do not reopen; real onboarding unauthorised | Prompt 23H release |
| Communications | V1 | Partial | Live provider acceptance absent | Future deployment/provider gate |
| Expenses/budgets/misc income/Cash Book | V1 | Complete | Family fee instruments separate | Prompt 16/FIN evidence |
| Library | V1 | Complete | Inaccessible Schoolknot screens remain comparison evidence gaps | Prompt 16E-J evidence |
| Certificates/Class X packages/ID cards | V1 | Complete | Report-card template catalog separate | Prompt 18 evidence |
| Backup/restore/migrations | V1 | Complete | Every new model must extend it | DEVOPS-1B/1E evidence |
| Staff Payslip Request and Secure Delivery | V1 | Complete local/private | Governed request/upload/protection/reveal/delivery/replacement/audit workflow independently verified | Deployment prerequisites and approved retention policy remain before real use |
| Family/Multi-Student Mixed-Tender Fee Collection | V1 | Complete locally/private | Provider activation, deployment, real-data onboarding and physical-printer acceptance remain gated | `FIN-FAMILY-PAY-1` implementation and independent QA |
| Canonical report-card template library/physical print | V1 | Partial | No original canonical assets or physical print acceptance | Obtain samples; run print protocol |
| Safe staging/release/client update | V1 | Partial | Plans exist; end-to-end environment/update operation not released | Governed implementation/rehearsal |
| Parent/Staff support/complaints/feedback | V1 | Missing | No complete role-owned case workflow proven | Specify/implement later V1 phase |
| Observability and operational health | V1 | Partial | Local health exists; production monitoring/alerts absent | Stage metrics/alerts/runbooks |
| Bulk Student/Guardian/Staff onboarding | V1 | Ready for QA | IMPORT-1A implements controlled templates, private upload, bounded validation, duplicate decisions, dry-run approval, atomic execution, lineage/reconciliation, safe rollback, OBS-1A metrics and backup v41 recovery; independent QA remains | Run IMPORT-1A-QA before merge/tag or any real-data approval |
| Final cross-module QA | V1 | Missing | Earlier tests cannot cover corrected missing V1 requirements | Run after implementation blockers |
| Staging/pilot/reconciliation/cutover | V1 | Deferred | Explicit operational approval not granted | Final release gate |
| Full payroll automation/salary ESS | V1.5 | Complete | Product scope moved from V1; statutory integrations remain gated | Prompt 23I release preserved |
| Transport | V1.5 | Deferred | School does not provide service | Optional future decision |
| Cafeteria | V1.5 | Deferred | School does not provide service | Optional future decision |
| AI educational programme | V2 | Deferred | Planning/mock foundations are not the programme | Future V2 with Teacher approval |

## V1 launch-blocker order

1. `HR-PAYSLIP-REQ-1` — Staff payslip request and secure delivery.
2. Canonical report-card source catalog and physical print acceptance.
3. Safe staging/release/client update implementation and rehearsal.
4. Independent IMPORT-1A-QA for the governed onboarding implementation.
5. Final cross-module QA, controlled pilot, reconciliation and cutover.
