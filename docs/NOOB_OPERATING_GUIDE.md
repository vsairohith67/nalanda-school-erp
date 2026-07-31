# Nalanda Fee Control — Beginner Operating Guide

## Account Security and password recovery

Open the user menu and choose **Account Security** to see masked verified login
identifiers and recent devices. A work/personal email or mobile must receive and
pass its verification code before it can sign in. The school-issued username
and any admission-number login are school governed. Removing an identifier uses
an in-app confirmation and never removes its audit history.

Use **Log out other sessions** after using another computer, or **Log out all
sessions** if access may be unsafe. The all-session action explicitly signs out
the current device too. Network evidence is deliberately masked.

**Forgot Password** asks for a login identifier and channel type but never shows
the stored email or number. The response is always generic. Live delivery is
not configured in AUTH-2B, so do not expect operational email/SMS until its
separate provider approval. Never send an existing or new password by email,
SMS, chat, Notion or screenshot.

## Publishing and downloading report cards

Principals use **Report Cards > Publication and Parent Delivery**. Select only
rows marked **Ready for exact preview**, choose individual, section or class
scope, and inspect the exact preview before using the in-app publish
confirmation. A blocked row is not safe to publish. Never use this screen to
change marks; return to the governed marks-correction process and calculate a
new locked snapshot first.

Issued reports cannot be edited. Use **Replace from preview** only for an
approved correction from a new locked snapshot; the prior version remains as
`REPLACED`. Use **Withdraw** only with the approved reason. Neither action
deletes history.

Parents use **Parent Portal > Report Cards**, select a linked child, then choose
**View**, **Colour PDF** or **B&W PDF** for the current issued version. Replaced
or withdrawn versions show their status but cannot be opened. Never copy the
temporary download address or PDF file into a public folder.

For batch printing, select issued reports, choose individual, merged PDF or ZIP
and choose colour or black-and-white. Keep each request within the on-screen
limit. A failed job publishes no file; use the governed retry summary. Normal
reports are A4 portrait and configured wide combined reports are landscape.
Always check A4 margins and grayscale readability before physical printing.

This feature is implemented but still requires independent QA. Cloud
deployment is not authorised.

## AUTH-2A operational accounts are secured

The operational Super Admin has a named owner, its password was recovered
privately, and two fresh logins were verified. The retained Admin, Accountant
and Viewer accounts are inactive until named people have a current operational
need. Their accounts and audit history were preserved; nothing was deleted.

Never send a password in chat, email, Notion, a screenshot, or a document.
Never reactivate or share a retained account without leadership approval and a
named owner. Never disable the last active Super Admin.

## DATA-0B clean starting point

The official operational starting point is now 0 Students, 0 active
enrollments, 0 Payments and ₹0 collected. The older 8 / 8 / 19 / ₹99,100
figures are historical rollback evidence only.

Do not run `demo:seed` or set `ALLOW_DEMO_USERS` or
`ALLOW_DEMO_BUSINESS_DATA` on this
school database. Add only reviewed school records through approved operator
workflows. Plain `db:seed` no longer creates demo users without the dedicated
copied-test gate. AUTH-2A is complete through P4C; preserve its named ownership,
private password handling, inactive secondary accounts, audit history and
last-working-leadership-login safeguards.

## Schoolknot replacement decision (Prompt 23B)

The planning audit is complete, but the school must **not switch everyone from Schoolknot yet**. No Schoolknot data was downloaded or imported and no new business feature was built in Prompt 23B.

- Management, Parent, Principal and Accountant can be considered only for small, supervised pilots that use features Nalanda already has.
- Teachers must not be cut over yet. The current attendance page can be permission-enabled without limiting the Teacher to the exact class and section assigned in the timetable.
- The first future build is Prompt 23C, after a separate QA review, to fix only that Teacher attendance scope.
- Keep live hosting, DNS, payment, external backup and monitoring off until the separate paid/provider deployment gates are approved.
- FIN-2A finance privacy/export/receipt integrity and FIN-2B Accountant final-receipt governance are cleared. An Accountant needs the exact permission, every successful cancellation/correction is audited and notifies active Directors/Super Admins, financial correction cancels/reissues instead of overwriting, and a locked day cannot be silently rewritten. Payroll, refunds, live payment gateway, transport/GPS and Schoolknot migration are not approved by this document. No FIN-2C scope is currently approved.

## DEVOPS-1C staging readiness planning (2026-07-23)

DEVOPS-1B and its independent QA are fully cleared. No website/server was put online in DEVOPS-1C. No hosting account, bill, DNS record, Google Workspace record, real database, secret or live provider was created or changed. The safe plan uses one Linux server/process and one persistent local disk for a fresh synthetic SQLite database. Read `STAGING_DEPLOYMENT_ARCHITECTURE.md`, `STAGING_ENVIRONMENT_AND_SECRET_MATRIX.md`, and `PWA_PHYSICAL_DEVICE_STAGING_CHECKLIST.md`; do not try physical phone certification until an approved HTTPS staging site exists.

## Staff DOB and EPFO/EPS planning

Prompt 22A and its QA are cleared plans only. There is no Staff DOB form, EPFO status screen, UAN field, age-58 reminder or compliance checklist yet. Do not start collecting or typing real DOB, Aadhaar, PAN, UAN, EPFO password, OTP, bank detail, portal screenshot or source-document image into the ERP, notes, chat, spreadsheets or AI tools.

Age 58 is an EPFO/EPS administrative review point, not an instruction to retire or terminate a Staff member. When a future approved reminder exists, it must say: **Review EPFO/EPS records and obtain professional guidance.** Never use it to change Staff status, salary, attendance, contribution, employment or pension.

The proposed first implementation omits full UAN. It would keep only a neutral availability/status and, if approved, the last four digits for restricted human checking. Director is the routine restricted owner; Admin may prepare a DOB correction queue but cannot verify by default; Accountant access must be explicitly assigned and masked; Parent/Public have no access.

Do not begin Prompt 22B until the decision-record conditions are signed by school leadership and the qualified EPFO/labour-law and privacy reviewers. Prompt 22C reminders and Prompt 22D checklist remain separate blocked phases. Prompt 21B/21C/21D also remain blocked.

## WhatsApp one-way communication

Start at `/whatsapp` and keep mode `MOCK` for learning/QA. Create a non-secret profile, run Health Check, record explicit consent, map an approved Meta template, then create a batch from a published in-app campaign. Preview first: it must show zero delivery rows written. Submit, obtain separate approval, queue, then Process Queue. Never paste Meta secrets into the app. LIVE requires supervised environment setup. Cost is an estimate and never posts to school finance.

This guide is for school staff who use the software but do not work with computer code.

## Before starting each day

1. Check that the computer date and time are correct.
2. Open Nalanda Fee Control.
3. Log in with your own username and password.
4. Never use another person’s account.
5. If you see a serious warning, stop and inform the Director/Admin.

### Local development N button

The N button and white developer window appear only during local development. Ignore it or hide Dev Tools. It will not be part of production use. Do not hide or ignore a real red error message in the app itself.

## A. Daily fee collection

### Use the dashboard

After sign-in, the dashboard shows only information and shortcuts allowed for your role.

- **Today at a glance** shows current collection, dues, people counts, attendance, leave, substitute, and notice summaries when those records are available to you.
- **Not marked yet** means no manual attendance session exists for today. It is not an estimate and does not mark anyone automatically.
- **Quick actions** are safe shortcuts. If an action is not allowed for your account, it is not shown.
- **Finance snapshot** uses the same payment and pending-dues records as the existing fee screens. Always use Daily Collection and the physical register for end-of-day reconciliation.
- **Recent activity & alerts** shows only items your role may view.
- **Viewer / Auditor** sees a read-only dashboard. Parent and Teacher accounts continue to their own portal start pages.
- “Today” and “This month” use the school’s India calendar date. Around midnight, the date, collection, attendance, and substitute summaries move together to the new school day.
- **All recorded payments by mode** is an all-time account summary, not only the current month.

On a phone, summary cards and actions stack into two columns. Use the top menu button for the full navigation. You should not need to scroll sideways at the page level.

### Log in

1. Open `http://localhost:3000`.
2. Enter your username and password.
3. Select **Login**.

### Add a payment

1. Select **Add Payment** from the left menu.
2. Check the payment date.
3. Enter the receipt number.
4. Enter the student’s admission number.
5. Wait for the student name and class to appear.
6. Check that the correct student is shown.
7. Enter the amount.
8. Select the payment mode: Cash, UPI, NEFT, RTGS, IMPS, Bank Transfer, Cheque, or Other.
9. Select where the money was received.
10. For UPI or bank payment, enter the transaction/reference number.
11. Select the fee type and term information.
12. Add remarks if needed.
13. Select **Save Payment**.

Do not save if the admission number shows the wrong student.

### Cash + UPI split payment

If one receipt contains both Cash and UPI:

1. Open **Add Payment** and enter the receipt, student, date, fee type, and term once.
2. Tick **Cash** and enter the Cash amount.
3. Tick **UPI** and enter the UPI amount.
4. Select the correct UPI received account.
5. Enter the UPI transaction/UTR number.
6. Confirm that the displayed total equals the full receipt amount.
7. Select **Save Payment Receipt**.

The software safely stores internal component rows with the same receipt number. The audit screen shows this as a split payment, not as a duplicate problem, when all components belong to the same student.

### Check and print the receipt

1. Open **Payments** or the student ledger.
2. Find the receipt number.
3. Check the student, date, amount, payment split, mode, and reference number.
4. Open the receipt print view.
5. Check the school name and receipt details.
6. Select **Print**.
7. Use the school’s configured A5/A4 print size.

Never print a receipt before checking the amount and student.

### Correct or cancel a final fee receipt

An Accountant may cancel a final receipt only with `CANCEL_FINAL_RECEIPT` and may correct one only with `CORRECT_FINAL_RECEIPT`. Cancellation applies to the whole receipt. A non-financial correction appends an immutable audit version; a financial correction cancels and reissues a linked replacement instead of overwriting the issued receipt. Every successful Accountant action is audited and notifies active Directors and Super Admins. Submitted, approved and locked accounting days block ordinary Accountant action and are never silently rewritten.

Director or Super Admin:

1. Open the payment or **Receipt Audit**.
2. Check the Student, receipt number, total, and every Cash/UPI/bank component.
3. Select **Cancel entire receipt**.
4. Enter a clear reason of at least 3 characters.
5. Read the in-app confirmation and confirm only if the whole receipt must be cancelled.
6. Check that the receipt print says cancelled, Pending Dues reopened, and Daily Collection no longer includes the amount.

The app keeps the receipt, components, and audit history. Do not delete rows, edit the SQLite database, or cancel only one split component. If the app says the receipt changed after it was loaded, refresh and review it again.

### Check Daily Collection

1. Open **Daily Collection**.
2. Select the correct date or date range.
3. Compare:
   - total collection,
   - cash total,
   - UPI totals,
   - bank/other totals,
   - number of payments.
4. Match these figures with the physical register, cash in hand, and bank/UPI records.
5. Resolve differences before closing the day.

## B. Pending dues

### Find pending students

1. Open **Pending Dues**.
2. Use Class, Section, Status, Paid/Pending, or Term filters.
3. Search carefully and check the displayed student and due amount.

### Send a WhatsApp reminder

1. Find the correct student.
2. Select **Copy WhatsApp Message** or **Copy Detailed Message**.
3. Read the message before sending.
4. If a WhatsApp number is available, select **Open WhatsApp**.
5. Confirm the parent and amount before pressing Send in WhatsApp.

The software prepares the message. It does not automatically send messages through a WhatsApp API.

### Export reminder CSV

1. Apply the required class/section/term filters.
2. Select **Export Reminder CSV**.
3. Open the downloaded file in Excel.
4. Check the rows before using it for calls or reminders.

Accountant does not receive reminder destinations or Parent/contact fields. Finance exports are purpose-specific, private, audited, limited to 2,000 rows, and date-bounded where applicable. Viewer/Auditor receives aggregate reports only.

## C. Student Master

### Add a student

1. Open **Add Student**.
2. Enter the academic year and unique admission number.
3. Enter student and parent names.
4. Select class and enter section.
5. Enter phone and WhatsApp details.
6. Check Status and Student Type.
7. Add address and remarks if needed.
8. Select **Save Student**.

### Edit a student

1. Open **Students**.
2. Search by name, admission number, or class.
3. Select **Edit** for the correct student.
4. Change only the required fields.
5. Select **Save Student**.
6. Reopen the student to confirm the change.

### Faculty Child discount

1. In Student Type, select **Faculty Child**.
2. The system normally fills a 50% discount.
3. Confirm the approved discount with school management.
4. Do not change the percentage without authorization.

### Class IX/X start month

- Classes IX and X automatically start from **April**.
- Other classes normally start from **June**.
- The software sets this from the selected class.

### Import students

1. Take a full backup first.
2. Open **Import / Export**.
3. Under Student Master Import, choose the Excel/CSV file.
4. Read the preview, errors, warnings, and duplicate information.
5. Choose the correct create/update/skip mode.
   - Skip duplicates means existing admission numbers are not changed.
   - Update existing means existing students are edited.
   - Create new only means existing admission numbers fail or are skipped.
6. Confirm only after checking the preview.
7. Download the error CSV if rows fail.
8. Verify at least 10 random students after import.

Import Student Master before importing payments.

CSV row numbers include the header row. The first student in the file is CSV Row 2. If rows are skipped because existing, those students are already in this database. Reset sample pilot data before repeating the sample test.

## D. Payment import

1. Take a fresh full backup before opening the payment file.
2. Confirm Student Master is already imported and checked.
3. Open **Import / Export → Payment Import**.
4. Select the Excel/CSV daily collection file.
5. Choose **Dry run / preview only**.
6. Enter expected physical-register totals if available.
7. Select **Save Trial Run (No Changes)**.
8. Check:
   - uploaded total,
   - valid importable total,
   - duplicates,
   - error-row amount,
   - totals by date,
   - totals by payment mode,
   - totals by received account.
9. Correct unexplained errors or total differences.
10. Upload the corrected file if required.
11. Choose **Import valid rows**.
12. Tick the confirmation only after checking the matched students and rows.
13. Select **Import Valid Payment Rows**.
14. Open the saved Import Verification batch.
15. Check Daily Collection against the physical register.
16. Verify at least 10 random imported receipts.
17. Take another backup after a successful import.

There is no batch rollback button. The safe undo method is restoring the backup taken immediately before import.

For generated sample payment data, use date range 20-06-2026 to 20-06-2026 and expected totals Cash `60000`, Director Sir GPay `30300`, NPS Current Account UPI `11300`, Bank / Other `0`, Grand Total `101600`. For real school data, use the physical Daily Fee Collection Register, not the sample numbers.

Payment CSV row numbers include the header row. The first payment row is CSV Row 2. `Received account was blank; defaulted to Director Sir GPay` means the received account cell was empty. If Director Sir GPay or NPS Current Account UPI was written correctly, that missing-account warning should not appear.

Do not repeatedly import the same sample file without resetting sample pilot data, because the next import will correctly show duplicate/skipped rows.

### Reset sample pilot data

Director/Admin, only when `.env` points to a copied pilot database:

1. Stop the app if it is running.
2. Confirm `DATABASE_URL` contains `pilot` or `pilot-data`.
3. Run `pnpm pilot:reset-sample-data`.
4. Read the printed counts.
5. Run `pnpm pilot:sample-data` again if you want fresh sample CSV files.

The reset command refuses the normal `dev.db`. It deletes only sample records whose admission or receipt numbers start with `PILOT-`, plus saved sample import batches.

### Clean QA/demo/test receipts

Use this only for clearly marked QA/demo/test records, such as the browser-QA receipt `QA10C-0056`.

Do not use this to correct a real fee mistake. Real fee mistakes must use cancellation, restoration, and audit workflows so the school keeps a proper record.

First preview the cleanup:

```powershell
pnpm.cmd qa:cleanup -- --dry-run --receipt QA10C-0056
```

Read the printed list. It should show only QA/test/demo records and clear reasons.

Apply only after the preview is correct:

```powershell
pnpm.cmd qa:cleanup -- --apply --receipt QA10C-0056 --confirm DELETE_TEST_DATA
```

To preview all clearly marked QA receipts:

```powershell
pnpm.cmd qa:cleanup -- --dry-run --prefix QA
```

To apply that prefix cleanup:

```powershell
pnpm.cmd qa:cleanup -- --apply --prefix QA --confirm DELETE_TEST_DATA
```

The cleanup refuses numeric-only receipt prefixes such as `25` or `25023` because those can match real receipt books. After applying cleanup, run:

```powershell
pnpm.cmd backup
```

Difference from `pilot:reset-sample-data`: `pilot:reset-sample-data` is only for copied pilot databases and `PILOT-` sample records. `qa:cleanup` is for clearly named QA/demo/test records in the current database and starts with dry-run preview.

## E. Backup and restore

### Daily backup

Director/Admin:

1. Open **Import / Export**.
2. Select **Download Full Backup**.
3. Confirm the file downloaded and has today’s timestamp.
4. Copy it to a USB drive or another protected folder.

You can also double-click `tools\backup-now.bat`.

### Before import

Always make a new backup immediately before importing students or payments. Keep that file until the import has been fully checked.

### Restore warning

Restore can replace or combine important school data. It must not be treated like opening a normal file.

1. Stop routine data entry.
2. Take a new backup of the current data.
3. Stop the app and copy `prisma\dev.db`.
4. Test the restore on the copied database only.
5. Review backup counts and warnings.
6. Type the exact confirmation text only when the selected backup is correct.
7. After restore, check students, payments, receipts, daily collection, pending dues, settings, import history, and timetable.

**Never restore without first backing up the current database.**

### Encrypted automatic backup and recovery

Authorized leadership can use **Encrypted Cloud Backup** for health, runs, schedules, verification, rehearsals, retention, and aggregate reports. MOCK and LOCAL_FOLDER are QA/recovery modes; LIVE is disabled in Prompt 20C.

- Healthy means encrypted upload, readback, authentication, hash checks, and schema validation passed.
- Keys are kept by the server operator and never entered on a web page. Losing every copy of a historical key makes those backups unrecoverable.
- An ERP schedule does not run itself; configure Windows Task Scheduler or another deployment scheduler.
- **Run Isolated Restore Rehearsal** uses a temporary copied database and never changes the operational ERP.
- Preview retention first. Failed/unverified new runs never justify deleting older good copies.
- “Database backup verified. Private uploaded assets are not included in this backup.”
- Never use a provider delete-all/prefix-delete or replace the operational database during Browser QA.

The current JSON restore does not replace School Settings. Keep the approved school name, address, receipt, and print settings written down and check them after restore.

## F. Timetable

Only Director/Admin currently have timetable-management access.

### Add teachers

1. Open **Timetable → Teachers**.
2. Add the teacher’s name and unique short name.
3. Enter department and contact details if needed.
4. Set realistic maximum periods per week/day.
5. Keep the teacher Active if they should be scheduled.

### Add subjects

1. Open **Timetable → Subjects**.
2. Add subject name and unique short name.
3. Mark lab/activity/consecutive-period settings correctly.
4. Keep the subject Active if it should be scheduled.

### Add class sections

1. Open **Timetable → Class Sections**.
2. Add class, section, display name, and correct timetable group.
3. Confirm the academic year.

### Add assignments

1. Open **Timetable → Assignments**.
2. Select class section, subject, and teacher.
3. Enter required periods per week.
4. Review workload and overload warnings.

### Add unavailable and fixed periods

1. Open **Timetable → Periods & Rules**.
2. Under Teacher Unavailability, add periods when a teacher cannot teach.
3. Under Fixed Period, reserve required classes, teachers, subjects, or activities.
4. Check Friday and other period timings.

### Use the manual builder

1. Open **Timetable → Manual Builder**.
2. Create or select a draft.
3. Select a class and place periods.
4. Lock periods that must not move.
5. Review teacher preview, workload, conflicts, and warnings.

### Generate a timetable

1. Open **Timetable → Automatic Generator**.
2. Select the academic year and classes/group.
3. Choose whether to use a base draft and fixed periods.
4. Generate a preview.
5. Read unresolved periods, conflicts, warnings, and workload completion.
6. Save the generated draft.

The saved timetable is still a `DRAFT`.

### Review, activate, print, and export

1. Open the generated draft in **Manual Builder**.
2. Resolve errors first, then review warnings.
3. Check every class and teacher.
4. Mark it **ACTIVE** only after Principal/management approval.
5. Open **Print & Export**.
6. Print one class and one teacher first as a sample.
7. Export class, teacher, workload, or free-period CSV if required.
8. Take a fresh backup after approval.

## G. Daily student attendance

Attendance is manual only for now. There is no biometric/RFID import and parents cannot see attendance yet.

### Take attendance

1. Open **Student Attendance**.
2. Choose the date, class, and section, then select **Load Attendance**.
3. If no session exists, select **Create Draft Attendance**.
4. Use **Mark all Present** for a fast start, then change individual students to **Absent**, **Late**, **Half Day**, or **Excused**.
5. Add a short remark only when useful.
6. Select **Save Draft**. A draft can be saved again while work is in progress.
7. Check every active student is marked, then select **Submit Attendance**.

Inactive, left, and deleted students are not shown. If a class has no active students, check Student Master status, class, section, and academic year rather than creating duplicate students.

### Understand the states

- **DRAFT**: editable working copy.
- **SUBMITTED**: staff says attendance is complete; it is no longer editable.
- **LOCKED**: final attendance locked by an authorized school leader; normal edits are blocked.

There is no unlock button in this phase. If submitted or locked data is wrong, contact the Director/Super Admin and document the issue before any database correction.

## G2. Daily staff attendance

Director, Principal, Admin, or Super Admin:

1. Open **Staff Attendance**, choose the date, and select **Load Attendance**.
2. If no session exists, select **Create Draft Attendance**.
3. Use **Mark all Present**, then change exceptions to Absent, Late, Half Day, On Leave, or Excused.
4. Add check-in/check-out time, late minutes, or a short remark only when useful.
5. Select **Save Draft** while work is still being checked.
6. Select **Submit Attendance** only after every active staff member is marked.
7. An authorized school leader may select **Lock Attendance**. It cannot be edited or unlocked in the app.

Draft means unfinished and editable. Submitted means complete and no longer editable. Locked means final. Inactive and left staff are excluded. Reports include submitted and locked dates only; open **Staff Attendance Reports** for absent, late, on-leave, monthly summary, and CSV export.

This is manual attendance only. Biometric/RFID import or sync is not enabled. Staff leave approval is handled separately under **Staff Leave**.

### Apply for and approve staff leave

Teacher:

1. Open **Teacher Portal**, then **My Leave**.
2. Select **New Leave Request**.
3. Choose the leave type and dates. For Half Day, choose Fore Noon or After Noon and use one date only.
4. Enter a reason. The substitute checkbox and notes tell the separate Substitute Planner that coverage may need review; leave approval itself never assigns anyone.
5. Select **Save Draft** if unfinished, or **Submit Request** for approval.
6. A draft can be edited. A draft or pending request can be cancelled, and every cancellation needs a reason.

Director, Principal, Admin, or Super Admin:

1. Open **Staff Leave** to see all requests and filter by status, type, staff, or date.
2. Open a pending request.
3. Select **Approve Leave**, or enter a required rejection reason and select **Reject Leave**.
4. Open **Staff Leave Reports** for pending approvals, approved leave, type totals, staff/date filtering, and CSV export.

Status meanings: **Draft** is unfinished and editable. **Pending** is waiting for approval. **Approved** is accepted and cannot be silently edited. **Rejected** includes the leadership reason. **Cancelled** is retained instead of deleted. An overlap warning means the same staff member already has pending or approved leave in the date range; review it before continuing.

Teachers can see only their own linked staff leave. If the login has no StaffMember link, the page explains that an administrator must link it. WhatsApp/SMS/email notifications, full calendar handling, payroll/salary deduction, student leave, and automatic attendance/device sync are not enabled.

### Plan and assign a substitute teacher

1. Open **Substitute Teachers**. Director, Principal, Admin, and Super Admin can see all coverage; Teachers see only their own assigned duties.
2. Open **Planner** and choose a date or range. Approved staff leave and recorded staff absence appear. **Substitute required** means coverage needs review; it is not an assignment.
3. Use **Plan coverage** for a linked active timetable period. If timetable data is missing, use **Create Manual Coverage** and type class, section, subject, and period.
4. **Show Safe Suggestions** excludes inactive staff, approved leave, recorded absence, and conflicting substitute duties. Suggestions are advisory and never assign anyone automatically.
5. Save as Draft, or choose an active substitute and click **Assign Substitute**. Resolve conflicts instead of working around them.
6. Open the record to **Confirm Duty**, then **Mark Completed**. Cancelling a non-completed duty requires a reason.
7. **Substitute Reports** shows date-wise coverage, duties by substitute, most substituted staff, pending/unassigned rows, and CSV export.

This foundation has no WhatsApp/SMS/email notification, payroll deduction, biometric-triggered creation, AI final decision-maker, or teacher-performance score.

### Read reports

1. Open **Attendance Reports**.
2. Choose a From and To date. Optionally enter a class and section.
3. Review date-wise totals, the absent list, the late list, and the student summary.
4. Select **Export CSV** when a spreadsheet copy is needed.

## H. Users, roles, and permissions

### Role meanings

- **Super Admin** is the owner-level account. Keep at least one active Super Admin.
- **Director** is for school leadership and most operational work.
- **Principal** is for academic, timetable, student, and report access.
- **Admin** is for school office administration.
- **Accountant** is for payments, dues, ledgers, receipts, and fee reports.
- **Teacher** opens the teacher start page and can take/submit student attendance by recommended default. Teacher cannot lock attendance.
- **Parent** opens the read-only parent portal.
- **Viewer / Auditor** is read-only/audit access.

### Change role permissions

Super Admin, or a user with permission to manage role permissions:

1. Open **Role Permissions**.
2. Read the warning: changing permissions affects what users can see and do.
3. Tick or untick the boxes for each role.
4. Leave **Super Admin** locked on.
5. Select **Save Permissions**.
6. Sign in as a test user for that role and confirm the sidebar and blocked pages behave correctly.

Use **Reset to Recommended Defaults** only when you want to return all roles to the standard school setup.

### Promote a Super Admin safely

From PowerShell in the project folder, promote an existing user:

```powershell
pnpm.cmd user:make-super-admin username
```

Replace `username` with the real username or email. This does not create a password and does not show password hashes.

### Create users

1. Super Admin/Director/Admin opens **User Management**.
2. Enter name, username, optional email, role, and temporary password.
3. Select **Create User**.
4. Give the password privately.
5. Ask the user to change it after first login.

Super Admin can manage all roles. Director can manage operational roles but cannot create or demote Super Admin safety. Admin is intentionally limited when managing higher-privilege users.

**Viewer / Auditor** is a read-only role for someone who may see limited reports but must not edit school data. Teacher and Parent roles will be separate future modules; Viewer must not be used as a substitute for either role.

### Reset another user’s password

1. Open **User Management**.
2. Find the user and open **Manage**.
3. Enter and confirm a new temporary password of at least 8 characters.
4. Select **Reset Password**.
5. Tell the user to change it after login.

### Change your own password

1. Open the user menu at the top right.
2. Select **Change Password**.
3. Enter the current password.
4. Enter and confirm the new password.
5. Use at least 8 characters and do not share it.

### Deactivate a user

1. Open **User Management**.
2. Find the user and open **Manage**.
3. Change Status to **Inactive**.
4. Select **Save User**.

Deactivate accounts when staff leave or no longer need access. Do not reuse one person’s account for another person.

Do not deactivate or demote the last active Super Admin. The software blocks this, but the school should still keep a written record of who holds owner-level access.

## I. Schoolknot replacement and biometric planning

Manual student and staff attendance foundations are now available. Biometric/RFID integration or sync, automated notifications, and parent attendance visibility are not enabled. Before approving the Biomax BM-70W quotation or switching work away from Schoolknot, school management should read [SCHOOLKNOT_REPLACEMENT_GAP_MAP.md](SCHOOLKNOT_REPLACEMENT_GAP_MAP.md), confirm the vendor's export/API and data-ownership answers in writing, and approve a tested migration and fallback plan.

UI/navigation polish from Prompt 14B is now in place. On a computer, the left menu is grouped by school work area and can be hidden or shown from the top bar. On a phone, the full menu no longer appears above the page. Use the menu button in the top bar to open navigation, then choose the page you need. The menu closes after selecting a page or by using the close button.

Prompt 14C also adds the new dashboard summaries and role-safe quick actions described near the start of this guide. These are summaries only: they do not add expenses, exams, biometric attendance, messaging, online payment, or any other new module.

Parent and Teacher users still see only their safe portal navigation. Viewer / Auditor users still see only their allowed read-only/report pages.

## J. Student lifecycle foundation

Director, Principal, Admin, and Super Admin can open **Student Lifecycle** to review academic-year enrollment coverage, filter by year/class/section/status, and open a student's read-only history. Viewer / Auditor can review this page but cannot manage records. Parent and Teacher users cannot open broad lifecycle pages.

If the page reports missing current-year enrollments, use PowerShell from the project folder:

```powershell
pnpm.cmd lifecycle:backfill
```

This is a dry-run and changes nothing. Review the academic year and missing count. Only an authorized operator should then apply it:

```powershell
pnpm.cmd lifecycle:backfill -- --apply
```

The command reports **Active students scanned**, already enrolled, missing, and created counts. Left, inactive, cancelled, TC, soft-deleted, or otherwise non-active students are not enrolled by this command. The apply command creates only missing ACTIVE enrollment rows and matching ENROLLED history events. It does not promote, repeat, transfer, mark left/dropout, or change fees, attendance, or the current Student master. Running it again is safe and creates no duplicates.

## Progression decisions

Authorized Director, Principal, or Admin users can open **Students & Parents -> Student Progression**. Create a decision, confirm the source enrollment, enter the target preview and required reason/evidence, then save a draft or submit it. Submission changes no enrollment. A permitted approver must approve or reject; rejection needs a reason. Approval still changes nothing.

Finalization is a separate, warned action for an approved decision. Re-read the source, target, effective date, reason, and parent acknowledgement before confirming. PROMOTE/REPEAT creates a target-year enrollment; transfer/left/dropout/passed-out does not. Fee warning text is informational and never blocks the academic decision. Do not use CORRECTION as an undo: correction finalization is intentionally unavailable. Viewer can read reports only; Accountant, Teacher, and Parent cannot open this internal workflow.

Prompt 15C-QA confirmed that approval still makes no enrollment change and that the final confirmation is the only committing step. If finalization reports that the decision is already being finalized, no longer approved, or has a duplicate target year, stop and review the decision rather than retrying repeatedly.

## UDISE+ planning checklist

Director, Principal, Admin, Super Admin, and Viewer / Auditor can open **Administration -> UDISE Checklist**. This is a read-only school review tool. The top warning must say **“Planning checklist only — not official UDISE+ submission.”** Use the overview first, then open Student gaps or Staff gaps and apply filters.

`Complete` means the ERP has a value, not that the value is correct or officially required. `Missing` means no value was found. `Not tracked in ERP` means the current software has no suitable field. `Needs school verification` means compare the school register and latest UDISE+ portal. Never treat the checklist as legal advice or a compliance result.

The pages hide DOB, address, contact, and Aadhaar values. Aadhaar shows only a safe availability/verification status. Viewer can review but cannot export by default. Leadership/Admin users may export the **checklist gap-report CSV**; it is not an official upload file. This workflow cannot edit any student, staff, enrollment, lifecycle, or progression record.

Prompt 15D-QA confirmed these boundaries. If a count looks surprising, use the Student gaps filters and compare the source school register; do not assume the portal requires the field and do not try to upload the checklist CSV. An empty Staff gaps table means no matching staff records are in this ERP, not that staff reporting is complete. Ask an authorized school leader before any future data-fix phase.
## Expenses and Vendors (Prompt 16A)

Only use these pages if your role shows them. Parent and Teacher accounts cannot open expense/vendor pages. Viewer/Auditor is read-only. Principal is read-only by default. Accountant can create vendors/drafts and record approved payments, but cannot approve or cancel by default.

## Create a vendor

1. Open **Vendors** and choose **Create Vendor**.
2. Enter a unique vendor code and name. Contact details are optional.
3. If you enter GSTIN, PAN, or IFSC, the app checks only the format. It does not confirm the value with a portal or bank.
4. Enter only the final four account digits. Do not paste a full bank account number into any field or note.
5. Save. If the vendor should no longer be used, set INACTIVE or BLOCKED. Do not try to delete it.

## Create and approve an expense

1. Open **Expenses** and choose **Create Expense**.
2. Select category, optional vendor/department, date, and invoice details.
3. Enter gross, tax, and deduction. Net must equal gross + tax - deduction.
4. **Save Draft** if review is not ready, or **Save and Submit** to lock it for approval.
5. An authorized approver opens the record and chooses **Approve Expense** or enters a required rejection reason.
6. Approval does not mark the expense paid.

## Record payment

1. Open an APPROVED expense.
2. Enter the payment amount/date/method. A part payment is allowed; never enter more than the remaining amount.
3. CASH needs no reference. UPI/bank/NEFT/RTGS/IMPS/OTHER needs a transaction reference. CHEQUE needs cheque number and cheque date.
4. Read the warning and confirm. The payment becomes part of the permanent audit record.

## Reject or cancel safely

Rejection and cancellation always need a clear reason. Never ask a developer to delete an expense. Cancelled rows remain visible for audit but are excluded from active-spend totals. An approved/paid mistake must be cancelled under school policy; it cannot be silently edited.

## Reports and backup

Expense Reports has date, vendor, category, department, payment-status, and approval-status totals. Export is available only with export permission. It is not a budget report, cash book, tax return, or bank reconciliation. Backup version 15 includes vendors, expense masters, records, payments, and audits while continuing to exclude password hashes.

## Budgets and spending warnings (Prompt 16B)

1. Open **Budgets**. Only users with budget permission see it.
2. A permitted draft operator selects the academic year, title, warning/critical percentages, and optional effective dates.
3. Add allocations. Every row must choose a category, a department, or both, and enter a positive amount. The same combination cannot be repeated.
4. Read the calculated total, choose **Preview Allocations**, then save the draft or submit it. Submitted plans cannot be edited.
5. A Director/Super Admin checks the detail page and explicitly approves or rejects it. Rejection needs a reason.
6. Approval makes the plan official. Locking is a separate confirmation and has no normal unlock.
7. Never ask a developer to edit an approved/locked budget in the database. Use **Create Preserved Revision**, explain the reason, submit it, and have an approver approve it.

Budget reports show Allocated, Paid Actual, Committed, Utilized, Available, Utilization %, and Over Budget. Paid is only expense-payment rows; committed is the unpaid part of an approved expense. Warning begins at 80% and critical at 100% unless the plan/allocation specifies another valid percentage. Warnings do not block necessary expenses.

Viewer/Auditor and Principal are read-only. Accountant/Admin may prepare drafts and export by default but cannot approve, lock, or revise. Teacher and Parent cannot open budget pages. CSV export is formula-safe and needs export permission.

Backup version 16 includes expenses plus budget plans, allocations, and revisions and still excludes password hashes. Budgets are not a cash book, income register, payroll, GST return, bank reconciliation, purchase-order system, inventory system, or student fee calculation.

## Miscellaneous income and the daily cash book (Prompt 16C)

### Set up a non-fee item and price

1. Open **Miscellaneous Income -> Items & rates**.
2. Use a seeded item or create a new one. Choose whether a student is REQUIRED, OPTIONAL, or NOT REQUIRED.
3. Add the current academic-year rate. Do not edit old receipt amounts when a price changes; add a new non-overlapping effective rate.

### Issue a receipt

1. Open **Create receipt** and add one or more items.
2. Enter a positive whole quantity and any discount. The discount cannot exceed the item value.
3. Link a student when the item requires one.
4. CASH goes to the physical cash book. UPI/bank needs an account and reference. CHEQUE needs cheque number/date. Non-cash is never physical cash.
5. Save and print. This receipt uses a MISC number and is not a fee receipt or fee-ledger entry.
6. If it is wrong, use **Cancel receipt**, enter a reason, and issue a corrected receipt. Never ask anyone to delete or silently edit it.

### Close physical cash for the day

1. Open **Daily Cash Book** and create/open today.
2. Check the opening cash. It normally carries from the previous locked day's counted closing cash. Explain a first or changed opening.
3. Check calculated fee cash, miscellaneous cash, and cash expenses. Do not enter these again as movements.
4. Add separate **Deposited to school current account** and **Handed to Director Sir** movements if cash was split. Add a clear reason/reference.
5. Enter **Closing cash retained** after physically counting it. Explain every non-zero variance in Notes.
6. Submit. A permitted leader approves it separately, then locks it. A locked day is permanent.
7. If a later fee, income, or expense change produces a source-drift warning, do not unlock or edit history. Record a documented compensating movement on a later day under school policy.

Accountant/Admin can prepare and submit cash-book days by default but cannot approve or lock. Principal and Viewer/Auditor are read-only. Teacher and Parent have no access. Backup version 17 includes the Prompt 16C records and still excludes password hashes.

## Books sales and publisher bills

1. Open **Books → Catalog & Rates**. Create the item with a short unique code, choose whether a student is required, and add the current academic-year rate. Do not overwrite an old year to change a new year's price.
2. Open **Books → Issue receipt**. Choose the student when required, add one or more items, enter whole quantities and any permitted discount, and choose the actual payment method. CASH must be received at the Books cash counter; non-cash entries need the required reference.
3. Check and print the **Books / Academic Materials Receipt**. It is not a fee receipt. If it is wrong, use **Cancel receipt**, enter a clear reason, and issue a corrected receipt; never edit an issued receipt.
4. Open the date under **Books → Cash Settlements**. The expected cash comes from active CASH book receipts automatically. Enter how much went to Director Sir, remained at the school cash counter, stayed with the books in-charge, and any explained variance.
5. Create/open that date's Daily Cash Book before settlement approval. Submit the book settlement. Only Director/Super Admin approves by default. Approval creates one Director handover; counter/retained cash stays in physical cash.
6. For publishers, create an active Vendor, then use **Books → Publisher Bills → New publisher bill**. Submit, approve, and record bank/cheque partial or final payments only through the normal Expense page.
7. For the yearly books/library in-charge service payment, use **Create Library Management Service Expense**. Select an approved service-provider Vendor and enter the current year's amount. It is a draft expense, not payroll, and the amount is not fixed.
8. Use Books Reports for sales, settlements, and publisher outstanding. Exports are permission-controlled and omit sensitive fields.

## Library circulation boundary

The current **Books** pages sell academic materials and record publisher bills; they do not issue library books. Accession numbers belong only in the separate **Library** area. Do not enter library borrowings, lost books, or fines in Books Sales, student fee payments, or miscellaneous income. Borrowing is not built yet. The approved future order is borrowing, then charges, barcode labels, and stock verification. RFID is not approved or installed; it must not be used to track children or staff.

Admin/Accountant can draft and submit book settlements but cannot approve them by default. Principal and Viewer/Auditor have masked read-only books reports without export. Teacher and Parent have no books-finance access. Backup version 19 includes books and separate library records and still excludes password hashes.

## Library catalog and accession register

The separate **Library** area is now available to Director/Admin. Start in **Catalog**: create one title/edition record, then use **Accession copy** for each physical copy. Carefully review the preview because the accession number is permanent and cannot be edited or reused. Use the copy detail page to record shelf, condition, missing/repair/available status, or withdrawal. Withdrawal needs a reason and keeps the record/history.

Use **Library Import** only after downloading the correct titles or copies template. Preview first, read every CSV-row error/warning, tick the review checkbox, then confirm. The system uses exact codes and never guesses a title, Vendor, or Expense. An optional Vendor/Expense link is reference-only and does not pay or create an expense. Use **Library Reports** for accession and metadata reports; there are no borrowing or overdue reports yet.

Principal and Viewer/Auditor are read-only; Viewer cannot export and sees masked finance links. Accountant, Teacher, and Parent have no Library access by default. Backup version 19 includes library titles/copies/events and still excludes password hashes.

## Library membership and circulation

Director/Admin must first create reviewed Student and Staff borrowing policies. The system does not guess school limits. Create one exact membership per active Student or StaffMember, then use **Issue copy** to preview the policy, current loan count, due date, copy, and reservation priority before confirming. Use **Return copy** for the active loan and record condition; `DAMAGED` is only a warning and never creates a charge.

Open a loan to renew it. Renewal uses the original policy snapshot and is blocked at its limit or when another member is waiting for the title. Reservations are title-level and queue in requested-date order; the earliest waiting member receives issue priority. Staff cancellation needs a reason, and expiry is marked explicitly because no background scheduler exists.

Overdue is a derived label, not an editable loan status. In Prompt 16H, use **Library > Charges > New charge** to preview and explicitly assess an overdue or approved incident; merely opening a report never creates money. Approval and waiver are separate. Accountant collects only an approved positive balance through Miscellaneous Income, producing one Library Charge Receipt marked “not a school-fee receipt.” Never enter the same amount in student fees.

Parents use **Parent Library** for linked children only, and Teachers use **My Library** for their own linked Staff account only. Both are read-only. A cancelled linked receipt shows a reconciliation warning and must be handled by an authorized explicit correction. Backup version 21 includes incidents, rules, charges, waivers, receipt links, and events while continuing to exclude password hashes.
# Library barcode labels and scanner

Open Library > Barcode & Scanner. Preview a barcode before confirming it. A scanner behaves like typing followed by Enter; review the result and press Confirm Issue or Confirm Return yourself.
# Library stock verification

## Homework and assignments

Open **Homework**. Choose an authorised year, class, section, and subject. Enter plain-text instructions, school dates, an optional HTTP/HTTPS link, and public notes. Preview, save a draft, or use the named Publish confirmation. Corrections require a reason and preserve prior public content. Parents use **Parent Portal > Homework** and see only linked-child work. There are no uploads, submissions, marks, payments, or sent messages.

Open **Library → Stock verification**. Create a draft, preview the expected copies, then start only after checking the scope. During scanning, keep the scanner field focused and scan/type an exact barcode or accession; use Reset for a deliberate repeat. Scanning never changes a copy. Preview unchecked copies before proposing missing, then submit. A reviewer records one decision per discrepancy; an authorized operator explicitly applies each approved correction. Director/Super Admin performs the final lock. Never use this feature for valuation, charges, purchasing, accounting, or tracking people.
# Exams and marks quick guide

Create the exam first, add each class/section/subject assessment, then select **Open Marks Entry**. Teachers save all Student rows and select Absent/Exempt/Not Applicable explicitly; never leave a present mark blank and never use zero to mean absent. Submit every sheet before leadership closes entry. Approval and locking are separate steps. Use the on-screen dialogs and read the action text before confirming. A locked exam cannot be edited. CSV import must be previewed before **Confirm Import**.

# Digital report cards quick guide

Configure grade bands and a template under **Report Cards > Templates**. Create a batch only after previewing its exact Student list. A mark-based batch needs one locked exam; an LKG/UKG batch uses the full KG rubric. Open the batch for entry, complete and submit every Student card, submit the batch, approve it, and issue it as separate actions. Issue is the point at which Parents can see the card.

Never use report cards to edit raw marks or promotion decisions. A correction after issue needs a reason and creates a new visible version; the old version remains historical. Parents open **Parent Portal > Report Cards**, select a linked child, and can print only issued versions. Use **Report-card Reports** for completeness and issue checks; Viewer/Auditor names are masked and Viewer cannot export.

## Teacher Analytics operator steps

Only authorised leadership should create/open cycles or generate snapshots. Review readiness warnings first. Never treat missing sources as zero, approved leave as absence, or Student outcome movement as Teacher causation. Share explicitly before expecting a Teacher response. Finalise only after notes and context are complete. Viewer/Auditor access is aggregate-only; Teacher access is own shared/finalised only. The module never gives a composite score, ranking, or automatic employment decision.

## Student certificates quick guide

First create one active number series and one active validated template for each supported type under **Certificates → Templates & Number Series**. A preview never consumes a number. Create or review the request, approve the request, create the certificate draft, submit it for approval, approve it, and issue it as separate actions.

For a Transfer Certificate, review the prominent lifecycle/enrollment warning. If enrollment is active, Director or Principal must record why issue is appropriate; issue still does not mark the Student transferred/left or change progression, Attendance, fees, or dues. Corrections and reissues require reasons and preserve every earlier version. Parents use **Parent Portal → Certificates** and can access linked children only. Use browser print on A4. Typed labels are not digital signatures. Do not collect certificate fees in this phase.
# Class X document packages

1. Director/Super Admin first confirms the current Board/school procedure and configures one active checklist and one unambiguous charge rule under **Class X Documents > Templates & Charges**.
2. Staff previews the Student’s exact Class X source and charge before creating a package. The preview does not make a receipt.
3. Link TC, Study, Conduct, and Bonafide only after they have been issued through the Student Certificates workflow.
4. For Board/Migration documents, record request, school receipt, verification, and physical custody only. The ERP does not create the official certificate.
5. Where payment applies, a leader approves the service charge and Accountant collects the full amount once. This creates a Miscellaneous Income/Cash Book source, not a fee payment. An authorized full waiver needs a reason and makes no receipt.
6. Principal/Director approves the resolved package. Authorized staff may hand over some items first, then the remainder, and print the physical-signature acknowledgment.
7. Parents see only linked-child safe status. Never copy Board serials, internal notes, contacts, or bank/payment-reference details into public notes.
8. Review **Class X Documents > Reports** and verify mismatch count is zero.

Fee dues, marks, report cards, lifecycle, and progression are not changed by this workflow. Official procedures must be verified by the school. Prompt 18C is not part of this module.
# Virtual ID cards

Open **ID Cards** to create or review a card. Configure active Student and Staff templates and number series first. Preview does not consume a number. Approval and issue are separate actions; issue is the only step that allocates the permanent number. Use correction for a data correction, replacement for a lost/damaged card, and revocation only with a recorded reason. Parents see linked children only and Teachers see their own Staff card only. The barcode never logs anyone in.

# In-app notifications

Use **Notification Templates** for reusable plain-text wording. Activate a template before starting a new campaign from it. On a draft, choose the audience and use **Preview audience** first; preview shows counts and skipped reasons but writes no recipients. Submit for review, then an authorized leader separately approves and publishes or schedules.

A scheduled notification appears from its stored time even after the app restarts; no Browser tab needs to remain open. Published content cannot be edited. Use a corrected campaign for a correction, withdraw with a reason when recipients must retain a withdrawn history, and archive after operational use.

Parents see only notifications resolved to their authenticated account and linked children. Teachers can draft only `GENERAL`, `ACADEMIC`, or `HOMEWORK` items for exact timetable scope and cannot publish them. Read is different from acknowledgment, and acknowledgment is not a signature. Existing Parent Notices remain in the **Legacy Notices** section.

This page sends nothing to WhatsApp, SMS, email, or push. Never enter a phone number or email as notification content for delivery.
# SMS and Email one-way communication

The SMS & Email centre is safe by default: both channels start in MOCK and LIVE sending is disabled. Use only published in-app campaigns, review masked preview counts and skip reasons, submit for separate approval, and send only an approved MOCK batch during QA. Do not enter credentials in any screen. A real Email sender needs verified Workspace sender/SPF/DKIM and reviewed DMARC; a real SMS sender needs the selected vendor, PE/header/template registrations, consent compliance, limits, and supervised Director/Super Admin activation. Gmail “Accepted” does not mean delivered. Never use this module for OTPs, marketing, attachments, report-card files, or finance entries.

Parents and Staff manage SMS and Email consent separately on their communication-preference page. A changed mobile/email requires new consent. Suppression clearing is an authorised review with a reason; opting in does not clear it automatically. Routine operator commands are documented in `SMS_AND_EMAIL_ONE_WAY_COMMUNICATION_WORKFLOW.md`.

# Installing and updating the Nalanda ERP web app

Open **Install App** from the account menu or Parent/Teacher navigation.

- In a supporting browser, choose **Install Nalanda ERP** only when the browser offers it.
- On iPhone/iPad, open the ERP in Safari, use Share, choose Add to Home Screen, enable Open as Web App when offered, and choose Add.
- Installation does not download school records. Login and a live connection are still required.
- If Offline appears, reconnect and choose **Retry Connection**. Forms are not queued or saved offline.
- If an update appears, save current form work first. **Later** keeps the current version. **Update Now** opens a confirmation and reloads only after confirmation.
- **Clear Offline App Assets** removes only Nalanda icons/static files. It does not delete school records, browser passwords, or unrelated browser data.

Only Super Admin, Director, and Admin defaults can open **PWA Diagnostics**. Physical Android/iPhone installation still needs supervised real-device QA. See `PWA_AND_MOBILE_APP_STRATEGY.md`.

# Using the read-only AI Assistant

Open **Read-only AI Assistant** from Administration. Director/Super Admin can use documentation and aggregate modes; Principal can ask both but cannot manage the provider; Admin can ask documentation questions only. Other roles have no default access.

- Choose **Documentation** for questions about the allowlisted operating/developer guides.
- Choose **Aggregate operations** for school-wide totals such as enrollment, attendance, fees, Homework, exams, report cards, library, certificates or communications.
- Read the citations, source time, generated time, completeness and uncertainty before acting.
- A refusal is a safety result. Do not reword a request to obtain phone/email/address, individual marks, Teacher rankings, secrets, files, SQL, internet results, or a record change.
- The assistant never saves the visible conversation. **Clear conversation** removes the current browser view after confirmation.
- Directors can review Settings, Sources, Audit and Evaluations. Keep local/cloud profiles disabled. Never enter a key, password, token or endpoint into any assistant screen.

MOCK answers demonstrate the safe workflow and are not a substitute for leadership verification of legal, Board, financial, medical or other authoritative requirements.

## Handwritten fee-register OCR review

1. Open **Fee Register OCR** and create a batch for the correct academic year.
2. Use **MOCK** only for synthetic QA pages. Use **MANUAL** for authorised transcription when no approved OCR provider exists.
3. Upload JPEG, PNG, or still WebP images. PDF and HEIC are not supported.
4. Check the private source image beside every row. Confidence is only a warning aid.
5. Confirm the Student by exact admission number, or choose manually when names are ambiguous.
6. Correct fields with a reason, resolve duplicate warnings with evidence, and tick every verification item.
7. A different authorised person approves the exact reviewed version.
8. Use **Preview** to see a zero-write summary. **Posting is disabled**; download the reviewed staging CSV and use the normal Payment Import preview after taking a backup.

Never use the handwritten reference as the ERP receipt number. Purge source images only under the authorised retention process; metadata and history remain.

## Student address and location planning

## SEC-1 operator safety

- Security testing is local-only. Never test the public domain or a real user.
- Use the copied-database SEC-1 runtime workflow for Browser QA. If copied/pilot isolation is not clear, stop.
- Keep bootstrap/auth/provider secrets out of chat, documents, logs, and screenshots.
- Keep Secure cookies behind production HTTPS and enable proxy trust only behind a proxy that removes forged forwarding headers.
- Browser restore is for an explicit copied QA database only; operational recovery follows the disaster-recovery runbook.
- Do not bypass limits, approval snapshots, reconciliation states, OCR review, receipt ownership, or permission-denied screens.
- Prompt 21B/21C/21D remain blocked. Do not collect or process Student addresses or locations.

Prompt 21A does not add a map or change any Student record. Continue using the current authorised Student workflow; do not paste Student addresses into Google Maps, Mapbox, OpenStreetMap/Nominatim, an AI assistant, public website, chat, email, or a personal spreadsheet.

## SEC-1 operator note

The local security and production Browser audits are complete. Do not run penetration tests against `nalandaps.com` or any external service. Security QA must use a copied database and QASEC1 records only; never sign in to the operational database for QA.

Before a real deployment, obtain technical help to verify HTTPS, HSTS,
reverse-proxy forwarded-header stripping, secure-cookie behavior, centralized
log protection/alerts, distributed rate limits/worker locks, live-provider
secrets, and physical PWA behavior. The earlier spreadsheet-parser advisory was
fixed in SEC-1-QA; do not change its exact-pinned package without a new
dependency review.

Prompt 21B/21C/21D are still blocked. Do not add Student addresses, coordinates, maps, or geocoding.

## Schoolknot Management audit operator note

The Management audit and its independent reconciliation QA are complete, with result `MANAGEMENT_RECONCILIATION_CLEARED` for Management only. The full Schoolknot replacement audit is not complete: Parent, Teacher and Principal checks are still pending. No new Admissions, payroll, transport, events, submission, discipline or cafeteria module was added. Continue using the current authorised Nalanda workflows and the approved interim Schoolknot/manual process for any missing operation.

Do not download Schoolknot exports, copy personal values, enter credentials into documents, switch on a live provider, or make bulk changes for this planning phase. Management/developer reconciliation details are in `SCHOOLKNOT_MANAGEMENT_REPLACEMENT_MATRIX.md` and `SCHOOLKNOT_MANAGEMENT_RECONCILIATION_QA_REPORT.md`; operators do not need to duplicate that backlog here. Prompt 21B/21C/21D remain blocked, and Prompt 22B must not be started.

## Safe Git routine

The GitHub repository is private-only: `vsairohith67/nalanda-school-erp`. Git stores the program and safe documentation, not the school database or business files. Before any commit, run `pnpm.cmd git:safety-check`, stage only the intended safe files, run the scanner again, then inspect `git diff --cached --name-only`.

Stop immediately if Git shows `.env`, any database, backup JSON, upload/OCR/provider file, log, generated export, Schoolknot artifact, `.next`, or `node_modules`. Do not paste a token or password into GitHub or chat. If a secret might have been committed, revoke/rotate it first and follow `GIT_BASELINE_AND_RECOVERY_WORKFLOW.md`; do not force-push `main`.

### Fresh installation and migration safety

For a brand-new computer or clone, use `CLEAN_INSTALL_AND_EXISTING_DATABASE_ONBOARDING.md`. Create a private local `.env` from `.env.example`, use a new empty database, then run `prisma migrate deploy` and `prisma migrate status`. Do not copy `prisma/dev.db` from Git—the operational database is intentionally not in the repository.

Do not run `db push`, `migrate dev`, `migrate resolve`, or `migrate deploy` against the school operational database. The DEVOPS-1B existing-database command makes a temporary copy and tests that copy. If onboarding is ever approved, a developer must first stop writes, verify backups/hashes, prove schema equivalence, and follow the documented copied rehearsal. Operators must not improvise this process.

### Prompt 21B approval status

Prompt 21A and its QA are complete, but Prompt 21B is not approved. The approval record is `PENDING`, every required blocker is `UNRESOLVED`, and the final gate is `PROMPT_21B_BLOCKED`. No leadership approval or qualified Indian privacy/legal review has been supplied.

The recommended low-risk choice is structured postal address only and `OMIT_ALL_COORDINATES_FROM_21B`. That recommendation is not permission to collect anything. Continue the current authorised Student workflow; do not ask Parents for new address fields, do not process existing addresses, and do not use a map or geocoder. The draft Parent notice, retention rules, and access/incident matrix must not be presented as approved school policy.

Before any Prompt 21B work, school leadership and the authorised privacy/legal adviser must approve why the address is needed, who may see it, how a Parent corrects it, how long it is kept, and how incidents/deletion are handled. The safe starting choice is structured postal address only. Coordinates remain optional, coarse, manually confirmed, and disabled unless separately approved. Never request a child’s live phone location or use a home location for surveillance or ranking.

## Governed examination marks

Teacher marks entry and Principal moderation are cleared for use only through
the exact assigned examination/class/section/subject paper shown in the app.
Teachers may save drafts, but final submission is explicit. After submission,
use **Request correction**; a Teacher cannot reopen their own sheet. A
Principal must review the reason and either reject or create a new version.

`PRESENT` zero is a real zero. Never use zero to mean absent or missing; choose
the explicit entry state. Do not bypass a missing-entry warning, maximum-mark
error, stale-version conflict or incomplete calculation warning.

Moderation lock freezes the exact source sheet and calculation snapshot. It
does not publish a report card or send a result to a Parent or Student. PDF,
bulk PDF, ZIP and physical print work belongs to the separately governed
EXAM-RC-IMPL-3 phase.
