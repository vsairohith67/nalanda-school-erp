# Exact Marks Authorization Model

Permission is necessary but never sufficient for Teacher access. Every page,
Student list, draft, row save, bulk save, submit, correction request and
counter is derived from the same resolver in `lib/exam-marks-scope.ts`.

The resolver requires all of the following to agree:

- active authenticated `User` with role `TEACHER`;
- active linked `StaffMember`;
- active linked `TimetableTeacher`;
- active exact `TimetableAssignment`;
- active exact `TeacherExamAssignment`;
- academic year, examination and class scope;
- timetable class/section;
- subject and paper;
- frozen scheme version and component;
- assignment role and status.

Canonical class and section values must also match their stored uppercase
values. Cross-year, class, section, subject, paper, component, Teacher or
scheme references fail closed with an enumeration-resistant response.
Unlinked or unassigned Teachers receive an empty workspace.

The same server resolver is called before and inside each mutation
transaction. `PRIMARY_SUBMITTER` is the only final owner.
`CONTRIBUTOR` remains an audited contributor and cannot submit.

Principal actions require their dedicated effective permission. Super Admin
use additionally requires `INTERVENE_EXAM_MARKS` and an intervention reason.
All unsafe requests pass the shared same-origin/CSRF middleware and the
512 KiB EXAM marks payload limit.
