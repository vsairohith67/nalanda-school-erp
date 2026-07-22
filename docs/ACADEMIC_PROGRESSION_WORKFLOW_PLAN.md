# Academic Progression Workflow Plan

Planning phase: Prompt 15A  
Status: planning only. School review required before implementation. Verify against current UDISE+ portal requirements before production use.

## Design principles

- Preserve the Student master as the stable identity and create dated academic-year history around it.
- Never implement progression as a bulk overwrite of class, section, academic year, or status.
- Require preview, validation, authorized approval, finalization, and an auditable correction path.
- Keep academic decisions separate from fee/payment mutation. A later fee-clearance indicator must not silently decide progression.
- Preserve attendance, payments, guardians, documents, decisions, and previous-year enrollment history.
- Treat marks and teacher evidence as unavailable until the exams/marks foundation exists; do not invent evidence.

## Common workflow states

A future workflow may use `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `FINALIZED`, `CORRECTED`, and `CANCELLED`, with exact transitions reviewed before implementation. Drafts should not change the current Student record. Finalization should be idempotent and should record who approved and applied the decision.

## 1. Normal promotion

1. Select the source academic year and a class/section cohort.
2. Load the students from their current academic-year enrollments, not only mutable Student fields.
3. Propose next academic year, class, and section for each student.
4. Preview exclusions, missing data, conflicting enrollments, and exceptional cases.
5. Review available evidence/checklist and choose promotion decisions.
6. Obtain authorized approval and finalize once.
7. Create the next-year enrollment and a lifecycle event; keep the old enrollment unchanged and queryable.

The transition must not erase old-year class, section, roll number, attendance, or decision history. Passed-out students need a distinct reviewed outcome rather than an invented next class.

## 2. Repeat same class

Suggested record:

- source and target academic years;
- same target class, reviewed target section, and reason;
- parent request date/source or school academic-decision reference;
- marks evidence reference when the exams module exists;
- attendance evidence summary/reference;
- teacher remarks/evidence reference;
- principal/director approver, decision date, and notes;
- parent acknowledgement date/method;
- current-UDISE+ review result;
- immutable audit history and any later correction reason.

The workflow should allow approval or rejection. Final approval creates a new-year enrollment in the same class; it does not rewrite the prior enrollment. Parent request alone must not finalize the decision, and absence of a parent request must not hide a school-led academic decision.

## 3. Double promotion request

Double promotion is a sensitive exceptional workflow, not a casual class dropdown change.

1. Capture the requester, date, requested target class/year, and reason.
2. Require a strong evidence checklist: available marks/results, attendance, teacher remarks, assessments, and any school policy reference.
3. Record principal/director review and a clear approval or rejection decision.
4. Record parent acknowledgement of the decision and implications.
5. Complete a current UDISE+ compatibility review before finalization.
6. If rejected, retain the request and rejection reason without changing enrollment.
7. If approved and finalized, create one explicit lifecycle decision and target enrollment while preserving the skipped-grade context in history.

The future UI should warn that portal compatibility and school policy require verification. It must not recommend double promotion automatically from marks or attendance.

## 4. Transfer out

A future transfer-out workflow should capture:

- effective leaving date;
- transfer reason;
- destination school if known;
- later TC request/issue linkage, without building certificates in this phase;
- fee-clearance status later as advisory information only;
- approver, approval time, notes, and audit details;
- UDISE+ checklist/status review.

Finalization should close the relevant academic-year enrollment and create a `TRANSFERRED_OUT` lifecycle event. It must not delete the Student, attendance, payment, guardian, or previous-year records. If a TC is later cancelled or corrected, the lifecycle correction and document correction must both remain visible.

## 5. Left/dropout

Capture effective date, reason, follow-up notes, supporting evidence/reference, approver, approval time, and the reviewed reporting classification. Where the school uses follow-up or outreach, record dated notes without exposing sensitive details broadly.

`LEFT` and `DROPPED_OUT` should remain distinct candidate outcomes until school policy and current UDISE+ meanings are verified. Finalization closes the applicable enrollment and adds a lifecycle event; it never hard-deletes history.

## 6. Rejoin/readmission

Rejoining should:

- identify and verify the existing Student master;
- preserve the earlier departure and enrollment history;
- create a new academic-year enrollment and `REJOINED`-type lifecycle event if that event is approved during schema design;
- record the school decision, effective date, class/section, and source documents;
- avoid creating a duplicate student merely because an old admission is inactive.

Admissions/readmission intake, document collection, and fees remain separate future scope. This plan only protects lifecycle history.

## Approval and role plan

- Draft/preparation: permission-gated office or academic staff.
- Academic review: Principal and/or Director according to school policy.
- Finalization: a narrower permission than editing Student Master.
- Parent acknowledgement: recorded evidence, not a parent-side approval unless separately designed.
- Read-only audit: Viewer/Auditor may receive reports without action permissions.
- Correction/undo: specially permissioned, reason-required, and never a hard delete.

The existing role matrix should remain the authorization source. Exact new permissions belong in Prompt 15B/15C design, not this planning phase.

## Validation and reconciliation plan

Before finalization, validate:

- one source enrollment and no conflicting target enrollment;
- supported academic-year transition;
- valid class/section and explicit passed-out handling;
- required evidence/checklist and approvals for exceptional outcomes;
- no duplicate finalization;
- cohort opening count plus joins/rejoins minus departures reconciles to closing count;
- attendance evidence references the same student/year;
- missing marks are shown as unavailable, not zero;
- current UDISE+ compatibility remains a school-reviewed checklist.

## Explicit non-goals

This document does not build progression, exams, marks, admissions, TC/certificates, UDISE+ export/import, Aadhaar verification, or portal automation. It changes no schema, route, permission, business logic, or backup format.

## Prompt 15B foundation now implemented

The enrollment and append-only lifecycle-history layer is now built, with protected read-only pages/APIs, leadership management permissions reserved for future workflows, Viewer read-only access, and Parent/Teacher blocked from broad lifecycle data. No progression decision, approval, finalization, bulk rollover, promotion, repeat, double-promotion, transfer, left/dropout, or rejoin action exists yet.

Prompt 15C must build those actions as preview-first, evidence-aware, permission-gated workflows that append events and preserve prior-year enrollments. It must not casually rewrite existing history or couple academic decisions to fee/attendance logic.

## Prompt 15B-QA gate for Prompt 15C

The foundation QA passed link integrity, unique student/year behavior, active-only idempotent backfill, append-only event creation, semantic restore deduplication, role/API isolation, safe API serialization, responsive read-only history pages, and version 13 backup rehearsal. Prompt 15C may rely on these foundations, but it must still add a separate reviewed decision model/workflow, evidence and acknowledgement rules, approval/finalization permissions, preview/reconciliation, and compensating correction events. It must not introduce direct class/status mutation buttons or reuse lifecycle management permission as automatic approval authority.

## Prompt 15C implementation

Prompt 15C adds `StudentProgressionDecision` and protected `/students/progression` list, create, and detail routes. Decisions move through `DRAFT`, `PENDING_APPROVAL`, `APPROVED` or `REJECTED`, then explicit `FINALIZED`; draft/pending records may instead be reason-required `CANCELLED`. Approval never finalizes automatically.

Finalization is one database transaction: it rechecks the approved source snapshot, rejects a duplicate student/target-year enrollment, updates the source enrollment to the reviewed terminal status, creates an ACTIVE target enrollment only for PROMOTE/REPEAT, appends the lifecycle event, and finally marks the decision FINALIZED. Old enrollments, events, rejected decisions, and cancelled decisions are never deleted. Fee warnings are informational only. CORRECTION can be drafted/submitted/approved for review but cannot be finalized in this foundation because a safe compensating-correction UI is not yet designed. Double promotion is not implemented.

The five progression permissions separate view, manage, approve, finalize, and reports. Super Admin/Director/Principal/Admin receive all by default; Viewer receives view/report only; Accountant, Teacher, and Parent receive none. Backup version 14 includes decisions and their audit fields while preserving old-backup compatibility and password-hash exclusion. Prompt 15D remains a read-only UDISE+ checklist/dashboard; UDISE+ export and exams/marks integration remain later work.

## Prompt 15C-QA result

QA tightened two safety edges: draft updates cannot move a decision to another student or use an academic year that disagrees with the selected source enrollment, and finalization now claims the APPROVED row with a compare-and-set write before any enrollment/event work. The claim and all resulting writes share one transaction, so target/event failures roll everything back and simultaneous finalization attempts cannot both proceed.

Disposable live-data rehearsals finalized PROMOTE, REPEAT, TRANSFER_OUT, LEFT, DROPPED_OUT, and PASSED_OUT correctly; CORRECTION remained blocked. Browser QA also proved draft, submit, blank-rejection validation, separate approval, explicit irreversible confirmation, finalized audit display, desktop/mobile containment, and a zero-error console. Fee warnings remain advisory. The next safe phase is Prompt 15D's read-only UDISE+ checklist/dashboard only.

## Prompt 17C read-only display

Report cards only snapshot a FINALIZED progression decision. When no finalized decision exists, they display exactly: Promotion decision not finalised. Creating, approving, issuing, correcting, or restoring a report card must never create, update, finalize, or otherwise mutate StudentProgressionDecision.

## Prompt 18A certificate isolation

Transfer Certificates read only a `FINALIZED` progression decision. When none exists they print `Promotion decision not recorded.` Certificate request, approval, issue, correction, reissue, cancellation, print, backup, and restore never create, update, approve, finalise, or cancel progression or enrollment records.
# Prompt 18B isolation

The Class X document-package workflow may read current or historical Class X enrollment and progression context into an eligibility snapshot. It does not create, approve, reverse, or otherwise mutate a lifecycle event or progression decision. Package approval/handover is also independent of fee dues. Official Board/Migration procedures must be verified by the school.
