# Parent Attendance Access Specification

Prompt 23D exposes official Student attendance to an authenticated Parent as a read-only projection. Access is not granted by permission alone. Every page and API request must prove an active User, unrevoked current session, active Parent role assignment, active Parent role context, current version-bound opaque child handle, active Guardian link, and exact active academic-year enrollment.

The server resolves the child from the session-held `StudentGuardian` link. It never accepts a raw Student ID. Removal of the Guardian link, role switch, session revocation, authorization-version change, child switch, enrollment change, or stale context version makes the request fail closed without Student identity in the error.

Only `SUBMITTED` and `LOCKED` `StudentAttendanceSession` records for the exact enrollment cohort are official. `DRAFT` sessions are excluded. The Parent DTO contains the permitted child identity, academic year, class/section, month, chronological date/status rows, governed status counts, and latest official update time. It excludes remarks, session notes, Staff identities, raw IDs, other Students and audit payloads.

The existing statuses are reused exactly: `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, and `EXCUSED`. Nalanda currently has no governed working-day calendar or approved daily-attendance percentage formula. The Parent view therefore reports authoritative counts only, leaves working-day count and percentage unavailable, and never labels an unrecorded date absent or non-working.

Routes:

- `/parent/attendance` and authenticated `/parent/attendance/print`
- `GET /api/parent/attendance?academicYear=...&month=...&childContext=...&contextVersion=...`

Responses are private and `no-store`. There is no Parent mutation route, hidden state-changing GET, correction, dispute, deletion, bulk action, export, AI/provider transfer, or notification delivery in this phase.
