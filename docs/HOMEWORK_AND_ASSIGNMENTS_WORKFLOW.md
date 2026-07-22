# Homework and Assignments Workflow

Prompt 17A adds a safe homework foundation. It does not add online submission, uploads, grading, marks, report-card integration, AI generation, external notifications, file storage, or video hosting.

## Permissions and scope

- The seven permissions separate staff viewing, management, publishing, archival, reports, export, and own-portal access.
- Super Admin, Director, Admin, and Principal receive operational access according to role defaults. Viewer/Auditor receives masked read-only reports and no export. Accountant receives no homework access.
- A Teacher is restricted server-side through `User -> StaffMember -> TimetableTeacher -> TimetableAssignment`. Class, section, subject, and academic year must all match. Missing links show "No authorised class/subject assignments found" and never grant broad access.
- Parent access is read-only and resolved only through the signed-in User's Guardian-Student links plus the current academic-year enrollment. The API accepts a linked-child index, not an arbitrary admission number.

## Workflow

1. Create or update a draft. Drafts are not visible to Parents.
2. Preview validates the same server-side target and content rules without publishing.
3. Publish through the named in-app confirmation. Publishing is transactional and compare-and-set protected.
4. Correct published content only with a reason. The previous public title, instructions, due date, public notes, priority, assigned date, and resource link are preserved in an append-only event snapshot. The target audience cannot be moved.
5. Archive preserves the assignment and hides it from the current Parent list.
6. Cancel requires a reason and preserves the assignment. A previously published cancellation may remain visible as Cancelled in Parent history.

Repeated completed transitions are idempotent and do not create duplicate events. There is no hard-delete API. Homework dates are school calendar dates. Resource links must be HTTP/HTTPS and cannot include embedded credentials. Text is plain text; HTML/script-shaped input is rejected.

## Parent visibility and reports

A class-wide assignment has no section and applies to every current section of that class. A section assignment applies only to the matching section. Parent responses contain only public homework fields and exclude Teacher notes, actor IDs, internal events, contacts, addresses, and unrelated student records. Archived work is history-only; drafts are never visible; cancelled work is Parent-visible only if previously published.

Reports cover class, section, subject, creator where permitted, status, due today, upcoming, overdue, no due date, recent corrections, and cancellations. CSV is formula-safe and uses an India-local filename. Teacher reports remain scoped; Viewer/Auditor is masked and cannot export.

## Backup and limitations

Backup version 23 includes `HomeworkAssignment` and `HomeworkAssignmentEvent`. Restore accepts older backups without these arrays, validates dates/status/subject/snapshot/event links, isolates same-number/different-ID collisions, preserves newer local assignments, restores append-only events idempotently, and continues to exclude password hashes.

`HomeworkViewReceipt` is intentionally deferred. This phase does not claim that a Parent viewed, received, completed, or submitted homework. Future Prompt 17B may connect Exams and Marks at the planning boundary, but Prompt 17A creates no grades, marks, report-card data, or submission records.

## Prompt 17D analytics consumption

Teacher Analytics reports assignment workflow activity inside linked Teacher/timetable scope. Assignment volume is a workload/activity indicator, not a quality measure, and fewer assignments are never automatically negative. It does not modify Homework records.

## Prompt 19A notification boundary

Homework remains a source record and is not modified or automatically broadcast. Prompt 19A lets a timetable-linked Teacher draft a plain-text `HOMEWORK` notification for their exact timetable scope; leadership must approve and publish it. A safe `/parent/homework` or `/teacher/homework` action path is only navigation and does not bypass Homework ownership checks. No WhatsApp, SMS, email, or push delivery is implied.
