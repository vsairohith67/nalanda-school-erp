# UX-1A Independent Shared Login and App-Shell QA Closure

Date: 30 July 2026

Result: `UX_SHARED_SHELL_CLEARED`

## Scope and release boundary

Independent QA verified the public login and authenticated ERP shell on
`ux/shared-login-shell-redesign`. It did not change the authentication model,
Prisma schema or migrations, report-card logic, Teacher-attendance scope,
operational accounts, or operational business data. It does not authorize
staging or deployment.

The retained feature branch and annotated release tag are:

- Branch: `ux/shared-login-shell-redesign`
- Tag: `ux-shared-shell-v37-2026-07-30`

The final Git commit is recorded in the pushed branch, `main`, tag, Notion
closure entries, and release handoff rather than duplicated inside its own
commit.

## Confirmed QA corrections

Independent testing found three target-size gaps. The shared stylesheet now
enforces a minimum 44 px target for desktop navigation links, the System
Health action, and Change Password fields and buttons. Focused regression
tests assert these shared rules. No authentication or authorization behavior
changed.

## Role and permission matrix

A fresh copied operational database used synthetic Super Admin, Director,
Principal, Admin, Accountant, Viewer, Teacher, and Parent accounts. Every role
showed its human designation, permission-filtered navigation, correct default
route, and correct Change Password/account-menu behavior. No raw role enum or
single-role picker appeared. Viewer, Teacher, and Parent remained isolated
from leadership and operational navigation; disabled and unauthorized routes
were denied.

Synthetic accounts, credentials, sessions, audit rows, and the copied database
were destroyed after testing. No real disabled account was activated.

## Responsive and accessibility matrix

Login and authenticated-shell measurements passed in light and dark themes at
exactly:

- 1440 x 900
- 1366 x 768
- 1024 x 768
- 768 x 1024
- 390 x 844
- 375 x 667
- 320 x 568

The pages had zero document-level horizontal overflow. Branding stayed
proportionate, the academic year appeared once, and the mobile control order
remained menu, logo, year, notification, avatar. The drawer trapped focus,
closed on Escape, and returned focus to its trigger. Shared controls met the
44 px target and keyboard focus had a visible 2 px indicator. Menus, dialogs,
labels, and text remained contained.

Privacy-safe evidence:

- `docs/evidence/ux1a-qa/login-desktop-dark-1440x900.png`
- `docs/evidence/ux1a-qa/shell-super-admin-desktop-light-or-dark-1366x768.png`
- `docs/evidence/ux1a-qa/shell-mobile-drawer-dark-390x844.png`

## Login, account, and security verification

The login retained a truthful identifier label, generic anti-enumeration error,
accessible password visibility control, Caps Lock status, autocomplete, busy
state, and duplicate-submit protection. Nonexistent, wrong-password, and
copied disabled-account attempts did not disclose account existence. Origin
and CSRF controls, no-store responses, secure-cookie configuration,
permission enforcement, and credential-log exclusions remained intact. No
fake Forgot Password workflow was introduced.

Change Password required the current password and rejected weak or mismatched
values. A valid synthetic change expired the current session; stale
authorization and the old password were rejected, while a fresh login with
the new password succeeded. The synthetic credential was restored before
fixture destruction. Audit evidence contained no password.

Live or isolated production tests verified privacy-safe `401`, `403`, `404`,
`429`, and `500` states with no stack, source path, database detail, raw enum,
internal identifier, or credential disclosure. PWA tests and a live worker
check confirmed that APIs, authenticated documents, cookies, private/no-store
responses, redirects, and errors remain outside the public cache.

## Regression verification

Browser smoke testing covered Students, fees and receipts, Student and Staff
Attendance, Homework, Exams, Marks, report cards, Library, certificates,
notifications, communications, AI Assistant, OCR, Cloud Backup, the public
website, and Parent and Teacher portal boundaries.

Across the final Browser run, console errors and warnings were 0, hydration
errors were 0, production stderr was 0 bytes, native dialogs were absent, and
document overflow was 0.

## Cleanup and operational isolation

The first copied-database cleanup correctly failed closed after module smoke
testing changed only copied `updatedAt` timestamps for AI Assistant and OCR
profiles. No configuration value or business value changed. After the
operational database hash was rechecked, the isolated target was reset
byte-for-byte from the operational database and cleanup was rerun.

Two cleanup passes and two post-cleanup inspections then confirmed:

- no `UX1AQA` fixture, credential, copied database, harness, runtime, or
  namespaced log remained;
- no QA listener remained on the used ports;
- the operational database SHA-256 stayed
  `9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`;
- the operational baseline stayed 0 Students, 0 active enrollments, 0
  Payments, INR 0 collected, 0 Guardians, and 0 Staff;
- the account baseline stayed one active owned Super Admin and inactive
  Admin, Accountant, and Viewer accounts;
- `20260722_clean_install_baseline` remained the single clean migration.

## Mandatory command results

- Routes: 274 page routes and 378 API routes
- Lifecycle backfill: isolated zero-write result
- Typecheck: passed with a bounded 4 GB heap
- Tests: 1,585 passed across 171 files
- Production build: 212 of 212 entries generated with a bounded 4 GB heap
- Backup: version 37,
  `backups/nalanda-fee-control-backup-2026-07-30-17-05.json`
- Git safety: passed
- Prisma migration status: up to date

## External closure

The Canvs master architecture and detailed Login and App Shell phase boards
were re-fetched with the compact Shared UX Shell node and detailed phase
content present. Editable Mermaid fallbacks remain under `docs/diagrams`.
GitHub and the five governed Notion pages were re-fetched during release
closure. The private repository, retained feature branch, final `main`, and
annotated tag are the authoritative remote release references.

`AUTH-2B`, `IAM-1A`, `SUPPORT-1A`, and `OBS-1A` remain separate future phases.
The next governed phase is `EXAM-RC-IMPL-1`.
