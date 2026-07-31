# EXAM-RC-IMPL-3 Implementation Checkpoint

Date: 2026-07-31

Branch: `feature/report-publication-parent-pdf`

Authoritative base: `93fcfc179e00c7b5ebecb761af0ccb2d5adffcdd`

Backup format: 37

Deployment: not authorised

## Implemented

- Principal readiness, exact preview, individual/section/class publication,
  immutable versions, withdrawal and linked replacement.
- Parent issued-only linked-child list, authenticated view, colour PDF and
  printer-safe black-and-white PDF delivery.
- KG, primary, secondary and configured-combined safe snapshot families.
- A4 portrait and governed landscape rendering, embedded fonts/branding,
  deterministic safe names, merged PDF and ZIP packaging.
- Server-side object authorisation, origin/CSRF and no-store controls,
  expected-version protection, idempotency, bounded batch/concurrency,
  expiring download capabilities, safe rollback and append-only audit.
- Responsive Principal and Parent UI with custom confirmation dialogs,
  keyboard-labelled controls, 44 px actions and controlled table overflow.

No Prisma model or migration was required; existing immutable report-card
version and examination-audit records are reused. Approved marks, calculation
formulas, calculation runs and locked result snapshots are unchanged.

## Copied-database implementation evidence

The ignored EXAM3 harness copied the operational database before creating five
synthetic Students, four template families, six locked snapshots, five current
issued cards and six immutable publication versions. It covered two linked
children and one unrelated child, absent/zero/exempt/not-applicable states,
long names/labels, a linked replacement, concurrent merged/ZIP jobs and an
injected PDF failure. Inspection reported 20 governed audit events and eight
visual PDFs. The operational database remained at the zero-business baseline.

Manual PDF review covered KG colour/B&W, primary B&W, secondary multipage and
combined landscape output. Attendance, remarks, legend and signature blocks
remain together; no clipped table, orphaned final block or blank trailing page
was observed. Monochrome output includes hatching and direct labels.

Browser QA covered Principal and Parent at 1366x768 and 390x844 in light and
dark themes. Exact preview, publish confirmation, replacement history,
linked-child selection, issued-only view, raw-ID refusal and report rendering
passed with 44 px actions, controlled table overflow, no native dialog, zero
console logs and zero production stderr. A mobile report-sheet width defect was
found and corrected; the authenticated report then measured 362 px inside the
390 px viewport with zero document overflow.

## Final implementation verification

- routes: 281 page and 409 API routes;
- lifecycle backfill: 0 active Students scanned, 0 writes;
- typecheck: application, tools and all split test projects passed;
- tests: 175 files and 1,610 tests passed;
- production build: 223 pages passed with a bounded 4 GB Node heap;
- backup: version-37 `nalanda-fee-control-backup-2026-07-31-16-28.json`;
- Git safety: candidate, staged and tracked scans passed;
- cleanup: zero `EXAM3` or `tmp/report-publication` residuals;
- operational baseline: 0 Students, 0 active enrollments, 0 payments, 0
  collected, 0 report cards and 0 report-card versions.

## Gate

At this implementation checkpoint, independent `EXAM-RC-IMPL-3-QA` remained
required before merge, tag, release or any operational use. That gate was
subsequently cleared on 2026-07-31; see
`../EXAM_REPORT_PUBLICATION_QA_CLOSURE.md`. No cloud deployment is claimed or
authorised.
