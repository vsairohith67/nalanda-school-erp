# Report-Card R5 Digital Review Evidence

**Prompt:** `REPORT-PRINT-ACCEPT-1A-R5`<br>
**Date:** 2026-08-12<br>
**Branch:** `reporting/canonical-template-print-acceptance`<br>
**Starting feature commit:** `e33314374e8381f29b9d34c454cecc12dc776274`<br>
**R5 implementation commit:** `d767ac26fc305e0c3ff77803a8226c225869169f`<br>
**Synchronized release baseline:** `main` and `origin/main` at `6693f8d3e4c975be748e8d7f103cd72f2ee36cfc`; reachable tag `release-operations-v41-2026-08-10`

## Scope and gate

R5 covers Classes I-X only in `NALANDA_LEGACY_REFINED_COLOUR` and `NALANDA_LEGACY_REFINED_MONOCHROME`. KG/LKG/UKG implementation and history remain preserved, default-off and deferred to V1.5. The R5 output is synthetic digital-review evidence only. Physical-pack regeneration, printing, merge, tag, deployment, real report publication and issue remain unauthorised.

## Local ignored evidence

| Artifact | Pages | SHA-256 | Use |
| --- | ---: | --- | --- |
| `.codex/report-print-accept-1a/r5/VISUAL-DIRECTION-PACK-R5.pdf` | 10 | `EC70B7A943CF017236F78EDB1CC72B3E2517CBEA5ECAA86872C2D05FEBA41B8B` | Classes I-X user visual review |
| `.codex/report-print-accept-1a/r5/EDGE-CASE-RENDERING-PACK-R5.pdf` | 6 | `30F1480432DDFD3E7FBEA6136E1806B1524A474BE518616F25F1C91F7ECA6AB7` | Long-value, state, rounding, status-line and collision QA |

The generator reproduced identical bytes before writing and validated A4 boxes, page counts, pure-white canvas samples and neutral grayscale. Every page is marked `SYNTHETIC SAMPLE — NOT FOR ISSUE`. The pack and manifest are Git-ignored.

## Focused verification

- 23 R5-specific tests passed, including embedded Georgia Bold and approved body-font evidence.
- 50 R4/R4.1/R4.2 compatibility tests passed after the focused correction.
- 58 canonical, final-pack, calculation, V1/V1.5 and R5 tests passed in the final focused run.
- TypeScript library and test configurations passed.
- Visual raster inspection covered representative colour, grouped, combined, edge and monochrome pages.

The suites assert colour/monochrome geometry parity, pure-white A4 background regions, conditional School Settings status wording, exact identity labels, balanced tables, readable G/S/N legend, one-decimal display reconciliation, threshold-derived grade bands, chart patterns/collisions, complete labels, signing geometry, A4 validity, true monochrome and KG exclusion from R5.

## Preserved operational and historical baselines

The operational SQLite database began R5 at SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA` and 8,409,088 bytes. End-of-phase verification must match byte-for-byte.

The four superseded R4.2 artifacts were not regenerated:

| Preserved artifact | SHA-256 | Last write |
| --- | --- | --- |
| `PHYSICAL-ACCEPTANCE-COLOUR.pdf` | unchanged; full hash retained in ignored local evidence | 2026-08-11 20:56:29 |
| `PHYSICAL-ACCEPTANCE-MONOCHROME.pdf` | unchanged; full hash retained in ignored local evidence | 2026-08-11 20:56:29 |
| `RC-SYN-final-colour.pdf` | unchanged; full hash retained in ignored local evidence | 2026-08-11 20:56:29 |
| `RC-SYN-final-monochrome.pdf` | unchanged; full hash retained in ignored local evidence | 2026-08-11 20:56:29 |

## Current disposition

`REPORT_TEMPLATE_R5_READY_FOR_USER_REVIEW` is permitted only after final Git safety, privacy/source-artifact scan, operational hash comparison, cleanup-twice evidence, feature-branch push and privacy-safe external-system re-fetch all pass. Physical printing remains paused.
