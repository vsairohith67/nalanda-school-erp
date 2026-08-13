# Report-Card R5 Digital Review Evidence

**Prompt:** `REPORT-PRINT-ACCEPT-1A-R5` with amendment `REPORT-PRINT-ACCEPT-1A-R5-A1`<br>
**Date:** 2026-08-13<br>
**Branch:** `reporting/canonical-template-print-acceptance`<br>
**Starting feature commit:** `e33314374e8381f29b9d34c454cecc12dc776274`<br>
**R5 implementation commit:** `d767ac26fc305e0c3ff77803a8226c225869169f`<br>
**R5-A1 implementation commit:** pending this branch commit<br>
**Synchronized release baseline:** `main` and `origin/main` at `6693f8d3e4c975be748e8d7f103cd72f2ee36cfc`; reachable tag `release-operations-v41-2026-08-10`

## Scope and gate

R5 covers Classes I-X only in `NALANDA_LEGACY_REFINED_COLOUR` and `NALANDA_LEGACY_REFINED_MONOCHROME`. R5-A1 adds the approved three-line academic header, fixed 25% identity grid, 7-point collision-safe chart values, and simple diagonal/cross-hatch/dot monochrome patterns. KG/LKG/UKG implementation and history remain preserved, default-off and deferred to V1.5. The output is synthetic digital-review evidence only. Physical-pack regeneration, printing, merge, tag, deployment, real report publication and issue remain unauthorised.

## Local ignored evidence

| Artifact | Pages | SHA-256 | Use |
| --- | ---: | --- | --- |
| `.codex/report-print-accept-1a/r5/VISUAL-DIRECTION-PACK-R5.pdf` | 10 | `e33ac839d3881275ec3484c9a5d330ab97c8027af6e9da3920b97deb659fd567` | Classes I-X user visual review |
| `.codex/report-print-accept-1a/r5/R5-DETAIL-CHECKS.pdf` | 7 | `2d7452af0070a2de2977b44150e953dfcc25fc260a281ee07fb286987704365d` | Enlarged header, identity divider, chart labels, patterns, legend, and signature clearance |
| `.codex/report-print-accept-1a/r5/EDGE-CASE-RENDERING-PACK-R5.pdf` | 6 | `e224bebabaa23c39808a9266d5acab321b4b9ba52b7f974b2221014d6eea33e1` | Long-value, state, rounding, status-line and collision QA |

The pre-amendment R5 artifacts are preserved in ignored local evidence and marked `SUPERSEDED_BY_R5_A1`. The generator reproduced identical bytes before writing and validated A4 boxes, page counts, pure-white canvas samples and neutral grayscale. Every page is marked `SYNTHETIC SAMPLE — NOT FOR ISSUE`. The packs and manifest are Git-ignored.

## Focused verification

- 31 R5/R5-A1 tests passed, including exact header configuration, embedded Georgia Bold, fixed-grid geometry, 7-point label placement, pattern equivalence, pure-white canvas, true monochrome, and rendered photocopy simulation.
- The broader report-card regression covers 172 tests, including preserved R4/R4.1/R4.2 compatibility, canonical calculations, V1/V1.5 availability and publication/PDF security.
- TypeScript library and test configurations passed.
- Visual raster inspection covered representative colour, grouped, combined, edge and monochrome pages.

The suites assert colour/monochrome geometry parity, pure-white A4 background regions, approved status wording with safe preview warning and final-publication blocker, exact identity labels, a continuous 50% divider, balanced tables, readable G/S/N legend, one-decimal display reconciliation, threshold-derived grade bands, zero-overlap chart labels, complete labels, identical legend/bar patterns, blur-and-threshold photocopy distinction, signing geometry, A4 validity, true monochrome and KG exclusion from R5.

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
