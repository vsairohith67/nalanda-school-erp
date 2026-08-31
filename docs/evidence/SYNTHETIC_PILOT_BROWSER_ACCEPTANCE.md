# Synthetic Pilot Browser Acceptance

**Fixture:** generated synthetic data only
**Runtime:** local Next.js development runtime bound to `127.0.0.1`; isolated SQLite fixture
**Viewports:** `1366x768` and `390x844`
**Themes:** light and dark
**Result:** representative role, denial, responsive and theme checks passed with no unexpected browser warning/error log, hydration error, significant page overflow or unnamed button/link in the recorded checks.

## Role evidence

| Persona | Representative evidence | Result |
| --- | --- | --- |
| Super Admin | Command Center and Cash Book across desktop/mobile and light/dark | Passed |
| Principal | Dashboard, Student Attendance, Exams and Report Cards across the four viewport/theme combinations | Passed |
| Accountant | Payments, Expenses, Miscellaneous Income and Cash Book across the four viewport/theme combinations | Passed |
| Teacher | Teacher portal, Classwork, Homework, Student Attendance and repaired School Calendar scope | Passed |
| Parent | Parent Portal, Attendance, issued Report Cards and Support | Passed; linked-child context remained active |
| Viewer | Dashboard allowed; direct Students, new Payment and Users navigation failed closed at Access Restricted | Passed |
| Student | Authenticated landing at My Classwork | Passed |
| Gate Staff | Authenticated Dashboard and Gate Pass Verification | Passed |
| Director, Admin, Computer Operator | Authenticated role landing | Passed |
| Disabled test account | Remained at Login with the generic `We couldn’t sign you in with those details.` response | Passed; no account-state detail leaked |

Teacher marks entry remained intentionally denied by the Academic Integrity policy because the fixture does not fabricate an exact examination assignment. This is the expected fail-closed result, not a rehearsal failure.

## Responsive and accessibility observations

- Recorded pages had zero horizontal page overflow at the tested widths.
- Recorded pages had zero unnamed buttons and zero unnamed links.
- The responsive-table decorator produced no hydration warning after post-hydration idle scheduling was introduced.
- Intentional access denials were understandable and did not expose protected content before redirect.
- The browser console contained no unexpected warning/error entries in the final clean checks.
- The five referenced artifacts were normalized to actual PNG encoding and rechecked for synthetic-only content. Older unreferenced drafts, including one with a development issue badge, were quarantined outside the release evidence set.

## Screenshots

- [Teacher calendar, desktop light](synthetic-pilot-browser/teacher-calendar-desktop-light.png)
- [Parent issued reports, mobile dark](synthetic-pilot-browser/parent-results-mobile-dark.png)
- [Viewer payment denial, mobile light](synthetic-pilot-browser/viewer-payment-denied-mobile-light.png)
- [Super Admin, desktop light](synthetic-pilot-browser/super-admin-desktop-light.png)
- [Accountant, mobile dark](synthetic-pilot-browser/accountant-mobile-dark.png)

Screenshots contain synthetic fixture labels only. They are acceptance evidence, not proof of production deployment, a real-user pilot, public/private staging, provider-edge controls or physical-device certification.
