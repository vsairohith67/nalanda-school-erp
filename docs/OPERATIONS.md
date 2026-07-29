# Nalanda Fee Control Operations

## Current operational baseline

DATA-0B established 0 Students / 0 active enrollments / 0 Payments / ₹0
collected. Demo business seeding is disabled and must never be enabled against
`prisma/dev.db`. Preserve receipt numbering; do not reuse historical receipt
identities. Protected pre-clean rollback and post-clean v37 artifacts are
listed in `CONTROLLED_SAMPLE_DATA_CLEANUP_AND_NEW_BASELINE.md`.

`AUTH-2A` is complete through P4C: one named, rotated and verified Super Admin
remains active; Admin, Accountant and Viewer are inactive. Do not reactivate
one of those accounts until a named owner has a current operational need.
Never share credentials or disable the last active Super Admin.

DEVOPS-1E registered the already-present clean schema as the applied Prisma
baseline by adding only `_prisma_migrations` metadata. No application data,
configuration, account, role, permission, or schema changed. The protected
version-37 logical backup and byte-identical raw rollback copy are retained in
ignored operator storage. See
`OPERATIONAL_MIGRATION_BASELINE_ONBOARDING.md` for hashes and restoration
evidence. Do not delete or edit migration metadata, run `db push`, or rerun
`migrate resolve` manually. Escalate any migration-status discrepancy and keep
the application stopped until the reviewed recovery procedure is chosen.

## Daily workflow

1. Confirm the Windows computer date and time.
2. Sign in with your own account; do not share passwords.
3. Check the Dashboard and any receipt audit warnings.
4. Enter or import payments from the physical collection register.
5. Verify receipt number, student, amount, mode, account, and date before saving.
6. Print receipts where required.
7. Compare Daily Collection totals with cash, bank/UPI records, and the physical register.
8. Resolve errors before closing the day.
9. Sign out when leaving the computer.

## Fee receipt privacy and cancellation

FIN-2A privacy/export/integrity and FIN-2B final-receipt governance are complete. The policy below supersedes earlier operator wording that limited final-receipt cancellation to leadership. No FIN-2C workflow is approved; refund, gateway/settlement, Day Closer, payroll and employee self-service remain outside this routine.

- Accountant uses the payment lookup, ledger, pending-dues, collection, receipt, and audit screens only for fee collection. Those surfaces must not be used to obtain Parent contacts, address, date of birth, Aadhaar-related data, documents, marks, medical information, private Student notes, credentials, or internal actor IDs.
- Accountant cannot prepare Parent communication from the ledger or export reminder destinations. An Accountant may cancel a final receipt only with `CANCEL_FINAL_RECEIPT`, and may correct one only with `CORRECT_FINAL_RECEIPT`; broad finance permissions do not substitute.
- An authorised Accountant, Director or Super Admin opens the payment or Receipt Audit entry, reviews the whole receipt, selects **Cancel entire receipt** or the governed correction action, enters a specific reason, and confirms the in-app dialog. Successful Accountant actions notify every active Director and Super Admin.
- Cancellation always applies to every Cash/UPI/bank component under that receipt. It preserves the receipt and audit history, reopens dues, removes the receipt from active collection/Cash Book sources, and visibly marks the print as cancelled.
- Non-financial correction appends an immutable audit version. Financial correction cancels and reissues a linked replacement receipt; it never overwrites the original receipt number. Neither path is deletion or refund.
- Accountant action is blocked for a submitted, approved or locked accounting day. Use the existing authorised leadership correction path; never rewrite a locked snapshot.
- Never delete a `Payment`, edit the database, or change only one split component to imitate cancellation.
- If the page reports that the receipt changed after it was loaded, refresh and review it. Do not retry with stale details.
- Finance CSV downloads are purpose-specific, formula-safe, private/no-store, audited, limited to 2,000 output rows, and date-bounded where applicable. Narrow filters instead of creating an unreviewed bulk personal-data extract.

## Weekly backup routine

1. Director/Admin opens **Import / Export**.
2. Download a Full Backup.
3. Confirm the JSON file exists and has a current timestamp.
4. Copy it to a separate USB drive or protected folder.
5. Keep at least the latest four weekly backups.
6. Record who created the backup and where the second copy is stored.

## Monthly backup routine

1. Complete the weekly routine.
2. Copy the SQLite database file while the app is stopped.
3. Store the month-end JSON backup and database copy in a dated folder.
4. Retain month-end backups according to school policy.
5. Test a restore using a copied database, never the only live database.
6. Confirm the restored Student Master, payment count, recent receipts, and pending dues.

## Before importing real data

- Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Review **Settings → System Health**.
- Confirm school name, academic year, phone, address, receipt settings, and fee structure.
- Create real named users and change all documented temporary passwords.
- Check whether sample students or seeded payments are present.
- Take a full JSON backup and a stopped database-file copy.
- Import Student Master before payments.
- Preview every file and save any error CSV.
- Verify 10 random student rows before payment import.
- Never bulk import directly into the only copy of the database without a backup.

## Before restoring a backup

- Stop routine data entry and tell all users.
- Download a new backup of the current database.
- Copy `prisma/dev.db` to a separate safe location while the app is stopped.
- Confirm the selected backup belongs to Nalanda Fee Control and the expected academic year.
- Review validation counts and warnings.
- Test restore against a copied database first.
- Remember that user accounts are skipped during restore for login safety.
- After restore, verify school settings, Student Master, fee structures, payments, receipt audit, daily collection, and pending dues.

Full JSON backups also include Import Verification batch history and the in-app go-live checklist.
Restoring a current backup brings those records back without duplicating existing import batch IDs
or checklist state. Older backups remain supported, but they cannot restore verification history or
checklist changes that were not present when the backup was created.

Full JSON backups now also include the Timetable Foundation data: teachers, subjects, class
sections, period templates (including editable Friday timings), assignments, fixed periods, and
teacher unavailability. Restore rebuilds timetable master data first and then restores dependent
rows only when their teacher, subject, and class-section mappings are safe. Older backups remain
valid and restore normally, but they contain no timetable data to restore.

Backup version 4 also includes manual/generated timetable drafts and their entries. Restore maps
those entries only when the related draft, class section, teacher, subject, and assignment can be
matched safely; unsafe rows are skipped with warnings.

Backup version 5 also includes Role Permission Matrix rows. Restore accepts older backups without
role permission rows and keeps safe recommended defaults for missing matrix data. Password hashes
are still not exported.

The current full-backup payload does not restore the `SchoolSettings` singleton. Keep a separate
record of the approved school/receipt settings and verify them after any restore.

## QA/demo/test cleanup

The `qa:cleanup` command is only for clearly marked QA, demo, test, or sample records. It is not a real-fee correction tool. Correct real fee mistakes through receipt cancellation/restoration and audit records, not deletion.

Safe preview for the Prompt 10C browser-QA receipt:

```powershell
pnpm.cmd qa:cleanup -- --dry-run --receipt QA10C-0056
```

Apply only after reviewing the preview:

```powershell
pnpm.cmd qa:cleanup -- --apply --receipt QA10C-0056 --confirm DELETE_TEST_DATA
```

Prefix cleanup is allowed only for obvious test prefixes:

```powershell
pnpm.cmd qa:cleanup -- --dry-run --prefix QA
pnpm.cmd qa:cleanup -- --apply --prefix QA --confirm DELETE_TEST_DATA
```

The command refuses numeric-only prefix cleanup and skips ambiguous records under "Needs manual review". It never removes users, password hashes, role permissions, fee structures, timetable data, or school settings. Run `pnpm.cmd backup` after any applied cleanup.

Keep `pilot:reset-sample-data` separate: it is for copied pilot databases and `PILOT-` sample data only. Use `qa:cleanup` for named QA/demo/test receipts such as `QA10C-0056`.

## Role responsibilities

### Super Admin

- Owner-level account with all permissions.
- Can manage users, roles, permissions, settings, backup/restore, imports, fee structure, timetable, and reports.
- Must not be disabled or demoted if it is the last active Super Admin.
- Use `pnpm.cmd user:make-super-admin <username-or-email>` only to promote an existing trusted user.

### Director

- Owns first-run setup, school profile, fee policy, user access, backups, restores, and final reconciliation.
- Reviews System Health and resolves Critical/Warning items before real-data use.
- May cancel/restore a final receipt only with the exact permission, current receipt version, explicit reason, and whole-receipt review.
- Investigates partial component state and `ReceiptNote` disagreement before trusting totals.
- Should not remove or bypass Super Admin safety.

### Principal

- Academic, student, timetable, and report access by default.
- Does not receive full finance, restore, or role-permission control unless granted in Role Permissions.

### Admin

- Supports user management, school settings, imports, exports, backups, restores, and operational checks.
- Must not change financial records without school authorization.
- Keeps backup copies organized and confirms routine checks are completed.

### Accountant

- Enters payments, prints receipts, and reviews purpose-limited ledgers, Daily Collection, Pending Dues, and Receipt Audit.
- Reconciles app totals with cash, bank/UPI, and the physical register.
- Does not open the Student Master, access Parent/contact/private Student fields, prepare reminder destinations, or cancel a final receipt.
- Reports errors to the Director/Super Admin; does not perform backup restore, user administration, or school configuration.

### Viewer

- Uses aggregate-only dues/collection dashboard and report access; no Student ledger or personal-data export.
- Must not receive or share credentials for higher-privilege accounts.
- Reports discrepancies to the Director/Admin/Accountant.

### Teacher

- Opens Student attendance only when the account has an active linked
  `StaffMember`, active timetable Teacher, and an exact current-year
  class/section assignment, or a confirmed substitute assignment for that
  exact date and cohort.
- Treats the class/section selector as a convenience, not authority. A missing
  or empty selector is a safe denial and must be reported to the
  Principal/Director; never grant a broad role permission as a workaround.
- Uses **Correct Attendance** only on a submitted, unlocked session, changes at
  least one mark/remark and records a specific reason in the in-app dialog.
- Reloads after a 409/stale-version message. The other writer won; do not retry
  from the stale screen.
- Substitute access ends automatically outside the confirmed date. A multi-day
  substitute needs one approved dated assignment per day in the current model.
- Does not lock attendance by default. Leadership locking remains separately
  permissioned.

### Parent

- Uses only the linked-child portal surfaces granted to the account.
- Parent attendance expansion remains a separate Schoolknot follow-up and is
  not part of Prompt 23C.

### Prompt 23C copied-database check

Use only on the ignored copy:

```powershell
pnpm.cmd qa:23c prepare
pnpm.cmd qa:23c verify
pnpm.cmd qa:23c inspect
pnpm.cmd qa:23c cleanup
pnpm.cmd qa:23c destroy
```

The command refuses the operational database by path, compares its hash at
every phase, keeps the synthetic password only in the ignored state file and
restores the copy's complete non-QA logical state before destruction.
