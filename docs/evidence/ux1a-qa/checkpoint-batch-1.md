# UX-1A-QA recovery checkpoint — Batch 1

Date: 2026-07-30

Status: PASS

Scope completed:

- Viewer: human designation `Viewer / Auditor`; permission-filtered read-only navigation; one academic-year control; Change Password and Logout present; no role picker or raw role enum; direct `/users` access redirected to `/unauthorized`; zero Browser console warnings/errors; no native dialog; no document overflow.
- Teacher: human designation `Teacher`; role landing `/teacher`; assignment/permission-derived navigation; one academic-year control; Change Password and Logout present; no role picker or raw role enum; direct `/payments` access redirected to `/unauthorized`; zero Browser console warnings/errors; no native dialog; no document overflow.
- Parent: human designation `Parent`; role landing `/parent`; parent-only navigation; one academic-year control; Change Password and Logout present; no role picker or raw role enum; direct `/students` access redirected to `/unauthorized`; zero Browser console warnings/errors; no native dialog; no document overflow.
- Repaired desktop sidebar links: 70 visible controls measured; minimum height 44px.
- Repaired `Review System Health` action: measured height 44px.
- Affected-control retest: no document overflow.

Isolation:

- Browser QA used the ignored copied database `UX1AQA-browser.db`.
- The operational baseline check remained `UX1AQA_OPERATIONAL_BASELINE_UNCHANGED`.
- Operational database hash remained `9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`.
- No credential, cookie, session token, password hash, internal user ID, or permission token is recorded here.

Next restart-safe batch: exact responsive viewport and light/dark matrix.
