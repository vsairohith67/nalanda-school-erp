# Parent Meetings, Appointments and Follow-up Architecture

- **Prompt:** `PARENT-MEETING-V1_5-1A`
- **Module flag:** `PARENT_MEETINGS_V1_5`
- **Operational default:** `OFF`
- **School time zone:** `Asia/Kolkata`
- **Release boundary:** local/private software clearance only

## Purpose and boundaries

This module gives Nalanda one governed record for a current Parent's meeting
request, the school's schedule, authorised staff participation, meeting
outcome, deliberately released Parent summary, private internal evidence and a
small follow-up. It replaces fragmented coordination without becoming a
medical, counselling, disciplinary-investigation, admissions, Support case,
attendance, timetable, working-day, report-card or marks subsystem.

The module contains no attachment store, external calendar or video
integration, WhatsApp/SMS/email/push provider, AI provider or appointment SaaS.
It does not create My Work tasks. Universal Search and Smart AI integration are
deferred to a later explicitly governed Search extension.

## Data model

All six models are additive and keep the existing Student, Guardian, User and
StaffMember identities authoritative:

| Model | Durable responsibility |
| --- | --- |
| `ParentMeeting` | Student/Guardian context, category, Parent-safe request, schedule, lifecycle, cancellation/no-show and completion metadata |
| `ParentMeetingPreference` | Up to three immutable requested date/time windows |
| `ParentMeetingParticipant` | Explicit StaffMember assignment, primary/additional role and attendance history |
| `ParentMeetingNote` | Append-only, physically separated leadership-private, participant-internal or Parent-visible evidence and correction chains |
| `ParentMeetingFollowUp` | Internal and separately Parent-visible descriptions, responsible StaffMember, due date and open/done/cancelled state |
| `ParentMeetingEvent` | Append-oriented significant-action history with safe metadata and no broad logging of note bodies |

Public UUID-style keys are used at API boundaries. Existing internal Student,
Guardian, User and Staff IDs are not rewritten. The migration adds targeted
status/date, Student, Guardian, participant and follow-up indexes, integrity
checks, immutable-evidence triggers and overlap guards.

## Categories and occurrence state machine

Categories are `ACADEMIC_PROGRESS`, `ATTENDANCE`,
`GENERAL_SCHOOL_DISCUSSION`, `ADMINISTRATIVE`,
`PRINCIPAL_APPOINTMENT` and `OTHER`. Sensitive matters use neutral wording and
restricted notes; they do not create a new health or counselling database.

The occurrence lifecycle is:

```text
REQUESTED -> SCHEDULING -> SCHEDULED -> CONFIRMED
    |             |            |           |
    +-------------+------------+-----------+-> CANCELLED
                               +-----------> COMPLETED
                               +-----------> NO_SHOW
```

`REQUESTED` may be scheduled directly. `CONFIRMED` may be rescheduled back to
`SCHEDULED`. `COMPLETED`, `CANCELLED` and `NO_SHOW` are terminal. Optimistic
row versions and database transition triggers reject duplicate or conflicting
terminal actions. Significant corrections append a note/event rather than
changing or deleting earlier evidence.

Schedules require an explicit offset and are displayed in `Asia/Kolkata`.
Duration is 10–180 minutes. Server and database guards reject overlapping
active meetings for the same explicit staff participant, requester Guardian or
case-insensitive in-person location. Online mode stores a plain approved
reference, not a clickable URL.

## Role and permission matrix

| Role/context | List/view | Schedule/manage | Internal evidence | Parent-safe view |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | All module records | Yes | Leadership-private and participant evidence | Yes |
| `PRINCIPAL` | All module records | Yes | Leadership-private and participant evidence | Yes |
| `DIRECTOR` | Oversight list/history | No | No private note bodies or internal follow-up description | No Parent identity expansion |
| `TEACHER` | Explicitly assigned meetings only | No | Participant-internal note, own attendance, own responsible follow-up | No leadership-private evidence |
| `PARENT` | Own active linked child and own Guardian context only | Request and cancel an unscheduled own request | Never | Schedule, approved names, released summary and deliberately shared follow-up |
| Other built-in roles | Deny | Deny | Deny | Deny |

Other built-in roles are `ADMIN`, `ACCOUNTANT`, `COMPUTER_OPERATOR`, `STUDENT`,
`GATE_STAFF`, `VIEWER` and `MARKS_ENTRY_OPERATOR`. Parent Meeting permissions
are object-scoped and cannot be added through a broad custom profile. No
automatic scheduler delegation is introduced; a future
`PARENT_MEETING_SCHEDULER` capability would require a separate IAM decision.

Every page and API route performs current-session permission/role checks.
Route names and hidden navigation are not authorization controls.

## Parent ownership

The server resolves the active session's `User -> Guardian -> StudentGuardian
-> active AcademicYearEnrollment` context. A browser-supplied Student or
Guardian ID is never accepted for a Parent request. The child handle is opaque,
session/version bound and revalidated. Lists require both the linked Student
and the authenticated requester's Guardian context, producing fail-closed
cross-family and cross-child behavior.

Parent payloads expose only the public meeting key, Parent-safe request,
schedule/mode/location, approved display names, current released summary,
Parent-safe cancellation wording and intentionally shared follow-up. They do
not serialize internal notes, internal follow-up descriptions, private audit,
hidden cancellation reasons, staff handles or other families.

## Teacher participant scope

V1.5-1A deliberately uses explicit `ParentMeetingParticipant` assignment.
The general `TEACHER` role, same grade, subject or class does not grant access.
An assigned Teacher can append participant evidence and update only their own
participant attendance or a follow-up for which they are the responsible
StaffMember. Leadership-private notes remain unavailable.

This module neither imports nor grants `ENTER_MARKS` or
`ENTER_ASSIGNED_EXAM_MARKS`. It has no code path to marks, grades, publication,
report cards or progression. Academic Integrity v1.1 remains: Teacher marks
write denied; Principal/Super Admin normal authority unchanged;
`MARKS_ENTRY_OPERATOR` exact delegation only.

## Notes, summary and follow-up

There is no client-controlled visibility boolean. `LEADERSHIP_PRIVATE`,
`PARTICIPANT_INTERNAL` and `PARENT_VISIBLE_SUMMARY` are separate server-checked
note kinds. A Parent-visible summary is publishable only after meeting
completion. A correction references the earlier note, requires a reason and
cannot replace or delete that earlier evidence.

Follow-up has separate internal and Parent-visible descriptions. It stays
inside this module, requires a completed meeting, a responsible active
StaffMember and a school-local due date, and moves one way from `OPEN` to
`DONE` or `CANCELLED`.

## Notifications and reporting

Request, schedule, reschedule, cancel, upcoming, outcome, released-summary and
follow-up events create only `IN_APP` notification campaigns. Exact Guardian,
explicit participant and leadership recipient resolution is performed on the
server. A deterministic event fingerprint and unique campaign number make
processing idempotent. No external provider is called.

Leadership reporting includes pending, upcoming, completed, cancelled,
no-show, open follow-up and overdue-follow-up counts with bounded filters and
pagination. Leadership CSV omits private note bodies by default and prefixes
formula-leading cells to prevent spreadsheet formula injection.

## Privacy and security controls

- Private/no-store response headers and server permission checks apply to all APIs.
- Parent and Teacher serializers are allowlists, not field subtraction.
- Note bodies are rendered as React text; HTML, script, SVG and SQL-like strings are not executed.
- Significant audit metadata records references and state, not full internal note text.
- Optimistic versions and database constraints fail closed under concurrent schedule, terminal and follow-up actions.
- Schedule/list queries are indexed, bounded and paginated; no complete-table browser transfer is used.

## Migration, backup and recovery

Migration `20260822170000_parent_meetings_v1_5` is additive. It is validated on
a fresh database and a copied existing database only; it is not applied to the
operational database during software QA. Foreign-key checks and exact-path
copied-database cleanup are mandatory.

Logical backup version 43 adds all six durable Parent Meeting arrays. Restore
validates supported fields, identities, status values and graph links; maps
existing Student, Guardian, StaffMember and safe User identities; restores
notes in correction order; and is idempotent on a second pass. Sessions,
passwords, secrets and provider state remain outside the durable module data.

## Feature flag and release boundary

`PARENT_MEETINGS_V1_5` is false unless its exact environment value is `true`.
When false, pages/APIs fail closed, normal navigation is absent and the
reminder command exits without writes. Copied/synthetic QA may enable it.

`PARENT_MEETING_V1_5_CLEARED` means only that local/private software and its
recovery path passed independent QA. It does not enable operational use,
onboard real Parents, import meeting history, send live communications,
perform external calendar sync, deploy or change production configuration.

The exact independent acceptance evidence is recorded in
[`evidence/PARENT_MEETING_V1_5_QA_CLEARANCE.md`](./evidence/PARENT_MEETING_V1_5_QA_CLEARANCE.md).
