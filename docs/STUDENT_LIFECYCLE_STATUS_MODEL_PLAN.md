# Student Lifecycle and Status Model Plan

Planning phase: Prompt 15A  
Status: conceptual model only. No Prisma/schema or backup/restore change is authorized by this document.

## Current compatibility problem

The existing `Student` model is the stable record used by fees, attendance, guardians, imports, and operator screens. It also holds mutable `academicYear`, `className`, `section`, `rollNo`, `status`, and free-text `tcStatus`. Replacing or repurposing that model would create high regression and history-loss risk.

Future work should keep `Student.id` and `admissionNo` as the existing identity anchor, then add year-specific enrollment and append-only lifecycle/decision records around it. Migration must be additive, backfill-previewed, backup-covered, and compatible with existing fee/payment/attendance behavior.

## Candidate current statuses

- `ACTIVE`
- `PROMOTED`
- `REPEATED`
- `TRANSFERRED_OUT`
- `LEFT`
- `DROPPED_OUT`
- `PASSED_OUT`
- `ALUMNI`
- `INACTIVE`

These are planning terms, not finalized database enums or UDISE+ mappings. School review is required. Verify against current UDISE+ portal requirements before production use.

Some values describe a transition (`PROMOTED`, `REPEATED`) while others describe a continuing state (`ACTIVE`, `ALUMNI`). Prompt 15B must decide whether the Student stores only a derived current state while lifecycle events store transition types. Do not add an enum until that distinction and legacy-status mapping are tested.

## Future `AcademicYearEnrollment` concept

Possible fields:

- stable ID and `studentId` relation;
- academic year;
- class, section, roll number;
- enrollment status and start/end dates;
- admission/rejoin/source type;
- closing outcome and effective date;
- created/finalized/corrected actor and timestamps;
- source decision/event reference;
- version or lock state;
- notes with access/audit controls.

Desired rule: at most one non-cancelled enrollment for a student in the same academic year unless a reviewed correction/transfer case explicitly requires otherwise. Exact uniqueness and correction strategy need testing with real school records.

## Future `StudentLifecycleEvent` concept

Possible event types include enrolled, promoted, repeated, double-promotion approved/rejected, transferred out, left, dropped out, passed out, rejoined, inactivated, and corrected. Each event may store:

- student and related enrollment IDs;
- effective date and academic year;
- from/to class, section, status, and year snapshots;
- structured reason and notes;
- source request/decision/document references;
- created, approved, finalized, corrected, or cancelled actors/timestamps;
- correction link to the superseded event;
- UDISE+ review/checklist result without claiming compliance.

Events should be append-only after finalization. Correction should add a linked corrective event or version, not silently update/delete the original.

## Future `PromotionDecision` concept

Possible fields:

- student, source enrollment, proposed target enrollment/year/class/section;
- decision type: promote, repeat, double-promote, pass out, hold/pending;
- workflow status;
- reason and policy reference;
- marks, attendance, and teacher-evidence references or checklist states;
- requester and request date;
- principal/director approver and decision timestamp;
- rejection reason;
- parent acknowledgement details;
- UDISE+ compatibility-review state;
- finalized event/target-enrollment link;
- correction/cancellation metadata.

This model must not duplicate or invent exam marks. Evidence references should remain optional until a real exams foundation exists.

## Parent request documents/notes

A future `ParentRequest` record or carefully controlled request metadata could capture request type, received date, channel, summary, attachment/document reference, received-by user, acknowledgement, and linked decision. Sensitive attachments need a separate storage, retention, access, and backup design; do not place raw documents or Aadhaar images in ordinary notes.

Parent request and parent acknowledgement are evidence. They do not replace the school's authorized academic decision.

## Approval fields and audit

Future durable records should distinguish:

- prepared by/at;
- submitted by/at;
- reviewed or approved by/at;
- rejected by/at and reason;
- finalized by/at;
- corrected/cancelled by/at and reason;
- parent acknowledgement date/method;
- before/after snapshots needed for audit.

Use stable user IDs plus historical display-name snapshots where the existing audit pattern requires both. Role checks must use effective database-backed permissions at action time.

## Lock/finalize behavior

- Drafts may be edited without changing enrollment.
- Submission freezes the reviewed proposal except through a controlled return-to-draft path.
- Approval records a decision but should not be applied twice.
- Finalization creates/updates the target enrollment and lifecycle event transactionally.
- Finalized decisions become read-only.
- Bulk finalization must preview per-student failures and avoid partial invisible results; exact all-or-nothing versus per-row transaction policy needs explicit design.
- The system must record the academic-year cut-off/context used for the decision.

## Undo and correction safety

Do not provide a generic Delete or casual Undo button. A correction should require permission, reason, impact preview, and a link to the original record. It must check whether later attendance, payments, certificates, or another enrollment already depends on the finalized state.

Where safe, correction may supersede the event and repair the derived current Student fields. Where dependencies exist, block the correction or require a reviewed compensating event. Hard deletion of old student/enrollment/lifecycle history is out of scope.

## Compatibility with existing Student master

Prompt 15B should plan and test a transition such as:

1. Add new models without removing current Student fields.
2. Preview a backfill of one enrollment from each active Student's current year/class/section.
3. Flag invalid, missing, duplicate, cancelled, TC, and left legacy values for school review.
4. Keep existing routes and fee/attendance logic reading current Student fields initially.
5. Make finalized lifecycle work update derived Student current fields transactionally only after tests prove compatibility.
6. Prompt 15B implemented backward-compatible backup/restore version 13 for enrollments and lifecycle events.
7. Migrate reads gradually and retain admission-number identity and existing relations.

## Decisions required before Prompt 15B implementation

- authoritative academic-year format and rollover dates;
- exact internal status/event vocabulary and legacy mappings;
- class progression map, including LKG/UKG/Class X/pass-out behavior;
- section assignment ownership;
- roles and permissions for prepare, approve, finalize, view, and correct;
- exceptional-decision evidence checklist;
- fee-clearance policy, if any, kept separate from academic rules;
- backfill/reconciliation rules for existing students;
- backup/restore version and rollback plan;
- school-approved UDISE+ review language.

## Non-goals

No schema, migration, route, progression action, exam record, admission workflow, certificate, UDISE+ exchange, or Aadhaar integration is created here.

## Prompt 15B implementation status

Prompt 15B now implements the safe foundation described by this plan:

- `AcademicYearEnrollment` preserves one enrollment per student and academic year, including class, section, roll number, status, entry/exit dates, reasons, and notes.
- `StudentLifecycleEvent` stores append-only dated history with optional evidence, acknowledgement, approval, and recorder links.
- `/students/lifecycle` shows current-year coverage, filters, status counts, and missing-enrollment warnings.
- `/students/[id]/lifecycle` shows read-only enrollment and lifecycle-event history.
- `pnpm.cmd lifecycle:backfill` is dry-run only; add `-- --apply` after review to create missing ACTIVE enrollments and ENROLLED events idempotently.
- Backup/restore version 13 includes both new record types, accepts old backups, validates student links, avoids duplicates, preserves conflicting local history, and still excludes password hashes.

Prompt 15B intentionally does not implement promotion, repeat, double promotion, transfer/left/dropout actions, rejoin actions, corrections in the UI, UDISE+ export, exams, admissions, or certificates. Those reviewed workflows remain Prompt 15C or later.

Verified local backfill result: 8 active, non-deleted students received 8 ACTIVE `2026-27` enrollment rows and 8 matching ENROLLED events; the immediate rerun reported zero missing rows.

## Prompt 15B-QA safety result

Prompt 15B-QA tightened the foundation without adding progression actions:

- backfill and overview coverage now explicitly include only `Student.status = Active` with `deletedAt = null`, so Left, inactive, cancelled, TC, and soft-deleted records are not silently enrolled;
- enrollment plus ENROLLED event creation is transactional when run through the real Prisma backfill client;
- the detail API serializer now allowlists every field independently of its Prisma query, preventing future query refactors from exposing internal record/user IDs;
- restore skips exact semantic event duplicates even when their backup IDs differ, and preserves conflicting local append-only history with warnings;
- lifecycle dates use the shared Asia/Kolkata-aware `DD/MM/YYYY` formatter.

The live database audit found 8 valid enrollment links, 8 valid event links, zero invalid status/event values, zero duplicate student/year keys, and zero current class/section mismatches. No existing Student row or class/section was changed during QA.

Final verification passed 353 tests across 60 files and produced backup version 13 as `nalanda-fee-control-backup-2026-07-01-14-22.json` with 8 enrollments, 8 lifecycle events, and zero password-hash fields.

## Prompt 15C progression layer

`StudentProgressionDecision` now sits above `AcademicYearEnrollment` and `StudentLifecycleEvent`. Draft, submission, approval/rejection, cancellation, and finalization audit fields are retained independently from lifecycle history. PROMOTE/REPEAT finalization closes the source enrollment as PROMOTED/REPEATED and creates one ACTIVE target-year enrollment; departure/passed-out decisions close only the source. Every finalized outcome appends a lifecycle event. The existing unique student/year enrollment key prevents duplicate target years, and finalization rechecks the approved source snapshot inside a transaction. No prior enrollment or event is overwritten or deleted.

CORRECTION is review-only in Prompt 15C. A later prompt must design compensating events and reconciliation before correction finalization is enabled. Backup version 14 preserves progression decisions and all audit timestamps/user links where safely mappable.

## Prompt 15C-QA integrity result

PROMOTE/REPEAT rehearsals preserved the source row, changed only its reviewed status, created exactly one ACTIVE target-year enrollment, and appended exactly one lifecycle event. Transfer, left, dropout, and passed-out rehearsals created no target enrollment and appended the matching event. Duplicate target years and repeat finalization were rejected. Transaction-failure tests confirmed that neither a FINALIZED decision nor a partial enrollment/event survives a failed write.

All disposable students, enrollments, decisions, and events were removed after QA; the original 8 enrollments and 8 lifecycle events remain. The lifecycle backfill still reports zero missing/created records.
