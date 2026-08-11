# Report-Card Source-Fidelity Recalibration

**Prompts:** `REPORT-PRINT-ACCEPT-1A-R` and `REPORT-PRINT-ACCEPT-1A-R2`  
**Preserved technical checkpoint:** `1620cbbcf67448f6d6e783568b384307413fae39`  
**Current state:** `SOURCE_FIDELITY_VISUAL_DIRECTION_IN_PROGRESS`  
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

## Small visual-direction gate

The first review pack deliberately contains only eight representative page structures. Each appears as both `LEGACY_EXACT` and `LEGACY_REFINED`:

1. KG cover.
2. KG Student Profile.
3. KG Intellectual Skills.
4. Class II Session End.
5. Class V Session End.
6. Class VI grouped-subject report (also representing the VI-VIII grouping direction).
7. Class IX Combined Result.
8. Class X CT/Revision-style report.

The visual-direction pack uses realistic synthetic values. The separately generated edge-case pack uses long names, long subjects, `ABSENT`, `EXEMPT`, `NOT ENTERED`, decimals, and related stress cases; it is not the design-approval pack.

Full 47-page regeneration and all physical colour/B&W printing remain blocked by the visual-direction choice. The next decision is normal-language approval of `LEGACY_EXACT`, `LEGACY_REFINED`, or named changes.
