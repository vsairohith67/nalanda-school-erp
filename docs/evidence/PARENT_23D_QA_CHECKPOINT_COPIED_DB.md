# Prompt 23D-QA Copied-Database Checkpoint

Date: 2026-08-02
Branch: `feature/parent-attendance-exam-timetable`
Reviewed implementation range: `9fe5c2b928c2c84bc2e4c739d5bf377ce1501fc7..f0e033a824f97b094dc0f0d7a3d05aff07c4a68c`

## Independent security review

- Codex Security scan: `55edbe76-cff1-4693-8c3b-b787ae079753`.
- Coverage: 34 of 34 full-file discovery receipts complete; no deferred rows.
- Candidate closure: four of four candidates contain discovery, validation, and attack-path receipts.
- Result: zero reportable security findings. Three terminal-state compare-and-set candidates were classified as privileged, read-only correctness defects; the copied operational-baseline verifier candidate was classified as local release-tool correctness debt.
- Canonical scan result was sealed with complete coverage and a generated markdown report.

## QA corrections

- Published, withdrawn, and archived lifecycle retries now succeed only for the exact immediately completed request: prior expected version, same actor, and identical governed reason fields.
- Arbitrary stale versions, changed actors, and changed reasons fail with `EXAM_TIMETABLE_STALE_VERSION`.
- Exact retries append no duplicate timetable event.
- The operational verifier now requires exactly four protected users, four matching canonical role assignments, zero permission profiles/entries/versions/assignments/overrides, zero sessions, and zero active child contexts.
- An adversarial copied-database Parent insertion makes the operational verifier fail closed while the operational database hash remains unchanged.

## Fresh `PARENT23DQA` copied-database evidence

Command: `pnpm.cmd qa:23dqa`

Result: `PARENT23DQA_COPIED_DATABASE_QA_PASSED`

Proved:

- exact one-child and multi-child Parent scope;
- opaque child-handle tampering and cross-family reuse denial;
- Teacher + Parent and Director + Parent context separation;
- inactive, expired, removed-link, removed-role, and revoked-session denial;
- exact official attendance counts across all existing approved states, with no inferred percentage or working-day formula;
- no draft or withdrawn timetable disclosure to Parent;
- invalid time, duplicate paper, foreign paper, overlap, empty publication, and stale version refusal;
- one-event concurrent publication protection and exact retry idempotency;
- replacement visibility, preserved archived history, withdrawal policy, immutable rows, and append-only events;
- forced transaction rollback;
- version-37 backup validation with no credential-bearing fields;
- fresh migration plus two deploy passes, clean migration status, and two idempotent full-graph restore passes;
- full restore preserved exact Student, Guardian-to-Student, enrollment, official attendance session/record, timetable version/row/event, publication-link, and audit counts;
- byte-identical operational database before and after the matrix.

The expanded full-graph rehearsal found and corrected an existing nested-transaction defect: the top-level restore already supplied a Prisma transaction client, while examination-timetable restore attempted to start another transaction on that client. Timetable restore now starts a transaction only when called with a root client and otherwise reuses the enclosing full-restore transaction. The complete version-37 restore then passed twice with exact count idempotence.

## Cleanup and operational baseline

- `PARENT23DQA` copied databases and fixture directories: zero remaining on two inspections.
- Operational baseline: 0 Students, 0 active enrollments, 0 Payments, INR 0, 0 Guardians, 0 Staff.
- Protected accounts: exactly one active `SUPER_ADMIN`; `ADMIN`, `ACCOUNTANT`, and `VIEWER` inactive.
- IAM: four matching canonical role assignments; zero profiles, profile entries, profile versions, profile assignments, overrides, sessions, or active child contexts.

No staging, deployment, live provider, or real-user onboarding was performed or authorised.
