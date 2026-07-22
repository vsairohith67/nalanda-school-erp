# Nalanda Fee Control — Real-Data Pilot Plan

This pilot must be completed before the school treats the software as the official live record.

## Pilot rules

- Use a copied database if possible.
- Keep the physical registers as the source of truth during the pilot.
- Do not delete or overwrite the only live data copy.
- Stop and investigate every unexplained mismatch.
- Record who performed each check and the date.

## 1. Prepare a safe pilot copy

- [ ] Stop the app.
- [ ] Copy `prisma\dev.db` to a dated safe folder.
- [ ] Run `pnpm backup`.
- [ ] Copy the generated JSON backup away from the project folder.
- [ ] If possible, create a separate project/database copy for pilot work.
- [ ] Confirm school settings and academic year.
- [ ] Confirm all pilot users have named accounts and private passwords.

## 2. Student Master pilot

1. Prepare a small but representative Student Master sample.
2. Include different classes, sections, normal students, a Faculty Child, and IX/X students.
3. Open **Import / Export → Student Master Import**.
4. Preview the file.
5. Correct errors and review warnings.
6. Import the valid rows.

### Verify 10 random students

For 10 students selected from different classes, compare the app with the admission register/source Excel:

- [ ] Admission number
- [ ] Student name
- [ ] Father/mother name
- [ ] Class and section
- [ ] Phone/WhatsApp number
- [ ] Status
- [ ] Student type and discount
- [ ] IX/X April start month or other-class June start month

Do not continue to payment import until the Student Master is correct.

## 3. Payment import pilot

1. Take another backup immediately before payment import.
2. Prepare a payment sample from the physical Daily Fee Collection Register.
3. Include Cash, UPI, and at least one split Cash+UPI receipt if available.
4. Upload the file in **Payment Import**.
5. Run **Dry run / preview only**.
6. Enter the expected physical-register totals.
7. Compare uploaded, valid, duplicate, error, date, mode, and account totals.
8. Correct unexplained differences.
9. Import only valid rows.

### Compare totals

- [ ] Imported total matches the physical register for the sample.
- [ ] Cash total matches.
- [ ] Each UPI/account total matches.
- [ ] Duplicate and error amounts are understood.
- [ ] Daily Collection shows the correct date and total.

## 4. Verify 10 random receipts

For 10 imported payments, compare:

- [ ] Receipt number
- [ ] Date
- [ ] Admission number and student
- [ ] Class/section
- [ ] Amount
- [ ] Payment mode
- [ ] Received account
- [ ] UPI/bank reference where required
- [ ] Fee type/term
- [ ] Split rows add up correctly when one receipt used Cash+UPI

Also open **Receipt / Payment Audit** and explain every warning in the pilot sample.

## 5. Verify pending dues for 10 students

Choose 10 students with a mix of paid, partly paid, and unpaid positions:

- [ ] Expected annual/term fee is correct.
- [ ] Faculty Child/concession is correct.
- [ ] April/June start month is correct.
- [ ] Current-year and old-due payments are treated correctly.
- [ ] Pending balance matches the manual calculation.
- [ ] WhatsApp reminder amount is correct.

## 6. Print test receipts

- [ ] Print one normal receipt.
- [ ] Print one split Cash+UPI receipt.
- [ ] Confirm school name, address, phone, receipt number, student, date, payment breakup, total, and print size.
- [ ] Confirm cancelled/partially-cancelled markings are clear when applicable.

## 7. Restore test — copied database only

1. Stop the app.
2. Make another copy of the pilot database.
3. Point the test copy/environment to the copied database.
4. Start the app and restore a pilot JSON backup.
5. Review validation counts, warnings, created/updated/skipped/errors.
6. Verify restored students, payments, receipts, Daily Collection, Pending Dues, import history, go-live checklist, and timetable.

- [ ] Restore was never tested against the only live database.
- [ ] User login accounts remained safe and usable.
- [ ] No password hashes appeared in the backup file.

## 8. Timetable pilot

Use a small controlled timetable sample:

- [ ] Enter 5 teachers.
- [ ] Enter 5 subjects.
- [ ] Enter 2 class sections.
- [ ] Set realistic weekly/daily teacher limits.
- [ ] Add workload assignments.
- [ ] Add at least one teacher unavailable period.
- [ ] Add at least one fixed period/activity.
- [ ] Generate a draft.
- [ ] Review unresolved periods, workload, conflicts, and warnings.
- [ ] Correct the draft in Manual Builder.
- [ ] Print one class timetable.
- [ ] Print one teacher timetable.
- [ ] Confirm Friday/period timings.
- [ ] Mark ACTIVE only if the Principal approves the sample.

## 9. Sign-off checklist

| Check | Name | Date | Result/notes |
|---|---|---|---|
| Backup and copied database prepared |  |  |  |
| 10 students verified |  |  |  |
| Payment register totals matched |  |  |  |
| Daily Collection matched |  |  |  |
| 10 receipts verified |  |  |  |
| 10 pending dues verified |  |  |  |
| 2 receipts printed correctly |  |  |  |
| Copied-database restore passed |  |  |  |
| Timetable pilot passed |  |  |  |
| Accountant approval |  |  |  |
| Admin/Director approval |  |  |  |
| Principal final approval |  |  |  |

### Final decision

- [ ] Approved for controlled live use.
- [ ] Approved with listed corrections.
- [ ] Not approved; pilot must be repeated.

After approval, take a new full backup and complete [REAL_DATA_GO_LIVE_CHECKLIST.md](REAL_DATA_GO_LIVE_CHECKLIST.md).
