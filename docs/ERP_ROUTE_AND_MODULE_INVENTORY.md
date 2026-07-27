# ERP Route and Module Inventory

Audit phase: Prompt 14A  
Workspace: repository root of the audited clone.
Generated with source review plus `pnpm.cmd routes:list`.

## Summary

- Page routes found: 52.
- API routes found: 62.
- Main app navigation is permission-filtered through `lib/access-rules.ts`.
- Page/API security is normally enforced server-side through `requirePermission` and `requireApiPermission`.
- This document is an audit snapshot, not a redesign implementation.

## Status and Risk Legend

- **Stable:** feature has completed implementation and QA evidence in prior phases.
- **Needs QA:** route exists and works by source review, but should be included in future browser regression.
- **Needs UI polish:** workflow exists but the surface should be improved during Phase 14 UI work.
- **Placeholder:** intentionally limited start page or foundation surface.
- **Future:** not currently implemented as a route.
- Mobile risk: **Low**, **Medium**, or **High** based on nav depth, table density, form length, and likely operator use on phones.

## Page Route Inventory

| Route | Module | Purpose | Allowed roles/permissions if known | Status | Mobile risk | Notes |
|---|---|---|---|---|---|---|
| `/` | Dashboard | Fee summary, receipt warnings, top dues, recent payments, backup panel for permitted users | `VIEW_DASHBOARD`; backup panel via `RUN_BACKUP` | Needs UI polish | Medium | Working but not yet premium; lacks attendance/leave/substitute summary cards. |
| `/login` | Authentication | User sign-in | Public when not signed in | Stable | Low | Redirects signed-in users by role. |
| `/setup` | First-run setup | First active Director and school basics | First-run only; `FIRST_RUN_SETUP` API path | Stable | Medium | Critical path, should stay simple. |
| `/change-password` | Account | Current user password change | Signed-in users | Stable | Low | Small form. |
| `/unauthorized` | Access control | Permission failure page | Signed-in users without permission | Stable | Low | Needs consistent friendly copy in future UI pass. |
| `/students` | Students | Search/list Student Master | `VIEW_STUDENTS` | Stable, needs UI polish | High | Dense table and filters; important mobile operator route. |
| `/students/new` | Students | Add Student | `CREATE_STUDENTS` | Stable, needs UI polish | High | Long form; candidate for step-like/mobile grouping later. |
| `/students/[id]/edit` | Students | Edit Student | `EDIT_STUDENTS` | Stable, needs UI polish | High | Same long-form risk as add student. |
| `/guardians` | Parents/Guardians | Guardian list, sibling links entry point | `VIEW_GUARDIANS`; management via `MANAGE_GUARDIANS` | Stable, needs UI polish | Medium | Import action shown by `IMPORT_GUARDIANS`. |
| `/guardians/[id]` | Parents/Guardians | Guardian detail, linked students, parent account actions | `VIEW_GUARDIANS`; management via `MANAGE_GUARDIANS` | Stable | Medium | Useful but could benefit from clearer relationship cards. |
| `/parent` | Parent Portal | Read-only parent dashboard for linked children, dues, receipts, notices | `VIEW_PARENT_PLACEHOLDER` plus parent scoping | Stable | Medium | Mobile important; parent shell is simpler than staff shell. |
| `/notices` | Parent Notices | Staff notice list/create/edit/publish/archive | `VIEW_NOTICES`, `MANAGE_NOTICES`, `PUBLISH_NOTICES` | Stable, needs UI polish | Medium | Cards already more mobile-friendly than heavy tables. |
| `/staff` | Staff/Teachers | Staff master list and staff profile entry | `VIEW_STAFF`; management via `MANAGE_STAFF` | Stable, needs UI polish | High | Table and filters should be reviewed on mobile. |
| `/staff/[id]` | Staff/Teachers | Staff profile detail, safe user/timetable links | `VIEW_STAFF`; management via `MANAGE_STAFF` | Stable | Medium | Important identity-linking route. |
| `/teacher` | Teacher Portal | Safe teacher start page and permitted shortcuts | `VIEW_TEACHER_PLACEHOLDER` | Placeholder/stable | Low | Intentionally limited; no full teacher module yet. |
| `/attendance/students` | Student Attendance | Manual daily class attendance entry | `VIEW_STUDENT_ATTENDANCE`; save/submit/lock via action permissions | Stable, needs UI polish | High | Wide roster table, action bar, and status controls need mobile treatment. |
| `/attendance/students/reports` | Student Attendance Reports | Date/class attendance reports and CSV export | `VIEW_STUDENT_ATTENDANCE_REPORTS` | Stable, needs UI polish | High | Report tables can overflow on phones. |
| `/attendance/staff` | Staff Attendance | Manual daily active-staff attendance entry | `VIEW_STAFF_ATTENDANCE`; save/submit/lock via action permissions | Stable, needs UI polish | High | Wide table with time and numeric inputs. |
| `/attendance/staff/reports` | Staff Attendance Reports | Official submitted/locked staff attendance reports and CSV | `VIEW_STAFF_ATTENDANCE_REPORTS` | Stable, needs UI polish | High | Dense report tables. |
| `/leave/staff` | Staff Leave | Leave requests list; teachers see own linked profile only | `VIEW_STAFF_LEAVE`; create via `APPLY_STAFF_LEAVE` or management | Stable, needs UI polish | Medium | Filter panel wraps; needs mobile spacing review. |
| `/leave/staff/new` | Staff Leave | New leave draft or submit for approval | `APPLY_STAFF_LEAVE` or `MANAGE_STAFF_LEAVE` | Stable | Medium | Form is manageable; needs clearer small-screen actions. |
| `/leave/staff/[id]` | Staff Leave | View/edit/submit/approve/reject/cancel leave | `VIEW_STAFF_LEAVE` plus own/management checks | Stable | Medium | Workflow-heavy route; status and reason areas need polish. |
| `/leave/staff/reports` | Staff Leave Reports | Pending/approved/type/staff reports and CSV | `VIEW_STAFF_LEAVE_REPORTS` | Stable, needs UI polish | Medium | Tables should use reusable report cards later. |
| `/substitutes` | Substitutes | Substitute assignment list; teachers see own duties | `VIEW_SUBSTITUTES` | Stable, needs UI polish | Medium | Dense workflow data. |
| `/substitutes/new` | Substitutes | Manual substitute coverage creation/assignment | `MANAGE_SUBSTITUTES` and related workflow permissions | Stable | Medium | Form needs clearer grouping in design pass. |
| `/substitutes/[id]` | Substitutes | Confirm, complete, cancel, or review substitute duty | `VIEW_SUBSTITUTES` plus workflow permissions | Stable | Medium | Workflow route. |
| `/substitutes/planner` | Substitute Planner | Review approved leave, staff absence, and timetable coverage gaps | `MANAGE_SUBSTITUTES` | Stable, needs UI polish | High | High information density; important Phase 14 candidate. |
| `/substitutes/reports` | Substitute Reports | Coverage/workload/pending reports and CSV | `VIEW_SUBSTITUTE_REPORTS` | Stable, needs UI polish | Medium | Report-table standardization needed. |
| `/payments` | Payments | Payment list/export and receipt print links | `VIEW_PAYMENTS`; export via `EXPORT_PAYMENTS` | Stable, needs UI polish | High | Finance table is central and dense. |
| `/payments/new` | Payments | Manual fee receipt entry, split payment support | `CREATE_PAYMENTS` | Stable, needs UI polish | High | Critical operator form; needs premium mobile layout later. |
| `/payments/[id]/edit` | Payments | Immutable correction plus whole-receipt cancel/restore | `CORRECT_FINAL_RECEIPT` for correction; `CANCEL_FINAL_RECEIPT` for cancellation; Super Admin/Director/Accountant default | Stable | Medium | Non-financial correction appends an audit version; financial correction cancels/reissues a linked receipt. Reason, version, accessible dialog, transaction, leadership notification and locked-day protection are mandatory. |
| `/receipts/[receiptNo]/print` | Receipts | A5/A4 grouped receipt print view | `PRINT_RECEIPTS` or parent-owned receipt scoping | Stable | Low | Print routes should stay white-background and simple. |
| `/pending-dues` | Dues/Reports | Due position, filters, purpose-limited CSV export | `VIEW_PENDING_DUES`; reminders via `COMMUNICATE_PARENT` | Stable, needs UI polish | High | Accountant receives no Parent/contact/note/reminder fields; Viewer/Auditor is aggregate-only. |
| `/daily-collection` | Reports | Date/range collection report and print | `VIEW_DAILY_COLLECTION`; print via `PRINT_REPORTS` | Stable, needs UI polish | Medium | Candidate for finance summary cards/charts later. |
| `/ledger` | Student Ledger | Purpose-limited Student fee ledger search | `VIEW_LEDGER`; Viewer/Auditor is non-delegably denied | Stable, needs UI polish | Medium | Accountant search excludes Parent/contact fields and returns explicit finance allowlists. |
| `/ledger/print` | Student Ledger | Printable ledger | `PRINT_LEDGER` | Stable | Low | Print route. |
| `/receipt-audit` | Receipt/Payment Audit | Missing/duplicate/split/note-drift/cancel/reference checks | `VIEW_RECEIPT_AUDIT`; final cancellation requires `CANCEL_FINAL_RECEIPT` | Stable, needs UI polish | Medium | Payment components are authoritative; mixed component state or ReceiptNote disagreement fails closed. Successful Accountant action is audited and notifies active Directors/Super Admins. |
| `/import-export` | Import/Export/Backup | Student, guardian, staff, payment imports; exports; backup/restore | `VIEW_IMPORT_EXPORT` plus section permissions | Stable, needs UI polish | High | Very long multi-panel page; needs accordion/section design later. |
| `/import-verification` | Import Verification | Import batch history and go-live checklist | `VIEW_IMPORT_VERIFICATION`; Accountant has payment-only path | Stable | Medium | Evidence-heavy table. |
| `/import-verification/[id]` | Import Verification | Saved batch detail and reconciliation evidence | Same access helper as import verification | Stable | Medium | Should retain evidence-first layout. |
| `/pilot-acceptance` | Pilot Acceptance | Pilot sign-off, reconciliation, and evidence summary | `RUN_PILOT_ACCEPTANCE` | Stable | Medium | Planning/evidence page, not daily mobile-heavy. |
| `/settings` | School/Fee Settings | School profile, fee structures, health/readiness panels | `VIEW_SETTINGS`; changes via `MANAGE_SCHOOL_SETTINGS` | Stable, needs UI polish | High | Forms and health panels need clearer grouping. |
| `/users` | Users | User create/manage/reset password | `VIEW_USERS`; changes via `MANAGE_USERS`, `RESET_USER_PASSWORDS` | Stable | High | Role and password management panels are dense. |
| `/roles` | Roles | Role permission matrix | `MANAGE_ROLE_PERMISSIONS`; Super Admin always permitted | Stable, needs UI polish | High | Matrix has intentional wide overflow; future UX should improve scanning. |
| `/timetable` | Timetable | Timetable readiness overview and next-step links | `VIEW_TIMETABLE` | Stable, needs UI polish | Medium | Overview cards could be clearer. |
| `/timetable/teachers` | Timetable | Timetable teacher master | `MANAGE_TIMETABLE_MASTER` | Stable | Medium | Master-data form/table. |
| `/timetable/subjects` | Timetable | Subject master | `MANAGE_TIMETABLE_MASTER` | Stable | Medium | Master-data form/table. |
| `/timetable/classes` | Timetable | Timetable class sections | `MANAGE_TIMETABLE_MASTER` | Stable | Medium | Master-data form/table. |
| `/timetable/assignments` | Timetable | Teacher/subject/class workload allocation | `MANAGE_TIMETABLE_ASSIGNMENTS` | Stable, needs UI polish | High | Workload table can be wide. |
| `/timetable/settings` | Timetable | Period templates, unavailable periods, fixed periods | `MANAGE_TIMETABLE_MASTER` | Stable, needs UI polish | High | Rule tables and forms are dense. |
| `/timetable/builder` | Timetable Builder | Manual draft builder with conflict validation | `MANAGE_TIMETABLE_BUILDER` | Stable, needs UI polish | High | Grid-style editor is complex on phones. |
| `/timetable/generate` | Timetable Generator | Deterministic timetable generation preview/save | `RUN_TIMETABLE_GENERATOR` | Stable, needs UI polish | High | Dense controls/results; mobile should be reviewed carefully. |
| `/timetable/print` | Timetable Print/Export | Print class/teacher timetable and CSV export | `PRINT_TIMETABLE` | Stable | Medium | Print layout exists; selection UI still needs responsive review. |

## Backup and Restore Flows

There is no separate browser page named `/backup` or `/restore`. Backup and restore are exposed inside `/import-export`, and API routes exist at `/api/backup` and `/api/restore`.

Current known backup format: version 12. It includes the fee ERP, guardians/notices, staff, attendance, staff leave, substitutes, timetable data, role matrix rows, and safe user metadata. It still does not restore the `SchoolSettings` singleton.

## API Route Groups

| API group | Routes | Purpose |
|---|---|---|
| Authentication | `/api/auth/login`, `/api/auth/logout`, `/api/auth/change-password`, `/api/setup` | Sign-in, logout, password change, first-run setup. |
| Dashboard/reports | `/api/dashboard`, `/api/pending-dues`, `/api/ledger`, `/api/reports/collection`, `/api/export/[type]` | Dashboard data, dues, ledger, collection, CSV exports. |
| Students/payments | `/api/students`, `/api/students/[id]`, `/api/students/by-admission/[admissionNo]`, `/api/payments`, `/api/payments/[id]`, `/api/payments/[id]/restore` | Student and payment CRUD/workflow APIs. |
| Parents/guardians/notices | `/api/guardians*`, `/api/parent/dashboard`, `/api/notices*` | Guardian links, parent portal data, notices. |
| Attendance/leave/substitutes | `/api/attendance/*`, `/api/leave/staff*`, `/api/substitutes*` | Manual attendance, reports, leave workflow, substitute workflow. |
| Imports and pilot | `/api/import/*`, `/api/import-verification/checklist`, `/api/pilot-acceptance/reconciliation` | Preview-first imports, saved verification, pilot reconciliation. |
| Timetable | `/api/timetable/*` | Master data, drafts, entries, generator, export. |
| Admin/system | `/api/users*`, `/api/roles/permissions*`, `/api/fee-structures`, `/api/school-settings`, `/api/backup`, `/api/restore` | User/role/settings/backup/restore administration. |

## Navigation Risks Found

- The desktop sidebar can collapse, but the mobile sidebar becomes a full-width block above content.
- A highly privileged role may see more than 25 navigation links before page content on mobile.
- Several related destinations are separate top-level nav items instead of grouped module menus.
- Timetable subnav and report subnav add another horizontal/vertical nav layer after the main sidebar.
- Parent and teacher shells are simpler, but staff/admin mobile navigation needs a drawer or compact app navigation in Prompt 14B.

## Future Route Inventory Maintenance

Run:

```powershell
pnpm.cmd routes:list
```

After new page/API routes are added, refresh this document and `docs/DEVELOPER_CONTINUATION_GUIDE.md`.

## Prompt 19A notification addition

Prompt 19A adds eight pages under `/notifications`, `/teacher/notifications`, and `/parent/notifications`, plus protected APIs under `/api/notifications` for templates, campaigns/workflow, audience preview, own recipient actions/counts, Teacher/Parent lists, reports, and CSV. Existing `/notices` and Parent Notice routes remain unchanged; `/parent/notifications` exposes them only as a separate linked-child-safe legacy feed.
