# Prompt 23E-QA Browser Checkpoint 3 — Teacher and Multi-Role Context

Date: 2026-08-03

Environment: fresh `CAL23E` copied database, final production build, isolated production runtime on `127.0.0.1:3220`.

Independent Teacher and Teacher-plus-Parent QA passed at exact 1366 × 768 and 390 × 844 in light and dark themes. In Teacher context, the user saw the assigned Class A event, authorised Staff event and current examination reference. The unrelated Class B event and leadership-only event were absent from month, agenda and authenticated print views.

Switching the same account from Teacher to Parent context invalidated the stale Teacher calendar tab and failed closed at the unauthorised route. Inside Parent context, the linked-child selector appeared; selecting Child B exposed only the school-wide and Child B entries. Assigned Teacher, Staff-only, leadership-only, Child A and unrelated examination content were absent. Switching back to Teacher context dropped the child context and restored only Teacher-authorised Class A, Staff and examination entries.

All visible interactive controls measured at least 44 px, keyboard focus was visible and neither viewport had page-level horizontal overflow or clipped cards/dialogs. No native JavaScript dialog appeared and the Browser console contained zero warnings or errors.

The production runtime emitted no stderr. The final tab was closed, Browser state was finalised with no retained tabs and the isolated runtime was stopped.
