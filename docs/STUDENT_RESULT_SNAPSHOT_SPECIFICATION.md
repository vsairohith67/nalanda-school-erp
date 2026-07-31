# Student Result Snapshot Specification

`StudentResultSnapshot` is an append-only Student result version. One
calculation run shares a deterministic run ID and input fingerprint across the
exact cohort.

Each snapshot records:

- examination, class scope, Student and frozen base scheme;
- run number and Student snapshot version;
- component marks, entry states, maximums, weights and contributions;
- source mark-entry IDs and row versions;
- source sheet version IDs and source scheme version IDs;
- paper and explicit group results;
- total, maximum and percentage;
- grade/point, pass result and rank only when enabled;
- cohort average and highest;
- locked attendance reference;
- warnings, formula version and rounding version;
- calculation actor and timestamp.

Recalculation after a governed correction creates a new fingerprint, run and
Student snapshot version. Earlier snapshots remain queryable. Calculation lock
is an append-only audit event for the run and changes each exact current source
sheet to `LOCKED`; the arithmetic payload is not rewritten.

These snapshots prepare a stable source for EXAM-RC-IMPL-3. They do not issue,
publish, deliver or render report cards.
