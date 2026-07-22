# Real Data Pilot Runbook

Use this runbook to test copied school data without risking the clean base database.

## Important rule

Keep the physical school registers and source files as the source of truth during the pilot. Never import real data until you have confirmed which database the app is using.

## 1. Take a backup first

1. Stop the app if it is running.
2. Open PowerShell in the project folder:
   `C:\Users\dell\Documents\school software`
3. Run:
   `pnpm backup`
4. Confirm that a new JSON file appears in `backups\`.
5. Copy that JSON file to another safe folder or USB drive.

Do not continue if the backup fails.

## 2. Create the pilot database copy

With the app still stopped, run:

`pnpm pilot:create`

The command:

- reads the current local SQLite database from `DATABASE_URL`
- creates `pilot-data\` if needed
- copies the database to a timestamped file such as `nalanda-pilot-2026-06-20-09-07.db`
- refuses to overwrite an existing file
- leaves the original database unchanged

Write down the exact pilot filename printed by the command.

## 3. Switch DATABASE_URL safely

1. Open `.env` in Notepad.
2. Copy the current `DATABASE_URL` line into your pilot notes before editing it.
3. The normal database is usually:

   `DATABASE_URL="file:./dev.db"`

4. Change it to the pilot filename printed by the script. Example:

   `DATABASE_URL="file:../pilot-data/nalanda-pilot-2026-06-20-09-07.db"`

5. Save `.env`.
6. Reopen `.env` and confirm the line contains both `pilot-data` and the correct timestamped filename.

The `../pilot-data/` path is intentional because Prisma resolves the SQLite path from the `prisma` folder.

## 4. Run the app on the pilot database

1. Run:
   `pnpm dev`
2. Open the local address printed in PowerShell.
3. Sign in as Director or Admin.
4. Confirm the green banner says:
   `PILOT DATABASE MODE — safe for testing`
5. Open Settings and verify the school name, academic year, receipt settings, and fee structure.
6. Test the required user logins.

The N button and white developer window appear only during local development. Ignore it or hide Dev Tools. It will not be part of production use. A real app error message should still be reported and investigated.

Stop immediately if the pilot banner is missing. Recheck `.env`, stop the app, and start it again.

## 5. Avoid importing into the wrong database

Before every student or payment import:

- confirm the pilot banner is visible
- read the exact `DATABASE_URL` in `.env`
- confirm the filename is inside `pilot-data`
- write the database filename in the Pilot QA Report
- keep the clean base database untouched
- take another JSON backup before a large payment import or restore test

Do not rely only on remembering which terminal window was opened.

## 6. Pilot order

### Create the testing-only sample files

Run:

`pnpm pilot:sample-data`

This creates, but does not import:

- `pilot-data\sample-imports\sample-students.csv`
- `pilot-data\sample-imports\sample-payments.csv`

The files contain normal, Faculty Child, IX/X, full, part, Cash, both UPI accounts, split-receipt, and intentionally invalid dry-run cases. Regenerating them replaces only these two sample CSV files.

If you already imported the sample once and want a clean rerun, first confirm `.env` points to a copied pilot database whose `DATABASE_URL` contains `pilot` or `pilot-data`, then run:

`pnpm pilot:reset-sample-data`

This removes only sample pilot records: admission numbers starting `PILOT-`, receipts starting `PILOT-`, related payment audit rows, sample receipt notes, and saved batches for `sample-students.csv` and `sample-payments.csv`. The command refuses to run on the normal `dev.db`.

### Run the acceptance sequence

1. Sign in as Director or Admin.
2. Open **Pilot Acceptance** from the sidebar.
3. Verify school settings and named user logins.
4. Import `sample-students.csv` using dry-run first.
5. Review the intentional invalid row, then import only valid student rows.
6. Verify the sample students against the CSV. CSV row numbers include the header row, so the first data row is row 2.
7. Upload `sample-payments.csv` and run payment dry-run first.
8. Review the intentional invalid payment row and the two-row split receipt.
9. Compare expected totals with valid importable totals. For sample data use 20-06-2026 to 20-06-2026.
10. Import valid payments only after every mismatch is understood.
11. Check Daily Collection, ledgers, receipt print, Receipt Audit, and Pending Dues.
12. Open manual timetable builder, generator, and print/export; check one class and one teacher print.
13. Test restore only after making another copy of the pilot database.
14. Take a final backup.

The Pilot Acceptance checkboxes and section notes are temporary and saved only in the current browser. They are not written to the school database. Copy permanent findings into `docs/PILOT_QA_REPORT_TEMPLATE.md`.

## 7. Reconcile the collection

1. Open **Pilot Acceptance** as Director or Admin.
2. In **Pilot Reconciliation**, enter the start and end dates.
3. For generated sample data, select **Use Sample Date** or enter 20-06-2026 to 20-06-2026.
4. For generated sample data, select **Fill Sample Expected Totals** or enter:
   - Cash: `60000`
   - Director Sir GPay: `30300`
   - NPS Current Account UPI: `11300`
   - Bank / Other: `0`
   - Grand Total: `101600`
5. For real school data, enter expected totals only from the physical Daily Fee Collection Register.
6. Select **Compare Totals**.
7. Review Actual and `Actual - Expected`.
8. Investigate every non-zero difference before sign-off.

The actual figures are read-only. Cancelled and deleted payment rows are excluded. Bank / Other includes NPS Bank Account, Cheque, Other, and any unrecognized legacy account.

Repeated import or dry-run clicks create extra saved Import Verification batches. That is normal. If payment rows were already imported, rerunning the same sample import shows duplicates/skipped rows until you reset sample pilot data.

## 8. Screenshots and notes to capture

Capture or write down:

- pilot banner and database filename
- Pilot Acceptance completion summary and notes for each section
- Settings school name and academic year
- `pnpm pilot:sample-data` output and both generated filenames
- student import summary and any warnings
- 10 student verification notes
- payment dry-run totals
- expected versus actual totals by date, mode, and account
- Pilot Reconciliation table with date range and zero differences, or explained differences
- completed payment import summary
- Daily Collection total for the sample date
- 10 ledger verification notes
- two printed receipt results
- Pending Dues sample result
- restore preview/result counts and warnings
- timetable print result
- every issue found and how it was resolved

Do not include passwords in screenshots or notes.

## 9. Acceptance before sign-off

Do not sign off until:

- all applicable Pilot Acceptance checks are completed
- every reconciliation difference is zero or documented and approved
- the intentional invalid rows were rejected during dry-run
- one Cash-only, one UPI-only, and one split receipt were verified
- one fully paid, one part-paid, one Faculty Child, and one IX/X due result were checked
- one class and one teacher timetable print were checked
- the final backup filename is recorded

## 10. Return to the normal database

1. Stop the app completely.
2. Open `.env`.
3. Restore the original line, normally:

   `DATABASE_URL="file:./dev.db"`

4. Save `.env`.
5. Start the app again with:
   `pnpm dev`
6. Sign in as Director/Admin.
7. Confirm the pilot banner is no longer visible.
8. Verify that the clean base database still has its expected sample or empty data.

Do not delete the pilot database. Keep it with the completed QA report until the pilot decision is signed.
