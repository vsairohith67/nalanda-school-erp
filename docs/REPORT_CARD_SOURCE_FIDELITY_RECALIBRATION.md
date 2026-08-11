# Report-Card Source-Fidelity Recalibration

**Prompts:** `REPORT-PRINT-ACCEPT-1A-R` through `REPORT-PRINT-ACCEPT-1A-R4.1`
**Preserved technical checkpoint:** `1620cbbcf67448f6d6e783568b384307413fae39`  
**Current state:** `R4_1_FINAL_PREPRINT_READY_FOR_USER_REVIEW`
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

## R4.1 numerical and true-monochrome correction

R4.1 freezes the approved R4 architecture. It changes only grouped-result arithmetic, cohort comparison invariants, the explanatory group-row note, and the monochrome colour space.

Class IX `English Average`, `Science Average`, and `Social Average` are now derived from their visible configured members through the frozen arithmetic-mean formula. The corrected visible contributing total is `484.07 / 600`; percentage, grade, Grade Point, rank basis, and Student chart values are regenerated from the same two-decimal snapshot. Grouped reports print the plain-language note that shaded group-result rows contribute to the overall total while individual papers remain detailed references.

Class comparison values are generated from one synthetic class/section cohort. Present zero and decimal results remain valid; absent and not-entered records are excluded from comparison statistics. Each chart enforces `0 <= Student <= High Score <= Maximum` and `Class Average <= High Score`; an unavailable cohort suppresses comparison output rather than inventing values.

`NALANDA_LEGACY_REFINED_MONOCHROME` embeds a grayscale derivative of the official transparent logo at the original proportions and uses neutral RGB values for every visual element. Solid, diagonal-hatch, and horizontal-line chart patterns remain unchanged. Raster inspection of every R4.1 monochrome review page requires equal RGB channels within a two-level antialiasing tolerance.

The ignored R4.1 micro-review pack contains Class IX colour, Class X colour, Class II true-monochrome, and Class IX true-monochrome. The separate four-page edge pack covers grouped calculation, cohort high-score invariants, all compact result states, and long wrapping. Neither pack is authorised for physical printing.
