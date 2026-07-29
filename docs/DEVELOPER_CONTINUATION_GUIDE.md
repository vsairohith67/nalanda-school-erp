# Nalanda Fee Control — Developer Continuation Guide

## DEVOPS-1E operational migration baseline

The clean operational SQLite database now records
`20260722_clean_install_baseline` exactly once in `_prisma_migrations`. This was
a separately approved metadata-only operation after a byte-identical copied
database rehearsal, protected raw and version-37 logical backups, and a
restore-twice rehearsal. The application-table digest, application schema,
zero-data baseline, account states, configuration counts, Prisma schema, and
migration SQL remained unchanged.

Read `OPERATIONAL_MIGRATION_BASELINE_ONBOARDING.md` before any Prisma migration
work. Do not edit the committed baseline, restore the archived migration chain,
run `db push`, or treat this one-time approval as authority for another
database. DEVOPS-1E-QA must clear the feature branch before merge. AUTH-2B may
be planned only after that independent result.

## AUTH-2A-P4C operational account outcome

The operational account sequence is complete: one owned, rotated and
fresh-login-verified `SUPER_ADMIN` remains active; the retained `ADMIN`,
`ACCOUNTANT` and `VIEWER` accounts are inactive. No User was deleted and no
role/permission row changed. The governed update route requires an exact
`expectedUpdatedAt` value, uses a compare-and-set update, and requires a
privacy-safe reason for active-to-inactive changes. Status changes continue to
invalidate stale authorization through the current account-state check.

Do not reactivate a retained account until it has a named owner and current
operational need. AUTH-2B remains deferred until after DEVOPS-1E and must add a
central session registry, username plus verified personal/work login aliases,
selectable verified reset channels, and single-use reset links that never
email a password. A later IAM-1A phase must add named leadership and operational
accounts, reusable permission profiles, and per-user grants/denials.

## AUTH-2A-P2 seed-account and readiness boundary

`ensureSeedUsers` is disabled unless `ALLOW_DEMO_USERS=true`. When enabled it
requires `DEMO_USER_DATABASE_ROOT` under the ignored workspace `tmp/` tree, an
existing contained database, and four supplied unique non-documented
passwords. It refuses production/staging, `prisma/dev.db` by path/file
identity, and a partial retained seed set. A complete existing set is preserved
byte-for-byte, including disabled status. No fallback password or password log
exists.

Ordinary startup remains seed-free. Plain `db:seed` with demo users disabled
continues intentional system/master configuration seeding without creating a
User. `demo:seed` and isolated migration rehearsals must provide both the
dedicated demo-user gate/root and the separate demo-business gate/root.
Deployment validation rejects `ALLOW_DEMO_USERS=true`.

System Health derives seed origin only from the existing exact seed
fingerprint and emits safe role-level counts. Approved role-only decisions use
`AUTH_SEED_ACCOUNT_DECISIONS`; the value performs no mutation. Read
`OPERATIONAL_ACCOUNT_OWNERSHIP_DECISION.md` before AUTH-2A-P3. Do not claim
ownership assignment, rotation, disable, or fresh-login proof until P3
actually performs and verifies it.

No Prisma model/migration belongs in AUTH-2A. Central `AuthSession` and
persisted ownership/rotation metadata are AUTH-2B work after DEVOPS-1E.
`pnpm.cmd qa:auth2a` must operate only on ignored byte-identical copies and
must prove the operational DB identity unchanged.

## DATA-0B zero-data and demo-seed boundary

The operational business baseline is 0 Students / 0 active enrollments /
0 Payments / ₹0 collected. Treat the prior 8 / 8 / 19 / ₹99,100 state only as
historical rollback/provenance evidence.

Demo business seeding requires all of: exact
`ALLOW_DEMO_BUSINESS_DATA=true`, a separate existing database, and an explicit
isolated copied/test root. The guard refuses `prisma/dev.db` by resolved path,
real path and file identity; staging and production/release validation reject
the flag. Do not weaken this guard or attach demo seeding to startup.

Version-37 backup now includes an allowlisted `SchoolSettings` snapshot.
Restore upserts that singleton idempotently, while older backups without the
field remain accepted. DATA-0B protected backup/rehearsal tooling writes only
under ignored `.data0a/data0b`.

## Prompt 23B handoff

Read the nine final Schoolknot 23B documents listed in `docs/INDEX.md` before any gap work. The result is `REPLACEMENT_BUILD_CONTINUES_CUTOVER_NOT_READY`; it is not a whole-school cutover or parity claim. The Notion source has five role reports plus exactly 109 dispositioned unresolved items.

Independent 23B-QA cleared the consolidation baseline. Prompt 23C is now
independently cleared for its exact attendance boundary on
`security/teacher-attendance-exact-scope`. Its critical attendance blocker is
resolved, while overall Teacher replacement remains `CONDITIONAL`. Read
`TEACHER_ATTENDANCE_EXACT_SCOPE_WORKFLOW.md` before changing attendance.

The single authority is `lib/teacher-attendance-scope.ts`. Keep page, API,
report, CSV, Teacher portal and dashboard consumers on that resolver. A Teacher
needs an active User/session, active linked Staff, active linked timetable
Teacher and exact active current-year timetable target, or a confirmed
same-date substitute target. Permission alone is never a cohort. Blank section
is exact, never wildcard; the current substitute schema is one approved date
per row. Do not add normalization or a broad catch fallback.

Attendance mutation requires the caller's exact `updatedAt`, one-winner
compare-and-set within a serializable transaction, bounded full-roster
validation for submit/correct, and append-only privacy-safe `UserAudit`
evidence. Corrections require an in-app reason. The middleware remains the
CSRF/origin and body-limit boundary.

`scripts/qa23c-copied-db.ts` is an ignored copied-database harness. Preserve
its guarded root, operational hash checks, namespaced `QA23C` fixtures,
idempotent targeted cleanup and whole-database logical-digest restoration. Do
not point it at `prisma/dev.db`.

Prompt 23C deliberately does not combine Parent attendance, timetable UI,
Classwork, calendar, schema expansion or operational account creation.
Leadership permissions remain separate. Do not merge or claim Teacher cutover
GO before independent Prompt 23C-QA.

FIN-2A is complete and cleared. FIN-2B deliberately supersedes only its Accountant cancellation authority through exact `CANCEL_FINAL_RECEIPT` and `CORRECT_FINAL_RECEIPT` permissions, immutable audit and Director/Super Admin notification. Do not reopen the retained Accountant privacy/export/receipt-integrity safeguards as unresolved Nalanda gaps. Payroll and employee self-service remain separate evidence/governance gaps. DEVOPS-1D remains payment-gated and Prompt 21/22 gates are unchanged.

RECON-1A preserves the parallel Prompt 23B and FIN-2B workstreams and their final commit order. No feature commit is replayed. Treat `ACCOUNTANT_RECEIPT_CANCELLATION_CORRECTION_AND_NOTIFICATION.md` as the final finance-policy supersession and `RECON_1A_SCHOOLKNOT_FINANCE_POLICY_RECONCILIATION.md` as the integration record. No `FIN-2C` scope is approved or implied.

## Prompt 22A-QA handoff

Prompt 22A is fully cleared for planning/governance only. Read `STAFF_DOB_EPFO_22A_QA_REPORT.md` with the four Prompt 22A documents before any later work. The release result is `PROMPT_22A_CLEARED_BUT_22B_CONDITIONAL`: do not begin Prompt 22B coding or real-data entry until every decision-record condition has dated evidence. Prompt 22C and Prompt 22D remain separately blocked.

## Prompt 22A Staff DOB and EPFO/EPS planning handoff

Read `STAFF_DOB_EPFO_EPS_REMINDER_PLANNING.md`, `STAFF_EPFO_DATA_PRIVACY_AND_ACCESS_MATRIX.md`, `STAFF_EPFO_COMPLIANCE_CHECKLIST_DRAFT.md`, and `STAFF_DOB_EPFO_22A_DECISION_RECORD.md` before any Prompt 22 work.

Decision: `PROMPT_22B_CONDITIONALLY_APPROVED`. Do not code until named leadership, current EPFO/labour-law professional and privacy conditions are recorded. Prompt 22B is limited to nullable exact DOB, source/verification/correction, neutral EPFO/EPS/UAN-availability statuses, optional last four, safe review metadata, dedicated permissions, append-only events, explicit projections, tests and backup/restore. Reuse `dateOfJoining` and existing Staff status. Do not add a duplicate employment start date or infer employment end/status.

Full UAN, Aadhaar, PAN, bank data, credentials, OTPs, portal sessions, source images, portal automation, automatic coverage/EPS decisions, pension calculations, contribution actions and external messages are prohibited. Use a multi-state UAN availability value, not a boolean. Reject prohibited identifier patterns from safe notes.

Prompt 22C is a separate Director-only reminder phase. Its only instruction text is **Review EPFO/EPS records and obtain professional guidance.** It requires 365/180/90/30/date-reached/overdue states, one logical versioned reminder, bounded snooze, append-only events, DOB-correction recalculation and an approved leap-day anniversary policy. It never changes employment or sends a message.

Prompt 22D is a separate checklist phase and cannot claim statutory compliance. Keep all DOB/EPFO data out of ordinary Staff lists/search, broad CSV, general logs, print, PWA/offline cache, AI Assistant, public website and communications. QA must use prefixed synthetic data on a copied database, prove Director/assigned access plus multiple blocked roles, clean twice, then create the final encrypted-compatible backup. Prompt 21B/21C/21D remain blocked.

## Prompt 19B continuation boundary

Read `WHATSAPP_BUSINESS_ONE_WAY_COMMUNICATION_WORKFLOW.md` before provider changes. Keep MOCK default and LIVE environment-gated. Never add credential/full-phone database fields, free-form sends, direct Student delivery, media, OTP, conversations, or finance posting. Preserve creator/approver separation, send-time consent/phone revalidation, monotonic webhooks, capped retry, and backup version 31. Use `pnpm.cmd whatsapp:health`, `pnpm.cmd whatsapp:process`, and signed `pnpm.cmd whatsapp:webhook-fixtures`.

This guide is for Codex, Claude, or another developer continuing the existing project without guessing at its architecture or safety rules.

## Baseline and scope

Workspace: the repository root of the current clone.

Current verified baseline:

- `pnpm.cmd typecheck` passes.
- `pnpm.cmd test` passes: 353 tests across 60 files after Prompt 15B-QA.
- `pnpm.cmd build` passes.
- `pnpm.cmd backup` creates backup version 13; the verified Prompt 15B-QA backup is `nalanda-fee-control-backup-2026-07-01-14-22.json` with 8 academic-year enrollments, 8 lifecycle events, and zero password-hash fields.

Preserve existing fee workflows, seeded-user safety, role behavior, older-backup compatibility, and preview-first import/restore behavior.

## Prompt 15B student lifecycle foundation

- Models: `AcademicYearEnrollment` and `StudentLifecycleEvent` in `prisma/schema.prisma`, introduced by `prisma/migrations/20260701_student_lifecycle_foundation/migration.sql`.
- Duplicate rule: `@@unique([studentId, academicYear])`; a student has at most one enrollment row per academic year. Class/section changes for a finalized year must later use a reviewed correction workflow, not duplicate enrollment rows.
- History rule: lifecycle events are append-only. `lib/student-lifecycle.ts` exposes creation/listing helpers but no update/delete event helper.
- Backfill: `pnpm.cmd lifecycle:backfill` performs a dry-run using `SchoolSettings.academicYear`, or the safe settings fallback. `pnpm.cmd lifecycle:backfill -- --apply` transactionally creates missing ACTIVE enrollments and ENROLLED events only for active, non-deleted students. Re-running is idempotent. Left/inactive/cancelled/TC and soft-deleted records are excluded.
- Access: leadership roles view/manage lifecycle and academic-year enrollments; Viewer is view-only; Accountant, Teacher, and Parent have no default broad access. Pages and APIs enforce permissions server-side.
- Routes: `/students/lifecycle`, `/students/[id]/lifecycle`, `/api/students/lifecycle`, and `/api/students/[id]/lifecycle`.
- Backup/restore: version 13 includes `academicYearEnrollments` and `studentLifecycleEvents`. Old arrays are optional, student/user links are validated, duplicate events are skipped, and conflicting local enrollment history is preserved with a warning. Password hashes remain excluded.

Prompt 15B-QA additionally verifies that API serializers independently allowlist response fields, exact semantic lifecycle-event duplicates are skipped even when backup IDs differ, school-calendar dates use the shared Asia/Kolkata formatter, and an isolated temporary-database restore rehearsal remains stable across repeated restores.

Not built: promotion, repeat, double promotion, transfer/left/dropout action workflows, rejoin, correction UI, bulk rollover/finalization, UDISE+ export, exams, admissions, or certificates. Prompt 15C must add preview, evidence, approval, finalization, and compensating correction behavior without weakening this history model.

DEVOPS-1B and independent QA are fully cleared on `main`; the operational database is still intentionally unbaselined. The repaired active chain uses a generated baseline and rehearses `migrate resolve --applied` only on byte-for-byte copies. Follow `CLEAN_INSTALL_AND_EXISTING_DATABASE_ONBOARDING.md`; never casually mark a database applied and never use `db push` as deployment.

## Architecture overview

The app is a Next.js App Router application.

- `app/` — server-rendered pages and HTTP route handlers.
- `components/` — client forms, panels, tables, navigation, printing controls, and timetable interfaces.
- `lib/` — business rules, permission checks, import normalization, backup/restore, reporting, and timetable logic.
- `prisma/schema.prisma` — SQLite data model.
- `prisma/migrations/` — active deployable migrations (DEVOPS-1B begins with `20260722_clean_install_baseline`).
- `prisma/migration-archives/devops1b-legacy-chain/` — preserved non-active historical SQL plus checksum manifest; audit evidence only.
- `prisma/dev.db` — local SQLite database.
- `tests/` — Vitest unit/behavior tests.
- `scripts/` — backup, database initialization, and demo-seed utilities.
- `tools/` — double-clickable Windows helper scripts.

### QA/demo/test cleanup utility

`lib/test-data-cleanup.ts` and `scripts/cleanup-test-data.ts` provide a preview-first cleanup path for clearly marked QA/demo/test records. The package command is:

```powershell
pnpm.cmd qa:cleanup -- --dry-run --receipt QA10C-0056
pnpm.cmd qa:cleanup -- --apply --receipt QA10C-0056 --confirm DELETE_TEST_DATA
```

Safety expectations:

- Keep dry-run as the default.
- Keep apply gated by `DELETE_TEST_DATA`.
- Do not allow numeric-only receipt prefix cleanup.
- Do not delete real-looking students or students with non-test payments.
- Do not touch users, password hashes, role permissions, fee structures, timetable data, or school settings.
- Keep this separate from `pnpm.cmd pilot:reset-sample-data`, which targets copied pilot databases and `PILOT-` sample records.
- `docs/` — operator, handover, pilot, and developer documentation.

Route inventory helper:

```powershell
pnpm.cmd routes:list
```

This prints current App Router page and API routes from `app/`. Prompt 14A recorded 52 page routes and 62 API routes in `docs/ERP_ROUTE_AND_MODULE_INVENTORY.md`.

Pages normally enforce permissions server-side with `requirePermission`. APIs enforce permissions with `requireApiPermission`. Client components call API routes but are not the security boundary.

## Page route map

| Route | Purpose | Main access |
|---|---|---|
| `/` | Dashboard and fee summary | All roles |
| `/login` | Sign in | Public |
| `/setup` | First active Director and school basics | Only when first-run setup is required |
| `/change-password` | Change own password | Any signed-in user |
| `/students` | Search/list Student Master | Director/Admin/Accountant |
| `/students/new` | Add student | Director/Admin |
| `/students/[id]/edit` | Edit student | Director/Admin |
| `/payments` | Payment list/export | Director/Admin/Accountant |
| `/payments/new` | Add payment | Director/Admin/Accountant |
| `/payments/[id]/edit` | Edit/cancel payment workflow | Permission-controlled |
| `/receipts/[receiptNo]/print` | Grouped receipt print view | Print-receipt roles |
| `/pending-dues` | Pending/paid fee position and reminders | All roles |
| `/daily-collection` | Collection report | All roles |
| `/ledger` | Student ledger search | Director/Admin/Accountant |
| `/ledger/print` | Ledger print | Director/Admin/Accountant |
| `/receipt-audit` | Missing/duplicate/split/cancel/reference checks | Director/Admin/Accountant |
| `/import-export` | Imports, exports, backup, restore | Sections shown by permission |
| `/import-verification` | Import batch history and go-live checklist | Director/Admin; Accountant has payment-only access |
| `/import-verification/[id]` | Saved import batch detail | Permission/access helper controlled |
| `/settings` | System health, school profile, fees | Director/Admin |
| `/users` | User management | Director/Admin |
| `/roles` | Role permission matrix | Super Admin or `MANAGE_ROLE_PERMISSIONS` |
| `/timetable` | Timetable readiness overview | Director/Admin |
| `/timetable/teachers` | Teacher master | Director/Admin |
| `/timetable/subjects` | Subject master | Director/Admin |
| `/timetable/classes` | Timetable class sections | Director/Admin |
| `/timetable/assignments` | Teacher/subject/class workload | Director/Admin |
| `/timetable/settings` | Period templates, unavailable/fixed periods | Director/Admin |
| `/timetable/builder` | Manual draft builder and validator | Director/Admin |
| `/timetable/generate` | Deterministic automatic generator | Director/Admin |
| `/timetable/print` | Class/teacher print and CSV export | Director/Admin |
| `/attendance/students` | Manual daily student attendance by class/section | Permission-controlled; Teacher enabled by default |
| `/attendance/students/reports` | Date/class, absent, late, and monthly student summaries | Permission-controlled read-only report |
| `/attendance/staff` | Manual daily staff attendance | Leadership/Admin permission-controlled |
| `/attendance/staff/reports` | Official staff attendance summaries and CSV | Report permission-controlled |
| `/leave/staff` | Staff leave list; Teacher is server-filtered to own linked StaffMember | `VIEW_STAFF_LEAVE` |
| `/substitutes` | Substitute list; Teacher is server-filtered to own assigned duties | `VIEW_SUBSTITUTES` |
| `/substitutes/new` | Manual draft/assignment form with advisory suggestions | `MANAGE_SUBSTITUTES` |
| `/substitutes/planner` | Approved-leave, absence, and active-timetable review | `MANAGE_SUBSTITUTES` |
| `/substitutes/reports` | Coverage and workload reports with CSV | `VIEW_SUBSTITUTE_REPORTS` |
| `/leave/staff/new` | Save a leave draft or submit for approval | `APPLY_STAFF_LEAVE` or management |
| `/leave/staff/[id]` | View/edit draft, submit, approve/reject, or safely cancel | Own/management and approval permissions |
| `/leave/staff/reports` | Date/staff/type, pending and approved leave reports | `VIEW_STAFF_LEAVE_REPORTS` |
| `/unauthorized` | Permission failure page | Signed-in users |

## API map

| API | Methods | Purpose / permission |
|---|---|---|
| `/api/auth/login` | POST | Login and session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/change-password` | POST | Current user changes own password |
| `/api/setup` | POST | First-run Director/school setup |
| `/api/dashboard` | GET | Dashboard data; `VIEW_DASHBOARD` |
| `/api/students` | GET, POST | List/create students; view/edit permissions |
| `/api/students/[id]` | GET, PUT, DELETE | Read/update/soft-deactivate student |
| `/api/students/by-admission/[admissionNo]` | GET | Payment-entry student lookup |
| `/api/payments` | GET, POST | List/create payments |
| `/api/payments/[id]` | PUT, DELETE | Edit/cancel payment |
| `/api/payments/[id]/restore` | POST | Restore cancelled payment; Director-only permission |
| `/api/pending-dues` | GET | Due calculation |
| `/api/ledger` | GET | Student ledger |
| `/api/reports/collection` | GET | Daily/date-range collection |
| `/api/attendance/students` | GET, POST | Load/create/save/clear/submit/lock student attendance; action-specific permissions |
| `/api/attendance/students/reports/export` | GET | Student attendance CSV; report permission |
| `/api/receipt-audit` | GET, POST | Audit report and receipt-note management |
| `/api/fee-structures` | GET, POST | Fee settings |
| `/api/school-settings` | GET, PUT | School and receipt settings |
| `/api/users` | GET, POST | User list/create |
| `/api/users/[id]` | PUT | Update role/status/profile |
| `/api/users/[id]/reset-password` | POST | Privileged password reset |
| `/api/roles/permissions` | GET, POST | View/save role permission matrix |
| `/api/roles/permissions/reset` | POST | Reset role matrix to recommended defaults |
| `/api/import/students` | POST | Preview/dry-run/import Student Master |
| `/api/import/payments` | POST | Preview/dry-run/import payments and save batch |
| `/api/import-verification/checklist` | PUT | Update go-live checklist |
| `/api/export/[type]` | GET | Students, payments, pending dues, reminder/report CSV; dynamic permission by type |
| `/api/backup` | GET | Full backup download; `EXPORT_FULL_BACKUP` |
| `/api/restore` | POST | Validate/restore full backup; `RESTORE_FULL_BACKUP` |
| `/api/timetable/[resource]` | POST | Create supported timetable master/rule resource |
| `/api/timetable/[resource]/[id]` | PUT, DELETE | Update/delete supported resource |
| `/api/timetable/drafts` | POST | Create/copy timetable draft |
| `/api/timetable/drafts/[id]` | PUT | Rename, activate, archive, or restore a draft |
| `/api/timetable/drafts/[id]/fixed-periods` | POST | Apply fixed periods to draft |
| `/api/timetable/entries` | PUT, DELETE | Save/remove manual draft entry |
| `/api/timetable/generate` | POST | Preview or save generated draft |
| `/api/timetable/export/[type]` | GET | Class, teacher, workload, and free-period CSV |

When adding an API, enforce permission in the route itself. Do not rely on hidden buttons.

## Database models grouped by module

### Student and fees

- `Student` — identity, class/section, contacts, status, discount, start month, soft-deletion.
- `FeeStructure` — annual class fee represented by four term amounts/months for an academic year.
- `Payment` — one transaction row. Split receipts intentionally use multiple rows with the same receipt number.
- `ReceiptNote` — cancelled/missing receipt-book notes.
- `PaymentAudit` — immutable-style history for payment create/edit/cancel/restore actions.

### Authentication and administration

- `User` — named account, password hash, role, active status, last login.
- `UserAudit` — user-management actions.
- `RolePermission` — database-backed role/permission matrix rows.
- `SchoolSettings` — singleton school, academic year, receipt, logo, reminder, and print settings.

### Import readiness

- `ImportBatch` — dry-run or completed Student/Payment import history, counts, reconciliation details, and samples.
- `GoLiveChecklist` — singleton readiness checklist.

### Timetable

- `TimetableTeacher`
- `TimetableSubject`
- `TimetableClassSection`
- `TimetablePeriodTemplate`
- `TimetableAssignment`
- `TimetableTeacherUnavailability`
- `TimetableFixedPeriod`
- `TimetableDraft`
- `TimetableEntry`

Dependencies matter: teachers/subjects/classes/templates precede assignments and rules; drafts precede entries.

### Student attendance

- `StudentAttendanceSession` is unique by attendance date, class, section, and academic year. Workflow states are `DRAFT`, `SUBMITTED`, and `LOCKED`.
- `StudentAttendanceRecord` links the existing `Student`; it does not duplicate the Student Master. Statuses are `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, and `EXCUSED`.
- Only active, non-deleted students in the exact academic year/class/section are offered for marking. The copied `admissionNo` is historical convenience.
- Submitted attendance is treated as complete and not editable. Locked attendance is final. Unlock is intentionally not implemented in Prompt 13B.

## Key helper files

| File | Responsibility |
|---|---|
| `lib/auth.ts` | Current user, page/API permission guards, first-run gating |
| `lib/permissions.ts` | Roles, canonical permission names, labels, recommended defaults, and legacy aliases |
| `lib/role-permissions.ts` | Database-backed matrix loading, validation, fallback defaults, and reset/save helpers |
| `lib/setup.ts` | First-run detection and first Director creation |
| `lib/session-token.ts` | Signed session token handling |
| `lib/password.ts`, `lib/password-control.ts` | Password hashing and password rules |
| `lib/user-management.ts`, `lib/user-audit.ts` | Role hierarchy and user audit logic |
| `lib/validation.ts` | Student/payment payload validation and defaults |
| `lib/fee-allocation.ts` | Fee expectation, terms, discounts, and start-month logic |
| `lib/data.ts`, `lib/ledger-data.ts` | Dashboard, dues, ledger, and reporting data |
| `lib/receipt.ts`, `lib/receipt-audit.ts` | Receipt grouping/status and audit classification |
| `lib/reminders.ts` | WhatsApp reminder text and links |
| `lib/student-import.ts` | Student header normalization, validation, preview |
| `lib/payment-import.ts` | Payment normalization, matching, duplicates, audit creation |
| `lib/import-verification.ts` | Batch persistence, reconciliation, expected totals |
| `lib/import-verification-access.ts` | Role-specific visibility for batch history |
| `lib/backup.ts` | Backup version 12 document generation and password sanitization |
| `lib/restore.ts` | Backup parsing, shape validation, compatibility defaults |
| `lib/restore-database.ts` | Transactional, dependency-ordered restore |
| `lib/system-health.ts` | Production/readiness checks |
| `lib/timetable.ts` | Timetable constants, foundation/draft validation, loads |
| `lib/timetable-generator.ts` | Deterministic preview/save generation |
| `lib/timetable-print-data.ts`, `lib/timetable-print.ts` | Print/export data and CSV formatting |
| `lib/student-attendance.ts` | Attendance scope/status validation, active-student filtering, totals, and report summaries |
| `lib/prisma.ts` | Shared Prisma client |

## Permission system

Roles are `SUPER_ADMIN`, `DIRECTOR`, `PRINCIPAL`, `ADMIN`, `ACCOUNTANT`, `TEACHER`, `PARENT`, and `VIEWER`. Display `VIEWER` as **Viewer / Auditor**.

`lib/permissions.ts` defines canonical ERP-style permissions and recommended defaults. It also keeps legacy aliases such as `ADD_PAYMENT`, `VIEW_PENDING`, and `EXPORT_FULL_BACKUP` so older code/tests/backups remain compatible.

`lib/role-permissions.ts` is the database-backed layer:

- `hasRolePermission()` is used by `requirePermission()` and `requireApiPermission()`.
- Missing rows fall back to recommended defaults.
- `SUPER_ADMIN` always has every permission.
- `/roles` calls `ensureDefaultRolePermissions()` before showing the matrix.
- Backup scripts/API materialize missing default rows before export so backups include the matrix, but they must never rewrite an existing operational override merely by taking a backup.

Default role intent:

- Super Admin: all permissions, locked core access.
- Director: broad operational permissions but not role-permission management by default.
- Principal: academic/student/timetable/report permissions, not full finance/system by default.
- Admin: office operations, students, imports, reports, limited user work.
- Accountant: fee/payment/dues/ledger/receipt-audit/report work.
- Teacher: safe placeholder only by default. Parent: read-only portal. Broader teacher modules remain future work.
- Viewer / Auditor: read-only report/audit access.

`requireUser()` redirects to `/setup` if no active Director or Super Admin exists, otherwise to `/login` if the session is invalid. `requireApiPermission()` returns:

- 503 with `setupRequired: true` during first-run state,
- 401 when not logged in,
- 403 when the role lacks permission.

Keep system-health and alarming readiness warnings restricted to users with `VIEW_SYSTEM_HEALTH`.

Use `pnpm.cmd user:make-super-admin <username-or-email>` to promote an existing user. The script refuses missing users, does not create passwords, and does not print password hashes.

Prompt 10A-QA added pure access-rule tests for sidebar visibility and import/export access. Keep `lib/access-rules.ts` in sync with any new sidebar destination so permission QA can stay independent of the rendered React shell.

## Backup and restore design

`lib/backup.ts` creates backup version 12. It includes:

- students,
- fee structures,
- payments and cancellation fields,
- payment audits,
- safe user metadata without password hashes,
- role permission matrix rows,
- receipt notes,
- school-linked import batches and go-live checklist,
- all timetable foundation data,
- timetable drafts and entries,
- guardians and student/guardian links,
- parent notices and notice acknowledgements,
- staff members and their safe optional local links.
- student attendance sessions and records.

It currently uses `SchoolSettings.academicYear` in backup metadata but does not include the
`SchoolSettings` singleton as a restorable payload section. Do not claim otherwise in operator
documentation. Treat adding school-settings backup/restore as a separate future scoped change.

Restore is preview-first:

1. Browser parses/validates JSON using `lib/restore.ts`.
2. `/api/restore` validates counts and warnings.
3. Exact confirmation text is required.
4. `restoreValidatedBackup` runs inside a Prisma transaction.
5. Records are created, updated, skipped, or reported with warnings/errors.

Older backup sections are optional so older files remain valid. Users are mapped only when safe; accounts/passwords are not replaced. Timetable restore uses dependency ordering and skips unsafe dependent rows with warnings.

When extending backup coverage, update together:

- backup document and metadata,
- restore type/validation/defaults,
- restore execution order,
- API preview counts,
- restore-panel preview/result tables,
- backup/restore tests,
- operations documentation.

## Import design

Both Student and Payment imports are browser-uploaded Excel/CSV files parsed with SheetJS and sent as rows to server APIs.

Core safety properties:

- normalize common header variations,
- show preview before changing data,
- keep row errors and warnings visible,
- support dry-run/trial history,
- detect duplicates,
- import only valid rows,
- save batch counts/details,
- provide error CSV,
- take backup before import.

Payment matching prefers admission number. Name+class matching is allowed only when exactly one student matches and produces a warning. Payment duplicate fingerprint includes receipt, admission, date, amount, mode, and received account, so valid split receipts remain possible.

No batch rollback exists by design. Restore the pre-import backup if recovery is required.

## Timetable design

The timetable has four layers:

1. foundation master data and scheduling rules,
2. manual drafts/entries with live validation,
3. deterministic automatic generation,
4. class/teacher print views and CSV summaries.

The generator previews in memory and never replaces a base draft. Saved generated drafts remain `DRAFT`. Hard constraints prevent class/teacher collisions, unavailable-teacher placement, invalid/inactive mappings, non-teaching slots, locked/fixed-slot overwrite, and Friday-template overflow. Soft scoring spreads subjects and balances load. Unresolved workload is reported for manual correction.

Only one draft per academic year should be `ACTIVE`; activating one demotes the previous active draft. See `docs/TIMETABLE_MODULE_PLAN.md` before changing generator or print behavior.

## Test structure

Vitest tests are grouped by helper/feature:

- app information, formatting, navigation,
- permissions, setup, seed users, password controls, user management,
- validation, fee allocation, payment controls,
- receipts, audit, reminders,
- student import, payment import, import verification,
- backup, restore, import-verification restore,
- school settings and system health,
- timetable validation, backup/restore, generator, and print/export.

Run targeted tests while developing:

```powershell
pnpm vitest run tests/payment-import.test.ts
```

Before handover, always run:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Also run `pnpm backup` whenever database/backup logic changes.

## How to add a feature safely

1. Read the relevant page, API route, business helper, schema models, and tests.
2. State a narrow scope and explicit exclusions.
3. Confirm the permission required for page and API behavior.
4. Put business rules in `lib/`, not only in client components.
5. Add/alter Prisma models carefully; create a migration and preserve existing data.
6. If the model is operationally important, decide whether backup/restore must cover it.
7. Add focused tests for changed rules and backward compatibility.
8. Update operator/developer docs when workflows change.
9. Run targeted tests, then typecheck, full tests, build, and backup where relevant.
10. Do not mix unrelated modules in one change.

## Coding conventions observed

- TypeScript with explicit domain types.
- Server components load protected data; client components handle interactive forms.
- API handlers return JSON with friendly errors.
- Permissions are named constants, not scattered role-string checks.
- Shared normalization/validation belongs in `lib/`.
- Soft deletion/cancellation is preferred over destructive removal for financial records.
- Imports and restore use preview/confirmation patterns.
- Dates used for school records are normalized carefully rather than trusting browser locale.
- Existing behavior and older backup compatibility are preserved unless a migration plan says otherwise.
- Tests focus on pure helpers and safety contracts.

## SQLite and migration warnings

- `DATABASE_URL="file:./dev.db"` is resolved by Prisma relative to the Prisma schema, so the normal database is `prisma/dev.db`.
- Stop the app before manually copying the database file.
- Never edit the live SQLite file with an external tool while the app is writing.
- `prisma db push` is not the clean-install, CI, staging, production, or recovery migration process.
- DEVOPS-1B archives the incomplete 40-directory history and generates a single active baseline from the unchanged authoritative schema. Do not edit that baseline after deployment; add a new migration.
- Before any existing-database onboarding, require zero Prisma semantic drift, a byte-identical copy, row-count/data-digest controls, a verified backup, and a separately approved maintenance plan.
- Run `migration:inventory`, `migration:fresh-check`, `migration:existing-db-check`, and `migration:schema-check` for migration work.
- SQLite has limited concurrency. Do not expose the current file as a shared network database.
- Moving to PostgreSQL/cloud requires a separate tested data-migration plan, not only changing `provider`.
- Prisma 6 may warn that `package.json#prisma` seed configuration is deprecated for Prisma 7. Treat it as a future maintenance task, not a reason to ignore actual build errors.

## DEVOPS-1B clean-install baseline

The pre-repair chain failed at the first migration because it altered `Payment` before any migration created that table. The next migration also altered never-created `Student`; dependency analysis found 16 legacy migrations with unresolved prior dependencies. Strategy B was selected because reconstructing or editing unknown historical pre-schema SQL would create checksum ambiguity.

The active baseline is generated by Prisma 6.19.3 from `prisma/schema.prisma`, which remains SHA-256 `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`. Backup remains version 37. Read `CLEAN_INSTALL_MIGRATION_FAILURE_ANALYSIS.md`, `PRISMA_MIGRATION_DEPENDENCY_INVENTORY.md`, `CLEAN_INSTALL_MIGRATION_REPAIR_DECISION.md`, and `CLEAN_INSTALL_AND_EXISTING_DATABASE_ONBOARDING.md` before migration work.

Prompt 21B/21C/21D remain blocked, Prompt 22B remains conditional, and this DevOps repair authorizes no business feature.

## Avoiding context-window mistakes with AI developers

- Give Codex/Claude one small phase at a time.
- State exact files/modules in scope and list exclusions.
- Ask it to inspect current code before changing behavior.
- Run targeted checks after every prompt.
- Run full typecheck/tests/build before closing each phase.
- Run backup verification after backup/schema changes.
- Do not combine unrelated modules in one prompt.
- Preserve a short handover summary: changed files, behavior, tests, limitations, and next phase.
- When a prompt is large, split it into foundation, implementation, backup coverage, print/export, and documentation passes.

Small prompts are not bureaucracy here; they are protection against accidental cross-module changes.

## Prompt 14A stabilization and UI/UX planning

Prompt 14A is documentation/planning plus a tiny route-inventory script. It does not build a new ERP module and does not redesign the shell.

New planning documents:

- `docs/ERP_ROUTE_AND_MODULE_INVENTORY.md`
- `docs/ERP_FEATURE_STATUS_AND_GAP_MAP.md`
- `docs/UI_UX_AUDIT_AND_REDESIGN_PLAN.md`
- `docs/BUG_LIMITATION_AND_TECH_DEBT_REGISTER.md`
- `docs/UDISE_PLUS_PLANNING_NOTES.md`
- `docs/CODEX_PROMPT_STRATEGY.md`

Prompt 14B implemented the shell/navigation/responsive primitives. Prompt 14C now implements the dashboard command center using existing records only.

## Prompt 14B app shell and design-system foundation

Key files:

- `components/app-shell.tsx`
- `components/ui.tsx`
- `lib/access-rules.ts`
- `app/globals.css`
- `tests/access-rules.test.ts`
- `tests/app-shell-source.test.ts`

Navigation rules:

- `NAV_ITEMS` still maps each sidebar route to one required permission.
- `NAV_GROUPS` and `groupedVisibleNavigationItems()` add presentation grouping only. They must not become a second permission system.
- Desktop groups are Dashboard, Students & Parents, Fees & Reports, Attendance, Staff & Leave, Timetable, Communication, Administration, and System.
- The desktop sidebar hide/show button remains in the topbar.
- Mobile uses the same sidebar as an off-canvas drawer. It opens from the topbar menu button and closes from the close button, backdrop, Escape, or after a link click.
- Parent and Teacher minimal shells also use the mobile drawer pattern, but their navigation stays role-specific and minimal.
- Viewer / Auditor must remain reports/read-only only. Do not add action links to Viewer navigation unless permissions are intentionally changed and tested.

Design-system primitives now available:

- `PageShell`
- `PageHeader`
- `SectionCard`
- `StatCard`
- `StatusBadge`
- `EmptyState`
- `.filter-panel`
- `.form-panel`
- `.page-tabs`
- `.responsive-grid`
- `.table-wrap`
- `.empty-state`

Prompt 14B intentionally touched the dashboard only lightly to use `PageShell` and `SectionCard`. Do not treat that as a completed dashboard redesign.

## Prompt 14C dashboard command center

Key files:

- `app/page.tsx`
- `lib/dashboard.ts`
- `lib/data.ts`
- `app/globals.css`
- `components/backup-panel.tsx`
- `tests/dashboard.test.ts`

Safety and data rules:

- `getDashboardCommandCenter()` derives dataset access from the effective database-backed permission set before running queries.
- `buildDashboardView()` repeats the filtering defensively before returning finance, people counts, attendance, leave, substitute, notice, or import-warning data.
- Parent redirects to `/parent`; Teacher redirects to `/teacher`. Do not replace either with the internal dashboard unless a later dedicated role-dashboard prompt explicitly changes that rule.
- Viewer / Auditor quick actions remain empty even if an action permission is accidentally supplied; the dashboard is read-only.
- Dashboard attendance totals read existing manual sessions only. A missing session stays `null` and renders as “Not marked yet”; do not infer or auto-create records.
- Finance totals continue to use `getDashboard()` and existing fee-allocation/pending-dues logic. Prompt 14C only added safe payment counts and payment-mode aggregation to its return shape.
- Prompt 14C-QA makes dashboard date keys explicit to `Asia/Kolkata`; pass the same `now` value through `getDashboardCommandCenter()` and `getDashboard()` so finance, attendance, substitute, notice, greeting, and displayed date stay on one school day.
- `currentPublishedNoticeWhere()` intentionally includes `PUBLISHED` notices whose `publishDate` is null and excludes future or expired notices, matching parent-notice behavior.
- `/api/dashboard` must keep using `getDashboardCommandCenter()` with effective permissions. Do not restore the old broad `getDashboard()` JSON response.
- No schema, backup version, restore format, or fee/attendance/leave/substitute business transition changed.

Remaining dashboard work is visual/analytical only: a future trend chart should wait until its data contract is agreed, and expense/budget/exam summaries must wait until those real modules exist.

## Prompt 15A UDISE+ and academic progression planning

Prompt 15A is documentation/planning and a light source audit only. It adds no route, schema, migration, permission, backup-format change, or academic workflow. Start future work with:

- `docs/UDISE_PLUS_PLANNING_NOTES.md`
- `docs/ACADEMIC_PROGRESSION_WORKFLOW_PLAN.md`
- `docs/STUDENT_LIFECYCLE_STATUS_MODEL_PLAN.md`
- `docs/STUDENT_DATA_GAP_CHECKLIST_FOR_UDISE_AND_ACADEMICS.md`

Current data boundary:

- `Student` remains the identity/master used by fees, attendance, guardians, imports, and operator routes. Its year/class/section/status fields represent current mutable data, not complete academic history.
- The sample CSV is narrower than `lib/student-import.ts`; the importer can accept DOB, Aadhaar, broad status, and TC status, but those fields are not verified compliance data.
- Student attendance preserves dated year/class/section evidence, but there is no `AcademicYearEnrollment`, `StudentLifecycleEvent`, `PromotionDecision`, marks evidence, or progression audit.
- Staff reporting has a useful foundation but lacks several possible demographic/portal-specific fields. Do not infer them.
- `studentType` is a fee category (`Normal`, `Faculty Child`, `Concession`); never repurpose it as caste/social category.

Future sequence:

1. **Prompt 15B - Academic Year Rollover and Student Lifecycle Foundation**
2. **Prompt 15C - Promotion / Repeat / Transfer / Left Workflow**
3. **Prompt 15D - UDISE+ Checklist and Student Data Gap Dashboard**
4. **Prompt 17B or later - Exams/Marks Foundation**
5. **Prompt 18A - Certificates/TC/Bonafide Linkage**

Safety rules:

- preserve old-year history and keep schema changes additive;
- do not implement progression as direct bulk edits to Student class/year/status;
- require preview, evidence checklist, Principal/Director approval, finalization, and reasoned correction audit;
- keep unpaid-fee information separate/advisory unless a reviewed school policy explicitly says otherwise;
- do not invent marks before the exams foundation exists;
- treat every UDISE+ view/export as planning/checklist output with school review required;
- verify against current UDISE+ portal requirements before production use;
- do not add Aadhaar verification, portal scraping, unattended submission, or broad sensitive-data display.

# Prompt 12A Staff / Teacher Foundation

- `StaffMember` is the staff master. Its `userId` and `timetableTeacherId` links are optional and unique.
- Do not replace or repurpose `TimetableTeacher`; timetable assignments, builder, generator, print, and export continue to use the existing timetable models.
- Teacher-role login defaults to `/teacher`. The placeholder itself has no timetable, leave, payroll, biometric/RFID, ID-card, or performance features; Prompt 13B adds attendance as a separate permission-gated route.
- Staff import is preview-first at `/api/import/staff`; it creates/updates staff only and never creates users.
- Prompt 12A introduced backup version 8. The current format is version 12 after Prompt 13E; Staff restore still maps existing local Teacher users and timetable teachers conservatively and skips unsafe duplicate links.

## Prompt 13A Schoolknot replacement planning

`docs/SCHOOLKNOT_REPLACEMENT_GAP_MAP.md` is the management/developer roadmap for comparing the current ERP with Schoolknot-style modules. It records migration-critical gaps, conditional priorities, Biomax BM-70W integration stages, vendor approval questions, and the recommended Prompt 13B-19A order.

Prompt 13A is documentation only. No attendance, leave, substitute, biometric import/sync, homework, exams, library, transport, payment gateway, external messaging, cloud deployment, or redesign was added. Before building a replacement module, confirm Nalanda's actual Schoolknot workflow, obtain source exports and acceptance criteria, and preserve permission, audit, preview-first import, backup/restore, and role-isolation safety.

## Prompt 13B Student Attendance Foundation

- Manual daily student attendance is available at `/attendance/students`; reports and CSV export are at `/attendance/students/reports`.
- Permissions are `VIEW_STUDENT_ATTENDANCE`, `MANAGE_STUDENT_ATTENDANCE`, `SUBMIT_STUDENT_ATTENDANCE`, `LOCK_STUDENT_ATTENDANCE`, and `VIEW_STUDENT_ATTENDANCE_REPORTS`.
- Super Admin, Director, Admin, and Principal receive all five by default. Teacher receives view/manage/submit, Viewer/Auditor receives reports only, and Accountant/Parent receive none.
- Parent attendance visibility is deliberately absent. Biometric/RFID import, notifications, leave, substitutes, exams/marks, and unlock are future work; staff attendance is covered separately by Prompt 13C.
- Backup version 9 includes both attendance models; old backups remain valid because the new arrays are optional during validation.

## Prompt 13C Staff Attendance Foundation

- Manual daily staff attendance is at `/attendance/staff`; official reports and safe CSV export are at `/attendance/staff/reports`.
- `StaffAttendanceSession` is unique by date and moves only from `DRAFT` to `SUBMITTED` to `LOCKED`. Unlock is intentionally absent.
- `StaffAttendanceRecord` links the existing `StaffMember`; it stores historical staff code, status, optional times, late minutes, remarks, and a future-ready source. The UI writes `MANUAL` only.
- Only `ACTIVE` staff are offered. `INACTIVE` and `LEFT` staff cannot be added through the API.
- Super Admin, Director, Principal, and Admin receive all staff-attendance permissions. Viewer/Auditor receives reports only. Teacher, Accountant, and Parent receive none by default.
- Official reports exclude drafts and CSV formula characters are neutralized.
- Backup version 10 adds both staff-attendance arrays. Backup version 11 adds `staffLeaveRequests`. Restore keeps old backups valid, maps users when safe, and skips leave whose StaffMember link cannot be matched safely.

## Prompt 13E Substitute Teacher Foundation

- `SubstituteAssignment` records reviewed manual coverage, optional approved-leave/timetable links, class/subject/period fallback fields, workflow actors/times, priority, and reason-required cancellation.
- Workflow is `DRAFT -> ASSIGNED -> CONFIRMED -> COMPLETED`; non-final rows may be cancelled. No route auto-assigns a candidate.
- `lib/substitutes.ts` blocks inactive candidates, approved leave, recorded absence, and same-date/period conflicts. Live suggestions prefer matching subject/department and fewer duties; they are advisory, not AI.
- Teacher access is server-filtered to the linked StaffMember as substitute and is read-only. Viewer receives reports only. Accountant and Parent receive no default substitute permission.
- Backup version 12 adds `substituteAssignments`. Restore accepts older backups, maps both staff links conservatively, omits unsafe optional leave/timetable links with warnings, avoids duplicate rows, and excludes password hashes.
- Deliberate exclusions: notifications, biometric-triggered creation, payroll/deductions, performance analytics, and automatic final assignment.

### Staff leave foundation

- `StaffLeaveRequest` reuses `StaffMember`; it does not duplicate staff or add payroll fields.
- `DRAFT` is editable, `PENDING` awaits leadership, and `APPROVED`, `REJECTED`, and `CANCELLED` are retained final states. Rejection and cancellation always require a reason.
- Teacher defaults include `VIEW_STAFF_LEAVE` and `APPLY_STAFF_LEAVE`, but all teacher queries are filtered server-side to the StaffMember linked to that login. Director, Principal, and Admin receive view/apply/manage/approve/report defaults. Accountant and Parent receive none. Viewer receives reports only.
- Approved or rejected requests cannot be silently edited. Date validation blocks reversed ranges and multi-day half leave. Pending/approved overlaps generate a clear warning but do not block submission.
- Substitute-required and substitute-notes fields are future planning data only. No assignment, notifications, calendar module, payroll deduction, student leave, or biometric integration is present.
- Biometric/RFID, automatic sync, leave, substitutes, payroll, notifications, teacher analytics, and teacher own-attendance visibility remain future phases.

### Student progression foundation (Prompt 15C)

- Model/migration: `StudentProgressionDecision` in `prisma/schema.prisma` and `prisma/migrations/20260701_student_progression_foundation/migration.sql`.
- Core rules: `lib/student-progression.ts`; list/create API at `/api/students/progression`, detail/actions API at `/api/students/progression/[id]`.
- UI: `/students/progression`, `/students/progression/new`, and `/students/progression/[id]`. Lifecycle pages link to the protected decision list.
- Never collapse approval and finalization. `finalizeProgressionDecision()` must remain transactional, source-snapshot checked, duplicate-target guarded, and append-only for lifecycle history. Finalized decisions are immutable; rejected/cancelled records and reasons remain.
- Permissions are `VIEW_`, `MANAGE_`, `APPROVE_`, `FINALIZE_STUDENT_PROGRESSION`, and `VIEW_STUDENT_PROGRESSION_REPORTS`. Defaults: Super Admin/Director/Principal/Admin all; Viewer view/reports; Accountant/Teacher/Parent none.
- Backup version 14 adds `studentProgressionDecisions`; restore is optional-array compatible with version 13 and older backups, validates student/source links, maps optional users safely, deduplicates semantic decisions, and continues excluding password hashes.
- CORRECTION finalization and double promotion remain blocked. Future Prompt 15D is only the UDISE+ checklist/dashboard; exams/marks integration remains a later phase.
- Prompt 15C verification baseline: 377 tests across 62 files, typecheck/build/lifecycle backfill passed, and version-14 backup `nalanda-fee-control-backup-2026-07-01-15-04.json` was inspected. Browser QA covered 1366x768 and 390x844, both themes, leadership/Viewer/restricted roles, validation warnings, approval and cancellation. No sample decision was finalized; QA cleanup restored 0 progression decisions, 8 enrollments, and 8 lifecycle events.
- Prompt 15C-QA baseline: 381 tests across 62 files pass. `finalizeProgressionDecision()` now begins with an APPROVED-only `updateMany` claim in the transaction; do not weaken or move that claim outside the transaction. Draft student/year/source consistency is enforced. Disposable live rehearsals covered every finalizable decision type and rollback/refinalization guards, followed by cleanup to the original lifecycle counts.

### UDISE+ planning checklist (Prompt 15D)

- Core helper: `lib/udise-checklist.ts`. Keep its public report types allowlisted and status-oriented. It may use relational keys internally for queries, but UI/API/CSV output must never expose raw internal IDs, password hashes, secrets, contact values, address values, DOB values, or full Aadhaar.
- Pages: `/udise`, `/udise/students`, `/udise/staff`, and `/udise/summary`. APIs: `GET /api/udise/summary`, `/students`, `/staff`, and `/export`.
- Permissions: `VIEW_UDISE_CHECKLIST` defaults to Super Admin, Director, Admin, Principal, and Viewer. `EXPORT_UDISE_CHECKLIST` defaults to leadership/admin only. Accountant, Teacher, and Parent remain blocked by default.
- Data sources are existing Student and guardian relations, academic-year enrollment, lifecycle/progression history, StaffMember, and SchoolSettings. Queries select only needed fields and perform no writes.
- The export is an internal planning checklist/gap report with warning rows and spreadsheet-formula neutralization. Do not rename it as official, add portal codes, or reuse it for submission.
- No schema or backup-format change was made; backup version remains 14. The P3005 baseline limitation remains open.
- Prompt 15D verification baseline: 395 tests across 64 files, passing typecheck/build/lifecycle dry-run, Browser QA at 1366x768 and 390x844 in both themes with zero console errors/warnings, and version-14 backup `nalanda-fee-control-backup-2026-07-01-19-58.json`. Final data remained 8 enrollments, 8 lifecycle events, 0 progression decisions, and 0 QA users/students.
- Future work stays separated: Prompt 15E fix forms only after school confirms fields; Prompt 17B exams/marks; Prompt 18A certificates/TC/bonafide; Prompt 21A location privacy/cost/feasibility.

### UDISE+ checklist QA contract (Prompt 15D-QA)

- Keep all `/udise` pages and `/api/udise/*` handlers GET-only. Page guards do not replace API guards; both are required.
- `StudentUdiseChecklistRow.gapCount` is the count of unique visible non-privacy `gapTypes`. Do not calculate it from the pre-deduplicated field list.
- Keep the CSV filename generated through `udiseChecklistFilename()`. It must remain sanitized and must identify the file as a planning checklist/gap report.
- Live QA reconfirmed leadership/Admin/Principal view/export, Viewer view-only, and Accountant/Teacher/Parent denial. Navigation visibility is permission-derived and direct API/export requests enforce the same boundary.
- The checklist output contract excludes raw record/user IDs, full Aadhaar, DOB/contact/address values, hashes, secrets, and filesystem paths. Availability/status labels are the public boundary.
- No schema or backup-format change was made. Existing P3005 baseline debt remains open, and Prompt 15E must wait for school confirmation of fields.
- Prompt 15D-QA verification baseline: lifecycle dry-run changed nothing; typecheck, 397 tests across 64 files, and production build passed. Browser QA covered 1366x768 and 390x844, both themes, contained report tables, direct role/API/export checks, zero page overflow, and zero console errors/warnings. Final data remained 8 Active students, 8 enrollments, 8 lifecycle events, 0 progression decisions, 0 staff, 0 guardians, and 0 QA users/students. Backup version 14 is `nalanda-fee-control-backup-2026-07-14-23-51.json` and contains no password hashes or secrets.
## Prompt 16A expense/vendor continuation note

Prompt 16A is implemented with `Vendor`, `ExpenseCategory`, `ExpenseDepartment`, `ExpenseRecord`, `ExpensePayment`, and `ExpenseAudit`. The additive migration is `prisma/migrations/20260715_expense_vendor_foundation/migration.sql`. This local database used `prisma db execute` because the existing SQLite P3005 baseline limitation is unchanged.

The core helpers are `lib/vendors.ts` and `lib/expenses.ts`. Pages live under `/vendors`, `/expenses`, and `/expenses/reports`; APIs live under `/api/vendors` and `/api/expenses`. Page and API permissions are independent server checks. Do not rely on hidden buttons. Viewer expense output omits payment references, private notes/reasons, and finance actor names; authorized finance operators see names instead of internal IDs. CSV output is allowlisted and formula-safe.

Money is Prisma Decimal. The server requires net = gross + tax - deduction. Draft is the only editable state. Submit/approve/reject/pay/cancel use transaction-protected current-state guards and append `ExpenseAudit`. Partial payments are separate `ExpensePayment` rows. Never merge these records with `Payment` or change fee allocation logic.

Backup version 15 includes all six new entities. Restore validates links, statuses, money, duplicate numbers/master rows, user mappings, and local-newer vendor preservation. Older backups default the arrays to empty. Password hashes remain excluded. See `docs/EXPENSE_AND_VENDOR_WORKFLOW.md` for the operator contract and limitations.

Final verification passed: lifecycle dry-run changed nothing; typecheck, 440 tests across 67 files, and production build passed. Browser QA covered the full expense workflow, role isolation, CSV, desktop/mobile, both themes, contained tables, no page overflow, and zero console errors/warnings. The browser pass caught and fixed the date-only UTC-offset regression. All temporary finance records and Teacher/Parent QA users were removed. The clean version-15 backup is `nalanda-fee-control-backup-2026-07-15-00-48.json` and contains no password hashes or QA16A markers.

Prompt 16A-QA is complete. QA hardened exact date/money/length validation, active-master checks inside expense transactions, payment-reference normalization, restricted vendor/expense response fields, vendor-status confirmation, independent rejection/cancellation UI reasons, and restore collision isolation. A same-number/different-ID local expense is retained without receiving the backup record's payments or audits.

The isolated copied-database restore test recreated one vendor/expense/payment/audit, repeated restore left each count at one, and a deliberate expense-number identity collision emitted warnings while attaching no dependents. Final verification passed: lifecycle dry-run changed nothing; typecheck, 450 tests across 67 files, production build, and version-15 backup passed. Browser QA covered all finance pages/workflows and every requested role at desktop/mobile in both themes with contained tables, no page overflow, and zero console warnings/errors. Cleanup returned finance and QA-user counts to zero. The clean backup is `nalanda-fee-control-backup-2026-07-15-01-26.json` and contains no QA16A markers or password hashes.

Prompt 16B budgets may proceed next. Prompt 16C cash book and Prompt 16D miscellaneous income must remain separate. Invoice file uploads, reversal vouchers, category/department master screens, payroll, inventory, GST/tax filing, bank reconciliation, gateway integration, and AI are not implemented.

## Prompt 16B - Budget and Department Spending Controls

Schema: `BudgetPlan`, `BudgetAllocation`, and `BudgetRevision` are additive and independent of student `Payment`. Allocation uniqueness uses `budgetPlanId + allocationKey`, because nullable category/department compound uniqueness is unsafe in SQLite. The migration also adds a partial unique index limiting APPROVED/LOCKED official plans to one per academic year. The existing P3005 baseline limitation remains; retain the SQL migration and use the established direct SQLite execute procedure in this checkout.

Core helper: `lib/budgets.ts` owns Decimal validation, thresholds, plan/revision transitions, actor-safe serialization, actual-spend calculation, and CSV. The authoritative plan total is always the sum of validated allocations. Expense matching uses category+department first, category-only second, department-only third, and marks an approved expense assigned after its first match. Plan totals still include unmatched approved expenses. Never query student `Payment` for a budget.

Routes: pages are `/budgets`, `/budgets/new`, `/budgets/[id]`, and `/budgets/reports`. APIs under `/api/budgets` cover create/list, detail/draft update, workflow, revision creation/workflow, reports, and export. All use page/API permission gates. APPROVED/LOCKED edits are impossible through the draft update route; only an approved revision can replace current allocations. The revision row retains before/after allocation snapshots and totals.

Defaults are conservative: Super Admin/Director get all; Admin and Accountant may manage drafts and export but cannot approve, lock, or revise; Principal and Viewer are read-only without export; Teacher/Parent have none. Custom role-matrix values remain supported.

Backup version 16 includes the three budget entities. Restore validates identity, totals, status/reasons, thresholds, official-year uniqueness, category/department/plan/snapshot links, and duplicates. It will not attach children to a same-number/different-ID plan, will not overwrite a newer local plan/allocation, never deletes local budget data, and continues excluding password hashes.

See `docs/BUDGET_AND_SPENDING_CONTROL_WORKFLOW.md` for formulas and operator behavior. Prompt 16B implementation sign-off passed 493 tests across 69 files, the 119-page production build, role/workflow/report/CSV/responsive browser QA with zero console errors or warnings, and full QA cleanup. The clean version-16 backup is `nalanda-fee-control-backup-2026-07-15-02-25.json`. Prompt 16B-QA should independently stress the same real workflow and safety boundaries. Prompt 16C cash book and Prompt 16D miscellaneous income remain separate future modules.

Prompt 16B-QA hardened cancellation permission, effective inherited thresholds, transactional master validation, exact paise presentation, deterministic allocation precedence, and revision-snapshot restore validation. The clean verification baseline is 502 tests across 69 files, 119 build pages, and version-16 backup `nalanda-fee-control-backup-2026-07-15-10-25.json`; the database contains 0 budget/vendor/expense/payment/audit/QA-user rows. Isolated restore rehearsal proved repeat idempotence and exact-identity collision isolation.

Do not start Prompt 16C until the current Browser-only QA gate is rerun. The bundled Browser client failed before opening a page with `Cannot redefine property: process`, so responsive/theme/overflow/table-scroll/dialog/console checks from Prompt 16B-QA are pending. No cash-book code was added during QA.

## Prompt 16C implementation contract

The later Prompt 16B-QA gate was completed and Prompt 16C is now implemented. Read `MISCELLANEOUS_INCOME_AND_CASH_BOOK_WORKFLOW.md` before changing finance control code.

- Models: `MiscIncomeItem`, `MiscIncomeRate`, `MiscIncomeReceipt`, `MiscIncomeReceiptLine`, `CashBookDay`, and `CashBookMovement`.
- Helpers: `lib/misc-income.ts` owns master/rate/receipt validation, snapshot totals, restricted serialization, reports, CSV, and starter items. `lib/cash-book.ts` owns India-local day calculations, source queries, movement validation, snapshots, source drift, workflow transitions, restricted views, and CSV.
- Routes: pages live under `/misc-income` and `/cash-book`; protected APIs mirror them under `/api/misc-income` and `/api/cash-book`.
- Authority: fee `Payment`, `MiscIncomeReceipt`, and `ExpensePayment` stay authoritative. Never create duplicate cash movements for those sources.
- Workflow: submit snapshots; approve and lock are separate compare-and-set transactions; locked days have no unlock. Later source changes only create a drift warning.
- Privacy: read-only roles receive no references, private reason/notes, actor names, raw user IDs, password hashes, secrets, or filesystem paths.
- Backup: version 17 includes all six entities. Restore uses backup-ID maps, isolates same receipt-number/cash-date collisions, preserves newer local roots, and never deletes local records.
- Starter items have policies but no rates. Operators must configure academic-year prices.

Prompt 16C implementation sign-off passed `lifecycle:backfill` with no changes, typecheck, 558 tests across 72 files, and the 133-page production build. Browser QA covered receipt/rate validation, print/cancel, deposits and Director handover, variance, snapshots, source drift, lock immutability, reports/CSV, all requested role boundaries, 1366×768 and 390×844, light/dark mode, contained tables, no page overflow, and zero console errors/warnings. Browser QA also corrected received-account enum submission, prompt-based cancellation, and serialized cash-date routing. Cleanup left only 6 seeded income items and zero rates, receipts, lines, cash days, movements, temporary users, vendors, expenses, or budgets. The clean version-17 backup is `nalanda-fee-control-backup-2026-07-15-13-30.json` and excludes password hashes. Prompt 16C-QA may proceed.

## Prompt 16D implementation map

- Schema: `BookCatalogItem`, `BookCatalogRate`, `BookSaleReceipt`, `BookSaleReceiptLine`, `BookCashSettlement`, plus `CashBookDay.bookSalesCashSnapshot` and a unique optional settlement-to-movement link.
- Core logic: `lib/books-finance.ts`, `lib/book-cash-settlement.ts`, and `lib/publisher-bills.ts`. Keep money in `Prisma.Decimal`, dates in the existing India-local helpers, and transitions in database transactions.
- Pages: `/books`, catalog, sales/detail/print, settlements, reports, publishers, publisher bills, and the specialized bill/service templates.
- APIs: `/api/books/catalog`, rates, sales/detail/cancel, settlements/detail/workflow, reports/export, and publisher bill/library-service actions.
- Permissions: the eleven `VIEW_`, `MANAGE_`, `CANCEL_`, `SUBMIT_`, `APPROVE_`, and `EXPORT_` books permissions live in `lib/permissions.ts`; do not replace page/API enforcement with UI hiding.
- Cash rule: `calculateCashSources` adds active CASH book receipts once. `effectiveCashSources` uses stored book cash for non-draft days and drift compares the live source summary. Settlement approval adds only the Director movement.
- Expense rule: publishers and annual service always use existing Vendor/ExpenseRecord/ExpensePayment. Never introduce a parallel publisher-payment model.
- Backup: version 18 arrays and cash snapshot are defined in `lib/backup.ts`, validated in `lib/restore.ts`, and restored through ID maps in `lib/restore-database.ts`. Older missing arrays/snapshot remain optional/zero.
- Privacy: serialize allowlisted safe catalog, settlement, receipt, report, and publisher fields. Never serialize actor IDs or sensitive Vendor bank/tax/contact fields to Viewer/Auditor.

The remaining future library phase may add circulation/inventory, but it must not reinterpret historical Prompt 16D receipts, rates, expense payments, or cash settlements. Do not broaden Prompt 16D into payroll, GST, bank reconciliation, inventory, gateway, AI, or fee logic.

## Prompt 16E library circulation planning handoff

Read `LIBRARY_CIRCULATION_AND_ACCESSION_REGISTER_PLAN.md`, `LIBRARY_DATA_MODEL_PLAN.md`, `LIBRARY_BARCODE_RFID_AND_PRIVACY_PLAN.md`, and `LIBRARY_CATALOG_AND_ACCESSION_WORKFLOW.md` before expanding the library module. Prompt 16E changed documentation only; Prompt 16F then added the separate title/copy/event foundation and backup version 19. The books module remains finance-only: `BookCatalogItem`/rates and `BookSaleReceipt`/settlement are separate from `LibraryTitle`/`LibraryCopy`.

Recommended sequence: 16F title/catalog and accession foundation; 16G memberships, issue/return/renew/reservation; 16H overdue/lost/damaged/charges and tightly scoped portals; 16I barcode labels/scanner workflow; 16J stock verification. Prompt 16F is strictly titles, physical copies/accession, title/copy import preview, non-circulation reports, permissions, and backup/restore: no members, loans, fines, barcode/RFID, procurement, or valuation. A future `LibraryCharge` should be the obligation record and create one linked Miscellaneous Income receipt only on collection. RFID needs documented device/vendor evidence and must never provide authentication or location tracking. Procurement and inventory valuation are separate initiatives.

## Prompt 16F implementation handoff

Prompt 16F is implemented in `prisma/schema.prisma`, `lib/library-catalog.ts`, `lib/library-accession.ts`, `lib/library-import.ts`, `lib/library-reports.ts`, `/library`, and `/api/library/*`. Backup version is 19 with `libraryTitles`, `libraryCopies`, and `libraryCopyEvents`. Exact restore mapping is title -> copy -> event; Vendor/Expense depend on exact restored IDs, never display-value attachment. `ImportBatch` now accepts `LIBRARY_TITLES` and `LIBRARY_COPIES`.

Before Prompt 16G, read `LIBRARY_CATALOG_AND_ACCESSION_WORKFLOW.md`. Preserve accession immutability, append-only events, restricted serializers, and the books-finance/fee/cash boundary. Replace `assertNoOpenLibraryCirculation` with the real transactional loan guard when circulation models exist. Do not add fines/payments or portals in 16G.

## Prompt 16G implementation handoff

Prompt 16G is implemented in the five circulation Prisma models, `lib/library-members.ts`, `lib/library-policies.ts`, `lib/library-circulation.ts`, `lib/library-reservations.ts`, `lib/library-circulation-reports.ts`, the `/library/{members,policies,circulation,issue,return,loans,reservations}` pages, and protected `/api/library/*` routes. Backup version 20 adds five circulation arrays after title/copy/event restore. The migration SQL enforces the membership XOR CHECK, unique open-copy key, and unique waiting member/title key.

Renewal uses original loan snapshots. Overdue is derived. `assertNoOpenLibraryCirculation` blocks withdrawal during an issued loan. No borrowing-policy defaults are seeded.

Prompt 16H is implemented in `LibraryIncident`, `LibraryChargeRule`, `LibraryCharge`, `LibraryChargeEvent`, the Library accountability helpers, and protected incident/charge/rule plus Parent/Teacher routes. Collection reuses one Miscellaneous Income receipt and never fee `Payment`. Backup v21 restores accountability after circulation, validates exact links/ownership/receipt identity, and preserves terminal/event history. Read `LIBRARY_INCIDENT_CHARGE_WAIVER_AND_PORTAL_WORKFLOW.md` before Prompt 16I/16J work.
# Prompt 16I continuation

Barcode helpers are `lib/library-barcodes.ts` and `lib/library-barcode-svg.ts`. Keep Code 39 validation, exact lookup, existing circulation helpers, and confirmation boundaries intact.
# Prompt 16J continuation notes

## Prompt 17A continuation notes

Homework helpers are lib/homework.ts, lib/homework-scope.ts, lib/homework-portals.ts, lib/homework-reports.ts, and lib/homework-api.ts. Preserve exact timetable ownership, Guardian-Student/current-enrollment isolation, safe response allowlists, compare-and-set transitions, append-only correction snapshots, formula-safe CSV, and the no-delete boundary. Backup version is 23.

Stock verification uses `lib/library-stock-verification.ts`, `lib/library-stock-scanner.ts`, and `lib/library-stock-reports.ts`; routes live under `/library/stock-verification` and `/api/library/stock-verification`. Preserve the transaction guards, immutable snapshot fields, append-only scan/workflow events, exact lookup, Viewer masking, itemized apply flow, and Director-only default lock. Backup version is 22. Do not bypass the existing Library copy transition/shelf/condition helpers.
# Prompt 17B continuation note

The Exams and Marks Foundation lives in `ExamCycle`, `ExamAssessment`, `StudentMark`, and append-only `StudentMarkEvent`; core helpers are `lib/exams.ts`, `lib/marks.ts`, `lib/marks-scope.ts`, `lib/marks-import.ts`, and `lib/exam-reports.ts`. API writes must use server permissions plus `loadScopedAssessment()`/exact timetable scope. Keep exam approval separate from lock, do not add a normal unlock, and never mutate `StudentProgressionDecision`. Backup version is 24 and restore must map exam -> assessment -> Student mark -> event without cross-attaching collisions. Prompt 17C may consume locked raw marks but must not rewrite them. See `docs/EXAMS_AND_MARKS_WORKFLOW.md`.

# Prompt 17C continuation note

Report-card models are GradingScheme/GradeBand, ReportCardTemplate, ReportCardBatch/ReportCardBatchExamSource, StudentReportCard, immutable StudentReportCardVersion, and append-only StudentReportCardEvent. Core helpers are `lib/report-cards.ts`, `lib/report-card-calculations.ts`, `lib/kg-report-card.ts`, `lib/report-card-scope.ts`, `lib/report-card-portals.ts`, `lib/report-card-reports.ts`, and `lib/report-card-backup.ts`. Preserve exact Teacher scope, one-locked-exam read-only source, CAS workflow transitions, issue/correction version immutability, Parent linked-child isolation, Viewer masking, formula-safe exports, and progression read-only behavior. Backup version is 25. See `docs/DIGITAL_REPORT_CARDS_AND_KG_RUBRIC_WORKFLOW.md`.

## Prompt 17D continuation note

Teacher Analytics models are `TeacherAnalyticsReviewCycle`, immutable `TeacherAnalyticsSnapshot`, `TeacherAnalyticsReview`, and append-only `TeacherAnalyticsEvent`. Preserve versioned definitions, provenance/data-quality envelopes, minimum cohort 5, no-score/no-rank/no-causation rules, server permission/Teacher ownership guards, compare-and-set workflow, safe allowlists, formula-safe CSV, and backup/restore version 26. Read `docs/TEACHER_PERFORMANCE_ANALYTICS_WORKFLOW.md` before Prompt 18A.

## Prompt 18A continuation note

Certificate models are `CertificateNumberSeries`, `CertificateTemplate`, `StudentCertificateRequest`, `StudentCertificate`, immutable `StudentCertificateVersion`, and append-only `StudentCertificateEvent`. Core helpers are `lib/certificate-templates.ts`, `lib/certificate-numbering.ts`, `lib/certificate-requests.ts`, `lib/student-certificates.ts`, `lib/certificate-snapshots.ts`, `lib/certificate-scope.ts`, `lib/certificate-portals.ts`, `lib/certificate-reports.ts`, and `lib/certificate-backup.ts`. Preserve issue-time transactional allocation, template snapshots, CAS workflow, Parent ownership, TC active-enrollment reason, source read-only isolation, formula-safe allowlists, and backup v27 collision isolation. Read `STUDENT_CERTIFICATES_TC_AND_BONAFIDE_WORKFLOW.md` before Prompt 18A-QA or 18B.
# Prompt 18B developer continuation

Class X document packages are implemented under `/class-x-documents`, `/parent/class-x-documents`, `app/api/class-x-documents`, and `app/api/parent/class-x-documents`. Core helpers are `lib/class-x-package-templates.ts`, `lib/class-x-document-packages.ts`, `lib/class-x-document-items.ts`, `lib/class-x-package-payments.ts`, `lib/class-x-package-handover.ts`, `lib/class-x-package-portals.ts`, `lib/class-x-package-reports.ts`, and `lib/class-x-package-backup.ts`.

Preserve these invariants:

- Board/Migration data is external physical custody/status only; do not add document generation, scans, Board branding, or security data.
- School items link exact Prompt 18A immutable certificate versions.
- Parent identity comes from the authenticated Guardian link, never a trusted raw Student ID.
- Preview has no financial write; collection creates one unique Miscellaneous Income receipt and no fee `Payment`; waiver creates no receipt.
- Package state uses compare-and-set changes plus append-only events.
- Eligibility and package workflows do not mutate lifecycle/progression/marks/report cards.
- Backup version is 28 and includes all seven Class X arrays with older-backup defaults.

Read `CLASS_X_DOCUMENT_PACKAGE_MIGRATION_AND_PAYMENT_WORKFLOW.md` before changing the module. Prompt 18C requires a new scope decision.
# Prompt 18C continuation

ID-card code is under `app/id-cards`, `app/api/id-cards`, `lib/id-card-*`, `lib/identity-cards.ts`, and `components/identity-card-*`. Keep template field allowlists strict, preserve no-photo behavior until a separately approved managed source exists, allocate numbers only inside issue transactions, keep versions/events immutable, and preserve Parent/Teacher server-side ownership checks. Backup format is version 29.

# Prompt 19A continuation

Read `IN_APP_NOTIFICATION_CENTRE_AND_DELIVERY_LEDGER_WORKFLOW.md` before changing notifications. Core code is under `app/notifications`, `app/teacher/notifications`, `app/parent/notifications`, `app/api/notifications`, `lib/notification-*`, and `components/notification-*`.

Preserve these invariants: `IN_APP` only; plain text; exact allowlisted internal links; no contact fields; preview performs no writes; final audience resolution is transactional; campaign/User recipients are unique; Parent context derives from current Guardian ownership; Teacher scope derives from the exact timetable chain; submission freezes content/audience; publication cannot be edited; corrections are new linked campaigns; events are append-only; reports are aggregate by default. Backup format is version 30.

Do not add WhatsApp/SMS/email/push/provider/queue/webhook/service-worker code as a “small extension.” Prompt 19B and 19C require separate architecture and authorization.
# Prompt 19C developer continuation

Read `SMS_AND_EMAIL_ONE_WAY_COMMUNICATION_WORKFLOW.md` before changing external communication. The shared `SmsEmail*` models isolate SMS and Email from WhatsApp and Prompt 19A while reusing published campaign recipients. Provider secrets belong only in environment variables listed by name in `.env.example`; never add credential columns or credential UI. Keep `MockSmsProvider`/`MockEmailProvider` deterministic. Do not implement a LIVE SMS adapter until the exact selected provider's current official contract is available. Gmail uses `gmail.send`, plain-text MIME, base64URL, one destination per logical delivery, and `ACCEPTED` semantics.

Operational checks are `pnpm.cmd sms-email:health`, `pnpm.cmd sms-email:process`, `pnpm.cmd sms-email:webhook-fixtures`, and `pnpm.cmd sms-email:inspect`. Backup version 33 requires all eleven SMS/Email arrays plus older-backup compatibility, collision isolation, ownership/contact-hash validation, and exclusion of credentials/full contacts. Prompt 19D, inbound content, OTP, arbitrary HTML, attachments, tracking, marketing, and finance mutation are hard boundaries.

# Prompt 19D developer continuation

Read `PWA_AND_MOBILE_APP_STRATEGY.md` before changing the manifest, icons, `/sw.js`, `/offline`, `/install-app`, `/settings/pwa`, logout, or global PWA runtime.

Hard invariants:

- cache prefix stays `nalanda-pwa-`;
- authenticated navigation and `/api/**` stay network-only;
- `/offline` is the only cached HTML exception;
- non-GET requests are never queued, replayed, or cached;
- no push/notification permission/background sync is introduced;
- a waiting worker activates only after the accessible Update Now confirmation;
- cache clearing deletes only Nalanda PWA cache names;
- `/settings/pwa` remains guarded by `VIEW_SYSTEM_HEALTH`;
- `NEXT_PUBLIC_PWA_BUILD_VERSION` is the deployment cache/update version input;
- physical-device and wrapper/native work require a later prompt;
- backup remains version 33 unless a genuine data-model change occurs.

For production update QA, build A and B with different `NEXT_PUBLIC_PWA_BUILD_VERSION` values. Do not silently activate the waiting worker. Remove QA caches and stop temporary servers after the test.

# Prompt 20A developer continuation

Read `AI_ASSISTANT_SAFETY_AND_READ_ONLY_RETRIEVAL_WORKFLOW.md` before changing the assistant. Core code is under `app/ai-assistant`, `app/api/ai-assistant`, `components/ai-assistant-ui.tsx`, and `lib/ai-assistant-*`. The six Prisma models are backup/restore version 34.

Preserve these invariants:

- pages and APIs remain independently server-gated;
- documentation paths come only from the compiled registry, never model/user paths;
- aggregate tools remain handwritten read functions with fixed outputs, role checks and minimum group five;
- provider input/output is redacted and schema/citation validated;
- no question, answer, evidence body, system prompt, provider credential or endpoint is persisted;
- audit remains hashes, allowlisted keys, counts, timing, decision and expiry only;
- `LOCAL_HTTP` and `CLOUD_API` remain disabled until a separately reviewed phase;
- only MOCK activation is possible and exact confirmation is required;
- restore forces live providers disabled and validates links/hashes/collisions;
- PWA caching remains static-only and must never include assistant pages/APIs.

Use `pnpm.cmd qa20a:fixtures setup|inspect|cleanup` for deterministic QA. Cleanup must be run twice and the version-34 backup must be created afterward.

## Handwritten fee-register OCR (Prompt 20B)

Read `HANDWRITTEN_FEE_REGISTER_OCR_WORKFLOW.md` before modifying this module. Core code is under `app/fee-register-ocr`, `app/api/fee-register-ocr`, `components/fee-register-ocr-ui.tsx`, and `lib/fee-register-ocr-*`. Source bytes are private filesystem data and never belong in `public`, logs, CSV, Prisma, or JSON backup.

Keep provider output untrusted, Student matching exact/conservative, revisions append-only, approval bound to `reviewVersion`, and posting fail-closed. Do not implement a Payment create call until one existing shared helper demonstrably preserves allocation, outstanding balance, overpayment rules, ERP receipt numbering, historical `Payment.date`, Daily Cash Book behavior, and idempotency. Backup/restore is version 35.

## Prompt 20C encrypted automatic backup boundary

Read `AUTOMATIC_CLOUD_BACKUP_AND_DISASTER_RECOVERY_WORKFLOW.md` and `DISASTER_RECOVERY_RUNBOOK.md` before changing providers, keys, retention, scheduling, or restore rehearsal. Core code is under `app/cloud-backup`, `app/api/cloud-backup`, `components/cloud-backup-ui.tsx`, and `lib/cloud-backup-*`. Backup/restore is version 36 with eight optional-on-input arrays.

Preserve gzip-before-AES-256-GCM, fresh 12-byte nonces, authenticated headers, exact plaintext/ciphertext SHA-256, environment-only versioned 32-byte keys, encrypted-only LOCAL_FOLDER, path/symlink checks, read-after-write verification, exact-object pruning, and isolated repeated restore. Do not expose keys/credentials/bodies/absolute paths; implement Browser key/OAuth input; enable LIVE; treat Prisma schedules as deployed schedulers; restore over the operational database; include OCR image bytes; or mix the separately completed Prompt 20D public-website scope into this module.

Commands are `cloud-backup:health`, `process-due`, `run-now`, `verify`, `rehearse`, `retention-preview`, `prune`, `inspect`, and `cleanup-temp`. Windows Task Scheduler or a hosting scheduler must separately invoke `process-due`.

## Student location planning boundary (Prompt 21A)

Read `STUDENT_LOCATION_MAPPING_PRIVACY_COST_AND_FEASIBILITY.md`, `STUDENT_LOCATION_THREAT_MODEL_AND_DATA_POLICY.md`, and `MAPPING_PROVIDER_COMPARISON_AND_COST_MODEL.md` before touching Student address or location behavior.

Prompt 21A is documentation-only. Preserve backup version 37 and do not infer an implemented schema, route, API, permission, map, geocoder, provider, address conversion, browser geolocation request, or processed location record.

Prompt 21B is a conditional gate, not an automatic implementation approval. Before coding, require recorded leadership purpose and qualified legal/privacy approval. Keep structured postal address separate from any nullable coarse point; distinguish unknown from unverified; migrate legacy text as unverified; add dedicated server-side permissions; make Parent edits request-only and linked-child scoped; invalidate a point when its source address changes; and use explicit projections for APIs, backup, restore, export, print, audit, AI, PWA, and public surfaces.

Do not inherit location access from ordinary Student permissions, add exact-house points, call public Nominatim, enable Google/Mapbox, bulk-convert addresses, expose raw coordinates in CSV/URLs/logs, cache location data offline, request device location, or begin 21C/21D work. Use synthetic QA only and verify at least one allowed and multiple blocked roles.

### Prompt 21B preflight stop gate

## SEC-1 security continuation contract

Read `SECURITY_RUNTIME_AUDIT_AND_BACKLOG_RECONCILIATION.md`, `ERP_SECURITY_ATTACK_SURFACE_AND_THREAT_MODEL.md`, and `SEC_1_SECURITY_AUDIT_AND_HARDENING_REPORT.md` before changing authentication, restore, uploads, providers, exports, public/PWA boundaries, or error handling.

Preserve production bootstrap proof, current-role/credential session invalidation, Host-prefixed cookies, same-origin unsafe-request validation, copied-QA-only Browser restore, typed Prisma/no raw SQL, receipt ownership, import/report/webhook bounds, OCR containment, formula-safe CSV, `safeClientError`, MOCK-first providers, keyed privacy hashes, immutable approval snapshots, static-only PWA cache, read-only AI, and public-content-only queries.

Use QASEC1 fixtures and a fresh copied database for runtime QA. Never run `lifecycle:backfill` or login QA against the operational database. Prompt 21B/21C/21D remain blocked.

Read `STUDENT_ADDRESS_21B_APPROVAL_RECORD.md`, `STUDENT_ADDRESS_PRIVACY_NOTICE_DRAFT.md`, `STUDENT_ADDRESS_RETENTION_AND_DELETION_POLICY_DRAFT.md`, and `STUDENT_ADDRESS_ACCESS_AND_INCIDENT_MATRIX.md`. They are governance drafts, not implementation authority.

Current decision: `PENDING` / `PROMPT_21B_BLOCKED`. Every mandatory blocker is `UNRESOLVED`; no leadership approval or qualified Indian privacy/legal review is evidenced. Do not add schema, migrations, structured address fields, coordinates, location models, routes/APIs, correction UI, map, geocoder, provider package/call/key, operational records, or backup changes.

If the gate is later resolved, the recommended boundary to assess is Tier 1 structured postal address only with `OMIT_ALL_COORDINATES_FROM_21B`, linked-Parent request-only correction, office approval, explicit projections, and suppressed text-derived Tier 2 aggregates at an approved threshold. Tier 3 remains a separate phase; Tier 4 and Tier 5 are prohibited. Do not begin Prompt 21C or Prompt 21D.

## SEC-1 continuation checkpoint

SEC-1A and SEC-1B are closed for the local repository/runtime boundary. Start from `SEC_1_SECURITY_AUDIT_AND_HARDENING_REPORT.md`, `ERP_SECURITY_ATTACK_SURFACE_AND_THREAT_MODEL.md`, `SECURITY_RUNTIME_AUDIT_AND_BACKLOG_RECONCILIATION.md`, `SEC_1_RUNTIME_BROWSER_AND_UI_UX_AUDIT.md`, and `SEC_1_RUNTIME_ROUTE_API_MATRIX.csv`.

Any future runtime security QA must:

1. create a fresh `tmp/sec1-runtime` root;
2. copy `prisma/dev.db` byte-for-byte and compare SHA-256 before any fixture;
3. set process-scoped isolation/provider/upload variables only;
4. use only QASEC1 fixtures and local MOCK/disabled providers;
5. fail closed if the active database resolves to the operational database;
6. stop the temporary server, inspect cleanup twice, and delete the entire root;
7. recheck the operational hash, timestamp, `.env`, and business totals.

Do not reuse the deleted SEC-1B copy or logs. Deployment-only TLS/HSTS/proxy/distributed/logging checks remain separate. Prompt 21B/21C/21D remain blocked.

### SEC-1-QA closed checkpoint

Read `SEC_1_INDEPENDENT_QA_CLOSURE_REPORT.md` after the SEC-1A/SEC-1B reports.
The independent pass uses `QASEC1QA` fixtures and a new isolated root; do not
reuse either deleted QA root.

Preserve the SEC-1-QA fixes:

- exact-pinned official SheetJS 0.20.3 and its lockfile integrity test;
- read-only GET semantics for ID-card print/OCR private-image retrieval;
- explicit same-origin POST print auditing;
- wrong-role Parent/Teacher portal denial with the linked Accountant Staff
  consent exception modeled explicitly;
- the fixed 48 px mobile drawer dismiss strip.

The current inventory is 274 pages and 376 APIs. Local SEC-1 is fully cleared.
Before internet deployment, verify TLS/HSTS, proxy-header stripping, centralized
log retention/alerts, and distributed limiter/worker coordination. Prompt
21B/21C/21D remain blocked.

SEC-1-QA final baseline: 1,410 tests across 155 files, optimized build with
211/211 static pages, and clean backup version 37
`nalanda-fee-control-backup-2026-07-20-08-31.json`.

## Prompt 23B-M Management audit checkpoint

Read `SCHOOLKNOT_MANAGEMENT_REPLACEMENT_MATRIX.md` before planning a Schoolknot parity feature. It is the first authenticated Management-only reconciliation and supersedes name-based assumptions for that role. Also enforce `SCHOOLKNOT_FEATURES_NOT_TO_COPY.md`, the provisional M1-M6 wave document and the export/migration requirements.

Boundary rules:

1. Management audit completion does not complete Prompt 23B. Parent, Teacher and Principal authenticated audits remain pending.
2. Do not implement a cross-role feature merely because the Management account displayed it. Hold submissions, Parent correction/communication/leave, Teacher marks/homework/timetable changes, Principal approvals, events/transport visibility, notification behavior and report-card presentation for the relevant role evidence.
3. Treat public admissions content, Staff records, Teacher analytics, notices, homework publishing, timetable, Daily Collection, Expenses/Cash Book, public events, PWA, cloud backup and Parent correction as distinct from similarly named missing workflows.
4. Reject predictable passwords, unrestricted bulk edits/exports, hard deletion, recipient/read surveillance, Staff usage ranking, marks-driven employment decisions, unnecessary sensitive fields, broad location and ungoverned send/edit/delete actions.
5. Any future migration begins with a vendor field dictionary, source IDs, row/control totals, SHA-256 originals, an encrypted untouched archive, copied-database preview and signed reconciliation. Do not scrape Schoolknot or import credentials.

Prompt 23B-M began from 274 pages, 376 APIs, backup version 37, schema SHA-256 `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`, 40 migration SQL directories plus `migration_lock.toml` (41 entries by the established checkpoint convention), and operational database SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`. Business controls were 8 Students, 8 active enrollments, 19 active non-cancelled Payments and INR 99,100 collected. No schema/runtime/business module work is authorised by this checkpoint.

Prompt 21B/21C/21D remain blocked. Prompt 22B remains conditional and unimplemented. Independent `23B-M-QA` is now cleared after correcting 12 over-strong classifications and adding explicit evidence to every should-not-copy row. Read `SCHOOLKNOT_MANAGEMENT_RECONCILIATION_QA_REPORT.md` before using the matrix.

Prompt 23B-M final verification: 1,429 tests across 157 files passed; optimized build passed with 211/211 static pages; clean backup version 37 is `nalanda-fee-control-backup-2026-07-22-02-03.json`. Schema and operational database SHA-256 values, migration inventory, routes/APIs and the 8/8/19/INR 99,100 business baseline remained unchanged.

The next Schoolknot work must obtain the authenticated Parent, Teacher and Principal audits before final Prompt 23B consolidation. Management QA clearance does not approve M1-M6 implementation or any cross-role workflow.

Prompt 23B-M-QA final verification: 1,437 tests across 158 files passed; optimized build passed with 211/211 static pages; clean backup version 37 is `nalanda-fee-control-backup-2026-07-22-02-29.json`. Routes/APIs remain 274/376; schema/database hashes, 41-entry migration inventory and 8/8/19/INR 99,100 business baseline remain unchanged.

## DEVOPS-1A private Git baseline

The source baseline belongs only in private `vsairohith67/nalanda-school-erp`. Read `GIT_BASELINE_AND_RECOVERY_WORKFLOW.md` before staging or pushing. Run `pnpm.cmd git:safety-check` before and after staging, inspect the full staged name list, and never track `.env`, SQLite/sidecar files, backup JSON, private uploads/OCR/provider storage, QA/log/export artifacts, Schoolknot files, `node_modules`, `.next`, or coverage. The stable source tag is `baseline-sec1-management-2026-07-22`.

The Git baseline does not contain operational recovery data. DEVOPS-1B and its independent QA later cleared the clean-install migration-chain repair without onboarding the real operational database. Prompt 21B/21C/21D remain blocked, Prompt 22B remains conditional, and Parent/Teacher/Principal Schoolknot audits remain pending.

## DEVOPS-1C staging readiness

DEVOPS-1B is fully cleared. DEVOPS-1C runs only on `devops/staging-readiness-plan` and defines restricted single-instance SQLite staging, a Mumbai Linux VPS recommendation, a managed persistent-disk container fallback, fail-closed environment validation, synthetic database deployment, HTTPS/proxy/cache controls, monitoring/logging, singleton jobs, rollback, privacy, cost decisions and physical PWA entry gates. No cloud deployment, DNS record, provider account/resource, operational database onboarding or live provider activation occurred. Physical Android/iPhone certification remains pending HTTPS staging. Prompt 21B-21D remain blocked, Prompt 22B conditional, and Parent/Teacher/Principal Schoolknot audits pending.

The DEVOPS-1C local rehearsal passed on loopback with a fresh synthetic database, version-37 synthetic backup, production build/start, disposable self-signed HTTPS proxy, HSTS/secure-cookie/no-store/static-cache checks, database persistence across restart and rollback to a distinct prior build. Implementation verification passed 274 pages, 377 APIs, 1,471 tests across 162 files and 211/211 static pages. The operational database remained byte-for-byte at SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`; final operational backup is version 37 `nalanda-fee-control-backup-2026-07-23-04-19.json`.

Independent DEVOPS-1C-QA passed after correcting `.env*`/PWA identifier validation, rehearsal secret-artifact redaction/deletion, the complete environment inventory, immutable systemd write boundaries and build-specific Next cache placement. The new QA synthetic root passed migrate/status, version-37 backup, HTTPS/proxy/cache/cookie, restart and rollback. Final regression is 1,473 tests across 162 files and 211/211 static pages; final operational backup is `nalanda-fee-control-backup-2026-07-23-04-38.json` with all checkpoint integrity values unchanged.

## FIN-2A Accountant privacy and receipt integrity

Read `ACCOUNTANT_DATA_MINIMISATION_AND_RECEIPT_INTEGRITY.md` before changing Student lookup, fee reports, payment exports, payment correction, receipt print, cancellation, dues, ledger, Daily Collection, dashboard totals, Receipt Audit, or Cash Book fee sources.

Developer invariants:

1. Accountant must use `app/api/finance/students/lookup/route.ts`; never grant broad Student serializers as a shortcut.
2. Add a purpose-specific `select` and serializer for each finance response. Do not return a Prisma Student or Payment object.
3. Keep Accountant hard denials for `VIEW_STUDENTS`, `MANAGE_RECEIPTS`, `COMMUNICATE_PARENT`, and `EXPORT_REMINDERS`, and Viewer/Auditor hard denial for `VIEW_LEDGER`, across safe defaults, effective reads, matrix display, validation, and explicit save. Final-receipt actions must use only `CANCEL_FINAL_RECEIPT` or `CORRECT_FINAL_RECEIPT`; legacy `CANCEL_PAYMENTS`, `EDIT_PAYMENTS`, or `MANAGE_FINANCE` do not substitute. Backup generation must remain read-only and preserve stored role rows.
4. New finance CSV routes must use a documented field allowlist, formula-safe cell encoding, a 2,000-row fail-closed limit, a maximum 366-day range where dates apply, private/no-store headers, safe filenames, and `FINANCE_EXPORT_DOWNLOADED` audit.
5. `lib/receipt-integrity.ts` is authoritative. Never calculate collection from only `Payment.isCancelled = false`; first exclude any mixed-state receipt.
6. Final cancellation is whole-receipt, reasoned, versioned, transactional, append-only and idempotent. It requires exact `CANCEL_FINAL_RECEIPT` authority and is available to an active Accountant, Director or Super Admin with that permission. Correction requires exact `CORRECT_FINAL_RECEIPT`; non-financial changes append a version and financial changes use linked cancellation/reissue. Do not add a one-component cancel button or in-place final-receipt overwrite.
7. Receipt/admission numbers stay immutable during payment correction. Any future reassignment requires a separately reviewed correction workflow.
8. Store `receiptAuditSnapshot` only; sanitize historical JSON before a restricted response or render.
9. Mutation tests run only on an isolated copied/fresh database. `pnpm.cmd qa:fin2a` refuses to operate outside the established QA root and hash-checks the operational database.
10. Do not interpret FIN-2A as refund, gateway, partial cancellation, payroll, Day Closer, or Schoolknot-parity approval.

FIN-2A verification passed 274 page routes, 378 API routes, typecheck, 1,496 tests across 163 files, and 212/212 build entries. Copied-database Browser QA passed at 1366x768 and exact 390x844 in light/dark mode with aggregate-only Viewer behavior, accessible whole-receipt cancellation, contained 44px mobile controls, zero final console warnings/errors, and zero final production stderr. Cleanup was verified twice and the isolated database was destroyed. The final version-37 backup is `nalanda-fee-control-backup-2026-07-26-19-36.json`. Independent QA must use the separate `FIN2AQA` fixture mode before merge.

## FIN-2B Accountant final-receipt cancellation and correction

Read `ACCOUNTANT_RECEIPT_CANCELLATION_CORRECTION_AND_NOTIFICATION.md` before changing final-receipt behavior. Cancellation is whole-receipt, versioned and transactional. Non-financial correction appends an immutable audit version; financial correction cancels and reissues a linked replacement. Successful Accountant actions create exactly-once in-app notifications for active Directors and Super Admins. Non-mutable Cash Book days block ordinary Accountant action and create a leadership review alert without rewriting the snapshot. These workflows are not deletion or refund.

FIN-2B and FIN-2B-QA are complete. No FIN-2C implementation is authorised. Do not fold refunds, chargebacks, gateway/settlement, Day Closer, payroll or employee self-service into receipt-governance maintenance.

The final backup initially exposed and stopped a six-row operational permission-seeding rewrite. The seeder was corrected to preserve existing rows, a byte-identical rollback candidate was independently verified, and the operational database was atomically restored to SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`, 4,771,840 bytes, timestamp `2026-07-19T13:21:15.353Z`, with the exact schema/migration/business checkpoint. A repeat backup left hash and timestamp unchanged.

## Prompt 23C Teacher attendance exact scope

Read `TEACHER_ATTENDANCE_EXACT_SCOPE_WORKFLOW.md` before changing Student
attendance, Teacher timetable links, substitute duties, Teacher dashboard
totals, attendance reports or CSV.

`lib/teacher-attendance-scope.ts` is the one server-side authority. For a
Teacher, permission never creates cohort access: require the active User,
active linked StaffMember, active linked TimetableTeacher and exact active
current-year class/section assignment, or a confirmed substitute row for the
exact date and cohort. Never infer scope from role, subject name, a previous
assignment or an empty section. Leadership remains separately permissioned.

Every new Teacher attendance surface must reuse that resolver before reading
Student/session data. Preserve generic privacy-safe errors, private/no-store,
same-origin mutation protection, the 512 KiB/2,500-record bounds,
serializable expected-version compare-and-set and append-only reasoned
correction audit. Use only ignored copied databases for mutation QA.

Prompt 23C-QA independently cleared the critical attendance blocker. It did
not approve full Teacher parity. The next phase is `UX-1A`; remaining Teacher
workflows and role QA remain separately gated.
