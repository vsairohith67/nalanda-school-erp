# Schoolknot Replacement Gap Map and Biometric Integration Plan

## Prompt 23B final multi-role supersession

The final authoritative planning set is:

- `SCHOOLKNOT_FINAL_MULTI_ROLE_REPLACEMENT_MATRIX.md`;
- `SCHOOLKNOT_FINAL_UNRESOLVED_EVIDENCE_LEDGER.md` (exactly 109 unique rows and all eight source dispositions);
- `SCHOOLKNOT_ROLE_PERMISSION_AND_PRIVACY_COMPARISON.md`;
- `TEACHER_ATTENDANCE_SCOPE_CUTOVER_BLOCKER.md`;
- `SCHOOLKNOT_CUTOVER_BLOCKERS_AND_ACCEPTANCE_GATES.md`;
- `SCHOOLKNOT_GAP_IMPLEMENTATION_ROADMAP_23C_ONWARD.md`;
- `SCHOOLKNOT_SYNTHETIC_WRITE_TEST_PLAN.md`;
- `SCHOOLKNOT_VENDOR_EXPORT_AND_DATA_DICTIONARY_REQUEST.md`;
- `SCHOOLKNOT_FINAL_REPLACEMENT_DECISION.md`.

Prompt 23A role reports and Prompt 23A-E are complete and `READY_FOR_PROMPT_23B`. Prompt 23B is consolidation only: no Schoolknot data was imported and no Admissions, Parent, Teacher, Classwork, attachments, calendar, payroll, transport, gateway or other business module was implemented. Independent 23B-QA cleared the exact 109-row reconciliation, current repository evidence and role/cutover decisions after expanding every 23C-23J roadmap row with explicit schema, privacy, finance, storage/provider, migration, test, release and cutover boundaries. Teacher remains `NO_GO`; 23C may start from the merged/tagged QA baseline. FIN-2A is cleared; DEVOPS-1D is payment-gated; Prompt 21/22 gates are unchanged.

## WhatsApp one-way communication

Prompt 19B supplies a privacy-safe official Meta Cloud API foundation with MOCK QA, explicit consent, approved templates, controlled batches, queue/webhooks, and aggregate reporting. It is not a two-way inbox, chatbot, group tool, media sender, OTP channel, or direct Student messaging system. Production equivalence remains conditional on supervised Meta approval, environment credentials, HTTPS webhook deployment, and current rate review.

Planning date: 27 June 2026; refreshed 30 June 2026 for Prompt 14A  
Planning phase: Prompt 14A stabilization after Prompt 13E-QA  
Implementation status: Gap-map planning plus completed manual student attendance, staff attendance, staff leave, and substitute teacher foundations. Prompt 14A adds audit/planning documents only. Biometric sync, messaging gateway, payment gateway, and other planned modules are not built by this document.

## Purpose and decision rule

Nalanda Public School currently uses Schoolknot. The long-term goal is to replace the Schoolknot workflows the school actually depends on, then improve on them with safer imports, clearer audit trails, stronger reconciliation, and school-specific workflows.

This is a gap map, not a claim of product parity. Before migration, management must compare this map with the school's real Schoolknot usage, exports, contracts, mobile-app dependencies, and daily operator routines. A feature advertised publicly but not used by Nalanda may be deferred; a small workflow used every day may be migration-critical.

## 1. Current verified baseline and built capabilities

The latest completed implementation phase supplied for Prompt 14A is Prompt 13E-QA. The baseline supplied for this planning phase is: typecheck passed; 326 tests across 56 files passed; build passed; backup passed; backup format version 12; and latest prior backup `nalanda-fee-control-backup-2026-06-28-22-19.json`.

| Area | Current capability |
|---|---|
| Access control | Authentication/login, named users, role/permission matrix, Super Admin safety, and page/API permission gates |
| Fee operations | Fee collection, split payments, receipts, receipt printing, pending dues, student ledger, and daily collection |
| Financial control | Payment audit/cancellation and restore workflow, receipt audit, and reconciliation-oriented reports |
| Imports | Preview-first student, payment, guardian, and staff imports with warning/error handling |
| Parent/Guardian | Guardian master, sibling linking, parent-account foundation, read-only parent portal, and parent notices |
| Staff/Teacher | Staff/Teacher foundation, optional user and timetable-teacher links, staff profiles, and safe Teacher placeholder |
| Timetable | Foundation masters, builder, generator, conflict checks, print, and CSV export |
| Data safety | Preview-first restore, backup/restore version 12, pilot checklist/QA tools, pilot sample reset, and separately gated test-data cleanup |

The fee ERP core is the strongest part of the replacement. The largest remaining gaps are academic operations, attendance, admissions, communications delivery, supporting administration, and vendor/device integration.

## 2. Schoolknot replacement gap map

Priority meanings:

- **P0 - migration-critical:** build it, explicitly replace it with a documented manual process, or confirm it is unused before Schoolknot is switched off.
- **P1 - early replacement:** important soon after the P0 foundation; it may temporarily run beside Schoolknot if management accepts the duplication.
- **P2 - post-migration enhancement:** useful but not normally a blocker unless Nalanda depends on it today.
- **Decision:** final priority depends on confirmed current use, contract, hardware, or regulatory need.

| Schoolknot feature/module | Current ERP status | Gap | Priority | Recommended prompt/module | Notes |
|---|---|---|---|---|---|
| Admissions/enquiry | Missing | No enquiry funnel, application, admission workflow, document checklist, or conversion to Student Master | P0 | Future Admissions and Enquiry Foundation | Confirm admission-season workflow, enquiry sources, required documents, and numbering first. |
| Fee collection | Built | Core offline collection exists; continue real-data reconciliation | P0 - covered | Existing fee ERP and pilot acceptance | Preserve split payments, receipt grouping, audit/cancellation, dues, and ledger behavior. |
| Online payment/payment gateway | Missing | No parent checkout, gateway callback, settlement, refund, or automated reconciliation | Decision | Future Online Payment Gateway phase | P0 only if the school will not migrate without parent online payment. Approve provider and security/reconciliation rules first. |
| Fee reminders | Partial | Copyable text and CSV exist; no automated delivery, scheduling, consent, or delivery status | P1 | Future Reminder Scheduling and Delivery Adapter | Manual calling/copying is the interim process; do not claim automatic sending. |
| Expense management | Expense, budget, miscellaneous-income, and daily cash controls built | Prompt 16A adds vendors/expenses; 16B adds budgets; 16C adds separate non-fee receipts and physical-cash day close. Invoice attachments remain absent. | P1 | Prompt 16C-QA, then separately scoped 16D | All finance registers remain separate from fee receipt business logic. |
| Cash book | Foundation built | Opening/counted/expected closing, fee/misc/expense sources, deposits, Director handovers, variance, snapshots, drift warning, approve/lock, reports/CSV | P1 | Prompt 16C-QA | Reconciles authoritative fee and expense records without rewriting them. |
| Parent app/portal | Partial/strong web foundation | Read-only portal and notices exist; no native app, online payment, homework, results, attendance, leave, or push | P0 for current read-only use; P1 for expansion | Existing portal, then module-specific parent views | Keep parent surfaces read-only until each write workflow is separately approved and permission-tested. |
| Notifications | Partial | Parent notices exist; no SMS, WhatsApp API, email, push, consent, queue, retry, or delivery audit | P0/P1 decision | Future Notification Delivery Foundation | Require an approved manual alternative before migration if Schoolknot delivery is relied upon. |
| Homework/assignments | Missing | No assignment creation, class targeting, due dates, attachments, submission, or family view | P1 | Future Homework/Assignments Foundation | Start with publish/read-only consumption; defer online submissions unless required. Phase 14 is now reserved for UI/navigation stabilization. |
| Student attendance | Foundation built | Manual daily class attendance, submit/lock, reports, and CSV exist; period attendance, correction/unlock, device import, and parent view do not | P0 - foundation covered | Prompt 13B - Student Attendance Foundation | Keep device and parent expansion separately permission-tested. |
| Staff attendance | Foundation built | Manual daily active-staff attendance, times/late minutes, submit/lock, reports, and CSV exist; shifts, punches, correction/unlock, and device sync do not | P0 - foundation covered | Prompt 13C - Staff Attendance Foundation | The manual source and safe StaffMember link provide the base for a later device adapter. |
| Biometric/RFID integration | Planned only | No identity map, punch import, normalization, deduplication, or sync | P1 after attendance foundations and Phase 14 UI stabilization | Future Biometric Attendance Import Adapter | Begin with file import. Direct integration depends on verified BM-70W support. |
| Leave application | Staff foundation built | Staff draft/submit/approve/reject/cancel, overlap warning, reports, CSV, permissions, and backup exist; balances, attachments, calendar effect, student leave, and full audit history do not | P0/P1 foundation covered | Prompt 13D - Staff Leave Application Foundation | Approved leave is future input for substitutes; keep student leave separate. |
| Substitute teacher system | Foundation built | Manual planning, approved-leave/absence review, timetable fallback, advisory suggestions, workflow history, reports, CSV, permissions, and backup exist; notifications, biometric trigger, payroll effect, and automatic final assignment do not | P1 - foundation covered | Prompt 13E - Substitute Teacher Foundation | Human review remains mandatory; suggestions are explainable and advisory. |
| Timetable | Built | Core management/generation/print/export exist; role-safe consumption is limited | P0 - covered | Existing timetable; later safe views | Preserve draft/active separation and conflict validation. |
| Exam/results | Missing | No exam setup, marks entry, moderation, grades, report cards, or parent results | P0/P1 | Prompt 15A - Exams/Marks Foundation | P0 if Schoolknot is the official marks/report-card system. |
| Teacher performance reports | Missing | No agreed KPIs; attendance/marks/substitution evidence is not yet available | P2 | Prompt 15B - Teacher Performance Analytics | Use fair, explainable metrics; never reduce performance to biometric hours alone. |
| Library | Missing | No catalogue, accession copies, issue/return, fines, stock check, or labels | P1/P2 | Prompt 17A - Library Foundation | Raise to P0 if Schoolknot is the sole live library register. |
| Transport/bus tracking | Missing | No routes, stops, vehicles, assignments, GPS, live map, or alerts | Decision/P2 | Future Transport Foundation and GPS Adapter | Requires separate child-safety, vendor, privacy, uptime, and emergency review. |
| Events/holidays | Partial planning only | No school event/holiday publishing calendar | P1 | Future ERP Calendar and Events Foundation | Reuse the future calendar plan; do not mix it with timetable periods. |
| Multi-branch management | Missing | Single-school/local assumptions; no tenant isolation or consolidated reporting | P2/Decision | Future Multi-Branch Architecture phase | Changes identity, numbering, permissions, reporting, backup, and isolation; do not retrofit casually. |
| School branding/mobile app | Partial | School/receipt settings and web branding exist; no branded native app | P2 | Future PWA/Branded App phase | Evaluate responsive web/PWA before native apps and recurring maintenance. |
| Audit/change log | Partial/strong in key areas | Payments/users are audited; no universal audit for every future/master change | P0/P1 | Cross-module Audit Expansion | Each high-impact module should define actor, time, before/after, reason, and reversal. |
| Backup/cloud backup | Partial | Local JSON backup/preview restore exist; no encrypted off-site rotation or automated disaster recovery | P0 operational control | Future Backup Hardening phase | Migration needs tested restore, protected copies, retention, and a named owner even without cloud. |
| Virtual ID cards | Missing | No template, QR/virtual identifier, expiry, reissue, or parent/staff display | P2 | Prompt 19A - Virtual ID Cards | Do not embed sensitive data in QR codes; prefer revocable identifiers. |
| Certificates/TC/bonafide/migration | Missing | No request, approval, numbering, templates, issue register, print, cancellation, or reissue | P1 | Prompt 18A - Certificates/TC/Bonafide/Migration | Confirm official wording, authorities, numbering, and required fields first. |
| Miscellaneous income | Foundation built | Configurable items/rates, student-link policies, multi-line non-fee receipt, cancellation, print, reports/CSV, and cash-only cash-book source | P1 | Prompt 16C-QA; Prompt 16D is Books/Library Income and Publisher Payment Flow | Distinguishable from student fees and audited by its own receipt number. |

## 3. Replacement priority order

1. Inventory actual Schoolknot use: modules, reports, notifications, apps, identifiers, owners, and frequency.
2. Prove the current core on representative real data: fees, guardians, portal, staff, timetable, permissions, backup, and restore.
3. Build confirmed migration-critical foundations: admissions, student/staff attendance, leave, substitutes, homework, and exams.
4. Add adapters after domain foundations: biometric import after staff attendance; delivery after consent/templates; gateway after settlement design.
5. Close supporting administration gaps: cash book, miscellaneous income, expenses, certificates, and library.
6. Run both systems in parallel for an agreed period; reconcile totals and exception lists and document fallbacks.
7. Cut over only after export, backup, acceptance, training, rollback, and management sign-off.
8. Add differentiators only after operational stability.

## 4. Must-have before Schoolknot migration

- A signed inventory of every Schoolknot workflow Nalanda actually uses, with owner, frequency, source data, required history, replacement, and fallback.
- Accepted fee, receipt, dues, ledger, daily collection, audit, and import reconciliation on representative real data.
- Accepted guardian/sibling, parent portal, staff, timetable, backup/restore, and role-isolation workflows.
- Student and staff attendance foundations if Schoolknot holds authoritative attendance.
- Exams, homework, admissions, leave, notifications, certificates, and library either implemented or covered by approved interim processes if currently critical.
- A migration plan for students, guardians, staff, fees, receipts, attendance, marks, documents, and stable identifiers.
- A decision on historical reports: reproduce, archive, or retain read-only access.
- Full pre-cutover backup, tested restore on a copied database, protected secondary copies, retention rules, and a named owner.
- Permission sign-off for every role, including direct URL/API denials.
- Operator training, day-close and exception procedures, parallel-run criteria, rollback triggers, and management sign-off.
- A specific decision on online payments and automated notifications; current use makes a safe replacement or approved temporary alternative migration-critical.

## 5. Nice-to-have after migration

- Native branded apps after assessing responsive web/PWA.
- Virtual ID cards and revocable QR identifiers.
- Advanced teacher and attendance analytics after data quality and fair metrics are established.
- Live bus tracking after a separate safety/privacy/vendor review.
- Multi-branch management if independently operated branches are later required.
- Automated biometric sync after file import proves stable.
- Cloud backup/deployment after security, cost, recovery, connectivity, and ownership approval.
- Parent write/self-service workflows beyond the current read-only boundary.

## 6. Better-than-Schoolknot opportunities

- Explainable money trails connecting split payments, grouped receipts, cancellation reasons, audits, register comparison, and account reconciliation.
- Preview/confirm/error-export safety for every import and destructive operation.
- Evidence-led migration with saved counts, warnings, random checks, sign-offs, and before/after backups.
- One guardian identity with explicit sibling links and strict read-only scoping.
- Device-independent attendance: normalized ERP data plus vendor/device identity mappings.
- Human-correctable automation with source visibility, permissions, reasons, and audit history.
- Exception queues for missing punches, late arrivals, absences, timetable conflicts, unmatched imports, and unreconciled money.
- School-specific registers, approvals, wording, and academic-calendar rules.
- Server/API role enforcement, safe defaults, direct-route tests, and minimal Parent/Teacher surfaces.
- Low lock-in through standard exports, stable identifiers, and tested restores.

## 7. Risks and cautions

| Risk | Required caution |
|---|---|
| Mapping advertised features instead of real work | Interview operators and inspect actual Schoolknot screens, reports, and exports. |
| Historical-data loss | Export early, verify counts/identifiers, retain source files unchanged, and test on copies. |
| Big-bang cutover | Use parallel operation, objective reconciliation, sign-off, and a rollback window. |
| Biometric privacy/misuse | Limit collection, document purpose/retention/access, secure templates/logs, and provide correction/manual paths. Obtain appropriate legal/privacy advice. |
| Vendor lock-in | Require export/API/data-ownership evidence and a practical sample export before approval. |
| Device/network failure | Keep local storage, manual attendance/import, health visibility, and retry procedures. |
| Wrong identity mapping | Use stable ERP IDs, preview ambiguity, and never auto-merge only by name. |
| Wrong punch assumptions | Treat punches as evidence; apply approved shift, grace, leave, holiday, and correction rules. |
| Unfair analytics | Use transparent, reviewable measures; hours, marks, or substitutions alone are not performance. |
| Payment/security exposure | Gateways need signed webhooks, idempotency, settlement/refund reconciliation, secret handling, and audits in a separate phase. |
| Notification consent/delivery | Approve consent, templates, provider, failures/retries, costs, opt-out, and audits separately. |
| Scope creep | Build one narrow foundation at a time and preserve fees, backup compatibility, permissions, and operator language. |

## 8. Biometric integration plan - Biomax BM-70W

### Quotation context

The supplied quotation context identifies Edufied Labs LLP quotation `EST-000308`, dated 23 June 2026, for one Biomax BM-70W with Wi-Fi, face recognition, biometric, and RFID features.

| Item | Amount/status |
|---|---|
| Base price | Rs 13,800 |
| CGST | Rs 1,242 |
| SGST | Rs 1,242 |
| Total | Rs 16,284 |
| Approval status | Yet to be Approved |

The quotation is a commercial offer, not proof of custom integration. The feature list does not prove data pull/push, SDK access, or required export fields. Approval should wait for written answers, documentation, a sample export, and an acceptance demonstration.

### Integration principles

- Build attendance rules and corrections before connecting hardware.
- Keep ERP person IDs authoritative; map vendor/device user IDs separately.
- Preserve raw punches separately from derived daily attendance.
- Make imports idempotent so repeated files do not duplicate punches.
- Preview unknown users, duplicates, invalid timestamps, clock/time-zone problems, and importable rows.
- Record source file/device, operator, import time, counts, warnings, and corrections.
- Keep manual attendance available during device, power, network, SDK, or vendor-cloud failure.

### Stage 1 - Manual attendance entry/import foundation

Build date/session, person, status, source, remarks, correction reason, approval/lock, and audit history without device dependency. Define working days, holidays, shifts/grace, permissions, correction, reports, and backup/restore. Prompt 13B and 13C cover this future work.

**Exit gate:** approved rules, stable IDs, manual workflow, correction trail, reports, permissions, tests, and backup/restore.

### Stage 2 - CSV/Excel import from the biometric device

Use a real BM-70W export. Normalize employee/device user ID, punch time, punch type, device ID, and verification mode. Preview matched, unmatched, duplicate, invalid, and importable rows. Save raw evidence and import-batch results; derive attendance only through approved rules.

**Exit gate:** idempotency, time-zone/clock handling, no guessed users, totals matching the export, and downloadable errors.

### Stage 3 - Device SDK/API integration if provided

Test the documented SDK/API in an isolated proof of concept. Prefer read-only pull. Keep credentials server-side. Verify pagination/cursors, limits, error codes, reconnects, duplicates, time zone, and independence from proprietary cloud/software.

**Exit gate:** written rights/license, security review, stable connectivity, complete mapping, retry/idempotency tests, and file-import fallback.

### Stage 4 - Automated sync service if stable

Use a server-side scheduled worker with last-success cursor, bounded retry, health status, structured logs, duplicate protection, and operator retry. Never silently overwrite approved corrections.

**Exit gate:** sustained parallel run, monitored failures, reconciliation, recovery drill, support ownership, and approved retention.

### Stage 5 - Advanced analytics and substitute trigger

After quality is proven, add approved late-coming, early-leaving, missing-punch, absent-staff, and trend reports. Confirmed absence may propose a substitute requirement against the active timetable, but a permitted person must assign it. Show source/correction state and avoid automatic punitive decisions.

## 9. Vendor questions before approving quotation EST-000308

Ask for written answers plus documentation or a demonstration.

### Integration and exports

1. Does the BM-70W provide an SDK or documented API for a custom ERP?
2. Can it export attendance as CSV and/or Excel without proprietary software?
3. Can each record include employee ID, punch date/time, punch type, device ID, and verification mode?
4. Does it support LAN and Wi-Fi data pull from a local computer/server?
5. Does it have a cloud dashboard, and is cloud optional or required?
6. Can data be pushed to a custom ERP endpoint, or only pulled/exported?
7. Is the SDK available for Windows, Node.js, Python, and/or .NET, and which versions?
8. Will the vendor provide API/SDK documentation, sample code, field definitions, and error codes before purchase?
9. Can the vendor supply a real export from this exact model/firmware before approval?
10. Does it require Schoolknot, Edufied, Biomax, or other vendor software to enrol users or retrieve data?

### Ownership, cost, and lock-in

11. Can Nalanda own and export all enrolment and attendance data at any time?
12. Is there recurring software, cloud, API, license, AMC, support, or per-user cost beyond Rs 16,284? Provide total first-year and annual costs.
13. Is SDK/API/custom-integration use included, separately licensed, or prohibited?
14. If a subscription ends, can the school still operate locally and export everything?
15. Are there limits on history, API calls, devices, administrators, employees, or records?

### Capacity and operation

16. What are the exact user, face, fingerprint, RFID, and offline-record capacities?
17. How long are punches retained without network, internet, or cloud?
18. Does it support automatic time sync and Asia/Kolkata time, with time-change audit?
19. How are duplicate punches, overnight shifts, power loss, clock drift, and resets handled?
20. Is UPS/surge protection recommended, and what power adapter/warranty applies?
21. Can multiple devices later share users and records without a new platform?

### Security, privacy, support, and acceptance

22. Where are biometric templates stored, and are they encrypted at rest/in transit?
23. Can raw images be disabled/deleted while retaining only necessary templates?
24. What administrator authentication, role separation, audit, encryption, and firmware controls exist?
25. What warranty, replacement time, installation/training, local support, AMC, and expected life apply?
26. Will the vendor demonstrate enrolment, offline punches, export, network pull, backup, restore, and deletion?
27. Can purchase acceptance be conditional on export/API access, required fields, offline operation, and data ownership?

Obtain the exact datasheet/manual, SDK/API docs and terms, sample export, full recurring-cost statement, data-ownership statement, warranty/support terms, and signed demonstration results before approval.

## 10. Recommended next coding prompts

Each prompt should remain narrow, additive, permission-gated, audited where appropriate, included in backup/restore when it adds durable data, and fully verified before the next.

1. **Prompt 13B - Student Attendance Foundation** - complete
2. **Prompt 13C - Staff Attendance Foundation** - complete
3. **Prompt 13D - Staff Leave Application Foundation** - complete
4. **Prompt 13E - Substitute Teacher Foundation** - complete
5. **Prompt 14A - Whole ERP Audit, UI/UX, Navigation, Mobile Responsiveness, and Feature Gap Review** - complete after this audit pass
6. **Prompt 14B - App Shell, Navigation, Responsive Layout, and Design System Implementation**
7. **Prompt 14C - Dashboard Redesign and Operations Summary Cards**
8. **Prompt 14D - Mobile Route QA and UI Polish**
9. **Future Biometric Attendance Import Adapter**
10. **Future Admissions/Homework/Exams modules based on confirmed Schoolknot usage**
11. **Future Miscellaneous Income, Cash Book, Expense, Library, Certificate, and Virtual ID phases**

Before any biometric import or sync prompt, retain the vendor evidence above. If BM-70W cannot produce an acceptable standard export, stop at the attendance foundations and choose another device/vendor instead of coupling the ERP to an undocumented system.

## 11. Remaining limitations

- This plan does not verify Schoolknot's private implementation, Nalanda's contract, or exact module usage.
- It does not independently certify BM-70W capabilities; the quotation feature list is not an API/export guarantee.
- It is not legal advice about biometric privacy, retention, payments, messaging consent, or education records.
- It builds none of the future modules or integrations listed here.
- Priorities require operator interviews, Schoolknot usage/export review, vendor evidence, and management sign-off.

## Prompt 16D library-finance update

Nalanda now has an internal foundation for academic-year book pricing, separate book-sale receipts, daily book-cash settlement, Director handover, publisher expense wrappers, annual library-management service expense drafts, role-safe reports/CSV, and receipt printing. Publisher accounting deliberately reuses the shared Vendor/ExpenseRecord/ExpensePayment ledger.

This does not fully close the Schoolknot library-module gap: catalog/accession is now built, but circulation, issue/return, borrower history, overdue/fines, barcode scanning/RFID, inventory quantity/valuation, purchase orders, and procurement approvals remain unbuilt and require separately scoped future phases.

## Prompt 16E library circulation planning update

The library gap now has a privacy-first plan and a built Prompt 16F catalog/accession foundation. Bibliographic titles and accessioned physical copies remain separate from books-finance sale items; membership, audited issue/return/renewal/reservation, later charge/waiver integration, barcode-first operations, stock verification, parent linked-child isolation, and teacher self-only access are still future work. Start Prompt 16G before claiming circulation capability. RFID needs vendor/device/API/export/offline/cost/ownership evidence; procurement and inventory valuation are not circulation work.

## Prompt 16F replacement progress

Catalog/accession, circulation, and Library accountability replacement are now partial/built: titles, permanent copies, memberships, policies, issue/return/renewal, reservations, derived overdue, lost/damaged incidents, explicit charges/waivers, Miscellaneous Income collection, isolated Parent/Teacher views, reports, permissions, and v21 backup/restore are available. Do not claim full Schoolknot library replacement. Scanner labels (Prompt 16I), RFID, stock verification (Prompt 16J), procurement, and valuation remain missing.
# Prompt 16I update

Library supports Code 39 labels and confirmation-based USB scanner assistance. RFID and inventory stock verification are still gaps by design.
# Prompt 16J replacement coverage

## Prompt 17A replacement coverage

Class/section/subject Homework is covered for authorised staff, scoped Teachers, and linked-child Parents, including preserved corrections and safe reporting. This does not claim submission, attachment storage, grading, marks, report cards, AI generation, or external delivery.

Controlled Library physical stock verification is now covered, including locked audit history and safe reports. This does not claim RFID, camera scanning, valuation, depreciation, purchasing, accounting automation, or person-location tracking. Physical scanner certification remains pending real hardware.
# Prompt 17B update — examinations

The replacement now has an internal raw-marks foundation with exact timetable Teacher scope, review/approval/locking, audited corrections, preview-first import, completeness/average/pass-fail reports, and v24 recovery coverage.

# Prompt 17C update - digital report cards

Mark-based and LKG/UKG rubric report cards, separate approval/issue, immutable corrections, linked-child Parent access, operational reports, A4/KG print layouts, and backup/restore v25 are built. Remaining gaps include multi-exam aggregation, Parent acknowledgement receipts, Student login, external notifications, signature images, exam scheduling/admit cards, online tests, rank/merit, automated progression, and Teacher performance analytics (Prompt 17D).

## Teacher analytics boundary

Prompt 17D provides evidence categories, source-quality warnings, own-Teacher response rights, preserved leadership review, and aggregate reporting. It does not attempt ranking, employment scoring, hidden monitoring, biometric/location surveillance, or automatic HR action. Dedicated class-Teacher attribution and richer calendar denominators remain documented limitations.

## Student certificate replacement coverage

The internal Bonafide/Study/Conduct/TC request, approval, issue, correction/reissue, print, Parent linked-child access, reports, and recovery foundation is covered. This is not a claim of board-format compliance, public verification, Migration Certificates, certificate fee/payment support, QR verification, digital signing, or automatic transfer/lifecycle processing.
# Prompt 18B replacement update

The local ERP now covers the internal Class X document-package workflow: configurable checklists, school-certificate links, external Board/Migration custody status, service-charge collection/waiver, handover, Parent isolation, reporting, and backup v28. This is not a replacement for a Board portal and does not issue official Board documents. School leadership must verify current Board/authority procedure before relying on configuration. Gateway payments, scan storage, Board automation, and any Prompt 18C work remain gaps.
# Prompt 18C status

The local ERP now covers privacy-safe virtual Student and Staff ID cards, batch printing, portals, exact internal lookup, and lifecycle history. It does not replace PVC-card vendor services, personal-photo capture/cropping, RFID/NFC, access-control hardware, or public validation services.

# Prompt 19A status

The local ERP now covers authenticated in-app templates, controlled campaign review/publication, exact and Teacher-scoped audiences, immutable deduplicated recipient ledgers, Parent/Teacher inboxes, deterministic scheduling, operational acknowledgment, corrections/withdrawal, and aggregate reports. This replaces only the internal in-app portion of a SchoolKnot-style notification flow.

WhatsApp, SMS, email, push, provider callbacks, external delivery evidence, contact-field targeting, and automatic module-triggered messaging are not replaced. They require separately approved Prompt 19B/19C or later work.
# Prompt 19C communication replacement note

The ERP now has a disabled-by-default one-way SMS/Email operational foundation with MOCK QA, consent, suppressions, DLT/domain readiness, persistent queues, and aggregate evidence. This is not production replacement proof: no SMS vendor is selected, Gmail LIVE is disabled, SPF/DKIM/DMARC evidence is not asserted by the app, and no real contact has been sent. SchoolKnot comparison must keep two-way inboxes, marketing, OTP, attachment delivery, open tracking, and production provider certification outside this completed scope.

# Prompt 19D PWA replacement note

Nalanda ERP can now be installed from supporting browsers while retaining the responsive web baseline. Only approved public/static assets and the generic offline page are cached; school records, portals, APIs, reports, files, communications, and writes remain network-only. This improves launch convenience but is not app-store or physical-device certification, does not supply offline school operations, and does not replace future cloud, policy, support, signed-release, or device-QA work. See `PWA_AND_MOBILE_APP_STRATEGY.md`.

# Prompt 20A read-only assistant replacement note

Nalanda ERP now provides leadership-only cited retrieval over an explicit local-document registry and fixed aggregate operational summaries. This can replace a narrow internal help/overview use case only. It is not a SchoolKnot chatbot replacement, student/parent support bot, internet search product, autonomous operator, or production AI-provider certification. There is no external knowledge source, personal-data answer, individual marks/ranking, write action, attachment ingestion, live local model, or cloud model. All live-provider onboarding remains a separate governance and security gate.

# Prompt 20B handwritten register replacement note

Nalanda ERP can now replace the manual retyping *staging* step for photographed fee-register pages through private MOCK/MANUAL OCR review. It does not replace the financial Payment workflow: no fuzzy auto-match, automatic receipt, due change, Cash Book change, or Payment posting is enabled. Reviewed rows must be exported and passed through the existing preview-first Payment Import until a later phase proves the full posting helper. PDF and live local/cloud OCR are not certified.

# Prompt 20C recovery replacement note

Nalanda ERP now has a working encrypted automatic database-backup and recovery-verification foundation for deterministic MOCK and contained LOCAL_FOLDER storage. It verifies encrypted readback and supports isolated repeated restore rehearsal and safe retention.

This is not production cloud replacement proof: OBJECT_STORAGE and GOOGLE_DRIVE are disabled, no external scheduler is configured automatically, LOCAL_FOLDER is off-device only when deployed to separate protected media, private OCR/uploaded bytes are excluded, provider object lock is not claimed, and Browser cannot perform an operational cutover.

# Prompt 23B-M Management audit reconciliation

The authenticated Schoolknot MANAGEMENT audit is complete for the read-only visible scope as of 21 July 2026: all 15 top-level menus were opened, with 119 desktop observations and 39 exact 390×844 checks. Blank, inaccessible, write-test-only and export-evidence gaps remain explicitly unresolved. Parent, Teacher and Principal audits are still pending; the generic role template and provisional Principal map are not authenticated role evidence. Therefore **Prompt 23B is not complete**.

Use these current Management-only documents instead of the older advertised-feature assumptions:

- `SCHOOLKNOT_MANAGEMENT_REPLACEMENT_MATRIX.md` — code-derived capability inventory and workflow-by-workflow disposition.
- `SCHOOLKNOT_MANAGEMENT_RECONCILIATION_QA_REPORT.md` — independent source/repository/classification/gap/safety/hold verification and corrected Management-only clearance.
- `SCHOOLKNOT_FEATURES_NOT_TO_COPY.md` — rejection/redesign rules for surveillance, weak passwords, broad data, direct mutation, exports and unstable mobile UX.
- `SCHOOLKNOT_MANAGEMENT_GAP_IMPLEMENTATION_WAVES.md` — provisional M1-M6 planning; no cross-role priority is final.
- `SCHOOLKNOT_MANAGEMENT_EXPORT_AND_MIGRATION_REQUIREMENTS.md` — authorised future export contracts; no export was obtained in this phase.

No gap module, schema, migration, route, API, provider, deployment or data import was added. Admissions, payroll/exit, transport, internal calendar/events, Student submissions and richer exam consolidation are the main provisional gaps. Specific observed fee/payment, Guardian, lifecycle, timetable, permission and certificate/TC workflows are fully covered or governed more strongly. Nalanda Library, expense/budget/Cash Book and recovery capabilities are substantial, but inaccessible Schoolknot source modules remain `NEEDS_MORE_EVIDENCE`. Management-only QA is cleared after these corrections; Prompt 21B/21C/21D remain blocked, Prompt 22B remains conditional, and final Prompt 23B still waits for Parent, Teacher and Principal audits.

# Prompt 21A student-location replacement note

No Student-location feature is implemented or claimed as a SchoolKnot replacement. Prompt 21A establishes a privacy, threat, provider, cost, and phased decision gate only. Nalanda currently has one legacy free-text Student address and no coordinate, map, geocoding service, provider credential, location permission, or device-location request.

The conditional 21B path is structured postal address and correction control with no live provider. Exact-house mapping, transport tracking, geofencing, Teacher-wide access, public Nominatim, generic Student CSV coordinates, and location-based profiling are not replacement targets. A later comparison must judge purpose, child safety, lawful processing, provider/storage terms, accuracy, operating cost, incident handling, deletion, and physical workflow—not marker count alone.
