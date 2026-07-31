# Examination Calculation Specification

Formula version: `RC_CALC_V1_PAPER_NORMALIZED`.

Rounding version: `RC05_V1_DECIMAL6_HALF_UP2` (six intermediate decimals,
half-up, then two output decimals).

## Paper modes

For `RAW_SUM`, add included obtained component marks and included component
maximums. Paper percentage is `obtained / maximum × 100`.

For `WEIGHTED_NORMALIZED`, each included contribution is:

`obtained / component maximum × component weight`

The included weights form the paper maximum. Active weighted configurations
must have safe positive denominators and configured weights; scheme activation
continues to enforce exact 100 percent where required.

## Entry-state policy

- `NOT_ENTERED`: block calculation.
- `PRESENT`: use the numeric mark; zero remains zero.
- `ABSENT`: use zero under approved policy v1.
- `EXEMPT`: exclude the component.
- `NOT_APPLICABLE`: exclude the component.

No global pattern is inferred. Subject groups are calculated only from active
`ExamSubjectGroup` membership and its explicit mode/weights. Weighted group
members must total exactly 100 percent.

The active frozen grade-scale version is used when present. Pass/fail and rank
are produced only when enabled by the frozen base scheme. Rank uses
competition rank with stable admission-number ordering for deterministic ties.
Cohort average and highest use only the exact class/section enrollments.
Attendance references only locked sessions inside the examination date range.

A source fingerprint covers examination, scope, formula version, state policy,
sheet IDs, sheet versions, row versions, states and marks. An identical rerun
returns the existing preview rather than creating duplicate snapshots.
Calculation requests are limited to five per actor per minute.
