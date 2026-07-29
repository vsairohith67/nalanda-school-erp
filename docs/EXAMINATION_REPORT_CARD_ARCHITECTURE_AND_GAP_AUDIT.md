# EXAM-RC-PLAN-1 — Examination, Marks Entry and Progress Report Architecture

**Planning result:** `EXAM_REPORT_ARCHITECTURE_REQUIRES_DECISIONS`
**Leadership-policy result:** `EXAM_REPORT_LEADERSHIP_DECISIONS_APPROVED`
**Approved policy version:** `EXAM_REPORT_POLICY_V1`
**Branch:** `feature/exam-report-card-architecture`
**Authoritative starting commit:** `2bc71254d01d0bc57fa5b91867269f5ddba52661`
**Authoritative release tag:** `operational-account-hardening-v37-2026-07-28`
**Scope:** architecture, evidence, fixtures and implementation gates only

## 1. Safety checkpoint and scope

The preflight was performed on the private `vsairohith67/nalanda-school-erp`
repository. `main`, `origin/main` and the required starting commit were exact,
the worktree was clean, Git safety passed, and the feature branch was created
from that commit.

The read-only operational checkpoint was:

| Control | Verified state |
| --- | --- |
| Routes at the authoritative checkpoint | 274 pages / 378 APIs |
| Tests at the authoritative checkpoint | 1,567 |
| Backup contract | version 37 |
| Business baseline | 0 Students / 0 active enrollments / 0 Payments / INR 0 / 0 Guardians / 0 Staff |
| Accounts | one active owned `SUPER_ADMIN`; `ADMIN`, `ACCOUNTANT` and `VIEWER` inactive and retained |
| Database integrity | SQLite integrity OK; zero foreign-key violations |
| Operational database SHA-256 before planning | `3BA84F4834C4BE4B682D3BCE624490A99337BCAEC8027EFC27B9C4FF4FE11022` |
| Prisma schema SHA-256 before planning | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Checked-in migration directories | 1 |

This phase must not change the operational schema, migration history, database,
account state or business baseline. It does not authorize AUTH-2B, IAM-1A,
deployment, DNS, provider-account creation, payment or report publication.

## 2. Evidence boundary

The direct files available for this audit were:

| Evidence | Pages used | SHA-256 | Directly observed scope |
| --- | ---: | --- | --- |
| Black-and-white progress-report PDF | 2 | `6C16C7AE346C24B8AFE2275CFBFC54AF509AA60CF1EB396111D814B571D74585` | Class V and Class IX samples |
| Retained KG report-card scan | 10 | `2DB870B175EA01C4A72ED5E3DEEA7025D43BE108FB7F7BBCA3AB39DC605C8648` | LKG/UKG developmental booklet |

The retained Academic Records inventory says ten progress-report PDF sets had
previously covered Classes I, II, III, V, VI, VII, VIII, IX and X, with CT,
session, annual/session-end, preboard/revision and combined-result layouts.
Those source sets were not present in the current workspace, Desktop or
Downloads evidence locations during this audit. That inventory is therefore
useful as a family-discovery lead, not as directly revalidated field or formula
evidence.

The machine-readable fixture deliberately contains no student name, admission
number, guardian name, address, contact detail or scanned image. Source PDFs
are design evidence, not automatically correct calculation specifications.

### Whiteboard closure

| Board | Live Canvs room | Durable source | Re-fetch evidence |
| --- | --- | --- | --- |
| Authoritative high-level Nalanda ERP architecture | [open board](https://app.canvs.io/?room=WEPBLxUvW55admAHwFA7) | [`NALANDA_ERP_SYSTEM_ARCHITECTURE.mmd`](diagrams/NALANDA_ERP_SYSTEM_ARCHITECTURE.mmd) | 50 active elements; one live link to the detailed board |
| Examination and Report Card workflow | [open board](https://app.canvs.io/?room=tY7AqTFjFKQMyhcul0i5) | [`EXAMINATION_REPORT_CARD_WORKFLOW.mmd`](diagrams/EXAMINATION_REPORT_CARD_WORKFLOW.mmd) | 64 active elements after failed-render placeholders were deleted |

The main board stays intentionally high-level. Field rules and state detail are
kept on the phase board and in this document. The Mermaid files are the durable,
version-controlled import sources if a temporary Canvs room expires.

## 3. Current implementation gap matrix

Classification is based on executable workflow and object-level enforcement,
not route presence.

| Capability | Classification | Repository evidence and gap |
| --- | --- | --- |
| Academic years | `PARTIALLY_IMPLEMENTED` | Academic year is stored as normalized text across settings, enrollments, timetable and exams. There is no authoritative versioned Academic Year master with exam/report closure rules. |
| Classes and sections | `PARTIALLY_IMPLEMENTED` | `TimetableClassSection` and enrollment fields provide usable class/section scope, but there is no single governed academic class-section offering shared by enrollment, timetable and examinations. |
| Subjects | `PARTIALLY_IMPLEMENTED` | `TimetableSubject` is an active subject master. Exam papers, display order, paper groups and class-specific offerings are absent. |
| Staff and teachers | `PARTIALLY_IMPLEMENTED` | Staff and timetable-teacher links exist. Optional/stale links and missing exam-specific authority must fail closed. |
| Teacher/class/section/subject assignments | `PARTIALLY_IMPLEMENTED` | Timetable assignments enforce exact academic year/class/section/subject scope. They do not assign examination, paper or assessment-component authority. |
| Examination creation | `PARTIALLY_IMPLEMENTED` | `ExamCycle` has code, name, type, academic year, dates and workflow status. It lacks explicit class/section targets, entry windows, attendance range, rank policy, archive/reopen lifecycle and a bound scheme version. |
| Assessment components | `PARTIALLY_IMPLEMENTED` | `ExamAssessment` supports class, section, subject, component, maximum/pass marks and weightage. It lacks reusable component schemes, paper/group membership and an exact marks-entry assignment. |
| Marks entry | `PARTIALLY_IMPLEMENTED` | Zero is distinct from blank; maximum marks, draft save, keyboard movement, submit/approve/lock, correction reason, optimistic concurrency and append-only events exist. Missing are explicit `NOT_ENTERED`, selectors limited to exam assignments, autosave recovery, missing-only filter, exam/component authority and a teacher-owned correction-request queue. |
| Grades and grading scales | `PARTIALLY_IMPLEMENTED` | `GradingScheme` and `GradeBand` exist and snapshots are reproducible. Grade points, half-open decimal boundaries, scheme lifecycle/version lineage and class/exam bindings are incomplete. |
| Attendance | `PARTIALLY_IMPLEMENTED` | Daily student attendance, locking and reports exist. A report-specific inclusive date range, working-day policy, half-day policy and snapshotted report percentage are not implemented. |
| Remarks | `IMPLEMENTED_BUT_UNSAFE` | KG and general comments exist, but `lib/report-cards.ts` still uses hard-coded role-name ownership for KG approvals and permits broad non-Teacher comment editing. There is no approved remark bank or dedicated approval record. |
| Report-card templates | `PARTIALLY_IMPLEMENTED` | Template records, print settings and snapshots exist. Family inheritance, robust version promotion, conditional sections, pagination rules and pattern-based monochrome charts are absent. |
| Report-card generation | `PARTIALLY_IMPLEMENTED` | A locked exam can create snapshotted report-card rows and immutable versions. Current calculation is a flat, mainly single-exam result and output is browser print, not a bounded artifact-generation service. |
| Bulk PDF generation | `MISSING` | No section/class/multi-class selection job, merged PDF/ZIP artifact, deterministic file-name service, resource bound, retry/idempotency ledger or temporary-file cleanup workflow exists. |
| Parent/student report access | `PARTIALLY_IMPLEMENTED` | Parent access is server-side guardian-linked and issued-only, with private no-store responses. Student self-access, shared child context, audited downloads and IAM-1A dual staff/child context are absent. |
| Approvals, locking and moderation | `IMPLEMENTED_BUT_UNSAFE` | Sheet submit/approve/lock and report draft/approve/issue events exist, but missing-mark/unusual-score moderation, correction approval, controlled reopen, role-independent approval ownership and immutable publication approval are incomplete. |
| Audit events | `PARTIALLY_IMPLEMENTED` | Marks and report-card events preserve important transitions. Bulk generation, download, formula promotion, assignment changes and publication/reopen need append-only sensitive events. |
| Notifications | `MISSING` | The notification centre exists elsewhere, but examination openings, submission reminders, correction decisions and publication are not integrated. |
| Excel import/export | `PARTIALLY_IMPLEMENTED` | Reusable parsing, dry-run, duplicate checks, `ImportBatch` and formula-safe CSV helpers exist. Student import can commit valid rows while retaining row errors and does not atomically govern enrollment plus guardian links; the required multi-sheet workbook and corrected-error workbook are absent. |

### Existing strengths to preserve

- DB-backed semantic permissions and server-side page/API guards.
- Timetable-derived Teacher object scope and fail-closed assessment loading.
- Real zero versus blank handling.
- Accessible in-app dialogs instead of native `alert`, `confirm` or `prompt`.
- Optimistic concurrency and append-only marks/report events.
- Immutable `StudentReportCardVersion` records and batch snapshots.
- Parent-to-linked-child isolation and `private, no-store` protected responses.
- Formula-safe CSV protection and backup/restore coverage.

### Unsafe or misleading seams to remove

1. Do not treat a blank `PRESENT` mark as an implicit state. Store
   `NOT_ENTERED` explicitly.
2. Do not derive examination authority from timetable assignment alone.
3. Replace hard-coded KG/report approval role names with semantic permission
   plus exact assignment/approval ownership checks.
4. The calculation engine must never silently zero a missing component or
   treat it as an entered mark.
5. Do not label browser print as bulk PDF generation.
6. Do not expose a draft or unpublished report through a guessed identifier,
   stale cache, parent-child mismatch or broad permission alone.

## 4. Authoritative report-card evidence matrix

The detailed PII-free representation is
[`docs/fixtures/report-card-families.json`](fixtures/report-card-families.json).

| Family | Direct evidence | Marks and grouping | Co-scholastic / attendance | Grade, chart and signatures | Historical concern |
| --- | --- | --- | --- | --- | --- |
| `KG_DEVELOPMENTAL_BOOKLET` | 10-page LKG/UKG scan | Five evaluations; detailed rubric selections rather than numeric paper totals | 21 developmental criteria, 20 personality traits using G/S/N; month-wise working days/days present; height/weight at I, III and V | Overall A+ to E legend; comments/compliments; Class Teacher, Principal, Parent/Guardian and Director signatures; promotion/new-session certification | Whether all signatures and final grade are mandatory, and how a rubric maps to overall grade, are not evidenced as approved formulas. |
| `PRIMARY_10_40_SKILLS` | Class V CT-1 page | Usually internal 10 + written 40. English, Hindi, Maths, Science, Social and Computers observed; Telugu and GK/VE rows present. No total column was printed. | Ten skills graded G/S/N; no attendance block visible on the supplied page | Percentage, grade, grade point, rank; Student/Class Average/Highest chart with direct values; Parent, Class Teacher and Principal/HM signatures | Printed total is `0/0` while percentage is 54.57. A blank Telugu internal appears to have been silently treated as zero against a 50 maximum. |
| `SECONDARY_10_40_GROUPED` | Class IX CT-1 page | Internal 10 + written 40 = total 50; English Papers 1/2 feed first-language average; History/Geography feed Social average; Physics/Chemistry/Biology feed Science average; Hindi, Maths and Computers stand alone | Personality development graded G/S/N; attendance shown as days present/working days plus percentage | Percentage, grade, grade point, rank; three-series chart; Teacher, Principal, Parent and Director signatures | Displayed Science average 7.5/15.3/22.8 does not equal the equal-weight average of the printed paper values (7.33/15.67/23.00). Printed total follows the inconsistent displayed group. |
| `RETAINED_MULTI_EXAM_I_X` | Retained inventory only; source PDFs unavailable for revalidation | CT, session, annual/session-end, preboard/revision and combined-result layouts were recorded; Classes I-V skills and VI-X personality/group averages were recorded | Exact family-by-class and attendance variants are unverified in this pass | Combined-result weighting is reported as a family requirement but no authoritative weights were available | All fields and formulas remain `REQUIRES_SOURCE_REVALIDATION`; this family must not seed executable formulas. |

### Observed grading evidence

- KG/Class V printed bands: A+ 90–100, A 80–89, B 60–79, C 50–59,
  D 40–49, E 0–39.
- Class IX printed bands: A+ 90–100, A 80–89, B 70–79, C 60–69,
  D 50–59, E 35–49, F 0–34.
- Grade points are displayed in the Class V and IX samples, but their formula
  is not evidenced. They must become explicit band data, not be reverse
  engineered.
- Printed integer ranges leave ambiguity for decimal percentages. Executable
  bands must use unambiguous half-open bounds and an explicit top-bound rule.

### Calculations that require leadership confirmation

1. Class IX Science paper averaging and whether individual paper maxima are
   normalized before grouping.
2. Class V handling of a blank internal component, and correction of the
   printed `0/0` total.
3. Grade-point values and whether they are band constants or a formula.
4. The approved class/exam mapping of grading schemes.
5. Combined CT/terminal/annual/preboard/revision weights.
6. Rank cohort, tie policy, excluded states and whether rank should be printed.
7. Attendance date range and working-day/half-day rules.
8. Exact template-family mapping for the unavailable Class I–X source PDFs.

## 5. Target examination domain model

Implementation should be additive and migrate existing Prompt 17B/17C records;
it must not rewrite the working audit and snapshot foundation.

| Proposed aggregate | Purpose and key constraints |
| --- | --- |
| `AcademicYear` | One governed year code, dates, state and closure metadata. A migration decision must reconcile existing string years without mutating history. |
| `AcademicOffering` | Stable academic-year/class/section target used by enrollment, timetable and examination. Unique by year/class/section; inactive offerings remain historical. |
| `ExamSchemeVersion` | Immutable configuration version keyed to academic year, examination and class, with title, type, calculation mode, entry dates, attendance range, rank flag, rounding policy, status and source version. Draft edits create/promote versions; a published report never points to mutable JSON. |
| `ExamSchemeTarget` | Exact applicable academic offering. No class-wide wildcard may silently include a new section. |
| `ExamComponent` | Ordered Internal, Written, Practical, Oral, Project or other approved component with positive maximum, optional contribution weight, pass marks and entry-state policy. No combination is a universal default. |
| `ExamSubjectPaper` | Subject or paper offering, display order, component applicability and explicitly approved maximum/weight overrides. English Paper 1/2 and science papers are first-class rows. |
| `ExamSubjectGroup` / `ExamSubjectGroupMember` | Versioned, ordered group with member weights/normalization, such as First Language, Social or Science. A group cannot recursively include itself. |
| `ExamCombinedSource` | Links a Principal-selected locked examination version with an explicit decimal weight. Sources and weights are configured per academic-year/class/combined-result scheme, total exactly 100% and block when required sources are missing or unlocked. |
| `MarksEntryAssignment` | Exact user/staff, year, offering, subject/paper, component, examination scheme version, validity window and status. It is the server-side authority boundary. |
| `MarkSheetSubmission` | One assignment/sheet version, completeness counts, submit/approve/lock timestamps and optimistic version. |
| `MarkCorrectionRequest` | Teacher request, affected rows, reason, decision, decision actor and resulting sheet version. A request does not itself mutate approved marks. |
| `CalculationFormulaVersion` | Allowlisted formula AST/DSL, input/output units, precision, rounding and test vectors. Never execute arbitrary JavaScript or SQL. |
| `FormulaBinding` | Attaches a formula version to year, target, exam scheme, subject/paper/group and output type with explicit precedence. |
| `CoScholasticSchemeVersion` | Versioned skills/personality/developmental areas, ordered indicators and approved rating set. |
| `StudentCoScholasticEntry` | Student, scheme item, evaluation/exam, rating or allowed value, teacher note, approval and audit version. |
| `RemarkBankVersion` / `RemarkBankEntry` | Principal-approved phrases, category, applicable class range, state and history. |
| `StudentRemarkDecision` | Teacher text or bank selection, optional AI provenance, approver, approved value and immutable publication snapshot. |
| `ReportTemplateFamily` / `ReportTemplateVersion` | Family, A4 layout tokens, conditional sections, print modes, pagination and immutable promoted version. Existing templates migrate as version 1. |
| `ReportGenerationJob` / `ReportArtifact` | Bounded selection, idempotency key, publication version, format, counts, status, checksums, expiry/retention and cleanup evidence. |
| `ReportPublication` / `ReportPublicationEvent` | Approved immutable cohort publication pointing to calculation, template and data snapshots. Reopen creates a new version; it never rewrites an issued version. |
| `ReportAccessEvent` | Append-only view/download/print event with actor, child/student object, publication version, purpose and safe request metadata. |

All decimal maxima, weights and results should use fixed-precision decimal
storage. JSON snapshots remain useful for reproducibility but may not replace
indexed ownership, lifecycle and uniqueness columns.

## 6. Permission and marks-entry authorization model

Authorization is the intersection of all applicable controls:

```text
active session
AND effective semantic permission
AND active MarksEntryAssignment
AND exact exam scheme version
AND exact academic offering
AND exact subject/paper/component
AND entry window and sheet lifecycle allow action
AND requested students are active members of that offering
AND optimistic version matches
```

- A Teacher may propose components/maxima/weights only for an assigned subject.
  A proposal grants no activation or edit authority over the final scheme.
- A Principal with semantic permission reviews and activates the final
  class/exam scheme. A permitted Super Admin may intervene only with an explicit
  governed permission and mandatory audit reason. A role name alone grants
  nothing.
- A Teacher may have many assignments, but each query starts from their active
  assignment IDs. Client selectors are never trusted as authorization.
- Section-wide and class-wide leadership reads still require an object-scope
  policy. Broad view permission must not imply correction or publication.
- Permission removal or assignment revocation must fail on the next request.
  AUTH-2B/IAM-1A will separately define immediate session invalidation; this
  phase does not implement it.
- Every direct API must re-check student membership. Admission number, report
  number and opaque ID are lookup inputs, not proof of access.
- Proposed permission gaps include scheme-version management, formula
  promotion, exact entry assignment, moderation, correction decision,
  publication/reopen, bulk generation and report-access-audit export. Reuse
  existing semantic permissions wherever their meaning already matches.

## 7. Complete product workflow

### 7.1 Principal examination setup

1. Create a draft exam and choose the governed academic year.
2. Select exact class-section targets.
3. Select exam type and a template family.
4. Review any assigned-Teacher proposals; add ordered subjects/papers and
   configurable components, positive maxima and optional weights.
5. Select `RAW_SUM` or `WEIGHTED_NORMALIZED`; approve any subject/paper override
   and record a reason/audit for any section-specific exception.
6. Add group formulas and Principal-selected combined locked-exam sources, if
   applicable; combined weights must total exactly 100%.
7. Bind grading, grade-point, co-scholastic and attendance policies.
8. Choose rank visibility and record its cohort/tie policy.
9. Set marks-entry opening/closing dates.
10. Run a configuration preview that shows every target, denominator, formula,
   display row and unresolved configuration error.
11. Activate the immutable scheme version, then publish entry assignments.

The exam lifecycle is:

```text
DRAFT -> CONFIGURATION_APPROVED -> ENTRY_OPEN -> ENTRY_CLOSED
      -> CALCULATION_APPROVED -> LOCKED -> PUBLISHED -> ARCHIVED
```

`REOPENED_FOR_CORRECTION` is a controlled branch from `LOCKED` or `PUBLISHED`.
It requires a reason, permission, affected scope and new working version.
Previously published versions stay viewable and immutable.

### 7.2 Teacher assignment

The Principal assigns an active Teacher to exact academic year, class, section,
subject, paper/component and exam scheme version. The UI previews enrollment
count and conflicts before save. Overlapping assignments are either explicitly
co-teaching with stated authority or rejected. Removing an assignment does not
delete marks or events.

### 7.3 Teacher marks grid

Desktop is primary; mobile provides a safe row-card fallback.

- Selectors contain only active authorized assignments.
- Sticky student identity includes name, admission number and roll number.
- Arrow/Enter/Tab navigation is keyboard-first and focus is never trapped.
- `NOT_ENTERED`, `PRESENT`, `ABSENT`, `NOT_APPLICABLE` and `EXEMPT` are
  explicit. `PRESENT` with numeric zero is valid.
- Local and server validation enforce finite fixed-precision values and the
  exact component maximum.
- Draft save is explicit. Debounced autosave may protect a draft, but the UI
  shows pending/saved/failed state and it can never submit.
- A local recovery buffer contains the minimum marks payload, expires quickly,
  is keyed by sheet version and is cleared after confirmed save/logout.
- Completion counters and missing-entry filters distinguish all entry states.
- Submit is blocked while any required row is `NOT_ENTERED` or invalid.
- Submission becomes read-only with timestamp and checksum.
- A Teacher requests correction with affected rows and a reason. Only an
  authorized decision reopens a bounded working version.
- Compare-and-set version conflicts show an in-app resolution dialog with
  reload/review options; they never overwrite silently.
- No native browser dialogs are used.

### 7.4 Principal moderation and closure

The moderation dashboard provides:

- assignment completion and missing-mark counts;
- sheets not started/draft/submitted/approved/locked;
- submission timestamps and late submissions;
- values at zero or maximum and configurable statistical outlier flags;
- absent, exempt and not-applicable review;
- subject/group denominator preview;
- pending correction requests and decision history;
- student-by-student and aggregate calculation preview;
- source exam/version and formula-version lineage.

Outlier flags never change marks automatically. Result approval records the
exact scheme, formula, grade, co-scholastic, attendance and template versions.
Locking prevents source mutation. Publication creates an immutable publication
event and artifacts. Controlled reopen requires a mandatory reason, bounded
scope, leadership permission and a new publication version.

### 7.5 Generation and publication

Selection supports one student, selected students, one section, one class,
multiple classes or the whole exam cohort. Preview renders representative edge
cases before generation: longest name, largest subject count, second page,
missing optional blocks, chart and both print modes.

Supported outputs are:

- colour PDF;
- printer-safe monochrome PDF;
- merged PDF for manageable ordered sets;
- ZIP containing deterministic per-student PDFs and a manifest.

Artifact identity is based on publication version and stable report number,
never the student name. Repeating an identical request returns the same
successful artifact or safely retries the same job; it does not duplicate
report records.

## 8. Calculation and formula model

### 8.1 Formula principles

No class-specific formula exists only in application code. Each executable
formula is:

- allowlisted and versioned;
- bound to academic year, class/section target and exam scheme version;
- previewable with dependency trace;
- validated by stored positive, boundary and state test vectors;
- locked once referenced by a publication;
- reproducible from immutable inputs and version identifiers.

The formula engine supports:

- versioned ordered components with positive maxima and optional contribution
  weights;
- an explicit `RAW_SUM` or `WEIGHTED_NORMALIZED` mode on every scheme;
- paper marks and normalized or weighted groups;
- First Language/English, Social and Science averages;
- arbitrary approved subject groups;
- weighted CT/terminal/annual or other locked exam sources;
- total, percentage, grade, grade point and optional rank;
- attendance percentage;
- class average and highest score at the same result grain.

The structures 10+40, 20+80 and 25+25 are illustrative/historical test
vectors, not seeded school-wide defaults. A scheme is keyed by academic year,
examination and class. Subject/paper overrides require explicit Principal
approval; a section exception additionally requires a Principal reason and
append-only audit.

### 8.2 Canonical state semantics

| State | Numeric mark | Default calculation treatment | Publication rule |
| --- | --- | --- | --- |
| `NOT_ENTERED` | none | no calculation | blocks submission and publication |
| `PRESENT` | required; zero allowed | numerator is mark; denominator is maximum | included |
| `ABSENT` | none | recommended default numerator zero and denominator included, plus absence flag | leadership must approve policy |
| `NOT_APPLICABLE` | none | excluded from numerator and denominator | allowed only where scheme says item is inapplicable |
| `EXEMPT` | none | excluded by default; reason and approval required | policy may define an approved substitute, never an implicit zero |

### 8.3 Component, group and combined formulas

Every scheme must select exactly one component calculation mode.

For `RAW_SUM`:

```text
component_contribution = obtained_marks
scheme_obtained = sum(component_contribution)
scheme_maximum = sum(component_maximum_marks)
```

No contribution weight is inferred in this mode.

For `WEIGHTED_NORMALIZED`:

```text
component_contribution =
  (obtained_marks / component_maximum_marks) * component_weight
scheme_result = sum(component_contribution)
```

Every maximum must be positive, every required component must exist,
component identities must be unique, no mark may exceed its maximum and
component weights must total exactly 100%.

For a group with member normalized percentages `p_i` and positive weights
`w_i`:

```text
group_percentage = sum(p_i * w_i) / sum(w_i)
group_obtained = group_percentage * group_display_maximum / 100
```

The scheme must instead declare `RAW_SUM` when raw paper marks are intended.
Mixed maxima cannot be averaged without an explicit normalization rule.

For combined locked exam results:

```text
combined_percentage = sum(source_percentage_i * source_weight_i)
                      / sum(source_weight_i)
```

Every source is a locked exam publication/calculation version. A missing source
or unlocked source blocks calculation and activation. The Principal selects the
sources and percentage weights separately for each academic-year, class and
combined-result scheme; weights total exactly 100%. The retained
10%+10%+10%+20%+50% structure is evidence only and is never automatically
seeded. A preview must show the selected sources, formula and calculated result
before activation.

### 8.4 Precision and rounding

Approved RC-05 policy:

- input marks: up to four decimal places;
- intermediate normalization/group/combined values: decimal arithmetic at six
  places, no binary floating-point;
- canonical total and percentage: `ROUND_HALF_UP` to two decimals;
- grade and rank: use the unrounded canonical percentage/result, not formatted
  text;
- display: two decimals, with trailing-zero presentation controlled by the
  template;
- grade point: explicit value/range in the grade-band version;
- rank: competition ranking (`1, 2, 2, 4`) on exact canonical decimal result
  when enabled; cohort and secondary tie-breaker must be approved.

The Class V and IX historical inconsistencies are regression fixtures that
prove the new engine flags, rather than copies, the old arithmetic.

## 9. Co-scholastic and remarks model

Versioned schemes must support:

- LKG/UKG developmental rubric criteria and five evaluations;
- Classes I–V skill areas;
- Classes VI–X personality-development areas;
- G/S/N and other leadership-approved rating sets;
- GK/VE configured per class/exam scheme. The policy-v1 default is grade-only
  and excluded from total, percentage and rank; numeric-included or
  numeric-excluded mode requires explicit Principal approval;
- Principal-approved remark banks and free teacher remarks;
- Principal edit/approval with the original text retained in audit history.

Future AI suggestions are draft-only. The request sent to an approved service
must contain the minimum necessary structured inputs and no student image or
private asset. AI provenance is recorded. A Teacher or Principal must actively
review and approve the final remark; no AI output can submit or publish itself.

## 10. Publication and locking lifecycle

| Stage | Mutable content | Required controls |
| --- | --- | --- |
| Scheme draft | configuration only | manage permission, validation preview, optimistic version |
| Entry open | Teacher draft marks; scheme frozen for this version | exact assignment, entry dates, server validation; scheme change requires governed reopen and new version |
| Submitted sheet | none for Teacher | checksum, timestamp, correction request |
| Approved/locked source | no direct mutation | moderation approval, append-only event |
| Calculation preview | derived only | formula trace, exceptions, no publication |
| Result approved | no source/config mutation | approver, calculation snapshot |
| Publication version | immutable | cohort selection, template snapshot, event and artifact checksums |
| Reopen | new bounded working version | permission, reason, affected objects, prior version retained |
| Archive | immutable read access | retention policy and access audit |

Publishing is a transactionally reserved version plus an asynchronous bounded
artifact job. A failed PDF job does not roll back or duplicate approved marks;
it leaves a retryable failed job with safe error detail. A publication is
visible only after its required artifacts and manifest are successful.

## 11. Report-card template families and print specification

### 11.1 Family model

| Family | Intended range | Required sections | Evidence state |
| --- | --- | --- | --- |
| KG developmental booklet | LKG/UKG | profile, five evaluation rubrics, summary, personality, attendance/physical growth, comments, signatures, certification | direct retained scan |
| Primary numeric + skills | provisionally I–V | student/exam header, numeric subjects, skills, summary, remarks, chart, legend, signatures | Class V direct; other classes require revalidation |
| Secondary grouped numeric + personality | provisionally VI–X | paper/group rows, numeric subjects, personality, attendance, summary, chart, legend, signatures | Class IX direct; other classes require revalidation |
| Multi-exam/combined variant | class mapping undecided | source-exam weights, combined columns and formula trace | retained inventory only |

### 11.2 A4 design tokens

- Normal examination reports use A4 portrait with stable millimetre-based
  margins and a print-safe content area.
- Wide combined-result reports use A4 landscape or a readable multi-page
  portrait layout. Text never drops below the approved minimum size merely to
  force one page.
- School logo and approved identity lockup; Georgia Bold school name where the
  approved family specifies it, with a metrically safe fallback.
- Student block wraps long names and identifiers without clipping or reducing
  below the minimum readable font size.
- Examination title and academic year remain visible on continuation pages.
- Marks table repeats headers, prevents a student summary row from splitting,
  and moves an entire small section where possible.
- Many-subject layouts paginate; they do not squeeze columns into unreadable
  text. Paper/group indentation is semantic and accessible.
- Co-scholastic tables, totals, attendance, remarks, grade legend and signature
  blocks have explicit keep-together and continuation rules.
- Final reports provide Class Teacher, Principal, Parent/Guardian and Director
  signature or acknowledgement spaces. Interim templates may omit Director.
  Governed approval statuses and physical spaces are used; uncontrolled
  uploaded signature images are not accepted.
- HTML preview uses correct table headers, reading order, contrast and text
  equivalents. PDF tagging capability must be assessed in implementation QA.
- Colour and monochrome are separate promoted template render modes sharing
  identical data and pagination tests.

### 11.3 Monochrome chart contract

- Student Marks: solid fill.
- Class Average: diagonal hatch.
- Highest Score: dotted or cross-hatched fill.
- Every value has a direct numeric label.
- Legend contains visible pattern samples and text.
- Series order is stable and documented.
- No meaning depends on colour. Lines, borders and labels remain readable after
  grayscale conversion and ordinary photocopying.

Charts show comparable percentages or explicitly labelled equal-max values;
they never compare unlike raw maxima. The same publication snapshot supplies
student, class-average and highest-score series.

## 12. Bulk-generation architecture

1. Resolve and authorize the exact cohort server-side.
2. Require one immutable approved publication version.
3. Build a deterministic selection hash and idempotency key.
4. Enqueue a bounded job with maximum cards, maximum pages, timeout, memory
   ceiling and per-user/cohort rate limit.
5. Render locally with a pinned browser/font/template version. Do not send
   report content to an external PDF or AI service.
6. Validate page count, manifest count and per-file checksum.
7. Store artifacts in a private path outside public assets.
8. Offer a short-lived authorized download response with `private, no-store`.
9. Audit generation and download.
10. Remove temporary HTML, browser profiles and partial files in a `finally`
    path; a cleanup monitor detects abandoned work.

Recommended deterministic names:

```text
NPS_<exam-code>_<class-section>_<report-number>_v<publication-version>_<mode>.pdf
NPS_<exam-code>_<scope>_v<publication-version>_<mode>.zip
NPS_<exam-code>_<scope>_v<publication-version>_<mode>_merged.pdf
```

The private manifest maps report IDs to file checksums; names do not contain a
student name, phone number or admission number.

## 13. Parent and Student access

- Parent queries begin from active guardian links and return only issued
  publications for linked children.
- Student queries begin from the authenticated student account link and return
  only that student's issued publications. Student IAM is a dependency, not
  authorized in this phase.
- The future shared child context switcher must resolve an allowed-child list
  server-side on every context change.
- A teacher-parent staff member may switch staff/child contexts only after
  IAM-1A defines explicit account links, context claims and audit semantics.
- Draft, preview, superseded-working and unpublished versions are inaccessible.
- Views/downloads are audited according to the approved policy.
- Report HTML, PDFs, manifests and errors are private and `no-store`; artifact
  identifiers are opaque and object access is rechecked at download time.

## 14. Bulk student import dependency

The future downloadable `.xlsx` workbook contains:

| Sheet | Contract |
| --- | --- |
| `Instructions` | version, scope, safe editing/export rules, dry-run/import sequence, sample-row deletion instruction and support contact role |
| `Data Dictionary` | column, type, requiredness, maximum length, format, allowed values, update key, privacy class and examples using invented data |
| `Students` | student action, admission number, roll number, academic year, class, section, status, optional approved identifiers, guardian link key, mobile/email and row note |
| `Guardians` | stable import key, relationship, minimum approved contact fields and link semantics; avoids duplicating the same guardian across children |
| hidden validation lists | approved academic years, offerings, statuses, relationships and action values; protected from accidental editing |

Sample rows are conspicuously marked `SAMPLE_DO_NOT_IMPORT` and fail a real
import until removed or explicitly ignored.

The governed sequence is:

```text
download versioned template
-> parse without formulas/macros/external links
-> normalize
-> dry-run all rows and cross-sheet links
-> detect database and in-file duplicates
-> return row-level errors/warnings
-> user downloads corrected-error workbook
-> repeat dry-run
-> explicit import confirmation
-> one all-or-none transaction
-> append-only ImportBatch and row outcome audit
```

No partial unsafe import is allowed. The existing import framework can supply
parsing, dry-run, duplicate, audit and formula-safety primitives, but its
student apply path must not be reused unchanged because valid rows may commit
alongside row errors and it does not atomically govern enrollment and guardian
links.

## 15. Security and privacy controls

- Server-side semantic permissions on every page, API, job and artifact.
- Exact assignment-based mark entry and student membership checks.
- Object-level Parent/Student/Teacher/leadership isolation.
- Opaque identifiers plus authorization; never rely on non-guessability.
- No password, recovery material or session secret in reports, logs or exports.
- No marks enumeration through counts, timing, selectors or error differences.
- Spreadsheet cells neutralize leading formula characters; uploaded workbooks
  reject macros, formula cells and external links.
- No native browser dialogs.
- Append-only sensitive events with protected previous/next state snapshots.
- Permission/assignment removal fails closed immediately; session invalidation
  follows the separately gated AUTH-2B/IAM-1A design.
- Bulk generation has rate, cohort, page, time, memory and concurrency bounds.
- Temporary files use a private bounded directory and verified cleanup.
- No student image or private asset goes to an external AI service without a
  separately approved privacy, contract and retention control.

## 16. Risk register

| ID | Risk | Severity | Required control / gate |
| --- | --- | --- | --- |
| RC-01 | Most retained Class I–X source PDFs are unavailable for direct revalidation | High | reacquire PII-controlled source set; record hashes and approve family mapping before executable templates |
| RC-02 | Historical totals/group averages contain apparent errors | Critical | leadership-approved formula register and golden tests; never copy printed arithmetic silently |
| RC-03 | Current KG/comment approval uses role names and broad edit authority | Critical | permission plus object/field ownership refactor and negative authorization tests before pilot |
| RC-04 | Blank/PRESENT can be confused with zero or absence | Critical | explicit `NOT_ENTERED`, state migration policy and boundary tests |
| RC-05 | Timetable scope is mistaken for exam entry authority | Critical | exact `MarksEntryAssignment` and direct-API scope tests |
| RC-06 | Current report calculation is flat/single-exam while schema suggests multiple sources | High | versioned formula engine and combined-source integration tests |
| RC-07 | Grade-point, decimal band and rank policies are unknown | High | leadership decisions before configuration promotion |
| RC-08 | PDF generation exhausts memory/disk or leaves private temporary files | Critical | bounded queue, quotas, timeouts, private paths, cleanup monitor and fault tests |
| RC-09 | Draft/private report leaks through cache or guessed artifact ID | Critical | issued-only object check, opaque private storage, no-store and negative access tests |
| RC-10 | Student import partially commits an inconsistent family/enrollment graph | Critical | all-or-none transaction after clean dry-run and corrected workbook |
| RC-11 | Parent/Teacher dual context exposes the wrong object | Critical | IAM-1A dependency, explicit context claims and cross-context regression tests |
| RC-12 | Permission removal leaves a long-lived authorized session | High | fail each request immediately; AUTH-2B/IAM-1A session-invalidation gate |
| RC-13 | AI remark feature discloses private data or auto-publishes | Critical | disabled until separate privacy approval; minimum data, provenance and human approval |
| RC-14 | Academic year/class/section strings drift across modules | High | governed master reconciliation and migration rehearsal on a copied database |
| RC-15 | Colour-only or squeezed layouts fail print/accessibility | High | pattern chart contract, monochrome photocopy QA, long-name/many-subject fixtures |

## 17. Implementation breakdown

### EXAM-RC-IMPL-1 — Configuration, authorization and entry

Prerequisites: approved `EXAM_REPORT_POLICY_V1`, `DEVOPS-1E`, complete
source-family revalidation, Prompt 23C and UX-1A gates, and an approved
migration rehearsal plan.

- Add governed academic/exam scheme versions, exact targets, papers/groups,
  components, formulas and marks-entry assignments.
- Migrate existing exam/assessment/mark data additively on a copied database.
- Add explicit entry states, exact selectors, keyboard grid, autosave/recovery,
  completion filters and correction-request decisions.
- Add Principal setup, assignment and moderation dashboards.
- Replace hard-coded report approval role checks with semantic permission and
  field/object ownership rules.
- Preserve old snapshots/events and expand backup/restore before any
  operational migration.

Go gate: server-side negative authorization, formula configuration validation,
copied-DB migration/restore, accessibility and desktop/mobile entry QA all pass
with no operational DB change during development.

### EXAM-RC-IMPL-2 — Calculation, publication and access

Prerequisite: IMPL-1 independently cleared.

- Implement decimal formula engine, grade points, groups, combined sources,
  attendance snapshot, optional rank and cohort statistics.
- Implement co-scholastic schemes, governed remarks and template versions.
- Add calculation preview, approval/lock/reopen and immutable publication.
- Add bounded colour/monochrome PDF generation, merged/ZIP artifacts,
  idempotency and cleanup.
- Add issued-only Parent access improvements and Student access only when its
  IAM dependency is separately approved.
- Add notification integration and audited access/downloads.

Go gate: golden formula and historical-anomaly fixtures, print/photocopy,
resource-failure, object-isolation, idempotency and cleanup tests all pass.

### EXAM-RC-QA — Independent release-candidate verification

- Reconfirm exact approved commit/tag lineage, private remote and clean branch.
- Re-run a copied-database migration, rollback and version-37-plus restore.
- Exercise Principal, Teacher, Parent, Student (if approved), Viewer and denied
  roles separately without cross-role inference.
- Prove unrelated Teacher assignments and students cannot be enumerated.
- Test every entry state, real zero, maxima, decimals, conflicts, late windows,
  correction, reopen and permission removal.
- Compare explicit `RAW_SUM` and `WEIGHTED_NORMALIZED` test vectors, including
  illustrative 10+40, 20+80 and 25+25 examples, paper groups and configured
  combined weights; prove no example is seeded as a universal rule and
  historical inconsistencies are flagged.
- Validate A4 colour and monochrome output, pattern legend, long names,
  many-subject pagination, merged/ZIP manifests and repeated generation.
- Validate desktop primary flow and exact 390x844 mobile fallback, including
  in-page viewport dimensions and zero console errors.
- Verify rate/resource bounds, private cache headers, download audit and
  temporary cleanup.
- Remove all invented QA data and verify baseline/backup evidence before signoff.

## 18. Leadership policy version 1

The authoritative 40-item selection manifest and full rationale are in
`docs/EXAM_REPORT_CARD_LEADERSHIP_DECISION_REGISTER.md`; the machine-readable
freeze is `docs/fixtures/exam-report-policy-v1.json`. Policy version 1 contains
34 `OPTION_A` selections and 6 `CUSTOM` selections, with no missing or duplicate
Decision IDs.

The custom rules establish versioned component schemes with explicit
`RAW_SUM`/`WEIGHTED_NORMALIZED` mode, per-class combined-result sources and
weights totaling exactly 100%, locked-attendance ranges, configurable GK/VE,
final/interim signature spaces and readable portrait/landscape print behavior.
No fixed marks structure or combined-result weighting is universal.

The table below is retained as the historical planning-question crosswalk.

| Decision | Required answer |
| --- | --- |
| RC-D01 | Revalidated template-family mapping for every Class I–X exam layout |
| RC-D02 | Authoritative paper/group formulas, especially English, Social and Science |
| RC-D03 | Missing, absent, exempt and not-applicable denominator/failure policy |
| RC-D04 | Grade bands, decimal boundaries and explicit grade-point values by class/exam |
| RC-D05 | Combined-exam sources and weights by class/exam |
| RC-D06 | Rank visibility, cohort, tie rule and excluded-state policy |
| RC-D07 | Attendance range, working-day and half-day policy |
| RC-D08 | Required signature/approval roles, including Director and parent acknowledgement |
| RC-D09 | Approved colour identity, template typography and family-specific section order |
| RC-D10 | Student-account timing and teacher-parent context dependency after IAM-1A |
| RC-D11 | Report/access-event retention and which downloads must be audited |
| RC-D12 | Whether any approved alternative mark may replace an exemption |
| RC-D13 | Whether report cards may contain photos; external AI remains separately prohibited |

These policy questions are approved in `EXAM_REPORT_POLICY_V1`, but approval
does not promote a production formula or template. Source revalidation,
DEVOPS-1E, Prompt 23C, UX-1A, implementation and independent QA remain separate
gates.

## 19. Verification evidence

| Required check | Result |
| --- | --- |
| `pnpm.cmd routes:list` | passed; 274 page routes / 378 API routes |
| `pnpm.cmd lifecycle:backfill` | passed; 0 active students scanned, 0 missing enrollments, 0 changes |
| `pnpm.cmd typecheck` | passed |
| `pnpm.cmd test` | passed; 1,572/1,572 tests across 170 files |
| `pnpm.cmd build` | default heap compiled, then the type-analysis worker reached its ~2 GB heap limit; the authorized bounded 4 GB retry passed all 212 generated pages |
| `pnpm.cmd backup` | passed; version 37 `nalanda-fee-control-backup-2026-07-29-01-30.json`, SHA-256 `4999A6EDE2D3FE8DFF828E80D7F66308427FA480013C4B648CF9526FD98D00C9` |
| `pnpm.cmd git:safety-check` | passed before and after verification |

Read-only Browser audit, using the existing authenticated Super Admin session,
opened `/exams`, `/marks`, `/report-cards/templates` and
`/report-cards/batches/new`. The rendered empty-baseline workflows matched the
source audit: raw-mark exams/sheets, distinct mark states, server-validated
non-executable templates and one locked exam per mark batch. There were zero
captured console warnings/errors.

The existing marks, template and batch pages were also checked at exact
390x844. Each reported `window.innerWidth=390`, `window.innerHeight=844`,
`document.documentElement.clientWidth=390` and
`document.documentElement.clientHeight=844`, with document scroll width 390 and
no horizontal overflow. This validates the existing empty-state surfaces only;
the future dense marks grid and generated report layouts still require
EXAM-RC-QA with representative invented data.

After all commands and Browser cleanup:

- operational database SHA-256 remained
  `3BA84F4834C4BE4B682D3BCE624490A99337BCAEC8027EFC27B9C4FF4FE11022`;
- database size and last-write timestamp remained 4,771,840 bytes and
  `2026-07-28T18:22:32.2357749Z`;
- schema SHA-256 remained
  `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`;
- migration history remained the single `20260722_clean_install_baseline`;
- integrity remained `ok` with zero foreign-key violations;
- the exact zero-business-data baseline and four account-role states remained
  unchanged;
- all temporary PDF renders and Browser server logs were removed; and
- no schema, migration, API, production UI, deployment, DNS, provider account
  or payment change was made.

## 20. Closure decision

The existing foundation is worth extending, not replacing. The target design
is additive, versioned, permission-controlled and historically reproducible.
The planning phase itself can close with unchanged operational state, but the
missing direct Class I–X evidence and unresolved calculation/product decisions
mean the correct result is:

`EXAM_REPORT_ARCHITECTURE_REQUIRES_DECISIONS`

The later leadership-policy continuation resolved the 40 selections without
implementing them. Its approved planning result is:

`EXAM_REPORT_LEADERSHIP_DECISIONS_APPROVED`
