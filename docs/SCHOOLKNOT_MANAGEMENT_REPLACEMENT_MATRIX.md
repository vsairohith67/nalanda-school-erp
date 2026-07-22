# Schoolknot Management Replacement Matrix

Status: **provisional Management-only reconciliation**  
Evidence date: 21 July 2026  
Reconciliation date: 22 July 2026  
Prompt boundary: **23B-M only; Prompt 23B is not complete**
Independent QA: **Prompt 23B-M-QA cleared after the classification corrections recorded below; final Prompt 23B still awaits Parent, Teacher and Principal audits**

## Scope and decision rule

This matrix reconciles the completed authenticated Schoolknot **MANAGEMENT** audit with the actual Nalanda ERP repository. It does not treat the Parent, Teacher, Principal, or generic prompt-template coverage as authenticated evidence. No Schoolknot record, export, credential, personal value, or screenshot was copied into this repository. No Nalanda module, page, API, model, migration, provider, or real record was changed for this phase.

`FULLY_REPLACED` means the observed purpose and its material workflow are covered, not merely that a similarly named page exists. `NALANDA_STRONGER` is used where Nalanda adds materially safer isolation, approval, immutable history, reconciliation, or recovery. A form or report seen without an authorised write/export test cannot prove its side effects.

## Management source verification

| Evidence item | Verified result |
|---|---|
| Completion | MANAGEMENT role audit completed **21 July 2026** |
| Authenticated role | Management/Admin context with Finance, Admissions, HR, Staff, Roles, Transport, and School Settings |
| Top-level menus | **15**: Dashboard; Communication; Academics; Attendance; Students; Staff; Exams; Finance; Admissions; HR; Downloads; Transport; Settings; Discipline; Cafeteria |
| Desktop evidence | **119 structural page observations** |
| Mobile evidence | **39 representative checks at exact 390 × 844** |
| No-write boundary | No create, modify, send, upload, download, export, print, payment, attendance, marks, approval, cancellation, edit, delete, or role change was executed |
| Write result | No record was created, changed, sent, approved, published, paid, refunded, deleted, uploaded, exported, or downloaded |
| Privacy | Structural labels only; no names, contacts, identifiers, marks, balances, photographs, or transaction values retained |
| Mobile finding | Primary management sidebar remained hidden; toggle exposed only Logout; dense tables stayed desktop-width; some legacy forms became extremely long |
| Stability finding | Browser log capture reached 200 repeated warnings/errors; blank/weak pages included Day Closer and Admissions Dynamic Report |
| Unverified areas | Guardians as a standalone module; Library/books; inventory/assets; backup/restore; audit-history page; integrations; branch administration; Schoolknot expenses/budgets/cash book; refunds; checkout; GPS; biometric actions; exact Day Closer and export effects |
| Other-role status | Parent, Teacher, and Principal audits remain pending; their template headings are not evidence |

### Evidence-status vocabulary

- `VERIFIED_VISIBLE_WORKFLOW`: safe read-only workflow structure was visible.
- `VERIFIED_VISIBLE_FORM_ONLY`: fields/actions were visible, but no submit or mutation was tested.
- `VERIFIED_VISIBLE_REPORT_ONLY`: filters/columns/report selectors were visible, but no export was run.
- `BLANK_OR_BROKEN`: the page was blank, unstable, or did not expose reliable controls.
- `INACCESSIBLE`: not present in the authenticated menu or not safely reachable.
- `NEEDS_WRITE_TEST`: exact persistence, approval, reversal, or side effects require an authorised synthetic-tenant test.
- `NEEDS_EXPORT_EVIDENCE`: format, field dictionary, row counts, and download contents remain unverified.
- `NEEDS_OTHER_ROLE_EVIDENCE`: Parent, Teacher, or Principal behavior cannot be inferred from Management.

## Actual Nalanda Management capability inventory

This inventory is code-derived from `app/`, `app/api/`, `prisma/schema.prisma`, `lib/access-rules.ts`, `lib/permissions.ts`, workflow helpers, and tests. Current inventory: **274 page routes, 376 API routes, 160 Prisma models, and 345 canonical/legacy permission tokens found in the permission registry**. Navigation is permission-filtered into Dashboard, Students & Parents, Fees & Reports, Attendance, Staff & Leave, Timetable, Communication, Administration, and System groups.

| Management area | Concrete Nalanda evidence | Governance / integration result |
|---|---|---|
| Dashboard | `/dashboard`; `VIEW_DASHBOARD`, `VIEW_SYSTEM_HEALTH`; permission-filtered attendance/finance cards | Server permission gate; health details shown only when authorised |
| Students | `/students`, `/students/new`, `/students/[id]/edit`; `/api/students`, `/api/students/[id]`; `Student`; `VIEW_STUDENTS`, `CREATE_STUDENTS`, `EDIT_STUDENTS` | Soft-delete/status boundaries and controlled imports; no Admissions CRM |
| Guardians | `/guardians`, `/guardians/[id]`; `/api/import/guardians`; `Guardian`, `StudentGuardian`; `VIEW_GUARDIANS`, `MANAGE_GUARDIANS` | Separate Guardian identity, sibling links, Parent account isolation |
| Enrollment/lifecycle | `/students/lifecycle`, `/students/[id]/lifecycle`; `/api/students/lifecycle`; `AcademicYearEnrollment`, `StudentLifecycleEvent`; lifecycle permissions | Append/history-based lifecycle; dry-run backfill; no bulk silent mutation |
| Progression | `/students/progression*`; `/api/students/progression*`; `StudentProgressionDecision` | Draft/submit/approve/finalise/cancel with transactional enrollment changes |
| Classes, sections, academic years | Timetable masters and enrollment fields; `TimetableClassSection`, `AcademicYearEnrollment`, `SchoolSettings` | Operational foundation exists; not a multi-branch SIS |
| Timetable | `/timetable`, `/timetable/builder`, `/timetable/generate`, `/timetable/print`; `/api/timetable/*`; timetable models | Draft/active separation, conflict checking, generation, CSV/print, Teacher links |
| Substitutions | `/substitutes*`; `/api/substitutes*`; `SubstituteAssignment`; substitute permissions | Human-reviewed advisory suggestions; reports/export; no automatic payroll effect |
| Student attendance | `/attendance/students*`; attendance APIs; `StudentAttendanceSession`, `StudentAttendanceRecord` | Manual session/lock foundation and reports; richer consolidation and Student leave remain gaps |
| Staff attendance | `/attendance/staff*`; attendance APIs; `StaffAttendanceSession`, `StaffAttendanceRecord` | Manual, auditable foundation with reports/export; no biometric automation |
| Staff leave | `/leave/staff*`; `/api/leave/staff*`; `StaffLeaveRequest` | Draft/submit/approve/reject/cancel and reports; advanced balances/rules partial |
| Staff records | `/staff`, `/staff/[id]`; `/api/staff*`; `StaffMember`, `TimetableTeacher` | Operational staff master; explicitly not payroll |
| Homework | `/homework*`, `/parent/homework`, `/teacher/homework`; homework APIs; `HomeworkAssignment`, `HomeworkAssignmentEvent` | Publish/read workflow, Teacher scope, Parent child isolation; no Student submission/upload |
| Exams and marks | `/exams*`, `/marks*`, `/teacher/marks`; exam/marks APIs; `ExamCycle`, `ExamAssessment`, `StudentMark`, `StudentMarkEvent` | Governed entry/submit/approve/lock/correction/import; multi-exam consolidation partial |
| Report cards | `/report-cards*`, `/parent/results`, `/teacher/report-cards`; report-card APIs and version/event models | Review/approval/issue, immutable correction versions, print, Parent isolation |
| Teacher analytics | `/teacher-analytics*`, `/teacher/analytics`; analytics models and permissions | Descriptive, versioned, human-reviewed; no score/rank/salary automation |
| Fees/concessions | `FeeStructure`; settings/import surfaces; fee-structure permissions | Core fee setup exists; concession governance/reporting is partial |
| Payments/receipts | `/payments*`, `/receipts/[receiptNo]/print`, `/receipt-audit`; payment APIs; `Payment`, `PaymentAudit`, `ReceiptNote` | Split receipts, ledger, cancellation/restore audit and ownership checks; no live gateway/refund module |
| Dues/collection/ledger | `/pending-dues`, `/daily-collection`, `/ledger`, `/ledger/print`; reports APIs | Strong offline finance reporting; Daily Collection is not a proved Schoolknot Day Closer |
| Expenses/vendors | `/vendors*`, `/expenses*`; expense APIs; Vendor/Expense models | Approval/payment/cancellation and audit trail; not payroll accounting |
| Budgets | `/budgets*`; budget APIs; `BudgetPlan`, `BudgetAllocation`, `BudgetRevision` | Revision history and reports |
| Cash Book | `/cash-book*`; cash-book APIs; `CashBookDay`, `CashBookMovement` | Source snapshots, handover, variance, approve/lock, reports; distinct from Schoolknot Day Closer |
| Book sales | `/books*`; book APIs; book catalog/sale/settlement models | Separate receipts and cash settlement; not a general inventory system |
| Library | `/library` plus catalog, accession, circulation, incidents, charges, barcode and stock-verification routes/APIs; 20+ Library models | Permanent accessions, append-only events, portals, governed charge collection, stock lock/review |
| Certificates/TC | `/certificates*`, Parent certificate routes; certificate request/version/event models | Review/approve/issue, numbering, immutable correction/reissue, print/report/export |
| Class X documents | `/class-x-documents*`, Parent view; package/charge/handover/event models | Custody and handover governance; does not claim to issue Board documents |
| ID cards | `/id-cards*`, Parent/Teacher own views; number/template/batch/version/event models | Controlled issue/reissue/revoke, print, exact lookup; no RFID/access-control claim |
| Notices | `/notices`; `/api/notices*`; `Notice` | Published Parent notices with audience filtering; not a unified inbox |
| In-app notifications | `/notifications*`; notification campaign/recipient/event models | Preview/review/send scheduling, immutable audience snapshots, own-recipient actions, aggregate reports |
| WhatsApp | `/whatsapp*`; consent/template/batch/delivery/webhook/event models | MOCK-safe one-way foundation; live disabled; consent and aggregate reporting; no surveillance requirement |
| SMS/Email | `/sms-email*`; consent/template/batch/delivery/suppression/event models | MOCK-safe one-way foundation; live disabled pending provider/DLT/domain evidence |
| Parent portal | `/parent` plus homework, results, Library, certificates, Class X, ID cards, notifications, preferences APIs | Read-only, linked-child isolation; correction/write workflows held |
| Teacher portal | `/teacher` plus marks, homework, report cards, Library, ID card, notifications, preferences, analytics APIs | Own/timetable-scoped server isolation; Teacher audit still required for usability/parity decisions |
| Roles/users | `/roles`, `/users`; role/user APIs; `RolePermission`, `User`, `UserAudit` | Effective permission matrix, Super Admin safety, page/API guards, password reset audit |
| Public website | Public routes plus `/website-admin*`; versioned page/post models | Local-only controlled publication, public/private separation; no admissions CRM, deployment, DNS, tracking, or child photos |
| PWA | `/install-app`, `/settings/pwa`, manifest/service worker/offline | Static-public-assets-only cache, network-only authenticated pages/APIs; not a native app |
| AI Assistant | `/ai-assistant*`; AI profile/source/audit/safety/evaluation models | Allowlisted, aggregate-only, MOCK-only, no writes/personal lookup/external sources |
| OCR | `/fee-register-ocr*`; private OCR models | Manual/deterministic review and zero-write posting preview; actual Payment posting blocked |
| Encrypted backup | `/cloud-backup*`; backup profile/run/artifact/verification/rehearsal/event models | AES-GCM/gzip, hashes, readback, rehearsal and retention foundations; live off-site provider deployment-only |
| Imports/exports | `/import-export`, `/import-verification`; import APIs; `ImportBatch`, `GoLiveChecklist` | Preview-first, formula-safe, permission-gated, reconciled; no unrestricted arbitrary-field export |
| System health/security logging | Dashboard health, backup health, `UserAudit`, `PaymentAudit`, workflow events | Strong targeted logs and runtime boundaries; universal cross-module audit remains partial |

## Management replacement matrix

Statuses may be combined where, for example, a visible form also needs a later write test. Priorities are Management-only and provisional.

### Dashboard and Communication

| Schoolknot menu path | Evidence status | Purpose / visible fields, actions, reports | Nalanda equivalent and concrete evidence | Gap / dependency / other-role evidence | Decision | Priority |
|---|---|---|---|---|---|---|
| Dashboard / Homepage | VERIFIED_VISIBLE_WORKFLOW | Academic year; strength, gender/RTE, attendance and fee summaries | `/dashboard`; permission-filtered active Student/Guardian/Staff, attendance, finance, leave, substitution and operational cards; `VIEW_DASHBOARD` | Class/stage strength, gender and RTE summaries are not present; exact Schoolknot formulas were not export-tested | PARTIALLY_REPLACED | MEDIUM |
| Communication / Notifications / Admin Inbox | VERIFIED_VISIBLE_WORKFLOW; NEEDS_OTHER_ROLE_EVIDENCE | Inbox, status, search | `/notifications`, own-recipient APIs, `NotificationRecipient` | Unified cross-channel inbox parity and recipient behavior need role audits | PARTIALLY_REPLACED | HIGH |
| Communication / Notifications / Sent | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Date/status/search sent register | `/notifications/manage`, `/notifications/reports`; aggregate CSV | Exact Schoolknot fields/export unverified | PARTIALLY_REPLACED | MEDIUM |
| Communication / Notifications / Compose | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Audience/category, subject, message, image, submit/reset | Campaign preview/review/schedule/workflow APIs and models provide stronger governance | Image/media is intentionally absent; Schoolknot send effects and Parent/Teacher behavior remain unverified | PARTIALLY_REPLACED | HIGH |
| Communication / Notifications / Bulk Notifications | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Sample sheet upload and bulk send | Controlled audience snapshots and preview-first imports | Unrestricted upload/send is unsafe | SHOULD_NOT_COPY | DEFER |
| Communication / Notifications / Reports | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Date/status/search reporting | Aggregate notification reports/export | Recipient surveillance not required | NALANDA_STRONGER | MEDIUM |
| Communication / Showcase | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Title, audience, image, YouTube, submit | Public website governed pages/posts could safely cover approved public achievements | Operational need, consent and Parent/Principal visibility pending | PARTIALLY_REPLACED | DEFER |
| Communication / Events | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Title, audience, dates, description, Parent visibility, Edit/SMS/Delete | `ERP_CALENDAR_FUTURE_MODULE_PLAN.md`; notices/public content are not an internal calendar | Internal model/workflow missing; roles/audience pending | MISSING | HIGH |
| Communication / Holidays | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Event-like scheduling and audience | Calendar plan only | Attendance/timetable impact and role visibility pending | MISSING | HIGH |
| Communication / Events & Holidays / Settings | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Configuration surface | Calendar plan | Exact settings and persistence unverified | NEEDS_MORE_EVIDENCE | MEDIUM |
| Communication / Whatsapp / Dashboard | VERIFIED_VISIBLE_WORKFLOW | Channel overview | `/whatsapp`; consent/template/batch/delivery models | Live production provider remains blocked | DEPLOYMENT_ONLY | HIGH |
| Communication / Whatsapp / History | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Date, recipient/contact, class, sent/delivered/read/credit | Aggregate `/whatsapp/reports`; privacy-limited deliveries | Recipient-level read surveillance rejected | SHOULD_NOT_COPY | DEFER |
| Communication / Whatsapp / Template | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Template surface | `/whatsapp/templates`; approval/mapping workflow | Live template/provider evidence required | DEPLOYMENT_ONLY | MEDIUM |

### Academics, Attendance, Students and Staff

| Schoolknot menu path | Evidence status | Purpose / visible fields, actions, reports | Nalanda equivalent and concrete evidence | Gap / dependency / other-role evidence | Decision | Priority |
|---|---|---|---|---|---|---|
| Academics / Homework / View | VERIFIED_VISIBLE_WORKFLOW; NEEDS_OTHER_ROLE_EVIDENCE | Date/class/status/search register | `/homework`, `/teacher/homework`, `/parent/homework`; homework models | Teacher/Parent usability still unaudited | PARTIALLY_REPLACED | HIGH |
| Academics / Homework / Create | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Class/date-dependent form | `/homework/new`; Teacher-scoped APIs and append-only events | Attachment/scheduling parity partial | PARTIALLY_REPLACED | HIGH |
| Academics / Homework / Submissions | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_OTHER_ROLE_EVIDENCE | Student/date/class/subject/files | No Student submission model/page/API | Parent/Teacher evidence, storage/retention/moderation required | MISSING | HIGH |
| Academics / Homework / Report | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Class and homework-count aggregation | `/homework/reports`; formula-safe export | Exact count definitions unverified | PARTIALLY_REPLACED | MEDIUM |
| Academics / Assignments / Create/View | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Title, class, subject, date, description, file, schedule, status | Homework foundation supports type/title/description/due/publish history | Attachments and scheduled publication missing | PARTIALLY_REPLACED | HIGH |
| Academics / Assignments / Submissions | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_OTHER_ROLE_EVIDENCE | Submission count/action | None | Cross-role evidence and private storage required | MISSING | HIGH |
| Academics / Classwork / Create/View/Report | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Class/date register and count report | Homework can publish work but is not a distinct classwork workflow | Confirm academic purpose and role consumption | MISSING | MEDIUM |
| Attendance / View Absenteeism | VERIFIED_VISIBLE_WORKFLOW | Date/class/status/search | `/attendance/students/reports` | Comparable absenteeism views/report shapes partial | PARTIALLY_REPLACED | HIGH |
| Attendance / Marking | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Class/date attendance table | `/attendance/students`; session/record models, lock workflow | Teacher audit needed for operational entry usability | FULLY_REPLACED | LOW |
| Attendance / Settings | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Approval/manual choices | Nalanda session/submit/lock rules are code-governed | Curated settings UI may be useful; no parity requirement | PARTIALLY_REPLACED | MEDIUM |
| Attendance / Student Leaves | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_OTHER_ROLE_EVIDENCE | Date/status request register | Staff leave exists; no Student leave request | Parent/Principal approval evidence required | MISSING | HIGH |
| Attendance / Classwise, Master Class, Monthly, Daywise, Genderwise | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Academic year/date/class/lifecycle/gender aggregations | Student attendance reports/export | Monthly/daywise/master consolidation partial; gender requires purpose | PARTIALLY_REPLACED | HIGH |
| Students / Manage Students | VERIFIED_VISIBLE_WORKFLOW | Student/Parent/admission/contact/status/year/class/section filters | `/students`; `Student`, enrollments, Guardians | Selected filters/status mappings may differ | PARTIALLY_REPLACED | HIGH |
| Students / Promote Students | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Source/target year/class submit | `/students/progression*`; decision and lifecycle history | No need to copy direct bulk promotion | NALANDA_STRONGER | LOW |
| Students / Bulk Update Students | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Dozens of mutable fields | Preview-first field-specific imports only | Unrestricted mutation/export rejected | SHOULD_NOT_COPY | DEFER |
| Students / Add Student | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Identity, academic, contact, address, transport, medical, family, government, bank, biometric, photos | `/students/new`; deliberately smaller `Student` schema with stronger minimisation | Material Schoolknot fields were not write-tested; add only approved necessary fields and keep sensitive fields policy/legal-gated | PARTIALLY_REPLACED | HIGH |
| Staff / Manage Teachers and Employees | VERIFIED_VISIBLE_WORKFLOW; NEEDS_EXPORT_EVIDENCE | Search, role/designation/status, download, view, reset password | `/staff`; `/users`; `StaffMember`, `UserAudit` | Staff fields/report depth partial; reset must remain governed | PARTIALLY_REPLACED | HIGH |
| Staff / Add Teacher and Employee | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Employment plus bank/tax/family/biometric/identity/image/signature | `/staff`; operational fields only with stronger minimisation | Payroll/statutory and selected HR fields are absent by design or pending a separate boundary; Schoolknot writes were untested | PARTIALLY_REPLACED | HIGH |
| Staff / All Staff and Teaching Subject Reports | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Staff and teaching allocation registers | `/staff`, timetable Teacher assignments, exports | Department/report filters partial | PARTIALLY_REPLACED | MEDIUM |
| Staff / Dynamic Staff Report | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | User-selected arbitrary fields, favourites, PDF/download | Allowlisted exports only | Arbitrary personal-field extraction rejected | SHOULD_NOT_COPY | DEFER |
| Staff / Weekly Usage Report | VERIFIED_VISIBLE_REPORT_ONLY | Staff platform usage | No ranking; Teacher analytics is descriptive and reviewed | Fair-context aggregate support metrics only | SHOULD_NOT_COPY | DEFER |

### Exams and Finance

| Schoolknot menu path | Evidence status | Purpose / visible fields, actions, reports | Nalanda equivalent and concrete evidence | Gap / dependency / other-role evidence | Decision | Priority |
|---|---|---|---|---|---|---|
| Exams / View/Create Exams | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Class/exam/dates/status; Parent visibility | `/exams*`; `ExamCycle`, `ExamAssessment` | Scheduling/visibility parity and Principal workflow need evidence | PARTIALLY_REPLACED | HIGH |
| Exams / Type and Subject Config | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Exam/subject configuration | Assessment/component and timetable-backed subject setup | Exact configuration breadth partial | PARTIALLY_REPLACED | MEDIUM |
| Exams / Marks Entry | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Class/exam/subject marks | `/marks*`, `/teacher/marks`; governed status/correction/import | Teacher/Principal role evidence pending | NALANDA_STRONGER | LOW |
| Exams / Print Report | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Report filters/download | `/report-cards/*/print`, report APIs | Presentation parity needs Parent/Principal evidence | PARTIALLY_REPLACED | HIGH |
| Exams / Settings | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Grade ranges, labels, points, remarks, goals | `GradingScheme`, `GradeBand`, report-card templates | Goals/categories differ; do not copy without purpose | PARTIALLY_REPLACED | MEDIUM |
| Exams / Analytics | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Student selector/custom fields | Aggregate marks/report-card reports; Teacher analytics excludes raw Student ranking | Exact Student-level analytics purpose/export and board need are unconfirmed; large eager identity selectors remain unsafe | PARTIALLY_REPLACED | MEDIUM |
| Exams / Checklist and Single Exam | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Checklist/single-exam selectors | Mark/report-card reports | Checklist exact semantics missing | PARTIALLY_REPLACED | MEDIUM |
| Exams / Consolidated Report | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Consolidated results | One-locked-exam report cards and reports | Multi-cycle consolidation missing | PARTIALLY_REPLACED | HIGH |
| Exams / Multiple Exam Report | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Multiple-exam comparison | None | Academic rules and presentation require Teacher/Principal/Parent evidence | MISSING | HIGH |
| Exams / Board Exam Analytics | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Board analytics selector | None | Implement only if official school need is confirmed | MISSING | MEDIUM |
| Exams / Uploads | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Upload/register surface | Preview-confirm marks CSV import | Exact file formats/side effects unknown | NEEDS_MORE_EVIDENCE | DEFER |
| Finance / Add, Assign, View Fee Heads | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST | Name, level, frequency, class assignment | `FeeStructure`, fee settings/imports | Schoolknot write behavior untested; Nalanda core is mature | FULLY_REPLACED | LOW |
| Finance / Receive Payments | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Student/Parent search, mode, daily summary | `/payments/new`; split payments, receipt ownership, ledger | Online provider absent by design | NALANDA_STRONGER | LOW |
| Finance / Receipt History | VERIFIED_VISIBLE_WORKFLOW; NEEDS_EXPORT_EVIDENCE | Invoice/transaction/mode/reference/remarks/amount; view/print/edit/cancel | `/payments`, receipt print, `PaymentAudit`, cancel/restore | Direct mutation must not be copied | NALANDA_STRONGER | LOW |
| Finance / Other Payments | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Date, description, mode, heads, amount | `/misc-income`; separate receipt models | Distinct audited non-fee income is safer | NALANDA_STRONGER | LOW |
| Finance / Fee Settings | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Web/mobile module restriction checkboxes | Fee and role permission settings | Curated subset only | PARTIALLY_REPLACED | MEDIUM |
| Finance / Old Fee Reports | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Date/mode report | Payment, daily collection, ledger and audit reports cover the main operational need | Exact field, formula, date/mode semantics and export comparison remain pending | PARTIALLY_REPLACED | MEDIUM |
| Finance / Day Closer | BLANK_OR_BROKEN; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | No reliable controls observed | Daily Collection plus governed Daily Cash Book | Similar names do not prove same close/reconciliation workflow | NEEDS_MORE_EVIDENCE | HIGH |
| Finance / Analytics / Collections, Due, Summary, Concession | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Tabs visible; limited safe structural detail | Collection/dues/ledger/concession-related reporting | Exact formulas and exports unverified | PARTIALLY_REPLACED | MEDIUM |
| Finance / Analytics / Debit | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Tab only | No confirmed equivalent | Purpose/formula unknown | NEEDS_MORE_EVIDENCE | MEDIUM |
| Finance / Analytics / PG | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Gateway report; no checkout/refund | No live gateway | Provider/legal/idempotency/reconciliation gates | BLOCKED_APPROVAL | HIGH |
| Finance / Refund | INACCESSIBLE; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Receipt cancel seen; no refund workflow | No refund module | Must first prove business need and accounting/reconciliation design | NEEDS_MORE_EVIDENCE | HIGH |

### Admissions, HR, Downloads and Transport

| Schoolknot menu path | Evidence status | Purpose / visible fields, actions, reports | Nalanda equivalent and concrete evidence | Gap / dependency / other-role evidence | Decision | Priority |
|---|---|---|---|---|---|---|
| Admissions / Dashboard and All Enquiries | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST | Enquiry/follow-up/status/contact/actions | Public `/admissions` is information only; no CRM model/route/API | Director go-live need; privacy, dedupe, authorised migration | MISSING | CRITICAL |
| Admissions / Custom Whatsapp | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Template, year, probability, enquiry/status/action | Generic consented WhatsApp foundation, not admissions CRM messaging | Consent, preview, source identifiers and live provider gates | MISSING | HIGH |
| Admissions / Branch/Class/Not Interested/Vacancy Reports | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Funnel, branch/class/source/vacancy/loss reports | None | Multi-branch not currently supported; exact formulas unverified | MISSING | HIGH |
| Admissions / Dynamic Report | BLANK_OR_BROKEN; NEEDS_EXPORT_EVIDENCE | No reliable controls/content | None | Arbitrary-field reporting would be rejected regardless | NEEDS_MORE_EVIDENCE | DEFER |
| Admissions / Vacancies | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Vacancy form | No admissions capacity model | Capacity rules and approval required | MISSING | HIGH |
| HR / My HR Dashboard | VERIFIED_VISIBLE_WORKFLOW; NEEDS_OTHER_ROLE_EVIDENCE | Personal HR summary | `/teacher`, staff/leave/attendance own surfaces | Teacher/Staff authenticated evidence pending | PARTIALLY_REPLACED | MEDIUM |
| HR / Daily Attendance | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_OTHER_ROLE_EVIDENCE | Month; date/in/out | `/attendance/staff/reports`; `StaffAttendanceSession`, `StaffAttendanceRecord`; report/export permissions | Management reporting exists, but authenticated Staff/Teacher own-view parity remains unproved | PARTIALLY_REPLACED | MEDIUM |
| HR / Pay Slip | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_OTHER_ROLE_EVIDENCE | Year/month/action | None | Payroll architecture, legal review, Staff evidence | MISSING | HIGH |
| HR / My Leaves | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Availability/actions | Staff leave workflow | Balances/rules and Teacher experience partial | PARTIALLY_REPLACED | MEDIUM |
| HR / Resignation | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Staff, status, reason, dates, file, approvers | No exit model/workflow | Prompt 22/26 boundaries, retention, approvals | MISSING | HIGH |
| HR / Management Leaves / Dashboard, Requests, Assign, View, Settings, Report | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Requests, allocation, rule settings, reports | `StaffLeaveRequest`, reports/export | Advanced entitlement/rules/attachments partial; Principal approvals pending | PARTIALLY_REPLACED | HIGH |
| HR / Payroll / Payroll, Add Salary, Set Payroll | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Employee/department/month/year salary setup | Staff records and Expenses/Cash Book are not payroll | Legal/accounting/privacy architecture required | MISSING | HIGH |
| HR / Payroll / Advance Salary | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Employee, type, amount, instalments, recovery month/year | None | Approval, recovery, accounting and audit required | MISSING | HIGH |
| HR / Payroll / Settings and Report | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Working days, attendance/late deductions, PF/ESI, dates, grace, salary report | None | Qualified payroll/labour/accounting review; Prompt 22/26 gates | BLOCKED_APPROVAL | HIGH |
| Downloads / Transfer Certificate | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_EXPORT_EVIDENCE | Class/Student search/download | `/certificates`, TC templates/versions/print | Schoolknot PDF not downloaded; Nalanda governance is stronger | NALANDA_STRONGER | LOW |
| Transport / Routes and Assign Routes | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_OTHER_ROLE_EVIDENCE | Route/point register; Student/route/vehicle/status | Timetable is unrelated; no transport model/route/API | Parent/Principal visibility, child safety, migration | MISSING | CRITICAL |
| Transport / Vehicles | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Vehicle register/add | No equivalent | Ownership/vendor/document retention rules required | MISSING | HIGH |
| Transport / Vehicle Reading | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Vehicle/vendor/driver/fuel/date/slip/voucher | Expense/vendor foundation could link later but is not a replacement | Financial controls and attachment retention required | MISSING | HIGH |
| Transport / Bus Pass | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Search/filter/pass action | ID cards are not bus passes | Parent/Principal visibility and issue/revoke rules needed | MISSING | HIGH |
| Transport / Settings and Reports | VERIFIED_VISIBLE_REPORT_ONLY; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Areas/routes; strength, assignments, dues, readings, attendance | None | Full transport foundation first | MISSING | HIGH |
| Transport / GPS/live tracking | INACCESSIBLE; NEEDS_OTHER_ROLE_EVIDENCE | Not visible | No location provider/model | Separate privacy, vendor, legal, emergency and live-tracking approval | BLOCKED_APPROVAL | DEFER |

### Settings, Discipline, Cafeteria and inaccessible modules

| Schoolknot menu path | Evidence status | Purpose / visible fields, actions, reports | Nalanda equivalent and concrete evidence | Gap / dependency / other-role evidence | Decision | Priority |
|---|---|---|---|---|---|---|
| Settings / Subjects | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Name/code/type/status/import/assignment/edit | Timetable subjects and assignments cover the core | Status/import/edit effects and exact assignment/export parity remain unverified | PARTIALLY_REPLACED | MEDIUM |
| Settings / Classes | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST | Class, subjects, Teacher, coordinators, status | Timetable class/section and assignment foundation | Coordinator and status semantics are partial; Schoolknot writes were untested | PARTIALLY_REPLACED | MEDIUM |
| Settings / School Settings | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Broad identity, app, location, transport, fees, sign-in, passwords, Parent features, branding, schedules, signatures, tax/watermark | `/settings`; `SchoolSettings`; public/PWA settings separated | Curated safe subset only; many settings belong to future modules | PARTIALLY_REPLACED | HIGH |
| Settings / Manage Roles | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Module permission matrix | `/roles`; `RolePermission`; server/API guards | Schoolknot backend enforcement not proved | NALANDA_STRONGER | LOW |
| Settings / Departments | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Add/list | `ExpenseDepartment`; Staff department is limited | HR department master may be needed with payroll | PARTIALLY_REPLACED | MEDIUM |
| Settings / Analytics / App Downloads | VERIFIED_VISIBLE_REPORT_ONLY | Individual app login/pending/action | PWA diagnostics and system health, not recipient adoption ranking | Aggregate support metrics only | SHOULD_NOT_COPY | DEFER |
| Settings / Class Timetable | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE | Class/file/action/upload | Full timetable builder/generator/conflicts/print/export | Upload parity unnecessary without evidence | NALANDA_STRONGER | LOW |
| Settings / Change Password | VERIFIED_VISIBLE_FORM_ONLY; NEEDS_WRITE_TEST | Current/new/confirmation | `/change-password`; password policy and audited reset | No predictable defaults | NALANDA_STRONGER | LOW |
| Discipline / Register and Create | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Subject/date/category/narrative/action/image/fine/edit/delete/print | Library incidents are domain-specific and not Student discipline | Principal/Teacher/Parent boundaries, confidentiality, appeal and retention required | MISSING | MEDIUM |
| Cafeteria / View, Attendance, Settings, Reports | VERIFIED_VISIBLE_WORKFLOW; NEEDS_WRITE_TEST; NEEDS_EXPORT_EVIDENCE; NEEDS_OTHER_ROLE_EVIDENCE | Assignment, attendance, dates, amount, reports | None | Confirm actual use; finance, consent, allergy/medical scope must be excluded or separately approved | MISSING | MEDIUM |
| Schoolknot / Guardians standalone | INACCESSIBLE | Guardian data embedded in Student form | Separate `Guardian` and `StudentGuardian` | Schoolknot export/link identifiers needed | NALANDA_STRONGER | HIGH |
| Schoolknot / Library/books | INACCESSIBLE; NEEDS_EXPORT_EVIDENCE | Not visible | Extensive `/library*` and `/books*` foundations prove strong local capability | Schoolknot purpose, history, identifiers and export are unknown, so comparative replacement cannot be claimed | NEEDS_MORE_EVIDENCE | MEDIUM |
| Schoolknot / Inventory/assets | INACCESSIBLE; NEEDS_EXPORT_EVIDENCE | Not visible | Library accession stock is not general assets | Confirm business need | NEEDS_MORE_EVIDENCE | MEDIUM |
| Schoolknot / Backup/restore | INACCESSIBLE; NEEDS_EXPORT_EVIDENCE | Not visible | Local JSON plus encrypted cloud-backup/rehearsal foundation; version 37 proves Nalanda-owned recovery capability | Schoolknot-hosted recovery, ownership, retention and export evidence are unknown, so comparative replacement cannot be claimed | NEEDS_MORE_EVIDENCE | CRITICAL |
| Schoolknot / Audit history | INACCESSIBLE | Only an audit-related setting observed | Targeted User/Payment/workflow histories | Universal cross-module history remains partial | PARTIALLY_REPLACED | HIGH |
| Schoolknot / Integrations | INACCESSIBLE | No integration centre | Disabled provider foundations and explicit readiness gates | Exact dependencies/contracts unknown | NEEDS_MORE_EVIDENCE | HIGH |
| Schoolknot / Branch administration | INACCESSIBLE; NEEDS_EXPORT_EVIDENCE | Admissions filters/reports only | Single-school assumptions | Multi-branch architecture is a separate decision | NEEDS_MORE_EVIDENCE | DEFER |
| Schoolknot / Expenses, Budgets, Cash Book | INACCESSIBLE; NEEDS_EXPORT_EVIDENCE | Not visible | Strong Nalanda expense, budget and cash-book modules prove local capability | Schoolknot purpose, migration data and export evidence are unknown, so comparative replacement cannot be claimed | NEEDS_MORE_EVIDENCE | HIGH |
| Schoolknot / Biometric/RFID | INACCESSIBLE; NEEDS_WRITE_TEST | Identifiers/settings only | Manual attendance foundation; no device adapter | Vendor proof, privacy/legal approval and file-first design | BLOCKED_APPROVAL | DEFER |

## Reported Management gap validation

| # | Candidate gap | Current Nalanda result | Implement? / dependency |
|---:|---|---|---|
| 1 | Admissions and Enquiry CRM | Missing; public admissions page is information only | Consider M3 after Director need, minimisation, dedupe and export dictionary |
| 2 | Payroll and payslips | Missing; Staff/Expenses/Cash Book are not payroll | Plan only under Prompt 22/26, legal/accounting/privacy gates |
| 3 | Salary setup/history | Missing | Same payroll architecture; immutable effective periods |
| 4 | Advance salary | Missing | Only with approval, recovery, accounting and audit design |
| 5 | Resignation/exit | Missing | M2; Principal/Teacher evidence and retention/offboarding policy |
| 6 | Events and holidays | Internal module missing; public content is not a calendar | M1 candidate; role visibility pending |
| 7 | Academic calendar/tasks/reminders | Planning document only | M1 candidate; attendance/timetable integration carefully separated |
| 8 | Transport routes/Student assignment | Missing | M4 if operationally critical; Parent/Principal evidence |
| 9 | Vehicle records | Missing | M4 after ownership/document purpose and retention |
| 10 | Vehicle readings | Missing | M4; link to governed expenses without merging ledgers |
| 11 | Bus passes | Missing; ID card is not a pass | M4 with issue/revoke/visibility rules |
| 12 | GPS/tracking | Not implemented; Schoolknot not visible | Reject until separate privacy/legal/vendor approval; never broad live access |
| 13 | Student homework submissions | Missing | M5; requires Parent/Teacher evidence, isolation, moderation and retention |
| 14 | Assignment attachments | Missing | M5; private storage, malware/type/size/retention controls |
| 15 | Classwork | Missing as distinct workflow | Low priority until academic-use evidence |
| 16 | Consolidated exam reports | Partial | M1 report improvement after academic definitions |
| 17 | Multiple-exam comparison | Missing | M1/M5 planning; Teacher/Principal/Parent presentation evidence |
| 18 | Board-exam analytics | Missing | Implement only if confirmed official need; avoid rankings |
| 19 | Discipline | Missing | Optional M6 with confidentiality, restorative workflow, appeal, immutable history |
| 20 | Cafeteria | Missing | Optional M6 only if operationally used; avoid unnecessary health data |
| 21 | Showcase/public achievements | Partially replaceable by governed public pages/posts | Optional; consent and publication approval required |
| 22 | App-adoption/Staff-usage analytics | Intentionally absent | Reject individual monitoring/ranking; aggregate support metrics only |
| 23 | Refund workflow | Missing; cancellation/restore is not a refund | Needs provider/accounting/legal/reconciliation approval and source evidence |
| 24 | Day Closer | Schoolknot blank; Nalanda has Daily Collection and Cash Book | Do not claim replacement until source workflow/export evidence exists |
| 25 | Inventory/assets | General asset module missing; Library accessions are domain-specific | M6 only if confirmed need; no scope piggyback |
| 26 | School settings/integrations | Partial curated settings; integrations gated/disabled | Expand only per-module; provider-specific lock-in rejected |
| 27 | Schoolknot backup/restore evidence | Inaccessible | Nalanda recovery foundation stronger, but source export/recovery ownership still needed |
| 28 | Bulk exports/update tools | Allowlisted preview-first exports/imports only | Reject unrestricted variants; authorise case-by-case migration exports |

## Similar-looking features that are not equivalent

| Feature A | Feature B | Reconciliation |
|---|---|---|
| Public admissions information | Admissions CRM | Public pages explain admissions; they do not hold enquiries, follow-ups, capacity, application status, or conversion history. |
| Staff records | Payroll | `StaffMember` is operational identity/employment linkage; it does not calculate salaries, statutory deductions, advances, or payslips. |
| Descriptive Teacher analytics | Salary decision workflow | Nalanda analytics deliberately excludes ranks/scores/employment automation and must never silently drive pay. |
| Notices | Unified communication inbox | Notices are a published feed; the notification centre is a separate authenticated delivery ledger; neither proves a two-way unified inbox. |
| Homework publishing | Student submission | Current homework supports assignment publication and Parent/Teacher views, not files, Student authorship, review or grading. |
| Timetable | Transport routes | Timetable assigns classes/subjects/Teachers/periods; transport assigns Students/stops/vehicles and has distinct safety/privacy risks. |
| Daily Collection | Schoolknot Day Closer | Daily Collection reports payments; Cash Book approves/locks physical cash. The observed Schoolknot Day Closer was blank, so equivalence is unproved. |
| Expenses/Cash Book | Payroll accounting | Vendor expenses and cash custody do not calculate or authorise Staff pay. |
| Public website events content | Internal school calendar | Public content has publication governance but no internal audience, reminder, attendance, holiday, or task semantics. |
| PWA installation | Native Schoolknot app | Nalanda is an installable web foundation with network-only private routes; there is no native binary, app-store certification, or device telemetry. |
| Cloud-backup engine | Schoolknot-hosted backup | Nalanda controls its encrypted backup/rehearsal logic; the audit found no Schoolknot backup/restore evidence. |
| Parent correction workflow | Unrestricted direct profile edits | Future correction must be request/review/apply with field-level policy and audit, never direct broad mutation. |

## Cross-role evidence hold list

### Hold for Parent audit

- Student submissions, attachment visibility, acknowledgement and correction behavior.
- Parent correction requests and status visibility.
- Notices versus notification inbox, consent/preferences and message behavior.
- Student leave requests and approval visibility.
- Events/holidays/calendar, transport/bus-pass visibility, timetable usability, report-card presentation, fees/refunds, and mobile/PWA priorities.

### Hold for Teacher audit

- Homework/assignment/classwork authoring, attachments, submissions and review.
- Attendance entry/correction, marks entry/approval, report-card workflow, timetable/substitution usability, Staff leave/resignation own-view, communication behavior, and mobile priorities.
- Any Staff-usage metric; individual ranking remains rejected regardless of audit evidence.

### Hold for Principal audit

- School-wide approvals for exams, marks, report cards, leave, events, communication, discipline, admissions, transport and settings.
- Exact read/write/export boundaries for Students, Staff, finance, payroll, reports and bulk actions.
- Which Management modules disappear, are disabled, or are backend-blocked for Principal.
- School-wide consolidated reports and publication/correction authority.

## Interim conclusion

Management evidence supports a gap-driven backlog, not parity cloning. Nalanda is fully replacing or materially stronger for the specifically observed and code-proved parts of core offline fee/payment control, Guardians, lifecycle/progression, timetable, role permissions and certificates/TC. Nalanda also has mature local Library, expense/budget/cash-book and backup/recovery foundations, but the inaccessible Schoolknot source areas remain `NEEDS_MORE_EVIDENCE` rather than comparative replacement claims. Admissions, payroll/exit/advance, transport, internal events/calendar, Student submissions/files, richer exam consolidation, discipline and cafeteria remain missing or partial. Live providers, refunds, GPS, biometric/RFID and cross-role workflows remain approval/evidence gated.

**Prompt 23B remains incomplete.** This document only supports a future `23B-M-QA` review of the Management reconciliation. Parent, Teacher and Principal audits must be completed before final cross-role consolidation or priority sign-off.

## Verification closure

- Routes: 274 pages and 376 APIs, unchanged.
- Lifecycle backfill: 8 active Students scanned; 8 already enrolled; 0 missing/created; no data changed.
- Typecheck: passed.
- Tests: 1,429 across 157 files passed, including 10 focused Management reconciliation tests.
- Build: passed with 211/211 static pages using the established bounded 4 GB heap after the first command wrapper timed out without a code error.
- Backup: version 37, `nalanda-fee-control-backup-2026-07-22-02-03.json`.
- Prisma schema SHA-256: `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`.
- Migration inventory: 40 migration SQL directories plus `migration_lock.toml`, 41 entries under the established checkpoint convention.
- Operational SQLite SHA-256: `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`.
- Business baseline: 8 Students; 8 active enrollments; 19 active non-cancelled Payments; INR 99,100 collected.
- Backup credential check: zero `passwordHash` keys and zero User rows with a password-hash field.
- No Prisma model, migration, page, API, provider, deployment, Schoolknot export/import, credential, or Student/Staff/finance record was added or changed.
