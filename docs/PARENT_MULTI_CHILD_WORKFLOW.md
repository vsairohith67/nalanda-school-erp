# Parent Multi-Child Attendance and Timetable Workflow

A Parent with one eligible linked child receives a safe server-resolved default; no database context mutation occurs merely to render the page. A Parent with two or more eligible children uses the existing IAM child selector.

Selector values are HMAC-backed opaque handles bound to User authorization version, `StudentGuardian` link and session context version. A successful switch stores only the selected link in the server session and increments the context version. Both attendance and examination-timetable pages reload from the new server context.

Old tabs and handles fail closed after a switch, link removal, role change, enrollment change or authorization-version change. A handle from another Parent cannot be replayed. The selector exposes permitted child display data but no raw IDs. Attendance and timetable APIs repeat the complete relationship proof on every request.
