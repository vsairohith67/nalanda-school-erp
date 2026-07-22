# Schoolknot Management Gap Implementation Waves

Status: **provisional proposal only**  
Date: 22 July 2026  
Source boundary: completed Management audit; Parent, Teacher and Principal audits pending

## Rules before any wave

- These waves do not authorise schema, route, API, provider, migration, real-data, DNS or deployment work.
- Cross-role order is not final until Parent, Teacher and Principal audits are reconciled.
- Prompt 21B, 21C and 21D remain blocked. Prompt 22B remains conditional and must not begin.
- Every future prompt starts with an owner/use-frequency decision, source export dictionary, permission matrix, privacy/financial risks, acceptance checks, migration/reconciliation plan, backup/restore design, mobile QA and cleanup gate.
- Live messaging, payments, GPS/location, biometric/RFID and off-site provider activation require separate current approvals.

## Wave M1 — Low-dependency operational gaps

| Item | Proposal |
|---|---|
| Candidate scope | Events/holidays foundation; internal academic calendar/tasks/reminders; consolidated and multiple-exam report design; selected Management report improvements; curated settings/readiness improvements |
| Business value | Shared operational dates; fewer manual reminders; better academic overview; close high-value reporting gaps without starting a large CRM/HR/transport domain |
| Dependencies | Existing notices, attendance, timetable, exams/marks/report cards, permissions and calendar planning document; exact event/holiday ownership and academic definitions |
| Affected roles | Management, Principal, Teacher, Parent; possibly Viewer for safe aggregates |
| Likely models | Event/Holiday/CalendarEntry and append-only publication/change event; report definitions may need no model if derived; names are provisional |
| Privacy risks | Audience leakage; child-specific event details; notification surveillance; calendar caching |
| Financial risks | None by default; any paid event must be a separate governed finance design |
| Provider dependencies | None for local in-app foundation; external reminders remain disabled |
| Migration | Optional events/holidays export with source IDs, dates, audience, status and publication history |
| Other-role evidence | **Required** for visibility, notification, timetable usability and report-card presentation |
| Proposed prompts | 23C-M1A Calendar/Event Decision Record; 23C-M1B local foundation only after cross-role audit; 23C-M1C exam-consolidation report specification |
| Release gates | Exact definitions; role/object isolation; draft/review/publish/cancel; no hard delete; light/dark 390×844; formula-safe exports; v37+ backup only if a model is later approved |

## Wave M2 — Staff/HR governance

| Item | Proposal |
|---|---|
| Candidate scope | Payroll/payslip architecture; salary effective history; increment letters; resignation/exit; advance salary; Staff document governance |
| Business value | Replace a major Schoolknot HR dependency while keeping Staff master and finance ledgers conceptually separate |
| Dependencies | Prompt 22 planning/governance and future Prompt 26 boundaries; qualified payroll/labour/accounting/privacy review; Staff role/access evidence; approved statutory field list |
| Affected roles | Management, Director, Principal (approval scope unverified), Accountant, Teacher/Staff own-view |
| Likely models | PayrollProfile, SalaryStructureVersion, PayrollRun, PayslipVersion, SalaryAdvance/Recovery, StaffExitRequest/Event, document metadata; all provisional |
| Privacy risks | Salary, bank, tax, family and statutory identifier exposure; employment decision automation; retention after exit |
| Financial risks | Wrong gross/net/deductions, duplicate payroll, cash-book double counting, unauthorised advance, correction of closed periods |
| Provider dependencies | None for local planning; bank/EPFO/provider integrations are out of scope until separately approved |
| Migration | Staff stable IDs, salary effective periods, payslips, deductions/contributions, advances, approvals and exit history; import only with legal and reconciliation approval |
| Other-role evidence | Teacher audit for own HR/payslip/leave/resignation; Principal audit for approval boundary |
| Proposed prompts | 26A Payroll/HR Legal and Accounting Decision Record; 26B Effective Salary History Plan; 26C Exit/Advance Governance; later narrow implementations only after clearance |
| Release gates | Prompt 22/26 approvals; segregation of duties; immutable versions; dual-control close/reopen; no marks/usage-driven pay; masked export; copied-data restore; independent finance reconciliation |

## Wave M3 — Admissions

| Item | Proposal |
|---|---|
| Candidate scope | Enquiry pipeline, follow-up, capacity/vacancy, application status, conversion, duplicate detection and authorised migration |
| Business value | Replace a Management area that is genuinely absent; reduce spreadsheet/WhatsApp fragmentation during admission season |
| Dependencies | Director confirmation that CRM is day-one; minimum data dictionary; consent/contact policy; numbering; capacity rules; duplicate/merge policy; public site boundary |
| Affected roles | Management, Principal, authorised admissions Staff, Parent/applicant only if a later portal is separately approved |
| Likely models | AdmissionEnquiry, EnquiryEvent/FollowUp, CapacityPlan, Application, ConversionLink, DuplicateReview; provisional |
| Privacy risks | Prospective-child/family contacts, loss reasons, documents, messaging consent, premature Student creation |
| Financial risks | Registration/application money must not enter fee `Payment` without a separate approved receipt/reconciliation design |
| Provider dependencies | None for local CRM; WhatsApp/SMS/email remain consented live-provider gates |
| Migration | Enquiries, stages, sources, follow-ups, vacancy/capacity, branch/class, conversion/loss status; preview-only source-ID mapping |
| Other-role evidence | Principal audit for oversight/approval; Parent audit only if applicant/Parent self-service is proposed |
| Proposed prompts | 27A Admissions Use and Data-Minimisation Decision; 27B Enquiry/Follow-up Foundation; 27C Capacity/Application/Conversion; 27D Authorised Migration |
| Release gates | No public CRM exposure; duplicate review; conversion exactly once; separate Student master; consented communications; preview imports; audit/reversal; mobile QA; seasonal fallback |

## Wave M4 — Transport

| Item | Proposal |
|---|---|
| Candidate scope | Route/stop/vehicle foundation, Student route assignment, bus pass, vehicle readings; later optional GPS/vendor adapter |
| Business value | Replace a potentially migration-critical child-safety operation if the school actually runs transport in Schoolknot |
| Dependencies | Director operational confirmation; route/stop/vehicle export; child-safety owner; assignment/change/cancellation rules; emergency and incident procedures |
| Affected roles | Management, Principal, transport Staff, Parent, Student; Accountant for separately governed vehicle expenses |
| Likely models | TransportRoute, Stop, Vehicle, StudentRouteAssignment, BusPassVersion, VehicleReading/Event; GPS adapter models only in a later approved phase |
| Privacy risks | Child route, pickup point, driver/vendor data, live/precise location, pattern exposure |
| Financial risks | Transport fees, fuel/vouchers and vendor payments must link without duplicating fee/expense ledgers |
| Provider dependencies | None for core; GPS, maps, telematics and messaging require separate provider/privacy/legal approval |
| Migration | Routes/points, vehicles, assignments, passes, readings, vendors and status history; no scraping |
| Other-role evidence | Parent and Principal audits required; Teacher only if transport duties are visible |
| Proposed prompts | 28A Transport Safety/Privacy/Finance Decision; 28B Route/Vehicle Foundation; 28C Assignment/Pass/Reports; 28D Vehicle Readings; 28E optional vendor/GPS review |
| Release gates | Least privilege; no public/broad location; effective-dated assignments; pass revoke/reissue; vehicle history; expense reconciliation; exact mobile QA; emergency fallback |

## Wave M5 — Student academic interaction

| Item | Proposal |
|---|---|
| Candidate scope | Student submissions, private attachments, Teacher review/feedback, moderation, retention and optional acknowledgement |
| Business value | Close the largest difference between homework publication and interactive assignment completion |
| Dependencies | Completed Parent and Teacher audits; Student identity decision; private storage design; file safety; academic integrity/moderation; support process |
| Affected roles | Student (new role decision), Parent, Teacher, Principal/Management aggregates only |
| Likely models | AssignmentSubmission, SubmissionVersion, AttachmentMetadata, Review/FeedbackEvent; provisional |
| Privacy risks | Child-created content, filenames/metadata, accidental sensitive uploads, cross-child access, retention and deletion rights |
| Financial risks | Storage/egress cost only; no fees or rewards |
| Provider dependencies | Private object storage is not selected; no cloud upload until provider/security/recovery approval |
| Migration | Historical submission metadata/files only if authorised, inventoried, checksummed and necessary; default may be archive-only rather than import |
| Other-role evidence | **Mandatory Parent and Teacher evidence**; Principal evidence for moderation/oversight |
| Proposed prompts | 29A Submission/Storage/Retention Decision; 29B Text-only Submission Foundation; 29C Attachment Adapter only after storage approval |
| Release gates | Object isolation; file allowlist/size/malware strategy; immutable versions; teacher scope; moderation/escalation; private backup; purge/retention; mobile QA |

## Wave M6 — Optional or low-priority modules

| Candidate | Value test | Main risks / dependency | Provisional decision |
|---|---|---|---|
| Discipline | Confidential safeguarding history if actively used | Principal/Teacher/Parent boundaries, restorative policy, appeal, no fines/hard delete | DEFER until policy and role evidence |
| Cafeteria | Assignment/attendance if school operates it | Unnecessary medical/allergy data, payment duplication, attendance purpose | DEFER until confirmed use |
| Showcase | Controlled achievements/public communication | Child image/name consent and publication approval | Prefer governed public content; no separate module by default |
| Inventory/assets | General asset custody | Procurement, valuation, depreciation and ownership; Library stock is not general inventory | Separate discovery prompt only |
| App-adoption reporting | Support rollout | Surveillance and unfair Staff ranking | Aggregate support metrics only; reject individual ranking |
| Classwork | Distinct academic register | Duplication with homework/assignments | Await Teacher/Principal evidence |
| Board analytics | Official academic need | Ranking, definitions and presentation | Implement only with confirmed school/board purpose |

## Cross-role hold and priority rule

No wave may use the Management audit to infer Parent, Teacher or Principal behavior. Student submissions, Parent correction/communication/leave, Teacher marks/homework/timetable workflows, Principal approvals, events visibility, transport visibility, app/mobile priorities, notification behavior and report-card presentation stay held until their corresponding authenticated audits are delivered. Already independently approved and implemented Nalanda features remain in place; this hold prevents new cross-role expansion, not existing safe operation.

## Final provisional sequencing

M1 can be investigated first because it can begin with documentation/report definitions and local-only design. M2-M5 require stronger legal, financial, provider, migration or cross-role evidence. M6 remains optional. This ordering is provisional and must not be promoted to the final Prompt 23B roadmap until all four roles are reconciled.
