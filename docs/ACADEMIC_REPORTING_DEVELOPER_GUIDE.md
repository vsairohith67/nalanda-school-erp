# Academic Reporting Developer Guide

The source boundary is `lib/academic-reporting-sources.ts`. It requires current
issued report-card rows and linked locked result snapshots, verifies exact
Student/version/formula/rounding/maximum agreement, and resolves active role
scope server-side. `lib/academic-reporting.ts` validates bounded parameters,
applies compatibility rules, builds summaries and persists deterministic runs.

All mutating operations use authenticated POST requests with existing
CSRF/origin controls. Responses use private `no-store`. Exam lists are bounded
to 12 and source rows to 2,000. Exports are in-memory and use deterministic safe
filenames. No external network or AI client is called.

The additive migration creates four tables: definition, run, exact source
reference and audit event. Run/source/audit update/delete triggers enforce the
append-only contract. Version-37 backup includes all four collections but
removes actor IDs; restore validates hashes, JSON, links and supersession before
rebinding actors to the local restore operator.

Run `pnpm qa:23g` for the copied-database matrix. It deploys the migration twice
to isolated copies, seeds `REPORT23G` raw/weighted, compatible/incompatible,
state, group, tie, multi-section, board-class and privacy fixtures, exercises
concurrency/rollback and restores backup twice, then deletes the harness and
proves the operational SQLite artifacts are unchanged.
