# Role Training Guides

Never place a real password in this document. First login uses a separately delivered temporary credential, immediate password change where required, active-role confirmation and logout verification. Replace `[SCHOOL ESCALATION CONTACT]` before a real pilot.

## Super Admin

Can govern IAM, system health, backups, releases, feature state, Command Center, My Work, Search and read-only Smart AI. Cannot treat a green build as deployment approval, let AI write records, activate providers or import real data without a separate gate. Daily routes: `/dashboard`, `/super-admin/command-center`, `/technical-operations`, `/release-operations`, `/iam`. Common mistake: changing a flag to “test” in an operational environment. Recovery: revoke affected sessions, restore the default-off state and record the incident.

## Principal

Can oversee attendance, Staff work, academic configuration, exact marks/report approval, meetings and Parent issues within current permissions. Cannot gain Super Admin IAM/release authority or broaden Teacher marks access. Daily routes: `/dashboard`, `/attendance/students/reports`, `/exams/moderation`, `/report-cards/publication`, `/parent-meetings`. Escalate security/release/provider decisions.

## Director

Can review governed operational and finance summaries, approve and issue report cards under the existing server-owned permission policy, and view bounded release state. Principal and Director scopes remain distinct: Director report authority does not grant Principal marks-entry/moderation or full release execution authority. Routes: `/dashboard`, `/daily-collection`, `/expenses`, `/cash-book`, `/academic-reports`, `/report-cards/publication`, `/release-operations`.

## Accountant

Can collect fees, perform governed family allocation, record expense/misc income work, review dues/ledger/daily collection/Cash Book, and use separately activated Offline Sync drafts. Cannot browse general Student master data, treat a draft as a receipt, post Old Due offline, or silently edit posted finance. Use `/payments/new`, `/family-collections/new`, `/pending-dues`, `/daily-collection`, `/expenses`, `/misc-income`, `/offline/finance` and the closing runbook.

## Computer Operator

Can prepare bounded Student/Guardian/Staff/timetable/document/import records according to assigned permissions. Cannot auto-approve admissions, reports, progression or finance. Always preview imports, resolve row errors and escalate duplicates. Routes: `/students`, `/guardians`, `/staff`, `/timetable/assignments`, `/import-export`.

## Teacher

Can see own timetable/work, take exact-cohort Student attendance, publish assigned classwork/homework, view own Staff information and participate in assigned Parent Meetings. Cannot permanently enter marks, moderate, issue reports, browse other classes or see unrelated families. Use `/teacher`, `/attendance/students`, `/teacher/classwork`, `/teacher/homework`, `/teacher/exam-assignments`.

## Marks Entry Operator

This is an exact-scope permission profile, not a new role. It may only view assigned sheets, enter/submit assigned marks and request a correction. It cannot moderate, reopen, calculate, lock, approve, issue reports, manage IAM or operate outside the exact assignment. Routes: `/marks/governed` and the assigned `/marks/entry/[assessmentId]`.

## Parent

Can see only active linked children and their permitted fees, receipts, attendance, issued reports, classwork/homework, meetings, support and private media. Cannot use another child ID, see unpublished reports or access private school notes. Always confirm selected child after switching siblings. Routes: `/parent` and its child-specific sections.

## Viewer

Can read approved summaries only. Cannot mutate, export broadly, open ledgers or enter marks. If an action appears, do not use it; record a role/UI mismatch as a software defect. Routes include `/dashboard` and approved report summaries.

## Gate Staff

Can verify governed gate passes, complete checkout/return and view the minimum live campus roster. Cannot browse general Student data, issue a pass, alter attendance or use an expired/reused token. Route: `/student-departures/gate`.

Every role signs out from `/account-security`, confirms the session ended and reports a lost device or suspected credential immediately to `[SCHOOL ESCALATION CONTACT]`.
