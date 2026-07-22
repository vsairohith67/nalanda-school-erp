# Teacher Performance Analytics and Review Foundation

Prompt 17D adds evidence-based Teacher workload, operational workflow, source-quality, and aggregate Student-outcome context. It creates no composite score, no ranking or leaderboard, no automatic employment decision, no AI conclusion, and no disciplinary or compensation recommendation. Analytics must never be the sole basis for an employment decision.

## Fairness and privacy contract

- Category metrics are contextual evidence. Higher or lower values have no automatic value judgment.
- Teachers handling different classes, subjects, age groups, or assessment formats are not treated as directly equivalent.
- Approved leave is displayed separately and is never converted into unexplained absence or a punitive rate.
- Substitute support and periods requiring cover are context, not negative performance.
- Student outcomes are aggregate observations. They do not establish that a Teacher caused an increase or decrease.
- The default minimum cohort is 5. Below the configured minimum cohort, the output is `Insufficient cohort size`.
- Outcome comparison requires the same academic year, class/section, subject, assessment type/component, compatible maximum marks, and a compatible/intersected cohort.
- Student names, admission numbers, contacts, raw marks, sensitive attributes, and child-level KG responses are excluded from analytics snapshots, reports, and CSV.
- Parent and Student accounts have no access. Ordinary Teachers see only their own explicitly shared or finalised review.

## Data model and immutability

Backup version 26 includes:

- `TeacherAnalyticsReviewCycle`: preserved leadership review period and workflow.
- `TeacherAnalyticsSnapshot`: one validated evidence snapshot per cycle and StaffMember, with provenance, source states, and SHA-256 hash.
- `TeacherAnalyticsReview`: factual leadership notes, separate Teacher response, sharing, and finalisation.
- `TeacherAnalyticsEvent`: append-only cycle, snapshot, review, share, response, finalisation, archive, cancellation, and correction history.

Finalised cycles, snapshots, and reviews are never hard deleted or overwritten. An unshared draft snapshot may be regenerated only through `Regenerate Draft Snapshot`; the prior hash and reason are preserved. Finalised reviews cannot be regenerated.

## Workflow

1. Leadership opens `/teacher-analytics/new`, previews eligible Teachers and source availability, and creates a draft cycle.
2. `Open Analytics Review Cycle` freezes the metric definition version.
3. `Generate Teacher Snapshots` writes the eligible set transactionally.
4. Leadership reviews category provenance, period, definition, completeness, cohort size, calculation time, sensitivity, and warning.
5. Leadership records factual notes; the system never generates notes or allegations.
6. `Share Review with Teacher` exposes shared notes and own evidence only to the linked Teacher.
7. The Teacher may submit or update a response until finalisation. It does not overwrite leadership notes and is not a legal acknowledgment or admission.
8. `Finalise Teacher Review` makes the review immutable.
9. `Finalise Analytics Cycle` requires every included review to be finalised.
10. A finalised cycle may be archived. Draft/open cycles may be cancelled with a reason.

All state-changing dialogs are accessible in-app dialogs with explicit action names. Native `alert`, `confirm`, and `prompt` are not used. Workflow writes repeat server permissions and compare-and-set checks.

## Evidence and data quality

Versioned definitions live in `lib/teacher-analytics-definitions.ts`. Categories cover workload/timetable and substitute periods; staff attendance and approved leave; Homework workflow; marks-sheet workflow and status context; aggregate compatible locked-assessment outcomes; mark-based report cards; and KG Evaluation I-V, rubrics, personality, attendance, growth, comments, and submission.

Sources use `COMPLETE`, `PARTIAL`, `INSUFFICIENT`, `NOT_APPLICABLE`, or `SOURCE_MISSING`. Missing evidence is never displayed as zero. Assignment count is an activity indicator, not a quality measure. Correction count is not a negative label. KG grade distributions are not used to judge Teacher quality.

## Permissions

- Super Admin and Director: all permissions.
- Principal: identified analytics, cycles, snapshots, review/share/finalisation, reports, and export.
- Admin: no access by default because the module is employment-sensitive.
- Teacher: own shared/finalised evidence and response only; no peer data or export.
- Viewer/Auditor: aggregate school totals only; no identity, notes, or export.
- Accountant and Parent: no access.

Navigation follows effective DB-backed permissions. Direct pages and APIs repeat server-side permission and ownership checks.

## Reports, CSV, backup, and restore

Leadership reports cover cycle/review completion and source states. CSV uses formula-safe cells and an explicit allowlist. It excludes Student identity, admission numbers, raw marks, Teacher contacts/address/bank/tax data, actor IDs, leave reasons, password hashes, ranks, and performance labels.

Backup version 26 writes four analytics arrays without password hashes or actor IDs. Restore accepts older backups without those arrays, validates exact cycle/snapshot/StaffMember/review/event links, isolates same-code/different-ID collisions, preserves immutable local history, and is idempotent.

## Known limitations and Prompt 18A boundary

- A dedicated class-Teacher assignment is not reliably represented, so report-card/KG attribution is partial/contextual.
- Homework attribution is exact with a linked creator account; timetable-scope fallback is partial.
- Outcome comparison is deliberately conservative; incompatible or unlocked sources are excluded and no causal claim is made.
- Scheduled working days use available official attendance sessions; no calendar denominator is invented.
- No biometric/location surveillance, hidden monitoring, AI conclusion, automatic allegation, notification, payroll action, promotion, termination, or compensation workflow is added.

Prompt 18A remains outside this foundation. Do not widen Prompt 17D into unrelated HR, payroll, disciplinary, AI, notification, Student progression, or data-entry automation.
