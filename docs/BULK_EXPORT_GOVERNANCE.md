# Bulk Export Governance

Status: **CLEARED SOFTWARE EVIDENCE / OPERATIONAL FLAGS REMAIN DEFAULT-OFF**

Evidence date: 2026-08-24

Machine contract: `tools/release-evidence/bulk-export-contracts.json`

## Contract

The repository contains 40 governed multi-record export surfaces and 20 additional export-like routes that are explicitly not bulk exports. Discovery is executable: `node tools/release-evidence/bulk-export-governance.mjs` walks only `app/api/**/route.ts`, excludes documentation, tests and generated trees, and fails if a future export-like API route lacks a classification.

Every governed bulk response is server-authorized, privacy-scoped, formula-neutralized when CSV is available, and returned with private/no-store headers. Query parameters cannot select arbitrary fields. The common sensitive-field exclusion is: password hashes, session tokens, provider credentials and secrets are never export fields.

The committed `bulk-exports` release flag is a real default-off, 0% runtime switch reserved for newly released bulk-export surfaces. It currently maps to **zero** routes. Existing cleared exports keep their established per-surface permissions and bounds; treating the flag as a global kill switch for historical exports would invent new semantics.

## Governed bulk exports

| Route | Method | Module / format | Required capability | Object/data scope | Bound | CSV formula safe | Audit | Flag | State |
|---|---|---|---|---|---|---:|---|---|---|
| `/api/academic-calendar/export` | GET | Academic Calendar / CSV/ICS | `EXPORT_ACADEMIC_CALENDAR` | Published or authorized calendar scope | Date-windowed calendar snapshot | YES | NOT RECORDED | None | CLEARED |
| `/api/academic-reports/runs/[runKey]/export` | POST | Academic Reporting / CSV/PDF | `ACADEMIC_REPORT_ACCESS` | Exact authorized immutable report run | Persisted report-run summary cardinality | YES | RECORDED | None | CLEARED |
| `/api/admissions/reports` | POST | Admissions CRM / CSV | `EXPORT_ADMISSION_REPORTS` | Authenticated internal Admissions report filters | Governed report filters and report-service bounds | YES | NOT RECORDED | None | CLEARED |
| `/api/attendance/staff/reports/export` | GET | Staff Attendance / CSV | `VIEW_STAFF_ATTENDANCE_REPORTS` | Authorized staff attendance date range | Validated from/to date window | YES | NOT RECORDED | None | CLEARED |
| `/api/attendance/students/reports/export` | GET | Student Attendance / CSV | `VIEW_STUDENT_ATTENDANCE_REPORTS` | Role and teacher-assignment scoped students | Validated date range plus resolved attendance scope | YES | NOT RECORDED | None | CLEARED |
| `/api/books/reports/export` | GET | Books Finance / CSV | `EXPORT_BOOK_REPORTS` | Authorized book report type and date range | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/budgets/reports/export` | GET | Budgets / CSV | `EXPORT_BUDGET_REPORTS` | Authorized academic-year budget metrics | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/cash-book/reports/export` | GET | Cash Book / CSV | `EXPORT_CASH_BOOK_REPORTS` | Authorized finance date range | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/certificates/reports/export` | GET | Certificates / CSV | `EXPORT_CERTIFICATE_REPORTS` | Authorized certificate register | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/class-x-documents/reports/export` | GET | Class X Documents / CSV | `EXPORT_CLASS_X_PACKAGE_REPORTS` | Authorized package date range | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/classwork/aggregates` | GET | Classwork / CSV | `EXPORT_CLASSWORK_AGGREGATES` | Resolved classwork actor and aggregate filters | Aggregate service bounded by authorized scope | YES | NOT RECORDED | None | CLEARED |
| `/api/cloud-backup/reports/export` | GET | Cloud Backup / CSV | `EXPORT_CLOUD_BACKUP_REPORTS` | Aggregate recovery readiness only | 100 | YES | NOT RECORDED | None | CLEARED |
| `/api/expenses/reports/export` | GET | Expenses / CSV | `EXPORT_EXPENSE_REPORTS` | Authorized finance date range | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/export/[type]` | GET | Students and Finance / CSV | `TYPE_SPECIFIC_EXPORT_PERMISSION` | Allowlisted students, payments, dues or collection type | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/fee-register-ocr/reports/export` | GET | Fee Register OCR / CSV | `EXPORT_FEE_REGISTER_OCR_REPORTS` | Authorized reviewed batch or aggregate filters | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/homework/reports/export` | GET | Homework / CSV | `EXPORT_HOMEWORK_REPORTS` | Administrative role plus homework-scope filters | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/id-cards/reports/export` | GET | Identity Cards / CSV | `EXPORT_ID_CARD_REPORTS` | Authorized identity-card register | Configured school card population | YES | NOT RECORDED | None | CLEARED |
| `/api/leave/staff/reports/export` | GET | Staff Leave / CSV | `VIEW_STAFF_LEAVE_REPORTS` | Authorized date range and optional staff filter | Validated date range | YES | NOT RECORDED | None | CLEARED |
| `/api/library/barcodes/export` | GET | Library / CSV | `EXPORT_LIBRARY_REPORTS` | Allowlisted barcode coverage report type | Configured copy population; recent events fixed at 30 | YES | NOT RECORDED | None | CLEARED |
| `/api/library/charges/reports/export` | GET | Library Finance / CSV | `EXPORT_LIBRARY_CHARGE_REPORTS` | Authorized charge report type and date range | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/library/circulation/reports/export` | GET | Library / CSV | `EXPORT_LIBRARY_CIRCULATION_REPORTS` | Allowlisted circulation report type | Requested days restricted to 0-90; configured member population | YES | NOT RECORDED | None | CLEARED |
| `/api/library/reports/export` | GET | Library / CSV | `EXPORT_LIBRARY_REPORTS` | Allowlisted library report type | Configured library population; events fixed at 100 | YES | NOT RECORDED | None | CLEARED |
| `/api/library/stock-verification/reports/export` | GET | Library / CSV | `EXPORT_LIBRARY_STOCK_REPORTS` | Authorized stock-verification snapshot | Governed stock-verification report-service bounds | YES | NOT RECORDED | None | CLEARED |
| `/api/marks/reports/export` | GET | Marks / CSV | `EXPORT_EXAM_REPORTS` | Resolved marks scope; broad Teacher Parent Viewer Accountant denied | Academic-year and exam-filtered marks scope | YES | NOT RECORDED | None | CLEARED |
| `/api/misc-income/reports/export` | GET | Miscellaneous Income / CSV | `EXPORT_MISC_INCOME_REPORTS` | Authorized finance date range | 10000 | YES | NOT RECORDED | None | CLEARED |
| `/api/notifications/reports/export` | GET | Notifications / CSV | `EXPORT_NOTIFICATION_REPORTS` | Authorized aggregate notification report | Fixed report metrics and service limits | YES | NOT RECORDED | None | CLEARED |
| `/api/operations/cafeteria/reports/export` | GET | Cafeteria / CSV | `OPTIONAL_OPERATIONS_ACTOR` | Role-scoped privacy-minimal serving roster | Governed optional-operations report bounds | YES | NOT RECORDED | `cafeteria-v1-5` | DEFAULT_OFF |
| `/api/operations/transport/reports/export` | GET | Transport / CSV | `OPTIONAL_OPERATIONS_ACTOR` | Role-scoped privacy-minimal transport roster | Governed optional-operations report bounds | YES | NOT RECORDED | `transport-v1-5` | DEFAULT_OFF |
| `/api/parent-meetings/reports/export` | GET | Parent Meetings / CSV | `PARENT_MEETING_REPORT_ACTOR` | Exact Principal or Super Admin report scope | Validated filters and meeting-report service bounds | YES | NOT RECORDED | `parent-meetings-v1-5` | DEFAULT_OFF |
| `/api/payroll/reports` | POST | Payroll Administration / CSV | `EXPORT_PAYROLL_REPORTS` | Authenticated internal leadership payroll aggregates | Validated report type and payroll-report bounds | YES | NOT RECORDED | None | CLEARED |
| `/api/report-cards/pdf-jobs/[jobKey]/download` | GET | Report Cards / PDF/ZIP | `EXPORT_REPORT_CARD_REPORTS` | Exact actor-owned generation job plus access token | 200 | N/A | RECORDED | None | CLEARED |
| `/api/report-cards/reports/export` | GET | Report Cards / CSV | `EXPORT_REPORT_CARD_REPORTS` | Authorized academic year, class, section and status filters | Governed report-card report-service bounds | YES | NOT RECORDED | None | CLEARED |
| `/api/sms-email/reports/export` | GET | SMS and Email / CSV | `EXPORT_SMS_EMAIL_REPORTS` | Authorized privacy-minimal delivery aggregates | Fixed aggregate report set | YES | NOT RECORDED | None | CLEARED |
| `/api/substitutes/reports/export` | GET | Substitutes / CSV | `VIEW_SUBSTITUTE_REPORTS` | Authorized substitute-coverage date range | Validated from/to date window | YES | NOT RECORDED | None | CLEARED |
| `/api/support/reports/export` | GET | Support / CSV | `EXPORT_SUPPORT_REPORTS` | Authorized privacy-minimal aggregate metrics | Fixed aggregate metric and category set | YES | RECORDED | None | CLEARED |
| `/api/teacher-analytics/reports/export` | GET | Teacher Analytics / CSV | `EXPORT_TEACHER_ANALYTICS_REPORTS` | Authorized optional review-cycle aggregate | Governed analytics report-service bounds | YES | NOT RECORDED | None | CLEARED |
| `/api/timetable/export/[type]` | GET | Timetable / CSV | `PRINT_TIMETABLE` | Exact draft plus allowlisted class, teacher, workload or free-period type | Draft timetable cardinality and allowlisted type | YES | NOT RECORDED | None | CLEARED |
| `/api/udise/export` | GET | UDISE / CSV | `EXPORT_UDISE_CHECKLIST` | Authorized checklist for configured academic year | Fixed checklist section and issue set | YES | NOT RECORDED | None | CLEARED |
| `/api/website-admin/reports/export` | GET | Website Administration / CSV | `EXPORT_PUBLIC_WEBSITE_REPORTS` | Authorized aggregate readiness report | Fixed readiness metric set | YES | NOT RECORDED | None | CLEARED |
| `/api/whatsapp/reports/export` | GET | WhatsApp / CSV | `EXPORT_WHATSAPP_REPORTS` | Authorized privacy-minimal delivery aggregates | Fixed aggregate report set | YES | NOT RECORDED | None | CLEARED |

“Not recorded” means the export has permission enforcement and private response controls but no separate export-event record. It is an explicit governance classification, not a claim that an audit entry exists.

## Explicitly not bulk exports

| Route | Method | Module / type | Why it is not bulk | Feature dependency | State |
|---|---|---|---|---|---|
| `/api/admissions/documents/[publicKey]` | GET | Admissions CRM / DOCUMENT | Single authorized document download | None | NOT A BULK EXPORT |
| `/api/backup` | GET | Backup and Restore / BACKUP | Governed recovery artifact, not a business-data export | None | NOT A BULK EXPORT |
| `/api/classwork/attachments/[publicKey]` | GET | Classwork / DOCUMENT | Single attachment with actor and object scope | None | NOT A BULK EXPORT |
| `/api/event-media/assets/[assetKey]/file` | GET | Event Media / MEDIA | Single governed event asset | None | NOT A BULK EXPORT |
| `/api/event-media/public/assets/[assetKey]` | GET | Event Media / MEDIA | Single public derivative asset | None | NOT A BULK EXPORT |
| `/api/import/guardians/template` | GET | Imports / TEMPLATE | Blank template with no school rows | None | NOT A BULK EXPORT |
| `/api/import/staff/template` | GET | Imports / TEMPLATE | Blank template with no school rows | None | NOT A BULK EXPORT |
| `/api/library/import/template/[kind]` | GET | Library / TEMPLATE | Blank allowlisted import template | None | NOT A BULK EXPORT |
| `/api/marks/import/template` | GET | Marks / TEMPLATE | Blank governed marks template | None | NOT A BULK EXPORT |
| `/api/my-payroll/payslips/[reference]/download` | GET | Payroll ESS / DOCUMENT | Single self-owned payslip | `payroll-ess-pilot` | NOT A BULK EXPORT |
| `/api/my-payslip-requests/documents/[documentKey]/download` | GET | Payslip Requests / DOCUMENT | Single self-owned request document | None | NOT A BULK EXPORT |
| `/api/onboarding/batches/[publicKey]/error-workbook` | GET | Onboarding / ERROR_WORKBOOK | Single batch validation-error workbook | None | NOT A BULK EXPORT |
| `/api/onboarding/templates` | GET | Onboarding / TEMPLATE | Blank allowlisted onboarding template | None | NOT A BULK EXPORT |
| `/api/parent/event-media/assets/[assetKey]` | GET | Event Media / MEDIA | Single linked-child governed asset | None | NOT A BULK EXPORT |
| `/api/parent/report-cards/download` | GET | Report Cards / DOCUMENT | Single linked-child issued report | None | NOT A BULK EXPORT |
| `/api/payroll/payslips/[reference]/download` | GET | Payroll / DOCUMENT | Single authorized payslip | None | NOT A BULK EXPORT |
| `/api/payslip-requests/documents/[documentKey]/source` | GET | Payslip Requests / DOCUMENT | Single audit-governed source document | None | NOT A BULK EXPORT |
| `/api/public/admissions/application/documents/[publicKey]` | GET | Public Admissions / DOCUMENT | Single invitation-token scoped document | `public-admissions-form` | NOT A BULK EXPORT |
| `/api/report-cards/publication/preview` | POST | Report Cards / PDF | Single report preview; first authorized report only | None | NOT A BULK EXPORT |
| `/api/support/[requestKey]/export` | GET | Support / DOCUMENT | Single actor-scoped case evidence record | None | NOT A BULK EXPORT |

## Verification rules

The machine validator fails on unclassified or stale discovered routes, duplicate IDs or sources, missing server authorization evidence, missing private/no-store evidence, missing CSV-neutralisation evidence, client-controlled field selection, stale totals, or an inconsistent `bulk-exports` mapping count. Tests additionally exercise spreadsheet-formula sentinels against representative finance, report-card, certificate and communications CSV serializers.

This governance record does not activate any export, provider or staged module. Transport, Cafeteria and Parent Meetings remain governed by their own committed default-off operational flags.
