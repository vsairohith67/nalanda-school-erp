# Report-Card Source-Fidelity Recalibration

**Prompts:** `REPORT-PRINT-ACCEPT-1A-R` through `REPORT-PRINT-ACCEPT-1A-R4`
**Preserved technical checkpoint:** `1620cbbcf67448f6d6e783568b384307413fae39`  
**Current state:** `R4_FINAL_PRE_PRINT_CORRECTION_READY_FOR_USER_REVIEW`
**Physical printing:** paused and not authorised

## Classification of the previous result

The prior digital pass proved technical rendering integrity: valid A4 PDFs, deterministic generation, synthetic edge-state coverage, output batching, and privacy controls. Direct page-by-page review of the complete restricted source package subsequently showed that it did not sufficiently prove source-layout fidelity. The old generic multi-page academic direction differed materially from the compact one-page Nalanda hierarchy, while the KG direction did not yet reproduce the booklet's recognizable cover and layered page treatment.

This is a confirmed pre-print correction, not a failed physical acceptance. No physical printing occurred. Commit `1620cbbcf67448f6d6e783568b384307413fae39` and its ignored packs remain preserved as technical QA evidence. Those packs are marked `SUPERSEDED_FOR_VISUAL_APPROVAL` and must not be printed.

## Restricted source audit

The supplied ZIP was copied and extracted only beneath the ignored `.codex/report-print-accept-1a/source-fidelity/private-source/` directory. Rendered pages were the authority; text extraction was not used as a layout source. The package contains 70 distinct reference pages: ten KG booklet pages and sixty academic report pages across Classes I-X. A duplicate cropped KG representation was treated as the same ten-page source, not a second family.

No historical Student/Parent name, admission number, mark, rank, attendance value, remark, photograph, or signature is present in tracked evidence. The detailed privacy-safe classification is in `docs/report_card_source_fidelity_page_matrix.csv`.

## Canonical visual direction

The target is `NALANDA_LEGACY_REFINED`:

- preserve the originals' recognizable hierarchy, proportions, table density, border logic, chart placement, legend placement, and signature spacing;
- improve only sharpness, alignment, spacing consistency, font rendering, print contrast, long-name handling, accessibility, and monochrome interpretation;
- retain the official transparent school logo and use Georgia Bold for `NALANDA PUBLIC SCHOOL`, with a safe bold serif fallback;
- keep Classes I-X to one occupied A4 page per Student per examination/result unless a later source-backed configured exception is approved;
- keep the KG canonical booklet at ten ordinary A4 pages with its pink/green cover, layered borders, photograph space, developmental tables, growth/attendance, comments, promotion, and back cover;
- never expose internal algorithm, database, component-code, or template-family terminology to Parent-facing reports.

All maxima, weightages, subject groups, legends, rank/grade-point visibility, attendance basis, signatures, and combined-result availability remain controlled by frozen versioned configuration. Historical formulas and values are not copied.

## R3 refined source lock

The user selected `LEGACY_REFINED`. It is now the only production direction and is exposed solely through the versioned families `NALANDA_LEGACY_REFINED_COLOUR` and `NALANDA_LEGACY_REFINED_MONOCHROME`. `LEGACY_EXACT` is retained only in ignored historical comparison evidence; ordinary users cannot choose between Exact and Refined.

The R3 visual-review pack contains the following source-locked representative pages:

1. KG cover.
2. KG Student Profile.
3. KG Intellectual Skills.
4. Class II Session End.
5. Class V Session End.
6. Class VI grouped-subject report (also representing the VI-VIII grouping direction).
7. Class IX Combined Result.
8. Class X CT/Revision-style report.
9. Class II monochrome report.
10. Class IX monochrome report.

The visual-direction pack uses realistic internally reconciled synthetic values. Its table totals, overall result, chart Student values, class average and high-score series are all drawn from one frozen synthetic report/class snapshot. A separate edge-case pack covers wrapping, `ABSENT`, `EXEMPT`, `NOT ENTERED`, `N/A`, decimals, and long remarks; it is not the design-approval pack.

The renderer uses the approved transparent logo, Georgia Bold with a safe serif fallback, and the motto `Knowledge is Power`. School name, address, academic year, and any approved identity wording are resolved from School Settings. The current configured locality is `Nanalnagar`. No approved affiliation, recognition, or establishment-year value is currently configured, so those optional lines are omitted rather than replaced with historical wording.

Full-pack regeneration and all physical colour/B&W printing remain paused. The next gate is the user's normal-language review of the latest targeted pack; printing does not resume automatically.

## R4 final correctness pass

R4 retains `NALANDA_LEGACY_REFINED` and applies only the confirmed pre-print corrections. The KG cover now treats a reduced centred crest and the two-line Georgia Bold `NALANDA` / `PUBLIC SCHOOL` name as one visual group. Hindi and Mathematics retain every separate source row.

The legacy academic pages omit the per-subject academic Grade column by default while retaining the Skills/Personality Grade column. Grade-only subjects use a dedicated grade row. Class IX Combined retains configured academic Grade and Grade Point columns. Class X uses one frozen `A+` through `F` scale for subject grades, overall grade and exact-decimal legend bands, with no pre-grade rounding.

Displayed contributing subject totals are rounded deterministically to two decimals before the displayed overall total is summed. Percentage, grade, rank basis and Student chart values use that same frozen snapshot. The legacy chart policy is `LEGACY_LEAF_SUBJECTS`, so leaf rows and their averages are not shown together. Result states use `AB`, `EX`, `NE` and `NA`, with a printed legend whenever any code appears.

The ignored R4 review pack contains eight requested pages; the separate four-page edge pack covers long identities and all four result-state codes. Both remain digital review evidence only. The full pack and physical printing remain paused.
