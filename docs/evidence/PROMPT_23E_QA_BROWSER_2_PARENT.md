# Prompt 23E-QA Browser Checkpoint 2 — Parent

Date: 2026-08-03

Environment: fresh `CAL23E` copied database, final production build, isolated production runtime on `127.0.0.1:3220`.

Independent Parent QA passed at exact 1366 × 768 and 390 × 844 in light and dark themes. The authenticated calendar exposed month, agenda and print views with only published entries authorised for the active linked-child context.

For Child A, the Parent saw the published school-wide event, the exact Child A class/section event and the current published examination timetable reference. Child B events, Staff-only events, leadership-only events, marks and internal diagnostics were absent. After switching to Child B through the labelled linked-child control, the calendar refreshed to show the Child B event and school-wide entry while Child A and examination entries disappeared.

The account menu exposed the child selector with accessible name `Linked child context`. Calendar and agenda content used semantic table and list structures. All visible interactive controls measured at least 44 px, keyboard focus was visible and the exact mobile viewport had no page-level horizontal overflow or clipped content. No native JavaScript dialog appeared and the Browser console contained zero warnings or errors.

The production runtime emitted no stderr. The Parent tab and isolated runtime were stopped before the Teacher/multi-role batch began.
