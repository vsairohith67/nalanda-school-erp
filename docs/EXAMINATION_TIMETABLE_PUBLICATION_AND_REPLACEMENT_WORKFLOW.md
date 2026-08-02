# Examination Timetable Publication and Replacement Workflow

An authorised Principal or explicitly permitted leadership user selects an existing active examination and its exact active class/optional-section scope. The editor can create or clone a version, add one row per active subject paper, preview the Parent projection, inspect conflicts and history, then mark the version ready.

Validation requires every active paper, dates inside the examination window, end after start, reporting time no later than start, unique papers/display order, no overlapping paper in the version, no overlap with another current published timetable for the exact cohort, and a still-active examination/scope/class section. Empty or stale versions cannot publish.

Publication requires the exact optimistic version and a bounded reason. The transaction revalidates authorization and conflicts, uses compare-and-set updates, writes publication evidence and appends an audit event. Retrying an already completed request is safe; idempotency keys prevent duplicate draft creation.

Changes after publication begin by cloning the current published version. Publishing the replacement requires both publication and replacement reasons. One serializable transaction marks the prior version `REPLACED`, clears its current key, links the new version, publishes the successor and appends both events. A stale replacement is refused. Withdrawal records actor, reason and timestamp and clears Parent visibility without deleting history.

Teacher marks assignments do not confer timetable publication authority. There are no state-changing GETs, native browser prompts, hard deletion, live messages or provider calls.
