# Nalanda Fee Control — Project Handover

## Current governed implementation checkpoint

`EXAM-RC-IMPL-1` and independent QA are complete. The retained
`feature/exam-scheme-assignment-foundation` branch introduces one additive
Prisma migration for Principal examination creation, class/section scope,
versioned raw or weighted schemes, components, papers/groups,
grade/co-scholastic/template bindings, exact timetable-backed Teacher
assignments, activation/freeze/archive lifecycle and append-only audit.

The implementation does not enter Student marks, calculate or publish results,
or generate report-card PDFs. The operational migration is applied with the
business/account baseline unchanged. The next phase is
`EXAM-RC-IMPL-2 — Teacher Marks Entry, Moderation and Calculation Foundation`.
See
[`EXAMINATION_SCHEME_ASSIGNMENT_FOUNDATION.md`](EXAMINATION_SCHEME_ASSIGNMENT_FOUNDATION.md)
and
[`EXAMINATION_SCHEME_ASSIGNMENT_QA_CLOSURE.md`](EXAMINATION_SCHEME_ASSIGNMENT_QA_CLOSURE.md)
before operating or extending this domain.

## Project name and purpose

**Project:** Nalanda Fee Control  
**Local folder:** repository root of the current clone

Nalanda Fee Control is a local-first school operations application for the 2026–27 academic year. It keeps student details, fee collections, pending dues, ledgers, receipts, audit history, imports, backups, users, school settings, and timetables in one controlled system.

The immediate goal is safe use on a trusted Windows school computer. Cloud deployment can be considered later, only after a successful real-data pilot and a separate security/deployment review.

## Current status

The fee collection system is stable and the timetable module is usable. The current verified baseline is:

- TypeScript typecheck passed.
- 173 automated tests passed across 35 test files.
- Production build passed.
- Full backup command passed.
- Full backup version 5 covers fee data, receipt/audit data, import verification, go-live checklist, role permission matrix rows, timetable foundation, timetable drafts, and timetable entries.
- Password hashes are intentionally not included in backups.

Implemented areas include authentication, Super Admin and role permission matrix, user/password management, first-run setup, system health, student master, fees and dues, ledger and collection reports, receipt audit/print, reminders, imports/exports, safe backup/restore, import verification, go-live checklist, and the complete current timetable workflow.

## Technology used

- Next.js 15 App Router
- React 19
- TypeScript
- Prisma ORM 6
- SQLite local database
- Vitest automated tests
- SheetJS/XLSX for Excel and CSV import
- pnpm package manager
- Windows `.bat` helper scripts

## First setup on a Windows computer

1. Install the current Node.js LTS release.
2. Open PowerShell and run:

```powershell
npm install --global pnpm
Set-Location "<repository-root>"
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env
```

3. Edit `.env`. Set `AUTH_SECRET` to a private random value of at least 32 characters. Keep `SESSION_COOKIE_SECURE="false"` for local HTTP only.
4. Prepare the database:

```powershell
pnpm.cmd exec prisma generate --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
pnpm.cmd db:seed
```

5. Start the app:

```powershell
pnpm dev
```

6. Open `http://localhost:3000`.
7. If no active Director exists, complete the first-run setup screen.

On restricted Windows machines where Prisma setup commands fail, `pnpm db:init` can initialize the SQLite structure. The double-click helper `tools\start-dev.bat` starts the development server.

## Routine commands

Run these from the project folder:

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm backup
```

To promote an existing user to owner-level access:

```powershell
pnpm.cmd user:make-super-admin director
```

You can also set `MAKE_SUPER_ADMIN_USER` to a username or email. The command promotes only an existing user, does not create a password, and does not print password hashes.

Useful Windows helpers:

- `tools\start-dev.bat` — start the app.
- `tools\run-checks.bat` — typecheck, tests, and production build.
- `tools\build-app.bat` — production build only.
- `tools\backup-now.bat` — timestamped JSON backup.

## Important warnings

1. **Always back up before an import, restore, migration, or major data correction.**
2. **Never test restore on the only live database.** Stop the app, copy `prisma\dev.db`, and test using the copy.
3. A JSON backup on the same computer is not enough. Copy important backups to USB or another protected location.
4. SQLite is a local file database. It is not suitable for uncontrolled multi-computer access or cloud hosting without an architecture change.
5. Do not share Director/Admin accounts. Every operator should use a named account.
6. Seed/demo accounts and data are for testing. Change temporary passwords before real use.
7. Payment import has no batch rollback button. Recovery is the backup taken immediately before import.
8. A generated timetable remains a `DRAFT`. Review conflicts and workload before marking it `ACTIVE`.
9. User password hashes are excluded from backup. Restore does not replace or create login credentials.
10. Existing older backup files remain accepted, but they cannot restore data sections that did not exist when they were created.
11. Never disable or demote the last active Super Admin. The app blocks this, but operators should still treat Super Admin accounts as school-owner accounts.

## Current known limitations

- The app is local-first and uses SQLite; it is not yet a supported cloud or internet-facing deployment.
- Browser print is used for receipts and timetables; there is no server-generated PDF service.
- Timetable spreadsheet export is CSV, not XLSX.
- The current full-backup payload does not restore the `SchoolSettings` singleton. Keep a separate record of approved school/receipt settings and verify them after restore.
- The timetable generator assists with placement but does not model rooms, substitute eligibility, leave, or every special school rule.
- WhatsApp reminders open WhatsApp or copy prepared text. There is no WhatsApp Business API automation.
- There is no biometric attendance, payroll, payment gateway, SMS gateway, or attendance module.
- Restore is preview-first but must still be tested on a copied database before live use.
- Prisma may print a deprecation warning about the `package.json` `prisma` seed configuration. It is not a current failure; before Prisma 7, move that configuration to the newer Prisma configuration format.
- Some source files may display old character-encoding artifacts in a terminal configured with the wrong code page. Verify visible UI text after environment changes.
- Teacher and Parent roles exist for future access planning only. No teacher dashboard or parent portal is built in this prompt.

## Roles and permissions

The current roles are Super Admin, Director, Principal, Admin, Accountant, Teacher, Parent, and Viewer / Auditor.

- **Super Admin** is owner-level, always has all permissions, and cannot lose core access.
- **Director** is school leadership with broad operational access but cannot remove Super Admin safety.
- **Principal** is intended for academic, student, timetable, and report access by default.
- **Admin** supports office operations and delegated user work.
- **Accountant** handles fee collection, dues, ledgers, receipt audit, and finance reports.
- **Teacher** has a safe placeholder and **Parent** has a read-only portal; broader teacher modules remain future work.
- **Viewer / Auditor** is read-only/audit-oriented access.

Open **Role Permissions** to change checkbox permissions by module. Use **Save Permissions** to apply changes or **Reset to Recommended Defaults** to return to the built-in matrix. Changing permissions affects what users can see and do. After changing a role, sign in with a test account for that role and confirm the sidebar plus direct blocked pages behave as expected.

## Recommended next phases

1. **Real-data pilot only:** follow [REAL_DATA_PILOT_PLAN.md](REAL_DATA_PILOT_PLAN.md) on a copied database and obtain school sign-off.
2. **Go-live preparation:** remove or clearly separate demo data, create named users, change passwords, confirm school/fee settings, and complete [REAL_DATA_GO_LIVE_CHECKLIST.md](REAL_DATA_GO_LIVE_CHECKLIST.md).
3. **Operational hardening:** schedule daily and off-device backups, document the responsible person, and perform periodic copied-database restore drills.
4. **Cloud feasibility study:** only after local pilot success. Review database migration, authentication, HTTPS, hosting, backups, privacy, concurrency, and support ownership before writing cloud code.
5. **Attendance procurement/integration planning:** use [ATTENDANCE_FUTURE_MODULE_PLAN.md](ATTENDANCE_FUTURE_MODULE_PLAN.md). Do not build attendance before selecting and testing a suitable device.

## Handover reading list

- School operator: [NOOB_OPERATING_GUIDE.md](NOOB_OPERATING_GUIDE.md)
- Developer: [DEVELOPER_CONTINUATION_GUIDE.md](DEVELOPER_CONTINUATION_GUIDE.md)
- Pilot team: [REAL_DATA_PILOT_PLAN.md](REAL_DATA_PILOT_PLAN.md)
- Full document list: [INDEX.md](INDEX.md)
