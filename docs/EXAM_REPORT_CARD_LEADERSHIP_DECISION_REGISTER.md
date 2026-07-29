# EXAM-RC-DECISIONS-1 - Examination and Report-Card Leadership Decision Register

**Package result:** `EXAM_REPORT_DECISION_PACKAGE_READY`
**Decision count:** 40
**Implementation state:** paused; `EXAM-RC-IMPL-1` has not started
**Branch:** `feature/exam-report-card-architecture`
**Architecture commit reviewed:** `c93d1f894a2a931473b5c6ea631b33e48522d8ab`
**Scope:** leadership decisions and documentation only

This package converts every unresolved product or policy item in
`EXAM-RC-PLAN-1` into one answerable list. It does not treat an old printed
calculation as correct merely because it appeared on a report card. It contains
no student name, admission number, parent name, contact detail or sample mark.

## 1. Current-work verification

| Control | Verified state |
| --- | --- |
| Current branch | `feature/exam-report-card-architecture` |
| Current local commit before this decision package | `c93d1f894a2a931473b5c6ea631b33e48522d8ab` |
| Pushed branch commit | `origin/feature/exam-report-card-architecture` resolves to the same commit |
| Git status before this package | clean and tracking the remote feature branch |
| Private repository | `vsairohith67/nalanda-school-erp` |
| Operational database SHA-256 | `3BA84F4834C4BE4B682D3BCE624490A99337BCAEC8027EFC27B9C4FF4FE11022` |
| Prisma schema SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Migration history | one `20260722_clean_install_baseline` directory |
| Database integrity | `ok`; zero foreign-key violations |
| Business baseline | 0 Students / 0 active enrollments / 0 Payments / INR 0 / 0 Guardians / 0 Staff |
| Account state | one active `SUPER_ADMIN`; `ADMIN`, `ACCOUNTANT` and `VIEWER` inactive and retained |

EXAM-RC-PLAN-1 created:

- `docs/EXAMINATION_REPORT_CARD_ARCHITECTURE_AND_GAP_AUDIT.md`;
- `docs/diagrams/NALANDA_ERP_SYSTEM_ARCHITECTURE.mmd`;
- `docs/diagrams/EXAMINATION_REPORT_CARD_WORKFLOW.mmd`;
- `docs/fixtures/report-card-families.json`; and
- `tests/exam-report-card-architecture.test.ts`.

It also updated `docs/INDEX.md` and `docs/PROMPT_HISTORY.md`. No planning work
was reset, merged or discarded.

## 2. Evidence boundary

Directly revalidated evidence consists of:

- the retained 10-page LKG/UKG developmental booklet; and
- the two-page black-and-white Class V and Class IX sample.

The retained inventory describes broader Classes I-X CT, session,
annual/session-end, preboard/revision and combined-result families, but the
original files were unavailable during EXAM-RC-PLAN-1. Decisions that depend on
those files therefore either require source reacquisition or adopt a safe
disabled/default state until the evidence is approved.

The four PII-free evidence families are:

1. `KG_DEVELOPMENTAL_BOOKLET`;
2. `PRIMARY_10_40_SKILLS`;
3. `SECONDARY_10_40_GROUPED`; and
4. `RETAINED_MULTI_EXAM_I_X`.

## 3. How leadership should answer

Every decision has an `OPTION_A` recommendation. Leadership may approve the
recommendation, select an alternative, or write a bounded custom answer.
Selecting a configurable default does not change old published reports.
Configuration changes apply only through a new version for a future exam or
publication.

## 4. MUST_DECIDE_BEFORE_IMPLEMENTATION

There are 28 decisions in this group.

### RC-01 - Source reacquisition and template-family mapping

- **Topic and scope:** the report-card family for every LKG-X class and exam.
- **Evidence/current behavior:** LKG/UKG, Class V and Class IX are directly
  evidenced. The broader Class I-X family inventory is retained but its source
  PDFs were unavailable.
- **Risk:** inferred layouts or formulas could become production rules without
  source proof.
- **Recommended `OPTION_A`:** reacquire the original Class I-X PDFs through a
  PII-controlled process, record hashes, and approve a class/exam-to-family
  matrix. Until then, implement directly evidenced families only and keep other
  production templates disabled.
- **Alternatives:** `OPTION_B` approve provisional Primary I-V and Secondary
  VI-X mappings from the retained inventory; `OPTION_C` launch only LKG/UKG,
  Class V and Class IX.
- **Effects:** calculation bindings and print sections depend on the approved
  family. This is required before production template/formula promotion, but
  the mapping remains version-configurable later.

### RC-02 - Assessment components and maximum marks

- **Topic and scope:** 10+40, 20+80, 25+25 and other component schemes by
  class/exam.
- **Evidence/current behavior:** Class V and IX directly show 10 internal plus
  40 written. The current `ExamAssessment` can store components but does not
  provide a governed reusable scheme version.
- **Risk:** a global hard-coded maximum would miscalculate other exams.
- **Recommended `OPTION_A`:** configure ordered components and maxima per
  versioned class/exam scheme; seed 10+40 only for directly approved CT
  families and require explicit approval for every other combination.
- **Alternatives:** `OPTION_B` one school-wide scheme; `OPTION_C` class-band
  defaults with per-exam overrides.
- **Effects:** defines denominators, validation and table columns. Required
  before marks entry for an exam; safely configurable through a new scheme
  version later.

### RC-03 - Grade scale by class and exam

- **Topic and scope:** academic grade bands for LKG-X.
- **Evidence/current behavior:** KG/Class V print A+ 90-100, A 80-89, B 60-79,
  C 50-59, D 40-49, E below 40. Class IX print adds narrower B-E bands and F
  below 35.
- **Risk:** one scale would silently change historical meaning between Primary
  and Secondary reports.
- **Recommended `OPTION_A`:** use separately versioned scales: the printed
  KG/I-V bands for descriptive grading and the printed VI-X bands for numeric
  grading, subject to RC-05 decimal boundaries and RC-13 pass/fail policy.
- **Alternatives:** `OPTION_B` one school-wide scale; `OPTION_C` a unique scale
  for each exam.
- **Effects:** changes grade labels and legends, not raw totals. Required before
  formula/template promotion and configurable by future version.

### RC-04 - Grade-point scale

- **Topic and scope:** whether and how grade points appear for I-X.
- **Evidence/current behavior:** Class V and IX display a grade point, but its
  derivation is not evidenced.
- **Risk:** reverse-engineering could publish a false academic rule.
- **Recommended `OPTION_A`:** hide grade points until leadership supplies
  explicit band-to-point values; store future points as band data, never as an
  inferred formula.
- **Alternatives:** `OPTION_B` approve a written custom band-to-point table;
  `OPTION_C` remove grade points permanently.
- **Effects:** no effect on totals, percentage or grade; removes the grade-point
  field/legend until approved. The initial choice is required before template
  promotion and can change only in a new grade/template version.

### RC-05 - Precision, rounding and decimal grade boundaries

- **Topic and scope:** all numeric exams and combined results.
- **Evidence/current behavior:** old integer grade legends do not explain values
  such as 59.995. Historical Class IX group values also show inconsistent
  decimal handling.
- **Risk:** different screens could assign different totals, grades or ranks.
- **Recommended `OPTION_A`:** decimal arithmetic; accept marks to four decimal
  places; calculate intermediates to six; use `ROUND_HALF_UP` to two decimals
  for stored/displayed totals; determine grade and rank from the unrounded
  canonical result; use half-open bands with 100 included in the top band.
- **Alternatives:** `OPTION_B` round each paper/component first; `OPTION_C`
  truncate rather than round.
- **Effects:** controls every calculated number and printed decimal. Required
  before the formula engine; the policy is versioned but should rarely change.

### RC-06 - English paper-group calculation

- **Topic and scope:** classes/exams with English Paper 1 and Paper 2.
- **Evidence/current behavior:** the retained/direct Secondary evidence shows
  paper-level English feeding a grouped average, but does not prove weighting.
- **Risk:** raw averaging is unfair if paper maxima differ.
- **Recommended `OPTION_A`:** normalize each paper to a percentage and take an
  equal-weight average unless the approved scheme supplies explicit weights;
  then scale to the group's display maximum.
- **Alternatives:** `OPTION_B` raw sum; `OPTION_C` custom weighted normalized
  average.
- **Effects:** changes English group, total, percentage, grade, chart and rank.
  Required for any grouped English scheme and configurable by formula version.

### RC-07 - Science paper-group calculation

- **Topic and scope:** Physics, Chemistry and Biology groups, provisionally
  VI-X.
- **Evidence/current behavior:** the Class IX printed Science average does not
  equal the arithmetic average of the displayed papers.
- **Risk:** copying the old value would preserve an apparent arithmetic error.
- **Recommended `OPTION_A`:** normalize each paper percentage and use an
  equal-weight mean; flag the historical sample as inconsistent and never use
  it as a golden expected result.
- **Alternatives:** `OPTION_B` raw sum; `OPTION_C` leadership-supplied weighted
  normalized mean.
- **Effects:** changes Science, total, percentage, grade, chart and rank.
  Required before Secondary grouped calculation and configurable by formula
  version.

### RC-08 - Social paper-group calculation

- **Topic and scope:** History and Geography groups, provisionally VI-X.
- **Evidence/current behavior:** the Class IX sample shows a Social average but
  does not evidence weighting.
- **Risk:** unequal maxima could make a raw mean misleading.
- **Recommended `OPTION_A`:** normalize History and Geography separately and
  use an equal-weight average, with explicit scheme weights allowed later.
- **Alternatives:** `OPTION_B` raw sum; `OPTION_C` custom weighted normalized
  average.
- **Effects:** changes Social, total, percentage, grade, chart and rank.
  Required before grouped Social calculation and configurable by version.

### RC-09 - Combined CT, terminal and annual weights

- **Topic and scope:** combined-result reports for any class.
- **Evidence/current behavior:** retained inventory says combined reports exist,
  but no authoritative weights were available.
- **Risk:** a guessed 20/30/50 or similar rule would create false results.
- **Recommended `OPTION_A`:** ship the configurable engine with combined
  publication disabled until each class/exam has a leadership-approved set of
  source weights totaling 100%.
- **Alternatives:** `OPTION_B` approve a custom weight table now; `OPTION_C`
  remove combined reports from the first release.
- **Effects:** determines combined percentages, grades, charts and columns.
  Required to publish combined results; the generic engine may be implemented
  before weights, but no production weight may be seeded without approval.

### RC-10 - Missing source in a combined result

- **Topic and scope:** combined exams when a required CT/terminal/annual source
  is absent or unpublished.
- **Evidence/current behavior:** no approved historical rule exists.
- **Risk:** silent zero or silent exclusion changes the denominator and can
  unfairly lower or inflate results.
- **Recommended `OPTION_A`:** block combined calculation/publication until all
  required locked sources exist; show the missing source in moderation.
- **Alternatives:** `OPTION_B` exclude the source and renormalize approved
  weights; `OPTION_C` count the source as zero.
- **Effects:** controls eligibility and denominator, and prints no combined
  result while incomplete. Required before combined-result implementation;
  configurable only as an explicit scheme policy.

### RC-11 - Canonical mark-entry states

- **Topic and scope:** all numeric marks.
- **Evidence/current behavior:** real zero is already distinct from blank in the
  current foundation, but explicit `NOT_ENTERED` is missing. Old Class V
  evidence appears to have treated a blank component as zero.
- **Risk:** blank, zero, absence and inapplicability can be conflated.
- **Recommended `OPTION_A`:** require exactly `NOT_ENTERED`, `PRESENT`,
  `ABSENT`, `NOT_APPLICABLE` and `EXEMPT`; `PRESENT` requires a number and zero
  is valid; no other state stores an ordinary numeric mark.
- **Alternatives:** `OPTION_B` combine `EXEMPT` and `NOT_APPLICABLE`;
  `OPTION_C` retain blank as an implicit state.
- **Effects:** controls validation, totals, labels and moderation. Required
  before schema/entry work; state meanings must remain stable after launch.

### RC-12 - Whether absence contributes zero

- **Topic and scope:** required numeric components and subjects.
- **Evidence/current behavior:** supplied PDFs do not evidence an approved
  absence formula.
- **Risk:** excluding an absence can inflate percentage; silently storing zero
  loses the fact of absence.
- **Recommended `OPTION_A`:** keep `ABSENT` as a distinct flag, contribute zero
  to the numerator, and keep the required maximum in the denominator. Print
  `AB`, not `0`.
- **Alternatives:** `OPTION_B` exclude absent work from numerator/denominator;
  `OPTION_C` block all result publication until a makeup exam.
- **Effects:** affects totals, averages, pass/fail and rank; print remains
  visibly absent. Required before formulas and configurable per approved scheme
  only through a new version.

### RC-13 - Pass/fail and minimum subject mark

- **Topic and scope:** academic result status by class/exam.
- **Evidence/current behavior:** Class IX prints F below 35; KG/Class V use an E
  band but do not prove that E means failure.
- **Risk:** treating grade and pass status as the same rule could incorrectly
  fail younger students or allow an overall pass despite a failed required
  subject.
- **Recommended `OPTION_A`:** LKG/UKG have no pass/fail; I-V show descriptive
  achievement/needs-support only; VI-X terminal/annual/preboard require at least
  35% in each required numeric subject and 35% overall; CT remains formative
  unless explicitly promoted to a summative scheme.
- **Alternatives:** `OPTION_B` one 35% rule for I-X; `OPTION_C` overall
  percentage only; `OPTION_D` leadership-supplied class/exam thresholds.
- **Effects:** controls result status and printed wording, not the grade band
  itself. Required before result approval and configurable by scheme version.

### RC-14 - Rank visibility

- **Topic and scope:** whether rank is printed for each class/exam.
- **Evidence/current behavior:** Class V and IX samples show rank; KG evidence
  does not.
- **Risk:** unconditional rank can be inappropriate for young/formative cohorts
  and exposes unstable comparisons.
- **Recommended `OPTION_A`:** hide rank for LKG-V and all CT/formative exams;
  allow an explicit Principal-enabled rank only for VI-X terminal, annual and
  preboard reports.
- **Alternatives:** `OPTION_B` show rank for every numeric exam; `OPTION_C`
  never show rank.
- **Effects:** calculation may still compute private moderation statistics, but
  the printed rank field is conditional. Required before scheme/template
  promotion and configurable per future exam version.

### RC-15 - Rank cohort, ties and excluded states

- **Topic and scope:** exams where RC-14 enables rank.
- **Evidence/current behavior:** old PDFs show a number but do not define cohort
  or tie handling.
- **Risk:** class-wide versus section-wide ranking and hidden tie-breakers can
  produce disputed results.
- **Recommended `OPTION_A`:** rank within the exact class-section publication
  cohort; use competition ranking (`1, 2, 2, 4`) on the unrounded canonical
  result; no hidden tie-breaker; `NOT_ENTERED` blocks publication and other
  states follow their approved calculation policy.
- **Alternatives:** `OPTION_B` class-wide across sections; `OPTION_C` dense
  ranking (`1, 2, 2, 3`); `OPTION_D` custom secondary tie-breaker.
- **Effects:** changes rank only and requires a printed cohort label when rank
  appears. Required before rank implementation; configurable per scheme.

### RC-16 - Class average and highest score

- **Topic and scope:** chart/statistics for numeric reports.
- **Evidence/current behavior:** Class V and IX show Student Marks, Class
  Average and Highest Score, but cohort/inclusion rules are not stated.
- **Risk:** mixing raw maxima or excluding low/absent results can mislead.
- **Recommended `OPTION_A`:** calculate comparable percentages at the same
  subject/group grain within the exact class-section cohort; include every
  publishable student, including approved absences under RC-12; exclude
  `NOT_APPLICABLE`/`EXEMPT` only from the affected item; never mix unlike raw
  maxima.
- **Alternatives:** `OPTION_B` class-wide cohort; `OPTION_C` present students
  only.
- **Effects:** changes chart/reference values, not the student's own total.
  Required before chart calculations and configurable by versioned statistics
  policy.

### RC-17 - Attendance date range and source

- **Topic and scope:** attendance printed on every family that displays it.
- **Evidence/current behavior:** KG shows monthly attendance; Class IX shows
  days present/working days/percentage. Exact ranges are not evidenced.
- **Risk:** different pages can report different periods or include unlocked
  attendance.
- **Recommended `OPTION_A`:** each exam scheme records inclusive start/end
  dates and reads only locked daily Student attendance; annual reports default
  from the academic-year start through the exam closing date.
- **Alternatives:** `OPTION_B` month-to-date; `OPTION_C` cumulative year-to-date
  for every exam; `OPTION_D` custom approved ranges.
- **Effects:** changes attendance totals/percentage and the printed period
  label. Required before attendance snapshot implementation and configurable
  by exam version.

### RC-18 - Working-day and half-day policy

- **Topic and scope:** attendance denominator and partial presence.
- **Evidence/current behavior:** old reports show working days and present days
  but no half-day rule.
- **Risk:** holidays, unlocked sessions or partial days can be counted
  inconsistently.
- **Recommended `OPTION_A`:** denominator includes only locked instructional
  Student-attendance sessions; holidays/non-instructional days are excluded;
  present=1, absent=0, and an approved half-day=0.5 when half-day support
  exists.
- **Alternatives:** `OPTION_B` count every calendar school day; `OPTION_C`
  disallow half-days entirely.
- **Effects:** changes attendance percentage and printed decimal days. Required
  before the attendance formula; configurable by a future attendance-policy
  version.

### RC-19 - Skills, personality-development and KG rubric schemes

- **Topic and scope:** LKG/UKG developmental criteria, I-V skills and VI-X
  personality development.
- **Evidence/current behavior:** KG directly shows 21 developmental criteria
  and 20 personality traits; Class V shows ten skills; Class IX shows
  personality development. G/S/N is observed.
- **Risk:** one shared list would erase class-specific meaning.
- **Recommended `OPTION_A`:** create three independently versioned schemes with
  ordered items and approved G/S/N ratings; do not add their ratings to the
  numeric academic percentage.
- **Alternatives:** `OPTION_B` one school-wide co-scholastic list; `OPTION_C`
  A-E ratings; `OPTION_D` custom class-specific lists.
- **Effects:** changes co-scholastic tables only, not academic totals/rank.
  Required before those templates and configurable by future scheme versions.

### RC-20 - KG overall grade and promotion certification

- **Topic and scope:** LKG/UKG final summary and promotion wording.
- **Evidence/current behavior:** the booklet contains detailed rubrics, an
  overall grade legend and promotion/new-session certification, but no approved
  derivation formula.
- **Risk:** an invented numeric conversion could misrepresent developmental
  assessment or automate promotion.
- **Recommended `OPTION_A`:** print criterion ratings and approved remarks but
  hide an automatically derived overall grade; promotion/certification is a
  separate Principal-approved human decision, never calculated automatically.
- **Alternatives:** `OPTION_B` approve a written rubric-to-grade mapping;
  `OPTION_C` Teacher proposes and Principal approves a holistic overall grade.
- **Effects:** no numeric academic calculation; controls KG summary and
  certification blocks. Required before KG template promotion and configurable
  only through a new rubric/template version.

### RC-21 - GK/Value Education treatment

- **Topic and scope:** Primary and any Secondary family containing GK or Value
  Education.
- **Evidence/current behavior:** the Class V layout contains a GK/VE row, but
  the evidence does not prove numeric versus grade-only treatment.
- **Risk:** including an unclear row in totals changes percentage and rank.
- **Recommended `OPTION_A`:** grade-only using the approved co-scholastic
  rating set; exclude it from numeric total, percentage and rank.
- **Alternatives:** `OPTION_B` numeric marks included in total; `OPTION_C`
  numeric marks displayed but excluded from total; `OPTION_D` not applicable.
- **Effects:** controls numeric denominator and whether the row appears in the
  marks or skills table. Required before Primary template/formula promotion and
  configurable per scheme.

### RC-22 - General remarks author and approval

- **Topic and scope:** remarks on all report-card families.
- **Evidence/current behavior:** supplied families show comments/remarks. The
  current app permits broad non-Teacher comment editing and relies partly on
  role names.
- **Risk:** unauthorized text can be changed or published without clear
  ownership.
- **Recommended `OPTION_A`:** Class Teacher writes or selects from a
  Principal-approved bank; Principal may edit/approve; original and approved
  text remain in append-only history; Director approval is optional only where
  a family explicitly requires it.
- **Alternatives:** `OPTION_B` Teacher-only final remarks; `OPTION_C`
  Principal-only remarks.
- **Effects:** no calculation effect; controls the printed remark and approval
  audit. Required before remarks workflow and configurable by permission/family
  version.

### RC-23 - Principal correction and reopen authority

- **Topic and scope:** submitted, locked and published marks/results.
- **Evidence/current behavior:** current marks support corrections and report
  versions, but controlled reopen/ownership is incomplete.
- **Risk:** direct overwrite destroys history; unrestricted Super Admin/role
  checks bypass product authority.
- **Recommended `OPTION_A`:** Principal with explicit permission approves
  Teacher correction requests and may reopen a bounded result with a mandatory
  reason; permitted Super Admin is a governed fallback; reopening creates a new
  working/publication version and never edits an issued version.
- **Alternatives:** `OPTION_B` Principal only; `OPTION_C` Principal plus
  Director dual approval for published results.
- **Effects:** recalculates only a new version and prints a new publication
  number/version. Required before moderation/publication implementation;
  authority remains permission-configurable.

### RC-24 - Signature and acknowledgement fields

- **Topic and scope:** labels/approvals printed by family.
- **Evidence/current behavior:** KG shows Class Teacher, Principal,
  Parent/Guardian and Director; Class V shows Parent, Class Teacher and
  Principal/HM; Class IX shows Teacher, Principal, Parent and Director.
- **Risk:** a printed signature label can imply an approval or captured
  signature that does not exist.
- **Recommended `OPTION_A`:** LKG/UKG: Class Teacher, Principal and
  Parent/Guardian, with Director only on final promotion certification; I-V:
  Class Teacher, Principal/HM and Parent/Guardian acknowledgement; VI-X: Class
  Teacher and Principal, with Parent/Guardian acknowledgement and Director only
  for approved final/Class X families. Print labels/statuses, not a signature
  image unless separately governed.
- **Alternatives:** `OPTION_B` always print all four roles; `OPTION_C` Teacher
  and Principal only.
- **Effects:** no calculation effect; controls signature block height and
  approval prerequisites. Required before template promotion and configurable
  by family version.

### RC-25 - Historical compatibility and arithmetic defects

- **Topic and scope:** existing old PDFs and any imported historical report.
- **Evidence/current behavior:** Class V prints `0/0` with a non-zero
  percentage; Class IX Science does not equal its displayed paper average.
- **Risk:** recalculating old reports rewrites history; copying old arithmetic
  corrupts new results.
- **Recommended `OPTION_A`:** preserve old PDFs/snapshots exactly as historical
  artifacts, label known inconsistencies for authorized staff, and calculate
  all new publications only with approved versioned formulas. Never silently
  "fix" or overwrite an old issued report.
- **Alternatives:** `OPTION_B` regenerate corrected historical versions while
  retaining originals; `OPTION_C` import only images/PDFs with no structured
  calculation.
- **Effects:** new calculations use clean rules; print/history clearly
  distinguishes legacy from current versions. Required before migration/import
  design; future correction remains a new version.

### RC-26 - Class X revision and preboard reporting

- **Topic and scope:** Class X revision, preboard and combined/final internal
  reports.
- **Evidence/current behavior:** retained inventory reports preboard/revision
  layouts, but original PDFs and formulas are unavailable.
- **Risk:** an internal revision score could be mistaken for a Board result or
  silently weighted into another exam.
- **Recommended `OPTION_A`:** publish revision and preboard as separate,
  clearly labelled school-internal exam reports; do not call them Board results
  and do not combine them unless an explicit RC-09 scheme is approved.
- **Alternatives:** `OPTION_B` one combined Class X internal report;
  `OPTION_C` no Parent publication for revision tests.
- **Effects:** controls source weights, title, disclaimer and report family.
  Required before Class X template/formula implementation and configurable by
  exam version.

### RC-27 - Father name versus Guardian name

- **Topic and scope:** student identity block on all report cards.
- **Evidence/current behavior:** the current `Student` model has a required
  `fatherName`; governed Guardian links also exist. Old layouts may show a
  parent field.
- **Risk:** father-only display can be inaccurate or exclusionary and can
  conflict with the authorized Guardian relationship.
- **Recommended `OPTION_A`:** display `Guardian Name (Relationship)` from the
  approved primary Guardian link; use the legacy father-name field only as a
  fallback for unmigrated historical records; do not expose contact details.
- **Alternatives:** `OPTION_B` keep Father Name; `OPTION_C` show both Father and
  Mother; `OPTION_D` school-configured identity labels.
- **Effects:** no calculation effect; changes the identity block and future
  import requirements. Required before the new template/data contract and
  configurable only through a governed identity policy.

### RC-28 - Publication and versioning rule

- **Topic and scope:** every generated report.
- **Evidence/current behavior:** current report cards already preserve immutable
  versions, but full cohort publication/reopen and artifact tracking are
  incomplete.
- **Risk:** repeated generation or correction can duplicate records or replace
  evidence.
- **Recommended `OPTION_A`:** Principal result approval creates one immutable
  publication version bound to marks, formula, grade, attendance and template
  snapshots; identical regeneration is idempotent; corrections create a new
  version; the latest issued version is the default while prior versions remain
  authorized history.
- **Alternatives:** `OPTION_B` replace the prior PDF; `OPTION_C` one immutable
  version with no correction.
- **Effects:** freezes calculations and controls version/report labels in print.
  Required before publication implementation; the immutability rule must not be
  weakened later.

## 5. RECOMMENDED_DEFAULT_CAN_BE_CHANGED_LATER

There are 8 decisions in this group. The recommended answer is safe for the
first release and remains version/configuration controlled.

### RC-29 - Colour and monochrome chart design

- **Topic and scope:** numeric report charts.
- **Evidence/current behavior:** old reports show Student Marks, Class Average
  and Highest Score; no photocopy-safe pattern contract is evidenced.
- **Risk:** colour-only series become indistinguishable when photocopied.
- **Recommended `OPTION_A`:** colour mode plus a separate monochrome mode:
  Student solid, Class Average diagonal hatch, Highest dotted/cross-hatched;
  direct numeric labels and pattern legend; no meaning by colour alone.
- **Alternatives:** `OPTION_B` monochrome tables without charts; `OPTION_C`
  line-style chart.
- **Effects:** no calculation change; only rendering. Not required for IMPL-1,
  required before IMPL-2 print clearance, and configurable by template version.

### RC-30 - Merged PDF versus ZIP bulk output

- **Topic and scope:** section, class, multi-class and whole-cohort generation.
- **Evidence/current behavior:** real bulk PDF/ZIP generation is missing.
- **Risk:** one huge merged PDF can exhaust resources; per-student files can be
  awkward for staff.
- **Recommended `OPTION_A`:** individual PDF for one student; bounded merged PDF
  for one section/class; ZIP with deterministic per-student PDFs and manifest
  for large, multi-class or whole-cohort requests; allow both where within
  limits.
- **Alternatives:** `OPTION_B` ZIP only; `OPTION_C` merged PDF only.
- **Effects:** no calculation change; changes packaging/download UI. Can be
  finalized during IMPL-2 and adjusted through generation policy.

### RC-31 - Print identity, typography and section order

- **Topic and scope:** all promoted template families.
- **Evidence/current behavior:** architecture specifies A4 portrait, school
  identity and Georgia Bold where approved; exact broader family order is not
  fully revalidated.
- **Risk:** squeezed layouts or inconsistent branding reduce readability.
- **Recommended `OPTION_A`:** A4 portrait; approved logo; Georgia Bold school
  name with a safe fallback; identity, exam, marks, co-scholastic, summary,
  attendance, remarks, chart, legend and signatures in family-appropriate
  order; paginate rather than shrink many subjects.
- **Alternatives:** `OPTION_B` school-supplied custom design; `OPTION_C` plain
  printer-first typography.
- **Effects:** no calculation change; controls layout/pagination. Can be
  refined before IMPL-2 promotion through a new template version.

### RC-32 - Parent/Student access and download history

- **Topic and scope:** access after publication.
- **Evidence/current behavior:** Parent linked-child issued-only access and
  `no-store` responses exist; Student self-access and audited downloads are
  incomplete.
- **Risk:** draft/cross-child exposure or unaudited private downloads.
- **Recommended `OPTION_A`:** Parent sees issued reports only for active linked
  children; every PDF download is audited; ordinary page views may be recorded
  as bounded access events; Student self-access waits for an approved Student
  IAM link.
- **Alternatives:** `OPTION_B` audit downloads only; `OPTION_C` Parent access
  disabled initially.
- **Effects:** no calculation/print change; controls portal visibility and
  audit. Security defaults apply immediately; detailed audit policy can change
  later.

### RC-33 - Report and access-event retention

- **Topic and scope:** publication artifacts, manifests and view/download
  events.
- **Evidence/current behavior:** no approved retention duration is recorded.
- **Risk:** premature deletion loses academic history; indefinite detailed
  access logs create unnecessary privacy/storage burden.
- **Recommended `OPTION_A`:** do not auto-delete issued academic report
  publications; retain checksums/version metadata with them; retain detailed
  access/download events for three academic years pending a separately approved
  legal/privacy retention schedule.
- **Alternatives:** `OPTION_B` seven-year access-event retention; `OPTION_C`
  permanent access events; `OPTION_D` custom policy.
- **Effects:** no calculation or visible print change; affects storage/audit.
  Can be configured later before production cleanup jobs are enabled.

### RC-34 - Academic-year and class-section reconciliation

- **Topic and scope:** existing string academic years/classes versus future
  governed masters.
- **Evidence/current behavior:** multiple modules store normalized strings; no
  authoritative versioned academic offering exists.
- **Risk:** spelling/string drift can bind an exam to the wrong cohort.
- **Recommended `OPTION_A`:** preserve existing labels unchanged as historical
  aliases, introduce governed Academic Year and class-section offerings, and
  map/rehearse on a copied database before any operational migration.
- **Alternatives:** `OPTION_B` continue strings; `OPTION_C` rewrite all old
  labels in place.
- **Effects:** affects configuration binding, not old calculations/print.
  Technical mapping can be refined during IMPL-1 but must pass copied-DB
  approval before operational use.

### RC-35 - Co-teaching and overlapping marks assignments

- **Topic and scope:** two Teachers assigned to the same exam/paper/component.
- **Evidence/current behavior:** timetable scope exists; exam-specific
  assignments do not.
- **Risk:** overlapping authority can cause conflicting drafts/submissions.
- **Recommended `OPTION_A`:** reject overlap by default; explicit co-teaching
  requires a Principal-approved primary owner plus named contributors, with one
  final submission owner and complete audit.
- **Alternatives:** `OPTION_B` multiple equal editors; `OPTION_C` one Teacher
  only with no co-teaching.
- **Effects:** no formula/print change; controls entry concurrency and ownership.
  Can be adjusted through assignment policy after the safe default ships.

### RC-36 - Examination notifications

- **Topic and scope:** entry opening/closing, correction and publication.
- **Evidence/current behavior:** a notification centre exists, but exams are not
  integrated.
- **Risk:** external messages could be sent without consent or duplicate
  internal workflow events.
- **Recommended `OPTION_A`:** first release uses private in-app notifications
  only: Teacher assignment/opening, closing reminder, correction decision and
  Parent publication availability; no WhatsApp/SMS/email.
- **Alternatives:** `OPTION_B` no notifications; `OPTION_C` separately approved
  provider channels later.
- **Effects:** no calculation/print change. Safe to add after core workflow and
  configurable through notification policy.

## 6. SAFE_TO_DEFER

There are 4 decisions in this group. Deferral must keep the feature disabled,
not guessed.

### RC-37 - Student photo on report cards

- **Topic and scope:** all template families.
- **Evidence/current behavior:** photos are not required by the directly
  reviewed evidence.
- **Risk:** photos add private assets, print complexity and external-processing
  risk.
- **Recommended `OPTION_A`:** no student photo in the first release.
- **Alternatives:** `OPTION_B` optional governed local photo; `OPTION_C`
  family-specific photo.
- **Effects:** no calculation effect; simplifies identity/layout. Safe to defer
  and later add only with approved asset/privacy controls.

### RC-38 - Alternative mark for an exemption

- **Topic and scope:** an `EXEMPT` component/subject.
- **Evidence/current behavior:** no approved substitute-mark rule is evidenced.
- **Risk:** an invented substitute can inflate totals or hide the exemption.
- **Recommended `OPTION_A`:** exclude the exempt item from numerator and
  denominator, require reason/approval, and print `EX`; no alternative mark.
- **Alternatives:** `OPTION_B` approved cohort average substitute; `OPTION_C`
  approved prior-exam substitute.
- **Effects:** controls denominator and `EX` label. Safe default supports
  implementation; any substitute policy is deferred to a new formula version.

### RC-39 - Student accounts and teacher-parent context switching

- **Topic and scope:** Student self-access and staff users who are also parents.
- **Evidence/current behavior:** Parent linked-child access exists; Student IAM
  and dual context are not approved.
- **Risk:** premature context switching can expose staff or child records.
- **Recommended `OPTION_A`:** keep Student self-access and teacher-parent
  switching disabled until IAM-1A defines links, claims, switching and session
  invalidation; preserve Parent access separately.
- **Alternatives:** `OPTION_B` Student accounts in the report-card phase;
  `OPTION_C` separate permanent staff/parent accounts.
- **Effects:** no calculation/print change; portal access only. Safe and
  required to defer under the current IAM gate.

### RC-40 - AI-assisted remark suggestions

- **Topic and scope:** future drafting of report remarks.
- **Evidence/current behavior:** no AI remark workflow is implemented or
  approved.
- **Risk:** private data disclosure, hallucinated statements or automatic
  publication.
- **Recommended `OPTION_A`:** keep AI remarks disabled; ordinary remark bank and
  Teacher/Principal workflow ship first.
- **Alternatives:** `OPTION_B` later privacy-approved suggestions using minimum
  structured data and mandatory human approval; `OPTION_C` never allow AI
  remarks.
- **Effects:** no calculation/print change; only the source of a draft remark.
  Safe to defer and separately privacy-gated.

## 7. Compact leadership answer form

Copy this block and change only answers that leadership does not approve.
`OPTION_A` is the recommendation for every line.

```text
RC-01=OPTION_A  # reacquire/hash sources; approve exact family mapping
RC-02=OPTION_A  # versioned components/maxima; seed only evidenced 10+40
RC-03=OPTION_A  # separate KG/I-V and VI-X grade scales
RC-04=OPTION_A  # hide grade points until explicit values are approved
RC-05=OPTION_A  # decimal, six-place intermediate, half-up two-place output
RC-06=OPTION_A  # normalized equal-weight English paper average
RC-07=OPTION_A  # normalized equal-weight Science paper average
RC-08=OPTION_A  # normalized equal-weight Social paper average
RC-09=OPTION_A  # combined reports disabled until weights total 100%
RC-10=OPTION_A  # missing combined source blocks calculation/publication
RC-11=OPTION_A  # five explicit states; PRESENT zero is valid
RC-12=OPTION_A  # ABSENT prints AB and contributes zero with denominator kept
RC-13=OPTION_A  # no KG/I-V fail label; VI-X summative minimum 35%
RC-14=OPTION_A  # rank hidden LKG-V/CT; optional VI-X summative rank
RC-15=OPTION_A  # class-section competition rank; no hidden tie-breaker
RC-16=OPTION_A  # comparable percent statistics in class-section cohort
RC-17=OPTION_A  # explicit inclusive range from locked attendance
RC-18=OPTION_A  # instructional locked days; half-day 0.5 when supported
RC-19=OPTION_A  # three versioned co-scholastic families; no numeric roll-up
RC-20=OPTION_A  # no automatic KG overall grade/promotion
RC-21=OPTION_A  # GK/VE grade-only and excluded from numeric total
RC-22=OPTION_A  # Class Teacher writes; Principal approves; history retained
RC-23=OPTION_A  # permissioned Principal reopen; reason and new version
RC-24=OPTION_A  # family-specific signatures/acknowledgements
RC-25=OPTION_A  # preserve old reports; flag defects; never overwrite
RC-26=OPTION_A  # separate internal Class X revision/preboard reports
RC-27=OPTION_A  # Guardian Name (Relationship); father-name legacy fallback
RC-28=OPTION_A  # immutable idempotent publication versions
RC-29=OPTION_A  # colour plus pattern-safe monochrome chart
RC-30=OPTION_A  # merged PDF for bounded class scope; ZIP for large scope
RC-31=OPTION_A  # A4 portrait, approved identity, readable pagination
RC-32=OPTION_A  # linked-child issued-only access and audited downloads
RC-33=OPTION_A  # reports retained; access events three academic years pending review
RC-34=OPTION_A  # governed masters with copied-DB alias reconciliation
RC-35=OPTION_A  # reject overlap unless explicit primary-owner co-teaching
RC-36=OPTION_A  # private in-app exam notifications only
RC-37=OPTION_A  # no student photo in first release
RC-38=OPTION_A  # EXEMPT excluded; no substitute mark
RC-39=OPTION_A  # defer Student/dual context until IAM-1A
RC-40=OPTION_A  # AI remark suggestions disabled
```

Leadership may also approve all recommendations with:

```text
EXAM-RC-DECISIONS-1=APPROVE_ALL_OPTION_A
```

That approval should be recorded before implementation begins. A custom answer
must name the affected Decision ID and supply enough detail to make the rule
testable.

## 8. Next gate

Architecture planning is complete. Implementation remains paused until
leadership answers the 28 `MUST_DECIDE_BEFORE_IMPLEMENTATION` items or explicitly
approves their `OPTION_A` recommendations. The eight recommended defaults and
four safe deferrals are already implementation-safe if `OPTION_A` is approved.

After approval, the next phase is `EXAM-RC-IMPL-1`. Approval does not authorize
`EXAM-RC-IMPL-2`, operational database migration, production publication,
AUTH-2B, IAM-1A, deployment, DNS, provider creation or payment.
