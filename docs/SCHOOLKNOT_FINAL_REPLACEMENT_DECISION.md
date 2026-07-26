# Schoolknot Final Replacement Decision

Decision: `REPLACEMENT_BUILD_CONTINUES_CUTOVER_NOT_READY`

Date: **26 July 2026**

## Defensible answers

- **Already replaced or stronger:** core Students/Guardians/lifecycle, governed finance and split receipts, expenses/budgets/Cash Book/misc/books, timetable foundation, staff leave/substitutes, Homework publishing, exams/marks/report cards, Library, certificates/Class X/ID cards, targeted communications, roles/server guards, backup/rehearsal, public/private split, PWA safety, AI and OCR boundaries.
- **Partially replaced:** Student attendance, Parent experience, Teacher experience, internal calendar/events, comparative examinations, communication parity, universal audit history and migration evidence.
- **Confirmed missing with approved value:** Teacher exact attendance authorization (a defect in existing scope), Parent attendance/exam timetable, governed internal events/holidays/calendar, secure Classwork/submissions/private attachments after storage approval, comparative exam analytics after formula approval.
- **Evidence-limited:** Schoolknot refunds/gateway/Day Closer, branch isolation, backup/restore, integrations, payroll/self-service, transport/GPS, file storage, export schemas, hidden roles and several blank/erroring reports.
- **Never copy:** predictable passwords, broad role access, hard historical deletion, unrestricted export/bulk edits, recipient surveillance, usage rankings, marks-only appraisal, public attachment URLs, weak password change, unnecessary personal data, desktop-only navigation, silent blank/error states and lock-in.
- **Critical role blocker:** Teacher attendance fails to enforce exact active timetable class/section scope. Teacher remains `NO_GO`.
- **23C first:** implement and independently verify that exact Teacher attendance scope; do not add adjacent features.
- **Data required:** vendor role/branch matrix, dictionaries, stable IDs, redacted samples, attachment manifests, audit/backup/integration documents, counts/checksums and reconciliation/rollback evidence.
- **Defer or reject:** native app parity, live GPS, live gateway, biometric/RFID, payroll without governance, discipline/cafeteria/assets/appointments/complaints without approved business need, rankings and surveillance.
- **Technical achievability:** the planned 23C-23J sequence is technically achievable within the existing architecture, but storage, provider, payroll, transport and migration work have external approvals.
- **Current authorization:** no whole-school cutover, no production deployment, no provider activation, no Schoolknot import and no full-parity claim.

Payroll and employee self-service remain absent/unverified.

## Role decision

Management, Parent, Principal and Accountant may only enter narrowly defined conditional pilots after their stated gates. Teacher cannot. `DEVOPS-1D PAYMENT_GATED_DEFERRED`, Prompt 21B-21D blocked, Prompt 22B conditional and Prompt 22C-22D blocked remain unchanged.

Independent Prompt 23B-QA cleared the source, exact-ledger, repository, role, privacy and cutover-gate reconciliation after one roadmap-contract correction. Prompt 23C may begin only from the merged/tagged QA baseline and does not clear Teacher cutover.

## Final gap decisions

| Candidate | Decision | Reason and next boundary |
|---|---|---|
| Teacher attendance scope | **Confirmed gap / critical defect** | Permission-only global class/section access; Prompt 23C first |
| Parent attendance and exam timetable | **Confirmed gap** | No Parent routes/APIs; Prompt 23D |
| Classwork | **Confirmed gap** | Homework exists but distinct Classwork does not; Prompt 23F |
| Submissions, feedback and resubmission | **Confirmed gap** | No models/routes/storage lifecycle; Prompt 23F |
| Private attachments | **Confirmed gap, storage approval blocked** | No private file architecture; Prompt 23F only after approval |
| Own-Teacher timetable | **Confirmed gap** | Timetable foundation exists but no own route/default; follow after 23C |
| Events/holidays/internal calendar | **Confirmed gap** | Notices/public posts are not an internal governed calendar; Prompt 23E |
| Parent leave/profile correction | **Partial / external evidence** | No Student leave/correction-request workflow; require school rule and source evidence |
| Admissions/CRM | **Confirmed gap, approval/evidence gated** | No CRM model; Prompt 23H only if used |
| Payroll/payslips/salary history/advance/exit settlement | **Confirmed gap, approval blocked** | No implementation; ambiguous source role and professional governance required before 23I |
| Transport/stops/vehicles/bus passes | **Confirmed gap, approval/evidence gated** | Prompt 23J only if day-one requirement confirmed |
| GPS | **Approval blocked / defer** | No live GPS without separate privacy/legal/provider approval |
| Consolidated/multi-exam/board analytics | **Partial** | Core exams/marks/report cards exist; formulas and comparative views belong in 23G |
| Discipline | **Defer** | No approved core requirement; sensitive support design needs separate owner |
| Cafeteria | **Defer** | No approved day-one requirement |
| Inventory/assets | **External evidence / defer** | Source existence/use unverified and no approved requirement |
| Appointments and complaints | **External evidence / defer** | No confirmed Schoolknot or Nalanda day-one workflow |
| Universal tamper-evident history | **Partial** | Many targeted append-only events exist; no universal cross-module ledger claim |
| Refunds | **External evidence / approval blocked** | Whole-receipt cancellation exists; refund state/provider/ledger rule unproven |
| Day Closer | **External evidence / defer** | Blank source route; Cash Book and Daily Collection are not treated as parity |
| Live gateway | **Deployment/provider approval blocked** | No provider, merchant, settlement or external environment |
| Native app parity | **Safe to defer** | Governed web/PWA is the target; physical certification remains later |
| Backup/restore migration evidence | **Partial / external evidence** | Nalanda v37 and isolated rehearsal exist; source dictionaries and production recovery proof do not |
| Bulk export/update | **Reject unrestricted; partial safe alternative implemented** | Keep purpose-specific preview/allowlists only |
| Schoolknot integrations | **External evidence** | Vendor inventory/data flows/offboarding required |
| Employee self-service | **Partial / external evidence** | Staff leave/attendance foundations exist; own payroll/profile parity unverified |
| Lesson-plan/classwork evidence | **Safe to defer / external evidence** | Lesson plans lack an approved requirement; Classwork proceeds only through 23F evidence |
