# Sample Import Formats

Use simple Excel or CSV files with one header row. Import Student Master first. Do not import payments until the students have been checked.

## Generate the pilot sample set

From the project folder run:

`pnpm pilot:sample-data`

This creates:

- `pilot-data\sample-imports\sample-students.csv`
- `pilot-data\sample-imports\sample-payments.csv`

The command does not import anything. The files are testing-only and may be regenerated safely.

To rerun the sample from a clean copied pilot database, run:

`pnpm pilot:reset-sample-data`

The reset command works only when `DATABASE_URL` contains `pilot` or `pilot-data`. It refuses the normal `dev.db` and prints how many sample students, payments, audits, receipt notes, and sample import batches were removed.

Included cases:

- normal student
- Faculty Child with 50% discount
- IX and X students
- full and part payments
- Cash-only payment
- Director Sir GPay UPI payment
- NPS Current Account UPI payment
- Cash + UPI split under the same receipt and student
- one intentionally invalid student row
- one intentionally invalid payment row

Always run dry-run first and confirm the invalid rows are rejected.

Expected generated sample results before any database duplicates exist:

- Student file: 5 rows, 4 valid, 1 invalid
- Payment file: 6 rows, 5 valid component rows, 1 invalid
- Sample date range: `20-06-2026` to `20-06-2026`
- Cash: `60000`
- Director Sir GPay: `30300`
- NPS Current Account UPI: `11300`
- Bank / Other: `0`
- Grand Total: `101600`

## A. Student import

Recommended columns:

| Admission No | Student Name | Father Name | Class | Section | Phone | WhatsApp | Student Type | Discount % |
|---|---|---|---|---|---|---|---|---|
| NPS-001 | Sample Student | Sample Father | VI | A | 9876543210 | 9876543210 | NORMAL | 0 |

Guidance:

- Admission No must uniquely identify the student.
- CSV row numbers include the header row. The first data row appears as CSV Row 2.
- Keep class and section spelling consistent.
- Phone and WhatsApp should be digits only where possible.
- Use the student types already supported by the app.
- Enter Discount % as a number, such as `10`, not `10%`.
- Use testing-only names in a sample file. Do not mix sample rows with approved real rows.
- If the result says rows were skipped because existing, those admission numbers are already in this database. Use Update Existing only when you intend to edit them, or reset sample pilot data before testing again.

## B. Payment import

Recommended columns:

| Date | Receipt No | Admission No | Student Name | Class | Amount | Payment Mode | Received Account | UTR | Fee Type | Term | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 20-06-2026 | R-1001 | NPS-001 | Sample Student | VI | 1000 | UPI | Director Sir GPay | TEST123 | Current Year Fee | Term 1 | Pilot sample |

Guidance:

- Import Student Master first.
- Upload the payment file and run a dry-run before the real import.
- Compare valid importable totals with the physical register.
- The same receipt number can repeat for a split payment, such as one Cash row and one UPI row.
- Every split row must use the same receipt number, date, and student.
- `GPay` means `Director Sir GPay`.
- `Director`, `GPay`, and `Director Sir GPay` mean `Director Sir GPay`.
- `NPS`, `NPS UPI`, `NPS Current Account UPI`, and `Current Account UPI` mean `NPS Current Account UPI`.
- Use `NPS Bank Account` for bank transfer rows. Reconciliation groups bank, cheque, other, and unknown legacy accounts under Bank / Other.
- CSV row numbers include the header row. The first data row appears as CSV Row 2.
- Keep receipt number, date, admission number, amount, mode, and received account exactly as recorded.
- UTR should be provided for UPI/bank entries when available.
- `Received account was blank; defaulted to ...` means the account cell was empty and the app inferred the account from payment mode. A valid Director Sir GPay or NPS Current Account UPI value should not produce that warning.
- Unknown received account text maps to Other and should be checked against the physical register before import.
- Import valid payments only after duplicate, error, and warning rows are understood.
- Do not repeatedly import the same sample payment file without resetting sample pilot data, or the next run will correctly show duplicates.
# Staff Import (Prompt 12A)

Download the current template from **Import / Export > Staff Import**. Columns are:

`staffCode, fullName, staffType, designation, department, primarySubject, additionalSubjects, qualification, experienceYears, dateOfJoining, mobile, alternateMobile, email, status, notes`

- Preview is mandatory and does not change the database.
- Tick the review checkbox only after checking creates, updates, warnings, and errors.
- Matching uses `staffCode` first. When staff code is blank, email is checked before mobile.
- Staff import never creates login accounts. Create or link a Teacher login separately from the staff profile.
- Allowed staff types: `TEACHING`, `NON_TEACHING`, `ADMIN`, `SUPPORT`, `OTHER`.
- Allowed statuses: `ACTIVE`, `INACTIVE`, `LEFT`.

## Handwritten fee-register reviewed staging CSV

Prompt 20B can export human-reviewed OCR staging rows when controlled posting is unavailable. The file includes only the matched admission number, payment date, amount, mode, received account, term, handwritten reference, duplicate classification, and review status. It is formula-safe and states that it does not prove a Payment was posted.

Do not import this file blindly. Run the normal Payment Import preview, review every warning/duplicate, take a backup, and verify the Payment totals after import. The handwritten reference is evidence; it is not an ERP receipt number.
