# Schoolknot Management Reconciliation Independent QA Report

Status: **independent Management-only QA**  
QA date: 22 July 2026  
Scope: Prompt 23B-M-QA only  
Final Prompt 23B status: **incomplete; Parent, Teacher and Principal audits remain pending**

## Exact result

`MANAGEMENT_RECONCILIATION_CLEARED`

This result clears the corrected **Management-only reconciliation**. It does not clear final Prompt 23B, authorise a gap module, or approve any Parent-, Teacher- or Principal-dependent workflow.

## 1. Defects found and corrected

Independent QA found no runtime defect and no missing implementation to fix in this phase. It found **13 documentation-quality defects**: 12 replacement classifications were stronger than the available evidence supported, and the should-not-copy register did not expose Schoolknot evidence as its own column.

| Defect | Pre-QA claim | Independent evidence | Correction |
|---|---|---|---|
| Dashboard | `NALANDA_STRONGER` | `/dashboard` is permission-filtered but has no Schoolknot-equivalent class/stage strength, gender or RTE summary | `PARTIALLY_REPLACED` |
| Notification compose | `NALANDA_STRONGER` | Nalanda has safer campaign governance, but Schoolknot send effects and Parent/Teacher behavior were not tested and media is absent | `PARTIALLY_REPLACED` |
| Add Student | `NALANDA_STRONGER` | Nalanda is more data-minimised, but material Schoolknot fields and write behavior were unverified | `PARTIALLY_REPLACED` |
| Add Teacher/Employee | `NALANDA_STRONGER` | Nalanda intentionally lacks payroll/statutory depth; source writes were untested | `PARTIALLY_REPLACED` |
| Exam analytics | `NALANDA_STRONGER` | Nalanda has safe aggregate reports, but the source Student-level purpose/export and board need are unproved | `PARTIALLY_REPLACED` |
| Old Fee Reports | `FULLY_REPLACED` | Local reports exist, but exact fields, formulas, date/mode behavior and export are unverified | `PARTIALLY_REPLACED` |
| HR daily attendance | `FULLY_REPLACED` | Management reports exist; Staff/Teacher own-view parity awaits authenticated role evidence | `PARTIALLY_REPLACED` |
| Subjects | `FULLY_REPLACED` | Core exists; status/import/edit effects and export parity are unverified | `PARTIALLY_REPLACED` |
| Classes | `FULLY_REPLACED` | Core class/section foundation exists; coordinator/status semantics are partial | `PARTIALLY_REPLACED` |
| Schoolknot Library/books | `NALANDA_STRONGER` | Nalanda has extensive local capability, but the Schoolknot module was inaccessible | `NEEDS_MORE_EVIDENCE` |
| Schoolknot backup/restore | `NALANDA_STRONGER` | Nalanda has a governed recovery engine, but no Schoolknot recovery/ownership/export evidence was visible | `NEEDS_MORE_EVIDENCE` |
| Schoolknot expenses/budgets/cash book | `NALANDA_STRONGER` | Nalanda has mature local modules, but the Schoolknot purpose/data/export was inaccessible | `NEEDS_MORE_EVIDENCE` |
| Should-not-copy evidence | Evidence was implicit in “Observed pattern” | QA required an explicit status/menu-path evidence statement for every decision | Added a dedicated `Schoolknot evidence` column to every row |

The remaining `FULLY_REPLACED` and `NALANDA_STRONGER` rows were individually reviewed. They are limited to observed purposes for which concrete local workflow/governance evidence exists; they do not claim untested Schoolknot writes or exports.

## 2. Management audit source result

The connected Notion page **Schoolknot Multi-Role Replacement Audit** was fetched read-only. Only the completed Management section was treated as evidence.

| Check | Result |
|---|---|
| Role and completion | Authenticated `MANAGEMENT`; complete within the read-only boundary |
| Completion date | 21 July 2026 |
| Top-level modules | 15: Dashboard, Communication, Academics, Attendance, Students, Staff, Exams, Finance, Admissions, HR, Downloads, Transport, Settings, Discipline, Cafeteria |
| Desktop evidence | 119 structural page observations |
| Mobile evidence | 39 representative checks at exact 390 × 844 |
| Mobile finding | Management sidebar hidden; toggle exposed only Logout; dense tables remained desktop-width; some forms became extremely long |
| Blank/broken | Day Closer blank; Admissions Dynamic Report unreliable; repeated runtime warnings/errors recorded |
| Inaccessible/unverified | Standalone Guardians, Library/books, inventory/assets, backup/restore, audit-history UI, integrations, branch administration, exact expenses/budgets/cash book, refund, checkout, GPS, biometric actions and unexecuted write/export effects |
| No-write boundary | No save, send, approval, payment, refund, delete, upload, export, download, print or other mutation was executed |
| Privacy | Structural labels only; no real names, contacts, identifiers, marks, fees, balances, images or credentials were retained |
| Other roles | Parent, Teacher and Principal template coverage remains pending and is not authenticated evidence |

Schoolknot evidence continues to use only: `VERIFIED_VISIBLE_WORKFLOW`, `VERIFIED_VISIBLE_FORM_ONLY`, `VERIFIED_VISIBLE_REPORT_ONLY`, `BLANK_OR_BROKEN`, `INACCESSIBLE`, `NEEDS_WRITE_TEST`, `NEEDS_EXPORT_EVIDENCE`, and `NEEDS_OTHER_ROLE_EVIDENCE`.

## 3. Independent repository evidence result

The implementation was re-read from `app/`, `app/api/`, `prisma/schema.prisma`, `lib/permissions.ts`, `lib/access-rules.ts`, workflow helpers and focused tests. A page name alone was not accepted as replacement evidence.

| Capability group | Concrete page/API/model/permission evidence | QA result |
|---|---|---|
| Dashboard and navigation | `/dashboard`; `lib/dashboard.ts`; `VIEW_DASHBOARD`; permission-filtered `lib/access-rules.ts` | Real operational dashboard, but only partial Schoolknot dashboard parity |
| Students, Guardians and lifecycle | `/students*`, `/guardians*`, `/students/lifecycle*`, `/students/progression*`; `/api/students*`; `Student`, `Guardian`, `StudentGuardian`, `AcademicYearEnrollment`, `StudentLifecycleEvent`, `StudentProgressionDecision`; separate view/create/edit/manage permissions | Strong governed local foundation; Add/Manage field parity remains partial |
| Attendance and leave | `/attendance/students*`, `/attendance/staff*`, `/leave/staff*`; attendance/leave APIs; session/record/request models; view/manage/submit/lock/approve/report permissions | Manual Management workflows are implemented; consolidated reports, Student leave and other-role experience remain gaps |
| Academics and portals | `/homework*`, `/exams*`, `/marks*`, `/report-cards*`, `/teacher/*`, `/parent/*`; assignment, exam, mark and version/event models | Publishing, governed marks and report cards exist; Student submission/files and cross-role presentation remain held |
| Timetable and substitutions | `/timetable*`, `/substitutes*`; `/api/timetable/*`, `/api/substitutes/*`; timetable and substitute models/permissions | Full local builder/conflict/history foundation; transport remains unrelated and missing |
| Core finance | `/payments*`, `/daily-collection`, `/ledger*`, `/pending-dues`, `/receipt-audit`, `/misc-income*`; guarded APIs; `Payment`, `PaymentAudit`, `ReceiptNote`, `FeeStructure` | Strong offline collection/reconciliation; refund, gateway and Schoolknot Day Closer equivalence remain unproved |
| Expenses, budgets and Cash Book | `/expenses*`, `/budgets*`, `/cash-book*`; guarded APIs; expense/budget/cash models and workflow permissions | Mature local capability; not payroll and not comparative proof of inaccessible Schoolknot modules |
| Library and documents | `/library*`, `/books*`, `/certificates*`, `/class-x-documents*`, `/id-cards*`; extensive models, print/report/export and workflow permissions | Strong local capability; only observed TC/document purposes support comparison, not inaccessible Schoolknot Library parity |
| Communications | `/notices`, `/notifications*`, `/whatsapp*`, `/sms-email*`; consent/template/batch/delivery/event models and separate permissions | Governed in-app and MOCK-safe provider foundations; live providers remain disabled and cross-role behavior pending |
| Roles and security | `/roles`, `/users`, `/change-password`; role/user APIs; `RolePermission`, `UserAudit`; page/API permission guards | Server-enforced least privilege and audited credential controls are code-proved advantages |
| Public/PWA/AI/OCR/backup | public and `/website-admin*`, `/install-app`, `/settings/pwa`, `/ai-assistant*`, `/fee-register-ocr*`, `/cloud-backup*`; dedicated safety/version/event models | Implemented bounded foundations; public admissions is not CRM, PWA is not native, OCR posting/live providers remain blocked, Schoolknot-hosted backup parity unproved |
| System health/imports/exports | dashboard health; `/import-export`, `/import-verification`; fixed permission-gated export APIs; import/audit models | Purpose-limited, preview-first and formula-safe controls exist; unrestricted dynamic export/update is intentionally rejected |

Repository inventory at QA: **274 page routes, 376 API routes, 160 Prisma models and backup format version 37**. Representative API checks confirmed server permission guards on Students, attendance, marks exports, payments, roles, timetable, Library, expenses and Cash Book.

## 4. Replacement classification result

After correction, the workflow table contains:

- 2 `FULLY_REPLACED` rows, limited to observed manual Student attendance marking and core fee-head setup.
- 11 `NALANDA_STRONGER` rows, limited to code-proved governance/security advantages such as progression history, governed marks/receipts, role enforcement, timetable conflict handling and password safety.
- 36 `PARTIALLY_REPLACED` rows.
- 23 `MISSING` rows.
- 2 `DEPLOYMENT_ONLY` rows.
- 4 `BLOCKED_APPROVAL` rows.
- 6 `SHOULD_NOT_COPY` rows.
- 12 `NEEDS_MORE_EVIDENCE` rows.

These are row counts, not module counts. Similar labels across products were not treated as equivalence.

## 5. Management gap result

| Area | Independent result |
|---|---|
| Admissions/enquiries | Missing CRM; public admissions information is not enquiry/follow-up/capacity/conversion workflow |
| Payroll/payslips/salary/advance | Missing; Staff master and Expenses/Cash Book are not payroll; future work remains legal/accounting/privacy-gated |
| Resignation/exit | Missing; needs approval, retention and cross-role evidence |
| Events/holidays/calendar/tasks | Internal workflow missing; notices/public posts are not an operational calendar |
| Transport/routes/vehicles/readings/bus pass | Missing; timetable and ID cards are not replacements |
| GPS/tracking | Not implemented and not visible in the source; separate privacy/legal/vendor approval required |
| Student submissions/attachments/classwork | Missing as interactive Student workflow; homework publishing is not submission |
| Consolidated examinations | Partial raw-mark/report-card reporting exists; multiple-exam comparison and board analytics are missing |
| Discipline/cafeteria/general inventory | Missing or unproved business need; optional and policy-gated |
| Showcase | Governed public content may cover selected approved achievements; no separate module approved |
| App/Staff usage analytics | Individual surveillance/ranking rejected; aggregate support metrics only |
| Refund | Missing; cancellation/restore is not a refund; provider/accounting/legal/reconciliation approval required |
| Day Closer | Source page was blank; Daily Collection and Cash Book are distinct and cannot prove equivalence |
| School settings/integrations | Partial curated settings and disabled provider foundations; no provider-specific parity claim |
| Schoolknot backup/restore | Inaccessible; Nalanda recovery capability is real, but source ownership/export/recovery parity is unknown |
| Bulk exports/updates | Fixed allowlisted exports/imports exist; unrestricted arbitrary-field variants are intentionally rejected |
| Mobile/app | Nalanda PWA is not a native Schoolknot app; physical-device/native parity awaits separate evidence; Schoolknot mobile navigation defects must not be copied |

## 6. Should-not-copy result

Every rejection/redesign row now records: an explicit Schoolknot evidence status and safe menu/context, the risk, Nalanda policy, safer alternative and final decision. Evidence is deliberately qualified where the underlying page was blank, inaccessible, report-only or form-only. The register rejects predictable/DOB-derived passwords, unrestricted bulk edits/exports, hard deletion, recipient/usage surveillance, unfair marks-only employment decisions, unnecessary sensitive fields, broad location, uncontrolled sending/actions, desktop-only mobile behavior, unstable pages, provider lock-in and purposeless features.

No unsafe feature is recommended without preview, least privilege, consent/approval, append-only audit, retention/reversal, fixed exports, provider readiness and role-isolation safeguards.

## 7. Provisional implementation-wave result

Waves M1–M6 remain proposals only:

- M1: local calendar/event and exam-report definition candidates; cross-role visibility still required.
- M2: HR/payroll planning only; Prompt 22/26, labour, accounting, privacy and segregation-of-duty gates apply.
- M3: admissions only after purpose, minimisation, consent, dedupe, capacity and authorised migration decisions.
- M4: transport only after child-safety, privacy, finance, Parent/Principal and source-export decisions; GPS remains separate.
- M5: submissions only after Parent/Teacher/Principal evidence and private storage/moderation/retention design.
- M6: discipline, cafeteria, showcase, assets, adoption reporting, classwork and board analytics remain optional/deferred.

No wave finalises cross-role priority, creates a model, or authorises Prompt 21B–21D or Prompt 22B.

## 8. Cross-role hold result

### Await Parent audit

Student submissions and attachments; Parent corrections; communication/preferences; Student leave; event/calendar visibility; transport/bus-pass visibility; timetable usability; report-card presentation; refund visibility; mobile/PWA priorities.

### Await Teacher audit

Homework/assignment/classwork authoring and review; attendance entry/correction; marks and report-card workflow; timetable/substitution usability; Staff leave/resignation own-view; communication behavior; mobile priorities. Individual Staff ranking remains rejected regardless of evidence.

### Await Principal audit

Approval and visibility boundaries for exams, marks, report cards, leave, events, communication, discipline, admissions, transport, settings, finance/payroll, bulk operations, consolidated reports and publication/correction authority.

## 9. No-implementation result

Pre- and post-QA checks use the established checkpoint:

| Boundary | Result |
|---|---|
| Prisma schema | SHA-256 `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`; 160 models; unchanged |
| Migrations | 40 migration directories plus `migration_lock.toml` = 41 inventory entries; unchanged |
| Routes/APIs | 274 pages; 376 APIs; unchanged |
| Backup format | Version 37; unchanged |
| Operational SQLite | SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`; unchanged |
| Business baseline | 8 Students; 8 active enrollments; 19 active non-cancelled Payments; INR 99,100 collected; unchanged |
| Schoolknot material | No export/import/download, personal data, screenshot or credential stored |
| Providers/deployment | No live provider, DNS, deploy or external send/payment/location action |
| Runtime implementation | No Prisma model/migration/page/API/helper/business module added or changed |
| Operational data | No Student, Staff, finance or other school record changed |

## 10. Verification commands

| Command | Result |
|---|---|
| `pnpm.cmd routes:list` | Passed; 274 page routes and 376 API routes |
| `pnpm.cmd lifecycle:backfill` | Dry run passed; 8 active Students scanned, 8 already enrolled, 0 missing, 0 created, no data changed |
| `pnpm.cmd typecheck` | Passed |
| `pnpm.cmd test` | Passed; 1,437 tests across 158 files, including 18 focused Management reconciliation tests |
| `pnpm.cmd build` | Passed with the established bounded 4 GB heap; compiled successfully and generated 211/211 static pages in 411.8 seconds |
| `pnpm.cmd backup` | Passed; version 37 `nalanda-fee-control-backup-2026-07-22-02-29.json` |

Final backup SHA-256 is `BBF5C9BB509FCEDDDBA9780DEC9B7297D833CFC76E0376687EA4C423FEA49644`. It contains zero `passwordHash` keys. Post-backup schema, migration, operational database and business-baseline checks match section 9 exactly.

## 11. Final boundary

The corrected Management reconciliation is fully cleared for its **Management-only, observational and provisional** purpose. Final Prompt 23B must still wait for authenticated Parent, Teacher and Principal audits and a later cross-role consolidation. Prompt 21B–21D and Prompt 22B remain blocked.
