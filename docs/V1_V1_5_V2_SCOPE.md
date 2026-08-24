# Nalanda ERP V1, V1.5 and V2 Scope

**Decision ID:** `GOV-RECON-1-SCOPE`<br>
**Authoritative date:** 2026-08-12 (amends the preserved 2026-08-08 decision)<br>
**Status:** authoritative planning correction; historical records remain preserved and are explicitly superseded where they conflict<br>
**Technical source of truth:** this Git repository

## Interpretation rule

Scope is not the same as implementation state. A capability can already exist in code and still be classified in V1.5 for product-governance purposes. Conversely, a V1 requirement is not complete merely because a model, route or UI exists. Completion requires the required workflow, security boundary, tests and release evidence.

## V1 — required for the first complete Nalanda ERP release

1. Existing cleared ERP foundations.
2. Staff Payslip Request and Secure Delivery.
3. Family/Multi-Student Mixed-Tender Fee Collection.
4. Classes I-X canonical Report-Card Template Library and digital/physical print acceptance, including configured CT, Session, Revision, Preboard and Combined layouts, colour/true-monochrome output, individual/class/section/merged/ZIP delivery, private Parent access and correction/replacement versions.
5. Safe staging, release, rollback and client-update pipeline.
6. Parent/Staff support, complaint and feedback workflow.
7. Technical observability and operational health.
8. Bulk Student/Guardian/Staff import and governed onboarding.
9. Final cross-module security, performance, recovery, device and accessibility QA.
10. Controlled staging, pilot, reconciliation and production cutover.
11. Student Safe Exit, single-use gate pass, Guardian consent and Parent notification.

V1 explicitly excludes automatic payroll calculation. Full payroll and Employee self-service are technically cleared by Prompt 23I, but their operational product scope is V1.5 and they are not a V1 launch dependency. The released code may remain in `main` while disabled or permission-restricted for rollout. V1 retains only the separately specified Staff Payslip Request and Secure Delivery workflow; automatic payroll or generated payslips do not make that request workflow complete.

V1 also excludes KG/LKG/UKG report-card operational activation and physical acceptance. Classes I-X are `REPORT_PRINT_ACCEPTANCE_CLEARED`: the R8 colour, native-monochrome and one-generation photocopy output passed physical acceptance on A4. The approved Classes I-X `NALANDA_LEGACY_REFINED` base is frozen under versioned maintenance. `V1-FINAL-1A` was subsequently cleared; the current post-V1.5 corrected-scope acceptance state is maintained in `FINAL_CORRECTED_SCOPE_ACCEPTANCE.md`.

## V1.5 — later operational expansion

1. Full payroll automation:
   - salary structures;
   - monthly calculation;
   - loss-of-pay and proration;
   - deductions;
   - arrears;
   - advances and recoveries;
   - increments;
   - salary history;
   - automatic payslip generation;
   - salary reports;
   - broader salary Employee self-service;
   - statutory integrations only after professional validation.
2. Optional Transport.
3. Optional Cafeteria.
4. LKG/UKG developmental report cards:
   - preserved ten-page developmental booklet implementation;
   - LKG/UKG policy and operational activation;
   - colour and true-monochrome physical acceptance;
   - booklet printing/imposition decision;
   - software status `CLEARED`, with operational activation and physical acceptance still separately gated.

Transport and Cafeteria are optional because the school currently provides neither service. Full payroll is not V2.

The earlier KG deferral was not deletion or rejection. Existing renderers, tests, migrations, commits and ignored evidence remain intact. KG software is now cleared on current main, while the release-feature-flag framework keeps operational activation default-off. Existing issued/historical snapshots remain readable and immutable.

## V2 — AI educational programme

1. AI-generated lessons.
2. AI-generated educational videos.
3. Teacher review and approval.
4. Curriculum/source grounding.
5. Quality, privacy and cost controls.
6. No automatic Student publication.

V2 does not include full payroll.

## Supersession record

| Earlier record | Corrected disposition | Preservation rule |
| --- | --- | --- |
| Full payroll described as V1 in pre-2026-08-08 roadmap/task material | `SUPERSEDED`; full payroll is V1.5 | Keep the original dated entry and add a visible supersession note; do not delete it. |
| Prompt 23I released full payroll/ESS | Release remains valid evidence; product scope is V1.5 | Do not reopen or rewrite the completed release. |
| Payslip capability treated only as part of payroll automation | V1 requires a distinct request-and-secure-delivery workflow | Use `docs/STAFF_PAYSLIP_REQUEST_AND_SECURE_DELIVERY_SPEC.md`. |
| Transport/Cafeteria ambiguously placed in launch scope | Optional V1.5 | Do not treat either as a launch blocker. |
| AI programme mixed with operational automation | V2 is limited to the educational programme above | Teacher approval and no automatic Student publication are mandatory boundaries. |
| KG and Classes I-X combined in the report-card V1 requirement | Classes I-X remain V1; LKG/UKG moves to the child requirement `V1.5-RC-034` and is software-cleared there | Preserve the historical evidence; do not count KG as V1 scope or as operationally activated. |

## Source-of-truth hierarchy

1. Git repository — authoritative technical and version-controlled record.
2. Notion — executive roadmap, completion index and decisions.
3. Asana — actionable task tracking.
4. Basic Memory Cloud — searchable durable-decision mirror.

Basic Memory Cloud is never the only authority. Credentials, recovery addresses, private salary data, Staff payslips, Student personal data, payment references, database contents and encryption keys must not be stored there.
