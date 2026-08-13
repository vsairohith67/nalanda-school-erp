# Classes I-X R6 Digital Review Evidence

**Prompt:** `REPORT-PRINT-ACCEPT-1A-R6` with controlling amendment `REPORT-PRINT-ACCEPT-1A-R6-A1`

**Scope:** Classes I-X only; synthetic digital review

**State:** user review pending; physical printing paused

**KG state:** preserved/default-off foundation deferred to V1.5

## Applied correction

R6 preserves the approved one-page report architecture, exact identity grid, academic tables, totals, grade rules and 18 mm signing clearance. It changes only the governed secondary-header emphasis, adaptive chart sizing and the controlling A1 monochrome chart contract.

- The configured status line renders at 9.2 pt bold and the configured address at 9.8 pt bold. Publication still fails closed when the approved status wording is absent; the renderer does not invent an affiliation claim.
- `DENSE_ACADEMIC_CHART` activates for eight or more categories, insufficient projected category width or long configured labels. Ten categories use the 5+5 two-row fallback with one shared legend and a common 0-100 scale.
- Dense reports use the compact two-row grade legend without reducing its text below 6 pt or reducing the frozen 18 mm signature area.
- Colour charts retain the approved colours.
- Authoritative monochrome order and appearance is: Student Marks solid 55% neutral grey; Class Average black 45-degree diagonal slashes on white; High Score black diamond/cross-lattice on white. All bars have strong black outlines and legend swatches use the same drawing operation as the bars.

## Ignored local outputs

- `.codex/report-print-accept-1a/r6/VISUAL-DIRECTION-PACK-R6.pdf` — 8 A4 synthetic representative pages.
- `.codex/report-print-accept-1a/r6/R6-DETAIL-CHECKS.pdf` — 12 A4 enlarged checks, including the header, frozen identity grid, normal and dense charts, one-row/two-row modes, compact grade legend, frozen signing area, authoritative swatches, photocopy simulation and legend/bar equivalence.

Every page is painted on white, and every review page is marked `SYNTHETIC SAMPLE — NOT FOR ISSUE`. The generator is deterministic and refuses to create a physical acceptance pack.

## Digital evidence

- Both PDFs generated twice byte-identically.
- Page counts: visual 8; detail 12; every MediaBox is A4.
- True-monochrome raster checks passed for every monochrome representative and the authoritative detail pages with zero meaningful chromatic pixels.
- White-background sample checks passed on all 20 pages.
- Moderate blur/threshold photocopy simulation retained all three patterns. Maximum pair similarity was `0.169`, below the `0.72` rejection threshold.
- Rendered inspection confirmed clean 45-degree slash clipping, individually visible diamond lattice marks, matching legend/bar patterns, direct numeric labels and no missing/merged chart values.
- Focused R6 tests cover configured header wrapping, absent-status refusal, frozen identity/signature geometry, series order, pattern density, label collision, adaptive-mode triggers, deterministic A4 output, pure white and true monochrome.

## Release boundary

No real Student data, source PDF/page or report was used in the review output. No operational report was published. No physical pack was regenerated, and no print, merge, tag or deployment is authorised. The next action is normal-language user review of the two local PDFs.
