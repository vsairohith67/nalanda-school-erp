# UDISE+ Planning Notes

Planning phase: Prompt 15A  
Status: planning/checklist only. No UDISE+ integration, academic progression workflow, schema change, or government submission feature is built by this document.

## Purpose and caution

UDISE+ planning for this ERP means preparing accurate school-owned records, reviewable summaries, evidence links, and approval history so authorized staff can compare ERP data with the current UDISE+ portal. It does not mean claiming legal compliance or automatically submitting government data.

Every future implementation must be treated as a school review checklist. Verify field definitions, allowed values, cut-off dates, status rules, and required evidence against the current UDISE+ portal requirements before production use. Portal requirements can change, and the school's authorized UDISE+ operator remains responsible for review and submission.

## Current ERP baseline

The current `Student` master already stores academic year, admission number, student name, father/mother names, class, section, roll number, contact numbers, address, optional date of birth, optional Aadhaar number, a free-text TC status, a broad status, student type, and remarks. Guardian records and student/guardian links are available separately. Student attendance sessions preserve date, class, section, academic year, workflow state, and student-level attendance.

Important gaps:

- there is no gender field;
- there are no caste/social category, minority, CWSN/disability, medium, or language fields;
- admission date, previous school, leaving date/reason, destination school, and structured TC details are absent;
- the current Student row does not preserve one enrollment row per academic year;
- promotion, repeat, double-promotion, transfer, left/dropout, passed-out, rejoin, and correction events have no structured approval/audit record;
- exams, marks, report cards, teacher remarks, and academic evidence do not exist yet;
- class/section and demographic compliance summaries do not exist;
- existing `status` and `tcStatus` strings are not sufficient as a controlled lifecycle/compliance model.

The sample student CSV is intentionally narrower than the full importer. Its current columns cover academic year, admission number, student name, father name, class, section, phone, WhatsApp, student type, discount, and remarks. The importer can additionally accept mother name, roll number, extra contact/address fields, status, DOB, Aadhaar, and TC status, but importing a field does not establish its accuracy or compliance meaning.

## Student lifecycle statuses needed

Future design should distinguish a student's current operational state from a dated academic-year event. Candidate current statuses are `ACTIVE`, `PROMOTED`, `REPEATED`, `TRANSFERRED_OUT`, `LEFT`, `DROPPED_OUT`, `PASSED_OUT`, `ALUMNI`, and `INACTIVE`, subject to school review and current UDISE+ terminology.

Do not treat every value as interchangeable. For example, transfer out, left school, dropout, passed out, and administrative inactivity may have different reporting consequences. A future implementation should map school-approved internal terms to the current portal only after verification.

## Promotion, repeat, and double-promotion planning

- **Normal promotion:** create the next academic-year enrollment, preserve the old class/section/year, record the decision and actor, and avoid overwriting history.
- **Repeat same class:** require a stated reason, marks/attendance/teacher evidence when available, principal/director approval, parent acknowledgement, and a complete audit trail.
- **Double promotion:** treat as exceptional and sensitive. Require strong academic evidence, a documented parent request or school rationale, principal/director approval, parent acknowledgement, a rejection path, and explicit UDISE+ compatibility review.
- **Finalization:** bulk or individual decisions should have preview, validation, approval, lock/finalize, and correction workflows. They must never be casual edits to `Student.className`.
- **Fees:** do not automatically block or force an academic decision because fees are unpaid. Any fee-clearance policy must be separately approved by the school and reviewed for appropriateness before implementation.

Marks evidence cannot be automated now because exams/marks/report cards are not built. Until a later exams foundation exists, a future progression workflow could record an evidence checklist/reference without inventing marks data.

## Transfer out planning

A future transfer-out workflow should capture leaving date, reason, destination school if known, authorized decision, and later TC linkage. It should preserve all earlier enrollments, attendance, payments, guardian links, and audit history. A fee-clearance check may be shown later as advisory information, but academic/lifecycle policy must be decided by school leadership rather than silently encoded.

Before mapping transfer status to UDISE+, the school must verify current portal terminology, timing, and whether the destination or TC details are required.

## Left/dropout planning

Left school and dropout should not be a single vague status unless the school's current reporting rules explicitly permit that. A future workflow should capture effective date, structured reason, follow-up notes, supporting references, approval, and any school outreach record. Corrections must be auditable; history must not be deleted.

School review is required before using sensitive terms or reasons. Verify the distinction and allowed values against current UDISE+ portal requirements before production use.

## Rejoin/readmission planning

Rejoining must not reactivate an old row by erasing the leaving event. It should create a new academic-year enrollment/lifecycle event linked to the same Student master after identity and school-record verification. Admissions remains a separate future module and is not designed or built here.

## Aadhaar and privacy caution

The current Student model has an optional Aadhaar-number field. Its presence does not prove the school should collect it, that it is accurate, or that broad users should see it.

- Collect only data the school is authorized and required to hold.
- Prefer an availability/verification-status concept over repeatedly exposing the full number, if current rules permit.
- Do not add Aadhaar verification integration, government lookup, portal scraping, or unattended matching.
- Define access, masking, export, retention, correction, and deletion policies before expanding use.
- Never display Aadhaar in general class lists, dashboards, logs, or routine exports.
- Obtain school/privacy review and verify current requirements before production use.

## Student demographic data gaps

The following may be needed later, but each needs school-record and current-portal verification:

- gender;
- social/caste/category and minority status;
- CWSN/disability category and support details, handled sensitively with narrow access;
- medium of instruction and language fields;
- previous school and admission date;
- age/cut-off derivation from verified DOB;
- structured address/geography fields if the current portal requires them;
- structured leaving, transfer, and certificate details.

Do not guess missing demographic values. Reports should show `Missing` or `Needs verification`, not silently classify students.

## Class/section strength and demographic summaries

Future checklist/report views may need:

- active strength by academic year, class, and section;
- gender by class/section;
- category/minority summaries where required and authorized;
- age/DOB exception summaries against a school-selected reporting cut-off date;
- active, promoted, repeated, transferred-out, left, dropout, passed-out, and inactive counts;
- missing/invalid/duplicate admission numbers and missing demographic fields;
- comparison between opening strength, admissions/rejoins, promotions, transfers, departures, and closing strength;
- attendance roster count versus lifecycle/enrollment count.

Every total should state its academic year, cut-off date, included statuses, and missing-data count. The ERP should support reconciliation; it should not declare that a mismatch is compliant.

## Staff/teacher reporting gaps

The current `StaffMember` master has name, staff code, staff type, designation, department, subjects, qualification, experience, joining date, contact details, and status. Staff attendance exists. Possible future reporting gaps include gender, DOB/age, category where legitimately required, employment/appointment type, training, professional qualification detail, grade/class assignments, disability/CWSN training, and portal-specific teacher identifiers.

Do not infer these values from names, designations, timetable assignments, or attendance. Confirm the exact current UDISE+ staff/teacher fields and school source records before adding them.

## Infrastructure/reporting fields that may be needed later

UDISE+ may require school/infrastructure information beyond student and staff records. Possible planning areas include classrooms, toilets, drinking water, electricity, ramps/accessibility, ICT devices, internet, library, laboratories, boundary wall, transport, safety facilities, land/building details, and school identifiers. This list is exploratory, not a current compliance specification.

No infrastructure model should be added until the school identifies the authoritative register, responsible owner, update frequency, evidence, and the latest portal fields.

## Compliance safeguards

- Use the words **planning**, **checklist**, and **school review required** in future UIs and exports.
- Display: **Verify against current UDISE+ portal requirements before production use.**
- Do not claim legal or portal compliance merely because fields exist.
- Do not scrape, automate, or submit to a government portal without an explicitly approved, documented integration and current official requirements.
- Require preview and reconciliation before any future export.
- Keep portal credentials and sensitive identifiers out of the browser, logs, and exported diagnostics.
- Preserve old-year history; never rewrite history to make totals match.
- Make corrections explicit, reasoned, permission-gated, and auditable.
- Keep unresolved and missing data visible rather than filling defaults.
- Obtain school leadership approval for lifecycle definitions and any relationship between fees and progression.

## Recommended future implementation prompts

1. **Prompt 15B - Academic Year Rollover and Student Lifecycle Foundation**  
   Add year enrollment/history foundations only after schema, migration, permission, backup/restore, and correction rules are approved.
2. **Prompt 15C - Promotion / Repeat / Transfer / Left Workflow**  
   Add preview, evidence checklist, approvals, parent acknowledgement, finalization, rejection, and correction paths.
3. **Prompt 15D - UDISE+ Checklist and Student Data Gap Dashboard**  
   Add read-only missing-data and reconciliation summaries; do not add portal submission.
4. **Prompt 17B or later - Exams/Marks Foundation**  
   Build academic evidence separately before using marks in progression decisions.
5. **Prompt 18A - Certificates/TC/Bonafide Linkage**  
   Link approved transfer lifecycle events to a separately audited document-issue workflow.
6. **Later UDISE+ reviewed export helper**  
   Consider only after the school verifies the latest official format and the checklist workflow is trusted. Import, Aadhaar verification, scraping, and automatic submission remain out of scope unless separately authorized.

## Prompt 15A non-goals

- No promotion, repeat, double-promotion, transfer, left/dropout, or rejoin implementation.
- No exams, marks, grades, or report cards.
- No admissions or certificates.
- No schema or backup-format change.
- No UDISE+ import/export, Aadhaar verification, portal scraping, or government automation.
- No new route or ERP feature module.

## Prompt 15B status note

Prompt 15B adds internal academic-year enrollment and lifecycle-history foundations only. This improves future year-wise reconciliation but is not a UDISE+ export, portal mapping, compliance claim, Aadhaar verification, or government submission integration. Current portal requirements still require school review. Prompt 15D remains the earliest planned read-only UDISE+ data-gap/checklist surface; any export is later and separately approved.

Prompt 15B-QA confirmed that active-year coverage excludes Left/inactive/deleted Student rows, preserves historical statuses/events, and does not change current Student class/section. This is useful internal reconciliation evidence only; it does not validate any current UDISE+ status mapping or export format.

## Prompt 15C status note

Progression decisions now include optional `udiseReviewNotes` so authorized staff can record a manual review alongside promotion/departure evidence. This does not map current portal codes, validate Aadhaar, scrape a portal, or export/submit UDISE+ data. Prompt 15D remains the planned read-only data-gap/checklist dashboard, and current official requirements must still be verified by the school before any later exchange feature.

Prompt 15C-QA verified that progression outcomes are internally consistent and history-preserving. This remains internal ERP evidence only, not UDISE+ validation or compliance. Prompt 15D must stay read-only and checklist-oriented; no portal codes, export, submission, Aadhaar integration, or automated decision logic is authorized by this QA result.

## Prompt 15D read-only checklist status

Prompt 15D adds a permission-gated planning checklist at `/udise`, with student and staff data-gap reports plus a compact summary. It reads existing Student, Guardian link, AcademicYearEnrollment, StudentLifecycleEvent, StudentProgressionDecision, StaffMember, and SchoolSettings data. It does not write to any of them.

The dashboard uses the fixed warning **“Planning checklist only — not official UDISE+ submission.”** and tells reviewers to verify against the latest UDISE+ portal before production use. `VIEW_UDISE_CHECKLIST` is enabled by default for Super Admin, Director, Admin, Principal, and Viewer. `EXPORT_UDISE_CHECKLIST` is enabled only for Super Admin, Director, Admin, and Principal. Accountant, Teacher, and Parent have neither permission by default.

Student DOB, address, guardian contact, and staff contact are reported only as `Complete`, `Missing`, or `Not tracked in ERP`; their values are not displayed. Aadhaar is never displayed or exported: the checklist emits only `Not collected` or `Available in school records — needs verification`, together with a privacy caution. The CSV is an internal checklist/gap report with formula-injection protection, no raw internal IDs, and no official submission format.

Intentionally not built: government portal export/submission or automation, Aadhaar verification, data-fix forms, exams/marks/report cards, admissions, certificates/TC/bonafide, maps/location, AI decisions, or lifecycle/progression mutations. Prompt 15E may add reviewed data-gap fix forms only after the school confirms fields. Other separate future phases remain Prompt 17B exams/marks, Prompt 18A certificates/TC/bonafide linkage, and Prompt 21A student location privacy/cost/feasibility planning.

## Prompt 15D-QA result

Prompt 15D-QA rechecked every checklist page and API as a read-only surface. All four pages and all four APIs remain GET-only, permission-gated, and free of edit, mutation, submission, Aadhaar-verification, or government-portal behavior. The planning-only warning, school-verification language, and latest-portal reminder remain mandatory.

QA corrected a counting inconsistency where multiple missing basic fields could inflate a student's numeric gap count even though the visible gap badges were deduplicated. The count now matches the unique visible non-privacy gap types. The export filename is also sanitized while continuing to say `planning-checklist-gap-report`, never official submission. No schema, lifecycle, progression, fee, attendance, leave, substitute, or backup-format behavior changed.

Live permission and privacy checks confirmed leadership/Admin/Principal view and export, Viewer view-only, and Accountant/Teacher/Parent denial at both page and direct-API level. Page, JSON, and CSV output contained no full Aadhaar value, raw record/user ID, password hash, secret, or filesystem path. Current missing and not-tracked results remain review signals only, not claims about legal requirements or compliance.

Final verification passed the idempotent lifecycle dry-run, typecheck, 397 tests across 64 files, production build, and responsive Browser QA with zero console errors/warnings. Backup version 14 is `nalanda-fee-control-backup-2026-07-14-23-51.json`.
