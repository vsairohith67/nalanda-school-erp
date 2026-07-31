# EXAM-RC-IMPL-3-QA Independent Publication and PDF QA Closure

Date: 2026-07-31

Feature branch: `feature/report-publication-parent-pdf`

Authoritative starting baseline: `93fcfc179e00c7b5ebecb761af0ccb2d5adffcdd`

Backup format: 37

Cloud deployment: not authorised and not performed

## Independent copied-database matrix

A fresh ignored copy was populated only with uniquely namespaced `EXAM3QA`
records. Five initial Students covered KG, primary, secondary and configured
combined families; two linked children and one unrelated child exercised the
Parent boundary. Independent concurrency and failure fixtures increased the
audit copy to seven Students without touching the operational database.

The audit proved exact report-to-locked-snapshot fingerprints, snapshot and run
versions, frozen formula/rounding/template/grading/attendance/signature rules,
explicit zero/absent/exempt/not-applicable states, and configured combined
weights. Incomplete, unlocked and superseded calculations were refused.
Duplicate and concurrent publication requests produced one immutable current
version; a forced database failure rolled back the complete batch with no
partial active publication. Replacement retained its predecessor link and
withdrawal preserved status history.

Exact Principal permission checks and server-side object authorisation denied
Parent, Teacher, Accountant and Viewer publication attempts. Parent queries
returned only linked children and current issued content. Raw Student IDs,
unrelated children, cross-family references and replaced/withdrawn content
failed closed. View and download authorisations were actor-bound, expiring,
private/no-store and privacy-safe in audit history.

## PDF and bulk evidence

Eight independently generated visual fixtures covered each family in colour
and monochrome. `pdfinfo` and page-by-page raster inspection confirmed:

- KG: 4-page A4 portrait in both modes;
- primary: 2-page A4 portrait in both modes;
- secondary grouped/personality: 3-page A4 portrait in both modes;
- configured combined result: 3-page A4 landscape in both modes.

Student/exam identity, explicit mark states, totals, percentages, grades, grade
points, enabled pass/rank, attendance, skills/personality, remarks, legends,
signature spaces and public publication/version references matched the locked
snapshots. No internal database ID appeared. Long names, subjects, components
and remarks wrapped without clipping, overlap, orphan headings, tiny text,
blank trailing pages or broken page numbers. Monochrome percentage bars used
hatching and direct labels rather than colour alone. Printer-safe margins were
visually clear on every first, continuation and final page.

Individual, class/section selection, merged PDF and ZIP packaging were checked
for deterministic sanitised names, one file per selected Student, no duplicate
or missing output, two-worker concurrency, failed-item-only retry, rollback and
authenticated expiring delivery. No predictable public path was exposed.

## Browser and accessibility evidence

Principal and Parent flows passed at 1366x768 and 390x844 in light and dark
application themes. Principal readiness, blocker text, exact preview,
publication/version history, replacement/withdrawal controls and batch progress
were present. Parent linked-child switching showed a withdrawn KG history row,
an issued secondary version 2, its replaced version 1 history, authenticated
view and colour/B&W actions. Direct raw-ID tampering returned no private data.

Measured report content fit 362 px inside the 390 px viewport. The document had
zero horizontal overflow, governed actions were at least 44 px, accessible
names were present, and there were no native dialogs, console errors or
hydration errors. The application theme did not affect the independently
rendered PDF mode. The production runtime emitted no stderr; the temporary
development runtime and all logs were destroyed during cleanup.

## Backup, restore and cleanup

The audit created a credential-free version-37 backup, restored it once and
twice into a fresh isolated database, and confirmed identical publication,
version, event and withdrawn counts. Issued versions and replacement links were
preserved; no PDF artifact was duplicated by restore.

All `EXAM3QA` Students, users, marks, snapshots, publications, audits, copied
and restore databases, PDFs, ZIPs, rendered pages, job state, runtime files and
logs were destroyed. Cleanup inspection passed twice. The operational business
baseline remained zero.

## Final verification and release

The final clean-state command suite passed:

- `pnpm.cmd routes:list`: 281 page routes and 409 API routes;
- `pnpm.cmd lifecycle:backfill`: 0 active Students scanned and 0 writes;
- `pnpm.cmd typecheck`: application, tools and all split test projects passed;
- `pnpm.cmd test`: 175 files and 1,610 tests passed;
- `pnpm.cmd build`: 223 pages with the bounded 4 GB Node heap;
- `pnpm.cmd backup`: version-37
  `nalanda-fee-control-backup-2026-07-31-17-15.json`;
- `pnpm.cmd git:safety-check`: candidate, staged and tracked scans passed.

Release closure requires the pushed retained feature branch, fast-forwarded
`main` and annotated `exam-report-publication-v37-2026-07-31` tag to resolve to
one identical commit. The private remote ref check is performed after the final
commit. No cloud deployment is authorised by this closure.
