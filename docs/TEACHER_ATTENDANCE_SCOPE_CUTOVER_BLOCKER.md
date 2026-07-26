# Teacher Attendance Scope Cutover Blocker

Status: `CONFIRMED_CRITICAL_DEFECT`
Teacher cutover: `NO_GO_FOR_TEACHER_CUTOVER`

This is a code and data inspection only. No fix, attendance record, role permission, timetable assignment or operational database value was changed.

## Current permission path

1. `RECOMMENDED_ROLE_PERMISSIONS.TEACHER` grants `VIEW_STUDENT_ATTENDANCE`, `MANAGE_STUDENT_ATTENDANCE` and `SUBMIT_STUDENT_ATTENDANCE`.
2. `/attendance/students` calls `requirePermission("VIEW_STUDENT_ATTENDANCE")`.
3. The page queries every active Student class/section and passes all results to the selector.
4. `GET /api/attendance/students` checks only `VIEW_STUDENT_ATTENDANCE`, accepts caller-supplied date/class/section/year, then returns the matching active roster and session.
5. `POST /api/attendance/students` checks view plus manage/submit/lock permission, accepts caller-supplied scope, upserts a session and writes roster records.
6. `activeStudentsForScope()` filters active Students by the submitted academic year/class/section, but it does not bind the user to `StaffMember`, `TimetableTeacher` or `TimetableAssignment`.

## Exact defect and risk

The role permission is treated as global authority. A Teacher who can reach the page/API can enumerate and modify attendance for any active class/section by changing selector values or the API body. This is an object-scope/IDOR-class authorization defect even though the API uses class/section rather than a numeric record ID.

The current operational database has no Teacher user, no active teaching `StaffMember`, no `TimetableTeacher`, no `TimetableAssignment` and no substitute assignment. The defect is therefore dormant in the current user baseline, but it becomes active as soon as a Teacher account is provisioned because the default and persisted role matrix grant the global attendance permissions.

## Affected current cohorts

The page/API can target all eight active Student cohorts in the operational baseline: `I-B`, `II-A`, `III-A`, `IV-B`, `IX-A`, `LKG-A`, `VI-C` and `X-A`. This is structural class/section evidence only; no Student identity was read or recorded.

The timetable master currently contains 23 active class/section rows but zero subject assignments. Two operational cohorts also do not align cleanly with the timetable defaults (`LKG-A` versus timetable `LKG` with no section, and `VI-C` with no timetable `VI-C` row). A safe implementation must fail closed rather than normalise these mismatches.

## Required scope semantics

- Exact class **and** section, academic year and active assignment must match.
- A Teacher assignment to one subject in a class/section may authorise class-wide morning attendance only if the school explicitly approves that rule; otherwise a dedicated class-teacher/attendance-owner assignment is required.
- Subject assignment must not silently imply whole-class attendance authority.
- Section blank/null/`A` mismatches must not broaden scope.
- A substitute receives only the exact dated class/section/period duty, only while confirmed/active, and not general historical or future attendance access.
- Principal override must be a separate explicit permission with a reason and audit; the Principal title alone is insufficient.
- No active Staff link, no active timetable Teacher, no active assignment, ambiguous mapping or inactive class must return an empty selector and `403` API denial.
- UI filtering is convenience only; every GET/POST/direct-ID path must repeat server-side scope checks.

## Audit requirements

Record the actor user/role/staff/teacher assignment, requested class/section/year/date, authorization source (primary assignment, class-teacher rule, substitute or Principal override), action, before/after session state, reason for override/correction, request correlation and result. Do not duplicate Student personal data in the audit payload.

## Proposed Prompt 23C implementation

- Add one shared server-only attendance-scope resolver modelled on the existing Homework scope helper.
- Resolve the authenticated Teacher through active `StaffMember -> TimetableTeacher`.
- Resolve exact active timetable assignments and any approved class-teacher rule.
- Add a dated substitute resolver and a separate Principal override contract.
- Filter page options from the resolver.
- Enforce the same resolver on GET and every POST action before reading/upserting a session.
- Fail closed for no assignment, inactive links, unmatched section and direct request tampering.
- Preserve Director/Admin authorised operational access and existing attendance lifecycle.

## Required tests

- Assigned exact class/section GET/save/submit succeeds.
- Same class, other section is denied.
- Other class is denied.
- Direct API tampering is denied with unchanged data.
- No Staff link, inactive Staff, no timetable Teacher and no assignment each deny.
- Blank/null/letter section mismatch denies.
- Confirmed substitute has only exact date/duty access; draft/cancelled/other-date duty denies.
- Principal override requires the explicit permission, reason and audit.
- Teacher cannot lock unless policy explicitly grants it; current default correctly omits lock.
- Reports remain separately permissioned and do not leak unassigned cohorts.
- Existing Homework/marks/report-card scopes remain unchanged.

Prompt 23B-QA cleared this blocker analysis without implementing the fix. Prompt 23C may begin from the merged/tagged QA baseline. Teacher cutover remains `NO_GO` until the implementation and independent negative-security QA pass.
