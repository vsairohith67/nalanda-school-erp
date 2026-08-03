# Prompt 23H-QA release evidence

Date: 2026-08-03  
Branch retained: `feature/admissions-enquiry-crm`  
Release tag: `admissions-crm-v37-2026-08-03`

## Independent findings closed

- Viewer report export is now decided by the exact effective
  `EXPORT_ADMISSION_REPORTS` permission and the UI does not render an export
  action when it is denied.
- Class labels preserve Roman numerals instead of presenting `II` as `Ii`.
- Teacher review workspaces contain only explicitly assigned reviews.
- The applicant portal keeps the invitation token separate from saved child
  fields and removes it from the rendered DOM after the application opens.
- `/api/public/admissions/` is explicitly public at middleware while every
  application/document route still requires its hash-verified invitation
  token, expiry, version, ownership and attempt checks.
- Public enquiry submission retains its form reference across the asynchronous
  request, returns the same generic success class, and resets only after the
  request completes.

## Fresh copied-database matrix

The independent `ADMIT23HQA` harness passed before and after operational
migration. It created only copied-database synthetic fixtures and proved:

- 223 Prisma models/tables and 66 immutable-history triggers after fresh
  migration;
- public enquiry idempotence, honeypot handling and privacy-minimal fields;
- hash-only, expiring and single-use invitation handling;
- configured private document validation, opaque storage, SHA-256 evidence,
  encrypted asset backup, two restores and wrong-key refusal;
- human-reviewed duplicate suggestions with no automatic merge;
- Principal, restricted Receptionist, assigned Teacher, suppressed Viewer and
  denied Accountant boundaries;
- exactly-once/concurrent conversion, pending-only Parent account, zero Payment
  creation and forced transaction rollback;
- version-37 logical backup restore twice; and
- byte-identical operational business data before and after the harness.

## Browser and accessibility evidence

The in-app Browser used a fresh copied database at 1366 by 768 and 390 by 844.
Principal hand-checks matched the six-enquiry fixture: Class I 3, Class II 3,
Referral 3, Website 3, Application Invited 1 and New 5. Principal export was
visible; Viewer export was absent, minimum group size was 3, small stages were
suppressed and Viewer intake redirected to Access Restricted.

The public mobile enquiry had unchecked consent, no file input and no address,
location, Aadhaar, PAN, medical or payment field. After staff logout, the public
enquiry returned a generic success and an invitation opened the applicant's own
application without placing the token in the URL or rendered DOM. The stored
child name remained distinct from the token. Desktop/mobile light/dark views
had no horizontal overflow; Prompt 23H actions measured 44 px; dialogs supported
focus and Escape; native dialogs, console error/warning, hydration errors and
server stderr were zero.

All `ADMIT23HQA` records, copied databases, private documents, credentials,
logs and runtimes were removed. Cleanup was idempotent and inspected twice.

## Sequential release gates

- Routes: 310 pages and 472 APIs.
- Lifecycle dry run: zero active Students, zero created enrollments, no change.
- Typecheck: passed with a 3 GB heap limit.
- Focused admissions group: 2 files, 11 tests passed.
- Independent copied-database harness: passed.
- Full suite: 186 files, 1,688 tests passed, including fresh-install and
  backup/restore post-test checks.
- Production build: passed with a 4 GB heap limit.
- Backup: version 37 generated before and after migration.
- Git safety: passed with no detected secret or private runtime artifact.

## Operational migration and rollback evidence

Before migration, the only pending migration was
`20260803193000_admissions_enquiry_crm`. A protected byte-identical copy of
`prisma/dev.db` was created under ignored backups and verified by SHA-256. The
additive migration applied once; the second deployment reported no pending
migration and final status was clean.

The exact operational baseline remained: Students 0, active enrollments 0,
Guardians 0, Staff 0, Payments 0 and payment amount 0. The four protected local
accounts/role assignments remained unchanged, including one active Super Admin
and inactive Admin, Accountant and Viewer accounts. No real applicant, live
provider, deployment, address/location, fee, receipt or transport data was
created.

## Governance closure

GitHub PR 2, the Prompt 23H Notion page, the Asana release task and the Canvs
workflow are re-fetched after merge/tag. Production use still requires an
approved admissions privacy notice, retention policy and complaint route. No
final legal retention duration is invented. The next governed phase is Prompt
23I - Payroll, Payslips, Salary History and Employee Self-Service.
