# Digital Report Cards and KG Rubric Assessments

> **Academic Integrity v1.1:** The earlier Teacher entry/submission policy below is historical and is now `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`. From v1.1, only Principal and Super Admin have permanent marks/report-card write authority. Ordinary Teacher accounts remain read-only where existing academic-report policy permits. Exact non-teaching operators may enter marks only through an explicit `MARKS_ENTRY_OPERATOR` grant; they do not receive report-card editing or publication authority. Existing issued versions remain immutable. See [Academic Integrity v1.1](ACADEMIC_INTEGRITY_V1_1_PRINCIPAL_MARKS_ENTRY.md).

Prompt 17C adds issued, versioned report cards without changing raw exam marks or Student progression decisions. Mark-based cards read one locked Exam Cycle. LKG/UKG cards use a dedicated five-evaluation rubric and a ten-page print structure.

## Roles and permissions

- Director/Super Admin: full configuration, approval, issue, correction, reports, and export.
- Principal: batch workflow, entry/review, approval, issue, reports, and export; template and issued-correction access are not default.
- Admin: templates, batches, entry, submission, reports, and export; approval/issue are intentionally not default.
- Teacher: exact timetable-linked class/section scope, entry, and submission only.
- Viewer/Auditor: masked operational reports only, with no export or operational card access.
- Parent: linked-child, issued-version access only through /parent/results.
- Accountant: no report-card access by default.

The named permissions are VIEW_REPORT_CARDS, MANAGE_REPORT_CARD_TEMPLATES, MANAGE_REPORT_CARD_BATCHES, ENTER_REPORT_CARD_DATA, SUBMIT_REPORT_CARDS, APPROVE_REPORT_CARDS, ISSUE_REPORT_CARDS, CORRECT_ISSUED_REPORT_CARDS, VIEW_REPORT_CARD_REPORTS, EXPORT_REPORT_CARD_REPORTS, and VIEW_OWN_REPORT_CARDS.

## Configuration

Open /report-cards/templates. Create non-overlapping grading bands and a report-card template. Template definitions and print settings are validated plain JSON; executable content, scripts, event handlers, and unsafe URLs are rejected. Existing batches retain a template snapshot, so later template status changes do not rewrite history.

Mark-based templates use the locked Exam/Marks foundation. KG templates contain the prescribed Evaluation I-V rubric, monthly attendance, growth checkpoints I/III/V, summary grades, personality codes, typed approval placeholders, final grade/comment, and next-class display.

## Batch workflow

1. Open /report-cards/batches/new.
2. Choose academic year, class/section, report type, active template, and for mark cards one locked Exam Cycle.
3. Preview the exact active-enrollment Student list and review warnings.
4. Confirm creation. The batch and per-Student cards start in Draft.
5. Open the batch for entry.
6. Teachers or authorized staff complete each card and submit it.
7. Submit the complete batch, approve it separately, then issue it separately.
8. Issue creates immutable version 1 snapshots. Later corrections require a reason and create version 2 or later without overwriting the prior version.
9. Archive only after issue. Cancellation is allowed only before issue and requires confirmation/reason.

Every transition uses an optimistic concurrency check. Repeated or stale requests cannot duplicate the transition or issued version.

## Mark-based calculation policy

- A numeric zero is a valid present mark; Absent is a distinct state.
- Exempt and Not Applicable rows are excluded from the denominator.
- Missing required marks block submission and issue.
- Weightage, weighted maximum, weighted obtained, percentage, grade band, and pass/fail are derived from locked mark snapshots.
- Display percentage is rounded to two decimal places. Raw accepted mark precision remains the Exam/Marks policy.
- No rank, merit position, percentile, or Teacher-performance score is calculated or stored.
- Report-card pages cannot edit raw marks. Corrections cannot alter the snapshotted mark calculation.

The first release intentionally supports one locked Exam Cycle per mark-based batch. Multi-exam aggregation needs a separately reviewed policy for term weightage and is deferred.

## KG rubric

KG entry covers all five evaluations. Intellectual-development criteria use their configured response sets; summary areas use A+ to E; personality traits use G/S/N. Attendance is snapshotted from locked attendance where complete. An incomplete source must be explicitly reviewed with a reason before issue. Growth is recorded only for I, III, and V. Wide rubric tables remain inside contained horizontal table wrappers.

The KG print route uses ten explicit booklet pages with page breaks and optional black-and-white mode. Mark-based print uses a normal A4 report-card layout. Browser print is used; no native file dialog or external document package is introduced.

## Progression, Parent access, and history

Only a finalized StudentProgressionDecision is displayed. If none exists, the exact safe text is: Promotion decision not finalised. Report-card issue never creates, changes, or finalizes progression.

Parents see only issued/archived-batch cards for linked children. They can select siblings, view current and superseded historical versions, and print the allowlisted issued snapshot. Drafts, internal IDs, staff notes, and other Students are not returned.

## Reports, backup, and limits

/report-cards/reports shows operational completeness, workflow status, missing-mark blocks, KG completion, attendance gaps, grade/result distributions, and correction counts. Authorized exports are formula-safe CSV. Viewer output is server-masked and Viewer export is disabled.

Backup version 25 adds grading schemes, bands, templates, batches, exam-source links, Student cards, immutable versions, and append-only events. Restore validates ownership, relationships, identity collisions, contiguous version history, snapshots, and progression references; it remains backward compatible and excludes password hashes.

Deferred: multi-exam aggregation, Parent acknowledgement receipts, Student login/portal, Teacher analytics (Prompt 17D), external notifications, signature images, cloud storage, PDF-generation packages, rank/merit, and automatic promotion.

## Prompt 17C-QA hardening

- Mark-card snapshots embed the locked source exam code, name, status, and lock date. Mark calculations and Attendance snapshots are rejected if a card-update payload attempts to alter them.
- KG payloads accept only Evaluations I-V, growth periods I/III/V, the configured criterion response sets, and the typed approval role appropriate to the current actor. A self-declared calculated attendance source is not trusted, and incomplete attendance remains an issue blocker.
- Teacher list/detail/API access is exact timetable scope and allowlisted. Archived issued history remains visible to the authorised Teacher; raw marks, leadership comments/approvals, actors, contacts, addresses, and internal events remain unavailable.
- Parent output is an allowlisted immutable issued snapshot. The default selection is the latest issued version for a linked child; superseded versions are explicitly labelled and cannot replace version 1.
- Operational reporting separates pending entry, submission, approval, and issue; includes corrected/superseded/cancelled and KG/attendance/growth gaps; and keeps Viewer masking and formula-safe export rules.
- Print supports explicit historical version selection, source-exam and attendance provenance, full comments/approvals, and CANCELLED/SUPERSEDED watermarks without changing normal ERP styles.
- Version-25 restore validates grading-scheme snapshots, immediate supersession links, card identity inside immutable snapshots, same-card event/version ownership, collision isolation, and idempotent replay.

## Prompt 17D analytics consumption

Teacher Analytics reads report-card/KG workflow completion as privacy-safe aggregate context only. It does not modify cards, infer progression, expose child-level rubrics, or judge Teacher quality from grade/rubric distributions. See `TEACHER_PERFORMANCE_ANALYTICS_WORKFLOW.md`; backup version 26 adds analytics history while retaining version-25 card arrays.

## Prompt 18A certificate boundary

Student certificates use their own templates, numbers, requests, immutable versions, print pages, and version-27 recovery arrays. They do not rewrite report cards, Exam/Mark data, KG rubrics, promotion display, or report-card versions.
# Prompt 18B isolation

Class X package eligibility may snapshot the existence/status of a report card as operational context, but it does not infer Board eligibility, pass status, or result from marks/report cards and never mutates this module. Board and Migration documents remain external custody/status records only.
