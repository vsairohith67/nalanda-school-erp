# Nalanda School Management System: Living Master Requirements

Version 1.0.0; owner inventory: exactly 46 requirements. `approvedAt: null` records that no separate human approval timestamp was supplied. `RECONCILED_PENDING_RELEASE_GATES` describes this immutable source checkpoint. Terminal clearance under the owner's conditional authorization belongs to the verified annotated release tag, final receipt and tracker readbacks; it is neither a new human approval nor operational authorization. This is a reconciliation of released source at 4a4df050d194104cfc497a6de790ca9553a69db6. The canonical machine record is [the register](../../config/master-requirements-register.json). Its audit inventory records both Prisma schemas, every migration/trigger, application/API files, services, tests and retained refs.

Software completion means the stated implementation and recovery exist. Real use requires the named privacy, policy, provider, hardware and owner gates. The repository is currently PRIVATE (the supplied PUBLIC fact has changed); all source-content restrictions remain. Historical requirement ledgers are evidence with older scopes and are not additional canonical copies of these 46 requirements.

## Owner decisions

- Belts and ties are never anonymous sales. A designated Student-linked item requires an exact Student and may have any valid positive quantity.
- Graduation Certificate is implemented through the reusable certificate architecture, not through a one-off page.
- School-issued Graduation Certificates must contain a configurable disclaimer stating that they do not replace statutory Council/Board documents.
- Editing an approved certificate template creates a new immutable version.
- Previously issued certificates remain bound to their original version.
- A Draft TC or suspension document can never be visually or technically mistaken for an official issued record.
- Sensitive AI outputs are recommendations only.
- Final concession, increment, appraisal, discipline and separation decisions require authorised humans.
- Aadhaar format validity is not identity verification.
- Marketing-lead functionality must not scrape or facilitate spam toward private individuals.
- Major phases run in series; independent subtasks may run in controlled parallel only inside a stable phase.
- NALANDA PUBLIC SCHOOL must use Georgia Bold in every generated document or image.

Evidence arrays for missing, deferred or blocked workflows identify the existing neighboring foundations that were inspected. They are not claims that the requested missing workflow exists. Source permission names are validated against the canonical permission catalogue; effective account access is a separate operational check.

## Dispositions

| ID | Requirement | Status | Owning bundle |
| --- | --- | --- | --- |
| NPS-REQ-001 | Configurable RBAC, custom roles, temporary permissions, revocation and sensitive-feature controls | PARTIAL | ACCESS-GOVERNANCE-FOLLOWUP |
| NPS-REQ-002 | Academic-year configuration and immutable historical year-bound policies, rates and settings | PARTIAL | YEAR-POLICY-INTEGRITY |
| NPS-REQ-003 | Permanent, tamper-resistant audit trails for sensitive actions | PARTIAL | AUDIT-INTEGRITY |
| NPS-REQ-004 | Permission-filtered Universal Search across authorised ERP sources | PARTIAL | SEARCH-GOVERNANCE |
| NPS-REQ-005 | Digital and printable Student and Staff identity cards | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-006 | Class X exit-document checklist and collection tracking | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-007 | A chargeable school-issued Class X Graduation Certificate that is clearly distinct from statutory Council/Board documents | MISSING | CERTIFICATE-GRADUATION-EXIT-1A |
| NPS-REQ-008 | A reusable, versioned certificate engine supporting issue, preview, PDF, print, reprint, reissue, cancellation/void and privacy-safe QR verification | PARTIAL | CERTIFICATE-GRADUATION-EXIT-1A |
| NPS-REQ-009 | Validated Excel bulk upload, row-error preview and controlled certificate generation | PARTIAL | CERTIFICATE-GRADUATION-EXIT-1A |
| NPS-REQ-010 | Student-linked miscellaneous sales for belts, ties, documents and future items, with unrestricted positive quantity and academic-year rates | PARTIAL | STUDENT-ITEMS-CONCESSIONS-1A |
| NPS-REQ-011 | Human-reviewed OCR workflow for handwritten daily fee registers; no guessing when confidence is inadequate | BLOCKED | HANDWRITING-OCR-BENCHMARK-1A |
| NPS-REQ-012 | Daily collection, expenses, bank deposit, Director handover and closing-cash reconciliation | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-013 | One real parent payment allocated across multiple children without duplicating the bank/UPI transaction or reference | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-014 | Restricted household-income information in enquiry/admission workflows | MISSING | STUDENT-ITEMS-CONCESSIONS-1A |
| NPS-REQ-015 | Governed concession request, recommendation, approval, scope, evidence and validity | PARTIAL | STUDENT-ITEMS-CONCESSIONS-1A |
| NPS-REQ-016 | Director-sponsored concession classification separate from school discount, scholarship and other waiver types | MISSING | STUDENT-ITEMS-CONCESSIONS-1A |
| NPS-REQ-017 | Explainable AI-assisted concession recommendation, advisory only | DEFERRED | STUDENT-ITEMS-CONCESSIONS-1A |
| NPS-REQ-018 | Books and Examination Cell purchasing, stock, sales, publisher accounting, collections and settlement | PARTIAL | BOOKS-EXAMINATION-CELL-FOLLOWUP |
| NPS-REQ-019 | Configurable annual Books/Examination Cell remuneration with approval and voucher evidence | NEEDS_CONFIRMATION | BOOKS-EXAMINATION-CELL-FOLLOWUP |
| NPS-REQ-020 | School-branded payment experience using licensed money-movement infrastructure | BLOCKED | PAYMENT-PROVIDER-GOVERNANCE |
| NPS-REQ-021 | Teacher attendance with configurable statuses and provider-neutral device integration | PARTIAL | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-022 | Uninformed-absence event followed by later arrival reconciliation without deleting the original event | PARTIAL | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-023 | Morning-present/afternoon-absent, morning-absent/afternoon-present, late and early-departure rules with configurable cut-offs | PARTIAL | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-024 | Advance leave workflow and later governed communication integration | PARTIAL | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-025 | Automatic substitute recommendations without teacher double-booking | PARTIAL | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-026 | Configurable, versioned and explainable substitute-ranking weights | PARTIAL | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-027 | Shortage escalation through normal teachers, optional Principal fallback and approval-controlled section combination | MISSING | ATTENDANCE-SUBSTITUTE-FOLLOWUP |
| NPS-REQ-028 | Student-progress-versus-teacher analytics using growth and contextual evidence rather than raw marks alone | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-029 | Annual Teacher dashboard with attendance, workload, responsibilities, observations, complaints, commendations and learning progress | PARTIAL | HR-RECRUITMENT-APPRAISAL-PIP-1A |
| NPS-REQ-030 | Configurable and normalised Teacher performance score | DEFERRED | HR-RECRUITMENT-APPRAISAL-PIP-1A |
| NPS-REQ-031 | Human-approved salary-increment recommendation | DEFERRED | HR-RECRUITMENT-APPRAISAL-PIP-1A |
| NPS-REQ-032 | Feedback, support, PIP, target, review and reassessment workflow before serious HR action | PARTIAL | HR-RECRUITMENT-APPRAISAL-PIP-1A |
| NPS-REQ-033 | Recruitment workflow from manpower request through probation and confirmation | MISSING | HR-RECRUITMENT-APPRAISAL-PIP-1A |
| NPS-REQ-034 | UDISE+ planning, validation and status workspace without claiming official compliance or portal submission | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-035 | Strict separation between Aadhaar format/checksum validation and legally authorised identity verification | PARTIAL | IDENTITY-VALIDATION-GOVERNANCE |
| NPS-REQ-036 | Governed school WhatsApp broadcast through the unified communication foundation, live provider default-off | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-037 | Parent/Staff/public complaint and support workflow | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-038 | Minimal-data Parent social-media preference survey and aggregate analytics | MISSING | PARENT-SURVEY-MARKETING-GOVERNANCE-1A |
| NPS-REQ-039 | Legally governed local marketing-lead register restricted to opt-in or legitimate public-business contact information | MISSING | PARENT-SURVEY-MARKETING-GOVERNANCE-1A |
| NPS-REQ-040 | Provider-neutral school server/private-cloud architecture | PARTIAL | PORTABLE-DEPLOYMENT-OBSERVABILITY-FOUNDATION-1B |
| NPS-REQ-041 | Automatic, encrypted, versioned and restoration-tested backups | COMPLETE | MAINTAIN-RELEASED |
| NPS-REQ-042 | Highly restricted Director/Super Admin digital diary and work programme | PARTIAL | PRIVATE-WORK-GOVERNANCE |
| NPS-REQ-043 | Governed management whiteboard integration and future safe metadata search | PARTIAL | WHITEBOARD-METADATA-GOVERNANCE |
| NPS-REQ-044 | Progressive Student discipline incidents, evidence, counselling, behaviour plans, reviews and escalation | MISSING | STUDENT-DISCIPLINE-DRAFT-NOTICE-1A |
| NPS-REQ-045 | Restricted Draft Suspension Notice, Draft Disciplinary Warning and Draft TC Preview with permanent “DRAFT – NOT OFFICIAL” marking until authorised official issuance | PARTIAL | STUDENT-DISCIPLINE-DRAFT-NOTICE-1A |
| NPS-REQ-046 | Traceable software change management covering requirement, impact, migration, security, tests, acceptance, release and changelog | PARTIAL | MASTER-REQUIREMENTS-RECONCILIATION-1A |

## NPS-REQ-001: Configurable RBAC, custom roles, temporary permissions, revocation and sensitive-feature controls

**PARTIAL** — Named identities, versioned permission profiles, temporary grants, revocation and immutable role denials are released.

Still required: Confirm whether named permission profiles satisfy custom roles; arbitrary base-role creation is not implemented.

Evidence: [lib/iam/effective-access.ts](../../lib/iam/effective-access.ts) (line 8), [lib/iam/profiles.ts](../../lib/iam/profiles.ts) (line 24), [lib/iam/users.ts](../../lib/iam/users.ts) (line 38). Tests: `tests/iam1a.test.ts`, `tests/real-user-access-readiness-1a.test.ts`. Gates: POLICY. Dependencies: .


## NPS-REQ-002: Academic-year configuration and immutable historical year-bound policies, rates and settings

**PARTIAL** — Academic-year enrollments, calendar versions and year-specific fee/book/misc rates exist; issued snapshots preserve prior values.

Still required: Prove immutable historical policy/rate settings across every module; editable rate records are not a universal year lock.

Evidence: [lib/fee-structures.ts](../../lib/fee-structures.ts) (line 8), [lib/academic-calendar.ts](../../lib/academic-calendar.ts) (line 7). Tests: `tests/academic-calendar-security-regressions.test.ts`, `tests/academic-calendar.test.ts`, `tests/fee-structures.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-001.


## NPS-REQ-003: Permanent, tamper-resistant audit trails for sensitive actions

**PARTIAL** — Sensitive modules preserve append-only events and database triggers; identity and receipt audits are present.

Still required: Inventory all sensitive actions, close unprotected audit tables and define retention/tamper evidence beyond privileged database access.

Evidence: [lib/user-audit.ts](../../lib/user-audit.ts) (line 15), [lib/receipt-audit.ts](../../lib/receipt-audit.ts) (line 5), [lib/communication-service.ts](../../lib/communication-service.ts) (line 20). Tests: `tests/communication-delivery-foundation-1a.test.ts`, `tests/iam1a.test.ts`, `tests/receipt-audit.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-001.


## NPS-REQ-004: Permission-filtered Universal Search across authorised ERP sources

**PARTIAL** — Universal Search combines permission-filtered sources under exact Super Admin access, including owner-filtered diary notes, tasks and contacts. It is not limited to metadata.

Still required: Reconcile deferred registry coverage with the owner scope; preserve owner-only diary/task/contact search and keep whiteboard canvas content excluded. Any role expansion requires a separately approved access policy.

Evidence: [lib/universal-search.ts](../../lib/universal-search.ts) (line 285), [lib/universal-search-api.ts](../../lib/universal-search-api.ts) (line 7), [lib/universal-search-contract.ts](../../lib/universal-search-contract.ts) (line 74). Tests: `tests/universal-search.test.ts`. Gates: PRIVACY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-005: Digital and printable Student and Staff identity cards

**COMPLETE** — Student and Staff identity cards have governed batches, numbering, immutable versions, own/linked access, print, reissue, cancellation and mapped restore.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/identity-cards.ts](../../lib/identity-cards.ts) (line 9), [lib/id-card-batches.ts](../../lib/id-card-batches.ts) (line 18), [lib/id-card-backup.ts](../../lib/id-card-backup.ts) (line 28). Tests: `tests/id-card-backup-restore.test.ts`, `tests/id-card-batches-qa.test.ts`, `tests/id-card-numbering-templates.test.ts`, `tests/id-card-portals-lookup.test.ts`, `tests/id-card-reports-qa.test.ts`, `tests/identity-cards-workflow-security.test.ts`. Gates: ACTIVATION. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-006: Class X exit-document checklist and collection tracking

**COMPLETE** — Exact-year Class X packages track school-certificate versions, external Board document custody, collection charges and governed handover with event/restore coverage.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/class-x-document-packages.ts](../../lib/class-x-document-packages.ts) (line 7), [lib/class-x-document-items.ts](../../lib/class-x-document-items.ts) (line 30), [lib/class-x-package-handover.ts](../../lib/class-x-package-handover.ts) (line 18), [lib/class-x-package-backup.ts](../../lib/class-x-package-backup.ts) (line 9). Tests: `tests/class-x-package-backup.test.ts`, `tests/class-x-package-security.test.ts`, `tests/class-x-packages.test.ts`. Gates: DOCUMENT_POLICY, ACTIVATION. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-007: A chargeable school-issued Class X Graduation Certificate that is clearly distinct from statutory Council/Board documents

**MISSING** — The reusable certificate engine supports BONAFIDE, STUDY, CONDUCT and TRANSFER only; Class X packages link existing school issues or external Board custody.

Still required: Add GRADUATION through this engine, configurable school-issued disclaimer and audited charge linkage; no statutory replacement claim.

Evidence: [lib/student-certificates.ts](../../lib/student-certificates.ts) (line 10), [lib/certificate-templates.ts](../../lib/certificate-templates.ts) (line 1), [lib/certificate-backup.ts](../../lib/certificate-backup.ts) (line 6). Tests: `tests/student-certificates-security-backup.test.ts`, `tests/student-certificates.test.ts`. Gates: DOCUMENT_POLICY. Dependencies: NPS-REQ-006, NPS-REQ-008, NPS-REQ-010.


## NPS-REQ-008: A reusable, versioned certificate engine supporting issue, preview, PDF, print, reprint, reissue, cancellation/void and privacy-safe QR verification

**PARTIAL** — Request, draft, approval, issue, immutable issued snapshots, reissue/correction, cancellation and browser print are implemented.

Still required: Add privacy-safe certificate QR verification and dedicated PDF acceptance; approved-template edits must create new immutable versions while old issues retain originals.

Evidence: [lib/student-certificates.ts](../../lib/student-certificates.ts) (line 10), [lib/certificate-templates.ts](../../lib/certificate-templates.ts) (line 1), [lib/certificate-backup.ts](../../lib/certificate-backup.ts) (line 6). Tests: `tests/student-certificates-security-backup.test.ts`, `tests/student-certificates.test.ts`. Gates: DOCUMENT_POLICY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-009: Validated Excel bulk upload, row-error preview and controlled certificate generation

**PARTIAL** — Validated XLSX onboarding provides deterministic row review and import governance; certificate issuance is a separate controlled workflow.

Still required: Add certificate-specific row-error preview, exact Student resolution, approval and resumable idempotent batch issuance using immutable template versions.

Evidence: [lib/student-import.ts](../../lib/student-import.ts) (line 3), [lib/onboarding-workbooks.ts](../../lib/onboarding-workbooks.ts) (line 16), [lib/student-certificates.ts](../../lib/student-certificates.ts) (line 10). Tests: `tests/onboarding-governance.test.ts`, `tests/onboarding-workbooks.test.ts`, `tests/student-import.test.ts`. Gates: PRIVACY. Dependencies: NPS-REQ-008.


## NPS-REQ-010: Student-linked miscellaneous sales for belts, ties, documents and future items, with unrestricted positive quantity and academic-year rates

**PARTIAL** — Misc income has Student-link policies, year/effective-date rates, receipts, cancellation and exact monetary calculations.

Still required: BELT/TIE defaults are OPTIONAL and quantity is capped at 10000. Require exact Student linkage and any valid positive quantity within explicit numeric-safety limits; preserve receipt history.

Evidence: [lib/misc-income.ts](../../lib/misc-income.ts) (line 5). Tests: `tests/misc-income.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-001, NPS-REQ-002, NPS-REQ-003.


## NPS-REQ-011: Human-reviewed OCR workflow for handwritten daily fee registers; no guessing when confidence is inadequate

**BLOCKED** — Released fee-register staging supports human row review, revisions, duplicate checks and reviewed export; direct payment posting deliberately fails closed. Printed benchmark is separate from open worker PR #19.

Still required: Handwriting accuracy, worker security, licensing, hallucination, performance and human review must pass; retain manual review and never infer uncertain values.

Evidence: [lib/fee-register-ocr.ts](../../lib/fee-register-ocr.ts) (line 7), [lib/fee-register-ocr-provider.ts](../../lib/fee-register-ocr-provider.ts) (line 1), [lib/fee-register-ocr-backup.ts](../../lib/fee-register-ocr-backup.ts) (line 11). Tests: `tests/fee-register-ocr-backup-restore.test.ts`, `tests/fee-register-ocr-safety.test.ts`. Gates: OCR_SECURITY, OCR_HANDWRITING. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-012: Daily collection, expenses, bank deposit, Director handover and closing-cash reconciliation

**COMPLETE** — Cash Book reconciles fee/misc/book cash, expenses, bank deposit and Director handover; approvals, locked snapshots, source drift and variance are governed.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/cash-book.ts](../../lib/cash-book.ts) (line 5), [lib/book-cash-settlement.ts](../../lib/book-cash-settlement.ts) (line 9), [lib/expenses.ts](../../lib/expenses.ts) (line 4). Tests: `tests/books-backup-restore.test.ts`, `tests/cash-book.test.ts`, `tests/expenses.test.ts`. Gates: ACTIVATION. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-013: One real parent payment allocated across multiple children without duplicating the bank/UPI transaction or reference

**COMPLETE** — One collection owns tender instruments and per-child allocations; reference uniqueness, exact paise, atomic confirmation, correction/reversal and mapped restore prevent duplicate transaction accounting.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/family-collections.ts](../../lib/family-collections.ts) (line 31), [lib/family-collection-allocation.ts](../../lib/family-collection-allocation.ts) (line 4), [lib/family-collection-backup.ts](../../lib/family-collection-backup.ts) (line 4). Tests: `tests/family-mixed-tender.test.ts`. Gates: ACTIVATION, PAYMENT_PROVIDER. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-014: Restricted household-income information in enquiry/admission workflows

**MISSING** — Enquiry/application, document review and conversion exist; inspected admission models do not contain a restricted household-income workflow.

Still required: Add optional minimised income bands, separate sensitive permission, purpose/retention controls and exclusion from general exports/search/telemetry.

Evidence: [lib/admissions.ts](../../lib/admissions.ts) (line 7), [lib/admissions-api.ts](../../lib/admissions-api.ts) (line 9), [lib/admissions-backup.ts](../../lib/admissions-backup.ts) (line 3). Tests: `tests/admissions-crm.test.ts`. Gates: PRIVACY, POLICY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-015: Governed concession request, recommendation, approval, scope, evidence and validity

**PARTIAL** — Student type Concession and discountPercent exist; preparatory import-mapping metadata names finance review. This is not a live concession-request approval workflow.

Still required: Add request, recommendation, role-bound approval, evidence, scope, validity, revocation and ledger audit; a discount field is not concession governance.

Evidence: [lib/constants.ts](../../lib/constants.ts) (line 1), [lib/student-import.ts](../../lib/student-import.ts) (line 3), [lib/fee-structures.ts](../../lib/fee-structures.ts) (line 8), [config/onboarding/mapping-catalogue.json](../../config/onboarding/mapping-catalogue.json) (line 65). Tests: `tests/fee-structures.test.ts`, `tests/student-import.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-014, NPS-REQ-002, NPS-REQ-003.


## NPS-REQ-016: Director-sponsored concession classification separate from school discount, scholarship and other waiver types

**MISSING** — Existing Student types and discounts do not represent separate Director sponsorship, scholarship and waiver classifications.

Still required: Add explicit funding/classification and approval/audit semantics without duplicating fee collections.

Evidence: [lib/constants.ts](../../lib/constants.ts) (line 1), [lib/student-import.ts](../../lib/student-import.ts) (line 3), [lib/fee-structures.ts](../../lib/fee-structures.ts) (line 8). Tests: `tests/fee-structures.test.ts`, `tests/student-import.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-015.


## NPS-REQ-017: Explainable AI-assisted concession recommendation, advisory only

**DEFERRED** — Cleared Smart AI is read-only and Search-grounded; it has no concession decision engine. Owner places this sensitive enhancement in a later governed bundle.

Still required: Specify explainable advisory factors, uncertainty, bias review, provenance and human-only final decisions after concession governance.

Evidence: [lib/universal-search.ts](../../lib/universal-search.ts) (line 17), [lib/teacher-analytics-definitions.ts](../../lib/teacher-analytics-definitions.ts) (line 1). Tests: `tests/smart-ai.test.ts`, `tests/teacher-analytics.test.ts`. Gates: AI_REVIEW, PRIVACY. Dependencies: NPS-REQ-015, NPS-REQ-016.


## NPS-REQ-018: Books and Examination Cell purchasing, stock, sales, publisher accounting, collections and settlement

**PARTIAL** — Book catalog/rates/sales, publisher ExpenseRecord accounting and approved cash settlement are implemented. Library catalog/circulation is a separate stock domain.

Still required: Define Examination Cell purchasing and saleable-stock integration; prevent duplicate publisher ledger or conflation with library lending inventory.

Evidence: [lib/books-finance.ts](../../lib/books-finance.ts) (line 5), [lib/book-cash-settlement.ts](../../lib/book-cash-settlement.ts) (line 9), [lib/publisher-bills.ts](../../lib/publisher-bills.ts) (line 18), [lib/expenses.ts](../../lib/expenses.ts) (line 4). Tests: `tests/books-backup-restore.test.ts`, `tests/books-finance.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-002, NPS-REQ-003, NPS-REQ-012.


## NPS-REQ-019: Configurable annual Books/Examination Cell remuneration with approval and voucher evidence

**NEEDS_CONFIRMATION** — An annual Library Management Service Expense uses the existing Vendor/ExpenseRecord approval and payment workflow with a configurable amount.

Still required: Confirm whether this service expense is the requested Books/Examination Cell remuneration, its recipient role and voucher requirements; do not assume payroll equivalence.

Evidence: [lib/books-finance.ts](../../lib/books-finance.ts) (line 5), [lib/book-cash-settlement.ts](../../lib/book-cash-settlement.ts) (line 9), [lib/publisher-bills.ts](../../lib/publisher-bills.ts) (line 33), [lib/expenses.ts](../../lib/expenses.ts) (line 4), [app/api/expenses/[id]/workflow/route.ts](../../app/api/expenses/[id]/workflow/route.ts) (line 9). Tests: `tests/books-backup-restore.test.ts`, `tests/books-finance.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-018.


## NPS-REQ-020: School-branded payment experience using licensed money-movement infrastructure

**BLOCKED** — Family collection and provider-plan contracts preserve exact allocations; manual recording does not constitute licensed online money movement.

Still required: Select and certify licensed payment infrastructure, approved fees/settlement/refund terms, legal/privacy and owner budget before branded live payment activation.

Evidence: [lib/family-collections.ts](../../lib/family-collections.ts) (line 31), [lib/family-collection-allocation.ts](../../lib/family-collection-allocation.ts) (line 4), [lib/family-collection-backup.ts](../../lib/family-collection-backup.ts) (line 4). Tests: `tests/family-mixed-tender.test.ts`. Gates: PAYMENT_PROVIDER. Dependencies: NPS-REQ-013.


## NPS-REQ-021: Teacher attendance with configurable statuses and provider-neutral device integration

**PARTIAL** — Staff attendance and provider-neutral biometric registry, immutable punches, policies, reconciliation, correction and restore are released default-off.

Still required: Confirm configurable status vocabulary beyond fixed enums; certify an exact physical device/provider separately from simulator evidence.

Evidence: [lib/staff-attendance.ts](../../lib/staff-attendance.ts) (line 4), [lib/biometric-attendance/reconciliation.ts](../../lib/biometric-attendance/reconciliation.ts) (line 11), [lib/biometric-attendance/governance.ts](../../lib/biometric-attendance/governance.ts) (line 11), [lib/biometric-attendance/backup.ts](../../lib/biometric-attendance/backup.ts) (line 6). Tests: `tests/biometric-staff-attendance-1a.test.ts`, `tests/staff-attendance-restore.test.ts`, `tests/staff-attendance.test.ts`. Gates: DEVICE, POLICY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-022: Uninformed-absence event followed by later arrival reconciliation without deleting the original event

**PARTIAL** — Biometric raw punches and corrections retain original evidence; missing punches become exceptions rather than invented absence.

Still required: Add a named uninformed-absence event and later-arrival reconciliation that preserves the original event and reason; prove manual and device paths.

Evidence: [lib/staff-attendance.ts](../../lib/staff-attendance.ts) (line 4), [lib/biometric-attendance/reconciliation.ts](../../lib/biometric-attendance/reconciliation.ts) (line 11), [lib/biometric-attendance/governance.ts](../../lib/biometric-attendance/governance.ts) (line 11), [lib/biometric-attendance/backup.ts](../../lib/biometric-attendance/backup.ts) (line 6). Tests: `tests/biometric-staff-attendance-1a.test.ts`, `tests/staff-attendance-restore.test.ts`, `tests/staff-attendance.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-021.


## NPS-REQ-023: Morning-present/afternoon-absent, morning-absent/afternoon-present, late and early-departure rules with configurable cut-offs

**PARTIAL** — Effective-dated shift, grace, late, early-departure and duration-based half-day thresholds exist.

Still required: Add explicit morning/afternoon attendance states, cut-off rules and transition tests; current split/overnight settings are not proof of split-session implementation.

Evidence: [lib/staff-attendance.ts](../../lib/staff-attendance.ts) (line 4), [lib/biometric-attendance/reconciliation.ts](../../lib/biometric-attendance/reconciliation.ts) (line 11), [lib/biometric-attendance/governance.ts](../../lib/biometric-attendance/governance.ts) (line 11), [lib/biometric-attendance/backup.ts](../../lib/biometric-attendance/backup.ts) (line 6). Tests: `tests/biometric-staff-attendance-1a.test.ts`, `tests/staff-attendance-restore.test.ts`, `tests/staff-attendance.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-021.


## NPS-REQ-024: Advance leave workflow and later governed communication integration

**PARTIAL** — Staff leave supports advance applications, half-day selection, review and approved-leave conflict checks.

Still required: Connect governed leave events to the unified communication intent/policy lifecycle when separately authorised; do not revive legacy direct sends.

Evidence: [lib/staff-leave.ts](../../lib/staff-leave.ts) (line 3), [lib/communication-types.ts](../../lib/communication-types.ts) (line 1). Tests: `tests/biometric-staff-attendance-1a.test.ts`, `tests/staff-attendance-restore.test.ts`, `tests/staff-attendance.test.ts`, `tests/staff-leave-restore.test.ts`, `tests/staff-leave.test.ts`. Gates: COMMUNICATION_PROVIDER. Dependencies: NPS-REQ-021, NPS-REQ-036.


## NPS-REQ-025: Automatic substitute recommendations without teacher double-booking

**PARTIAL** — Recommendations exclude approved leave, absent Staff and overlapping substitute duties; assignment validation repeats those checks.

Still required: Prove conflicts against the regular active timetable and atomic concurrent assignments, beyond substitute-duty overlap.

Evidence: [lib/substitutes.ts](../../lib/substitutes.ts) (line 3). Tests: `tests/substitute-restore.test.ts`, `tests/substitutes.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-021, NPS-REQ-024.


## NPS-REQ-026: Configurable, versioned and explainable substitute-ranking weights

**PARTIAL** — Ranking uses fixed subject weight 2, department weight 1, existing duty count and stable name tie-break with visible reasons.

Still required: Add approved immutable weight versions, normalisation, explanation snapshots and fair tie-break policy.

Evidence: [lib/substitutes.ts](../../lib/substitutes.ts) (line 3). Tests: `tests/substitute-restore.test.ts`, `tests/substitutes.test.ts`. Gates: POLICY. Dependencies: NPS-REQ-025.


## NPS-REQ-027: Shortage escalation through normal teachers, optional Principal fallback and approval-controlled section combination

**MISSING** — The current planner suggests and assigns individual substitute Staff; no normal-teacher/Principal/section-combination escalation lifecycle was found.

Still required: Add explicit shortage state, optional Principal fallback and role-approved section combination with safety/capacity/timetable constraints.

Evidence: [lib/substitutes.ts](../../lib/substitutes.ts) (line 3). Tests: `tests/substitute-restore.test.ts`, `tests/substitutes.test.ts`. Gates: POLICY, CHILD_SAFETY. Dependencies: NPS-REQ-025, NPS-REQ-026.


## NPS-REQ-028: Student-progress-versus-teacher analytics using growth and contextual evidence rather than raw marks alone

**COMPLETE** — Paired Student growth compares compatible prior/current locked assessments on intersected cohorts, with small-group suppression, source quality, workload and contextual cautions. Snapshots and mapped restore preserve those outcomes without causal Teacher scoring.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/teacher-analytics.ts](../../lib/teacher-analytics.ts) (line 218), [lib/teacher-analytics-definitions.ts](../../lib/teacher-analytics-definitions.ts) (line 1), [lib/teacher-analytics-snapshots.ts](../../lib/teacher-analytics-snapshots.ts) (line 4), [lib/teacher-analytics-backup.ts](../../lib/teacher-analytics-backup.ts) (line 22), [lib/restore-database.ts](../../lib/restore-database.ts) (line 2348). Tests: `tests/teacher-analytics.test.ts`, `tests/master-requirements-growth-evidence.test.ts`. Gates: HR_POLICY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-029: Annual Teacher dashboard with attendance, workload, responsibilities, observations, complaints, commendations and learning progress

**PARTIAL** — Review cycles combine attendance, workload, substitute cover, academic workflow and aggregate outcomes with shared Teacher responses.

Still required: Add governed responsibilities, observations, complaints, commendations and annual review completeness without leaking restricted narratives.

Evidence: [lib/teacher-analytics.ts](../../lib/teacher-analytics.ts) (line 7), [lib/teacher-analytics-definitions.ts](../../lib/teacher-analytics-definitions.ts) (line 1), [lib/teacher-analytics-snapshots.ts](../../lib/teacher-analytics-snapshots.ts) (line 4), [lib/teacher-analytics-backup.ts](../../lib/teacher-analytics-backup.ts) (line 22). Tests: `tests/teacher-analytics.test.ts`. Gates: HR_POLICY, PRIVACY. Dependencies: NPS-REQ-028, NPS-REQ-037.


## NPS-REQ-030: Configurable and normalised Teacher performance score

**DEFERRED** — The released analytics contract deliberately excludes composite scores/rankings. This owner enhancement belongs to the later HR bundle.

Still required: Agree normalised versioned weights, comparability, uncertainty, appeal and human approval before a score is introduced.

Evidence: [lib/teacher-analytics.ts](../../lib/teacher-analytics.ts) (line 7), [lib/teacher-analytics-definitions.ts](../../lib/teacher-analytics-definitions.ts) (line 1), [lib/teacher-analytics-snapshots.ts](../../lib/teacher-analytics-snapshots.ts) (line 4), [lib/teacher-analytics-backup.ts](../../lib/teacher-analytics-backup.ts) (line 22). Tests: `tests/teacher-analytics.test.ts`. Gates: HR_POLICY, AI_REVIEW. Dependencies: NPS-REQ-029.


## NPS-REQ-031: Human-approved salary-increment recommendation

**DEFERRED** — Released reviews deliberately exclude compensation recommendations; the owner enhancement is deferred to the later HR bundle. Payroll/payslip records are not an increment recommendation workflow.

Still required: Add explainable recommendation, approved budget and authorised human decision with audit; no automatic salary change.

Evidence: [lib/staff.ts](../../lib/staff.ts) (line 3), [lib/teacher-analytics.ts](../../lib/teacher-analytics.ts) (line 7). Tests: `tests/biometric-staff-attendance-1a.test.ts`, `tests/staff-attendance-restore.test.ts`, `tests/staff-attendance.test.ts`, `tests/staff-dob-epfo-planning-qa.test.ts`, `tests/staff-leave-restore.test.ts`, `tests/staff-leave.test.ts`, `tests/staff-restore.test.ts`, `tests/staff-ui-security.test.ts`, `tests/staff.test.ts`, `tests/teacher-analytics.test.ts`. Gates: HR_POLICY, AI_REVIEW. Dependencies: NPS-REQ-030.


## NPS-REQ-032: Feedback, support, PIP, target, review and reassessment workflow before serious HR action

**PARTIAL** — Leadership feedback, own Teacher responses, sharing, finalisation and append-only review events are implemented.

Still required: Add support plans, PIP targets, review dates, reassessment and appeal gates before serious HR action.

Evidence: [lib/teacher-analytics.ts](../../lib/teacher-analytics.ts) (line 7), [lib/teacher-analytics-definitions.ts](../../lib/teacher-analytics-definitions.ts) (line 1), [lib/teacher-analytics-snapshots.ts](../../lib/teacher-analytics-snapshots.ts) (line 4), [lib/teacher-analytics-backup.ts](../../lib/teacher-analytics-backup.ts) (line 22). Tests: `tests/teacher-analytics.test.ts`. Gates: HR_POLICY. Dependencies: NPS-REQ-029.


## NPS-REQ-033: Recruitment workflow from manpower request through probation and confirmation

**MISSING** — Staff lifecycle and onboarding are present, but no manpower-request-to-probation/confirmation recruitment workflow was found in code or retained history.

Still required: Add approved manpower request, candidate minimisation, selection evidence, offer, onboarding, probation review and confirmation; retain human decisions.

Evidence: [lib/staff.ts](../../lib/staff.ts) (line 3), [lib/teacher-analytics.ts](../../lib/teacher-analytics.ts) (line 7). Tests: `tests/biometric-staff-attendance-1a.test.ts`, `tests/staff-attendance-restore.test.ts`, `tests/staff-attendance.test.ts`, `tests/staff-dob-epfo-planning-qa.test.ts`, `tests/staff-leave-restore.test.ts`, `tests/staff-leave.test.ts`, `tests/staff-restore.test.ts`, `tests/staff-ui-security.test.ts`, `tests/staff.test.ts`, `tests/teacher-analytics.test.ts`. Gates: HR_POLICY, PRIVACY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-034: UDISE+ planning, validation and status workspace without claiming official compliance or portal submission

**COMPLETE** — The released UDISE checklist provides bounded masked planning rows, provenance groups, gaps and status; it expressly disclaims official compliance, certification and portal submission.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/udise-checklist.ts](../../lib/udise-checklist.ts) (line 6), [lib/udise-evidence-register.ts](../../lib/udise-evidence-register.ts) (line 1), [lib/udise-http.ts](../../lib/udise-http.ts) (line 3). Tests: `tests/udise-checklist.test.ts`, `tests/udise-security.test.ts`. Gates: UDISE_PORTAL. Dependencies: NPS-REQ-001.


## NPS-REQ-035: Strict separation between Aadhaar format/checksum validation and legally authorised identity verification

**PARTIAL** — UDISE treats Aadhaar as optional sensitive unverified data, excludes it from completeness and does not claim identity verification.

Still required: Add a separately named format/checksum validator if required; never turn format validity into identity verification or authorised-service status.

Evidence: [lib/udise-checklist.ts](../../lib/udise-checklist.ts) (line 6), [lib/udise-evidence-register.ts](../../lib/udise-evidence-register.ts) (line 1), [lib/udise-http.ts](../../lib/udise-http.ts) (line 3). Tests: `tests/udise-checklist.test.ts`, `tests/udise-security.test.ts`. Gates: AADHAAR. Dependencies: NPS-REQ-001.


## NPS-REQ-036: Governed school WhatsApp broadcast through the unified communication foundation, live provider default-off

**COMPLETE** — Unified intent, consent/current-contact policy, multilingual template versions, outbox, attempts, signed receipts and backup are released. WhatsApp live adapters and every channel remain OFF at 0%.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/communication-service.ts](../../lib/communication-service.ts) (line 20), [lib/communication-policy.ts](../../lib/communication-policy.ts) (line 10), [lib/communication-recipients.ts](../../lib/communication-recipients.ts) (line 4), [lib/communication-backup.ts](../../lib/communication-backup.ts) (line 4). Tests: `tests/communication-delivery-foundation-1a.test.ts`, `tests/whatsapp-consent-batch-permissions.test.ts`. Gates: COMMUNICATION_PROVIDER. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-037: Parent/Staff/public complaint and support workflow

**COMPLETE** — Public intake and linked Parent/Staff support cases have governed routing, private notes/files, assignment, SLA/escalation, resolution, satisfaction and event/restore coverage.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/support.ts](../../lib/support.ts) (line 6), [lib/support-api.ts](../../lib/support-api.ts) (line 8), [lib/support-backup.ts](../../lib/support-backup.ts) (line 3), [lib/support-files.ts](../../lib/support-files.ts) (line 9). Tests: `tests/support-backup.test.ts`, `tests/support-files.test.ts`, `tests/support-governance.test.ts`. Gates: PRIVACY, ACTIVATION. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-038: Minimal-data Parent social-media preference survey and aggregate analytics

**MISSING** — Admissions CRM and communication preferences do not implement a Parent social-media preference survey with aggregate analytics.

Still required: Add optional minimal choice survey, purpose/retention, no private profiles, aggregation thresholds and authorised audience controls.

Evidence: [lib/admissions.ts](../../lib/admissions.ts) (line 7), [lib/admissions-api.ts](../../lib/admissions-api.ts) (line 9), [lib/admissions-backup.ts](../../lib/admissions-backup.ts) (line 3). Tests: `tests/admissions-crm.test.ts`. Gates: PRIVACY, POLICY. Dependencies: NPS-REQ-001, NPS-REQ-036.


## NPS-REQ-039: Legally governed local marketing-lead register restricted to opt-in or legitimate public-business contact information

**MISSING** — Prospective admissions CRM is not a marketing-lead source/consent/retention register. No governed marketing ingestion workflow was found.

Still required: Limit leads to opt-in or legitimate public-business contacts, prove provenance/purpose, suppression and deletion; prohibit private-person scraping and spam.

Evidence: [lib/admissions.ts](../../lib/admissions.ts) (line 7), [lib/admissions-api.ts](../../lib/admissions-api.ts) (line 9), [lib/admissions-backup.ts](../../lib/admissions-backup.ts) (line 3). Tests: `tests/admissions-crm.test.ts`. Gates: MARKETING_LEGAL. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-040: Provider-neutral school server/private-cloud architecture

**PARTIAL** — A canonical non-root OCI image, synthetic Compose/Caddy, PostgreSQL 17, Valkey, private S3, secret injection, migration/readiness/jobs and recovery foundations are released.

Still required: Consolidate portable profiles and operator preflight/doctor/install/upgrade/rollback/restore/uninstall contracts; certify both CPU architectures and avoid provider forks.

Evidence: [Dockerfile](../../Dockerfile) (line 6), [deploy/portable/compose.yml](../../deploy/portable/compose.yml) (line 88), [lib/portable-runtime/config.ts](../../lib/portable-runtime/config.ts) (line 3), [lib/portable-runtime/health.ts](../../lib/portable-runtime/health.ts) (line 16), [scripts/portable/runtime-command.ts](../../scripts/portable/runtime-command.ts) (line 58). Tests: `tests/portable-migration-readiness.test.ts`, `tests/portable-runtime.test.ts`, `tests/postgresql-schema-contract.test.ts`, `tests/postgresql-synthetic-qa.test.ts`, `tests/postgresql-test-partition.test.ts`. Gates: HOST, ACTIVATION. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-041: Automatic, encrypted, versioned and restoration-tested backups

**COMPLETE** — Encrypted versioned backup scheduling, verification, retention and restoration rehearsal exist; portable backup uses private S3-compatible storage and separate identities. Logical schema stays v45.

No remaining software acceptance within this requirement; operational gates remain separate.

Evidence: [lib/cloud-backup-worker.ts](../../lib/cloud-backup-worker.ts) (line 26), [lib/cloud-backup-container.ts](../../lib/cloud-backup-container.ts) (line 13), [lib/cloud-backup-rehearsal.ts](../../lib/cloud-backup-rehearsal.ts) (line 12), [lib/cloud-backup-schedules.ts](../../lib/cloud-backup-schedules.ts) (line 3), [lib/backup.ts](../../lib/backup.ts) (line 300). Tests: `tests/books-backup-restore.test.ts`, `tests/budget-backup-restore.test.ts`, `tests/cloud-backup-backup.test.ts`, `tests/cloud-backup-container.test.ts`, `tests/cloud-backup-provider.test.ts`, `tests/cloud-backup-reports.test.ts`, `tests/cloud-backup-retention.test.ts`, `tests/cloud-backup-schedules.test.ts`, `tests/cloud-backup-security.test.ts`, `tests/exam-marks-backup-restore.test.ts`, `tests/expense-backup-restore.test.ts`, `tests/fee-register-ocr-backup-restore.test.ts`, `tests/homework-backup-restore.test.ts`, `tests/id-card-backup-restore.test.ts`, `tests/library-accountability-backup-restore.test.ts`, `tests/library-backup-restore.test.ts`, `tests/library-circulation-backup-restore.test.ts`, `tests/library-stock-backup-restore.test.ts`, `tests/misc-cash-backup-restore.test.ts`, `tests/notification-backup-restore.test.ts`, `tests/sms-email-backup-restore.test.ts`, `tests/timetable-backup-restore.test.ts`, `tests/whatsapp-backup-restore.test.ts`. Gates: BACKUP_OPERATIONS, ACTIVATION. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-042: Highly restricted Director/Super Admin digital diary and work programme

**PARTIAL** — Super Admin My Work provides owner-filtered diary, tasks, contacts and audit with mapped recovery and owner-scoped Universal Search; exact Super Admin is required.

Still required: Define isolated Director workspace semantics and extend only with explicit role-bound approval; preserve existing owner-only Search and prohibit shared or cross-owner diary exposure.

Evidence: [lib/super-admin-work.ts](../../lib/super-admin-work.ts) (line 5), [lib/super-admin-work-api.ts](../../lib/super-admin-work-api.ts) (line 5), [lib/universal-search.ts](../../lib/universal-search.ts) (line 285). Tests: `tests/super-admin-work.test.ts`. Gates: PRIVACY, POLICY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-043: Governed management whiteboard integration and future safe metadata search

**PARTIAL** — Whiteboard Bridge validates the canonical external destination under exact-role control; it does not ingest canvas content.

Still required: Define future safe metadata projection, access freshness and revocation before Search integration; do not index raw canvas text or images.

Evidence: [lib/super-admin-whiteboard.ts](../../lib/super-admin-whiteboard.ts) (line 1), [lib/universal-search-contract.ts](../../lib/universal-search-contract.ts) (line 1). Tests: `tests/super-admin-whiteboard.test.ts`, `tests/universal-search.test.ts`. Gates: PRIVACY. Dependencies: NPS-REQ-004.


## NPS-REQ-044: Progressive Student discipline incidents, evidence, counselling, behaviour plans, reviews and escalation

**MISSING** — Support, conduct certificates and early-exit safety incidents are neighboring workflows; none is a progressive Student discipline case lifecycle.

Still required: Add factual incidents, restricted evidence, counselling, behaviour plans, review, appeal and human-approved escalation with child-safety safeguards.

Evidence: [lib/student-certificates.ts](../../lib/student-certificates.ts) (line 10), [lib/support.ts](../../lib/support.ts) (line 6), [lib/teacher-analytics-definitions.ts](../../lib/teacher-analytics-definitions.ts) (line 1). Tests: `tests/schoolknot-management-reconciliation-qa.test.ts`, `tests/schoolknot-management-reconciliation.test.ts`, `tests/student-certificates-security-backup.test.ts`, `tests/student-certificates.test.ts`. Gates: CHILD_SAFETY, DOCUMENT_POLICY. Dependencies: NPS-REQ-001, NPS-REQ-003.


## NPS-REQ-045: Restricted Draft Suspension Notice, Draft Disciplinary Warning and Draft TC Preview with permanent “DRAFT – NOT OFFICIAL” marking until authorised official issuance

**PARTIAL** — The certificate engine has restricted pre-issue TRANSFER drafts and issued snapshot history; support and library suspension are unrelated.

Still required: Add Draft Suspension Notice and Draft Disciplinary Warning plus a Draft TC Preview with permanent DRAFT – NOT OFFICIAL on every screen/export/page; technical separation from official numbering/verification/issuance.

Evidence: [lib/student-certificates.ts](../../lib/student-certificates.ts) (line 10), [lib/certificate-templates.ts](../../lib/certificate-templates.ts) (line 1), [lib/certificate-backup.ts](../../lib/certificate-backup.ts) (line 6). Tests: `tests/student-certificates-security-backup.test.ts`, `tests/student-certificates.test.ts`. Gates: CHILD_SAFETY, DOCUMENT_POLICY. Dependencies: NPS-REQ-008, NPS-REQ-044.


## NPS-REQ-046: Traceable software change management covering requirement, impact, migration, security, tests, acceptance, release and changelog

**PARTIAL** — Requirements/prompt ledgers, release manifests, feature gates, migration, security/QA and retained merge/tag history exist. The old ledger has different scope/counts.

Still required: Establish this exact 46-item versioned canonical register, provenance, dependency checks and future impact/changelog enforcement; retain historical ledgers as evidence.

Evidence: [lib/release-operations-types.ts](../../lib/release-operations-types.ts) (line 1), [lib/release-operations-view.ts](../../lib/release-operations-view.ts) (line 6), [config/release-feature-flags.json](../../config/release-feature-flags.json) (line 6). Tests: `tests/final-corrected-scope-acceptance.test.ts`, `tests/release-operations-ui.test.ts`, `tests/release-operations.test.ts`. Gates: RELEASE_GATES. Dependencies: .


## Series and controlled parallel work

Finish and release this reconciliation first. Generate only PORTABLE-DEPLOYMENT-OBSERVABILITY-FOUNDATION-1B, then stop. It is the sole next implementation prompt; it requires a later explicit start. Within an authorised stable phase, independent evidence/test/documentation tasks may run in controlled parallel. Never run major bundles concurrently or create several feature branches.

Later roadmap only: CERTIFICATE-GRADUATION-EXIT-1A; STUDENT-ITEMS-CONCESSIONS-1A; HR-RECRUITMENT-APPRAISAL-PIP-1A; STUDENT-DISCIPLINE-DRAFT-NOTICE-1A; PARENT-SURVEY-MARKETING-GOVERNANCE-1A; HANDWRITING-OCR-BENCHMARK-1A. Attendance, Books and private-work follow-ups require separate scope decisions recorded in the register.

## Changing this living specification

Keep IDs stable. Each approved intent/status/dependency change requires a new registerVersion, a dated changelog entry with affected IDs and reasons, a priorRegisterHash over the exact previous register bytes, refreshed source/tree evidence and acceptance/security/recovery impact. New requirements need a separately approved inventory version and explicit test/schema count update; never silently reuse or drop an ID. Set approvedAt only with evidenced authorised approval and keep release state separate from operational activation. Preserve old versions through Git history.
