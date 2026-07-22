# Future Attendance Module Plan — Documentation Only

No attendance module is currently built. Do not start software development until the school selects and tests a suitable attendance device.

## Recommendation

Buy a proven third-party biometric or face-attendance device from a vendor who provides local support. Start with **staff attendance first**. Staff attendance is smaller, easier to verify, and safer for learning the device and correction process before considering students.

## Minimum device requirements

- Stores attendance offline when internet is unavailable.
- Continues operating during short power cuts.
- Supports a mini UPS or compatible backup power supply.
- Exports attendance as a clear CSV/Excel file.
- Preferably provides a documented local or cloud API for future integration.
- Keeps employee IDs stable and does not force vendor-only names as identifiers.
- Allows manual correction with an audit trail.
- Provides India-based/local installation and support.
- Has clear data-retention, privacy, face-template/fingerprint-template, and device-replacement procedures.

## Power and network

- Install a **mini UPS** for the device and, if required, its router/network switch.
- The device must save punches locally during internet/network failure.
- Confirm how many records it can store offline.
- Test export after a power cut and after network reconnection.

## Future software integration phases

1. **Staff Master**
   - employee ID,
   - name,
   - department/designation,
   - joining/leaving date,
   - active status,
   - device enrollment ID.

2. **Attendance Import**
   - CSV/API import,
   - duplicate-punch handling,
   - missing ID report,
   - dry run and preview,
   - import batch history,
   - backup before import.

3. **Late Marks**
   - shift/start-time rules,
   - grace period,
   - approved exceptions,
   - monthly late count.

4. **Leave and CL**
   - leave types,
   - Casual Leave balance,
   - approval,
   - half-day handling,
   - attendance correction link.

5. **Monthly Report**
   - present/absent/leave/holiday,
   - late/early marks,
   - missing punches,
   - manual corrections and approver.

6. **Salary/LOP Summary**
   - payable days,
   - Loss of Pay days,
   - approved leave,
   - summary export for payroll.

This should remain a summary for payroll. Do not build a full payroll module unless separately approved.

## Questions to ask the vendor

1. Does the device work fully offline?
2. How many staff, face/fingerprint templates, and attendance records can it store?
3. Can it export raw punches to CSV/Excel without extra paid software?
4. Is there a documented API? Is it local LAN, cloud, or both?
5. Is API access included or separately licensed?
6. What stable employee ID appears in every export/API record?
7. Can the device handle multiple IN/OUT punches and overnight shifts?
8. How are missed punches and manual corrections recorded?
9. Does correction history show who changed what and when?
10. What happens when power or internet fails?
11. Which mini UPS is supported, and how long will it run?
12. Can old data be exported before device replacement?
13. Who owns biometric/face data, and where is it stored?
14. How are templates deleted when staff leave?
15. Is face/fingerprint data encrypted?
16. Does the vendor provide a privacy notice/consent process suitable for staff?
17. What is the warranty, annual maintenance cost, and response time in Hyderabad?
18. Can the vendor provide a trial unit and sample CSV/API output before purchase?
19. Can one device later support more gates or branches?
20. Are software updates and cloud subscriptions mandatory?

## Purchase acceptance test

Before final payment:

- [ ] Enroll 10 staff.
- [ ] Record normal, late, repeated, and missed punches.
- [ ] Disconnect internet and confirm offline storage.
- [ ] Test a short power interruption using the mini UPS.
- [ ] Export CSV and confirm stable employee IDs and correct timestamps.
- [ ] Obtain API documentation and sample response if API was promised.
- [ ] Confirm deletion/export procedure for biometric data.
- [ ] Record vendor support contact, warranty, and renewal costs.
