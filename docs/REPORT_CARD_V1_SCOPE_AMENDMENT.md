# Report-Card V1 Scope Amendment

> **Acceptance closure — 2026-08-14:** Classes I-X later completed R8 digital and physical colour/native-monochrome/photocopy acceptance under `REPORT_PRINT_ACCEPTANCE_CLEARED`. The pending status and pre-acceptance narrative below are retained as the dated scope-amendment record. KG/LKG/UKG remains preserved, default-off and deferred to V1.5.

**Decision:** `REPORT-PRINT-ACCEPT-1A-SCOPE-AMENDMENT-2026-08-12`<br>
**Branch:** `reporting/canonical-template-print-acceptance`<br>
**Status:** R8 final Classes I-X digital review and paused physical candidates generated; physical printing remains paused

## Product-scope split

| Requirement | Product scope | Status | Release consequence |
| --- | --- | --- | --- |
| Classes I-X report cards | V1 | `IN_PROGRESS_PHYSICAL_ACCEPTANCE_PENDING` | CT, Session, Revision, Preboard and Combined layouts remain required where configured, with colour/true-monochrome output, private Parent delivery, correction versions, individual/batch/merged/ZIP delivery, and digital plus physical acceptance. |
| LKG/UKG developmental report cards | V1.5 | `IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5` | Existing renderers, tests, migrations, commits and ignored evidence are preserved. New KG template activation, binding, batch generation, entry, issue and correction are disabled by the existing default-off release-feature-flag system for V1. |

This is a deferral, not a rejection, deletion or rollback. Existing issued and historical reports remain readable through their immutable snapshots. A Super Admin technical view may show **KG report-card family — planned for V1.5**; ordinary operational controls do not expose the dormant family.

## Preserved Classes I-X design

The approved `NALANDA_LEGACY_REFINED_COLOUR` and `NALANDA_LEGACY_REFINED_MONOCHROME` base remains frozen. This amendment does not redesign the one-page architecture, logo/header, Georgia Bold school name, dynamic components/maxima, grade-scale versioning, immutable publication snapshots, zero/AB/EX/NE/NA states, group calculations, cohort statistics, private Parent delivery or true-monochrome rendering.

## R5 consolidated correction register

The user confirmed this 29-item register complete for R5. The items below are implemented in both approved Classes I-X variants and covered by focused synthetic rendering tests. This does not authorise a physical pack, printing, merge, tag, deployment or report publication.

### Header and identity

1. Restore an approved school-status line below the school name where configured.
2. Read affiliation, recognition and establishment wording only from approved School Settings.
3. Never hard-code an affiliation claim.
4. Use one consistent admission-number label, currently proposed as `Admission No. #`.
5. Keep Class/Section and Roll Number in separate cells.

### Layout

6. Remove the large unused area beside shortened marks tables.
7. Rebalance marks, co-scholastic grades, summaries, remarks, chart and signatures.
8. Provide genuine physical signing space for Class Teacher, Principal, Parent / Guardian and Director.
9. Keep the signature line above each label.
10. Keep adequate clear vertical space for handwriting.

### Co-scholastic grading legend

11. Use one readable legend: `G — Good   S — Satisfactory   N — Needs Improvement`.
12. Do not allow `Needs Improvement` to split awkwardly inside a narrow cell.

### Charts

13. Increase chart-number legibility.
14. Prevent adjacent numbers from appearing as one value.
15. Use controlled staggering and collision detection.
16. Use no more than one displayed decimal place.
17. Keep exact values in the marks table.
18. Preserve complete subject labels or an explicitly configured short chart label.
19. Do not silently drop words from chart labels.

### Colour and paper

20. Use pure white `#FFFFFF` as the Classes I-X academic report background.
21. Pale teal section headers and borders may remain.
22. KG colours are outside V1 and are not part of this correction pass.

### Display precision

23. Use at most one Parent-facing decimal place for component results, group results, subject totals, overall total, percentage, grade point, class average, high score and chart values.
24. Preserve full internal calculation precision.
25. Use one deterministic rounding rule across the frozen report snapshot.
26. Reconcile displayed contributing values to the displayed total after the chosen rounding/reconciliation policy.

### Grade-band display

27. Replace unnecessary two-decimal grade-band wording with an approved readable version.
28. Do not silently change underlying grade-scale boundaries.
29. Derive concise exact non-overlapping boundary wording from the frozen grade-scale thresholds.

R5 established the consolidated correction baseline. R6 added adaptive dense-chart handling, R7 corrected the secondary header, summary, attendance/remarks, signature balance and filled-diamond monochrome treatment, and R8 applies the final academic-table-priority correction. R8 produces an ignored eight-page final digital review, six-page detail pack and separate eight-page Classes I-X-only colour/true-monochrome physical candidates. The physical files are paused pending final user visual review and digital approval and are not yet acceptance evidence.

## Superseded local packs

The existing ignored `PHYSICAL-ACCEPTANCE-COLOUR.pdf`, `PHYSICAL-ACCEPTANCE-MONOCHROME.pdf`, `RC-SYN-final-colour.pdf` and `RC-SYN-final-monochrome.pdf` are preserved as technical evidence and marked `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS`. They must not be printed or used for V1 acceptance. R8 creates replacements under its own ignored folder, containing only genuinely distinct Classes I-X layouts; those replacements must not be printed until final digital approval.

## Release boundary

- Only ignored synthetic R8 review/detail and paused Classes I-X-only physical-candidate PDFs are generated; no physical printing or acceptance.
- No merge, release tag, deployment or real report publication.
- No operational database, issued snapshot, historical data or approved calculation change.
- No restricted source or Student data in Git or external planning systems.
