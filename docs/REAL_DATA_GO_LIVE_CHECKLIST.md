# Real Data Go-Live Checklist

Complete and sign off every item before entering live school records.

- [ ] Take a full JSON backup.
- [ ] Stop the app and copy the database file to a separate safe location.
- [ ] Verify school settings: name, academic year, phone, address, logo, receipt title, and print size.
- [ ] Review Settings → System Health and resolve Critical items.
- [ ] Create real named users for Director, Admin, Accountant, and Viewer as required.
- [ ] Change all default/documented temporary passwords.
- [ ] Confirm sample/demo students and payments will not be confused with real records.
- [ ] Import Student Master first.
- [ ] Verify 10 random students against the source register, including admission number, name, class, section, phone, and status.
- [ ] Correct Student Master issues before importing payments.
- [ ] Import payments only after Student Master is correct.
- [ ] Verify 10 random payments against the physical register, including date, receipt, student, amount, mode, and received account.
- [ ] Compare Daily Collection totals with the physical register, cash, bank, and UPI records.
- [ ] Export Pending Dues and review totals.
- [ ] Print a test receipt and verify layout and school/student/payment details.
- [ ] Test backup restore using a copied database only.
- [ ] Verify restored students, payments, daily collection, pending dues, and receipt audit.
- [ ] Store a backup copy away from the school computer.
- [ ] Record Director approval and go-live date.

## How to use Import Verification before real data go-live

1. Take a full backup before any large import.
2. Open **Import / Export** and upload the Student Master file.
3. Save a Student trial run. No student records are changed.
4. Open **Import Verification**, review the batch counts, and verify up to 10 sample students against Excel and the admission register.
5. Complete the real Student Master import only after correcting errors.
6. Upload the payment file and enter optional expected totals from the physical Daily Fee Collection Register.
7. Save a Payment trial run. Compare uploaded, valid, duplicate, and error amounts plus totals by date, payment mode, and received account.
8. Resolve every unexplained mismatch before importing payments.
9. After the actual payment import, open its saved batch and verify up to 10 sample payments.
10. Compare the created amount and Daily Collection report with the physical register, cash, UPI, bank, and cheque totals.
11. Update the in-app go-live checklist and take another backup after import.

Import Verification does not provide batch rollback. To undo a bad import, restore the backup taken immediately before the import.
