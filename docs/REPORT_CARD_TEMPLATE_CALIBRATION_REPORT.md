# Report-Card Template Calibration Report

**Prompt:** `REPORT-PRINT-ACCEPT-1A`
**Branch:** `reporting/canonical-template-print-acceptance`
**Starting release:** commit `6693f8d3e4c975be748e8d7f103cd72f2ee36cfc`, tag `release-operations-v41-2026-08-10`, backup version 41
**Status:** R4.1 final numerical and true-monochrome correction ready for user review; physical printing remains paused

## Privacy and baseline

The restricted source PDFs were inspected only from neutral, ignored local copies. No original PDF, source rendering, overlay, Student/Parent identity, admission number, mark, rank, attendance, remark, photograph, or signature is tracked. The starting operational database had SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, 8,409,088 bytes, 18 applied migrations, zero business rows, four governed accounts, and one active Super Admin. End-of-phase integrity must match this baseline exactly.

## Evidence matrix

| Source family | Source pages | Current renderer | Matched sections | Missing/direct-source gaps | Visual differences | Policy differences | Calibration required | Physical specimen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KG | `source-02/03` pages 1-10 | Ten-page KG path in `lib/report-pdf.ts` | Cover, profile, instructions/legend, intellectual summary, detailed English/Hindi/Number/EVS/Rhymes/Story, personality, monthly attendance, growth, comments, signatures, promotion, back cover | No missing page structure | Canonical output expands cropped scans into exact A4 with the approved school header on page 1, stable reference/page footers, and privacy-safe identity labels | Frozen schemes and settings replace historical values/wording | Preserve ten pages and logical order; prevent page 8 overflow | `RC-SYN-01-C/M`, 10 pages each |
| Classes I-II | No direct restricted page | Academic variable-component path | Identity, components, totals, chart, skills, attendance, remarks, legends, signatures | Historical source page unavailable | Requirement-driven distinct family | All maxima/weights/visibility/configuration frozen | CT, Session, Combined variants | `RC-SYN-02` to `04`, colour/mono |
| Classes III-V | `source-01` page 2 for CT | Academic variable-component path | Separate Science/Social, skills, totals, chart, legend, remarks, signatures | Session/Combined direct pages unavailable | Governed first-page header, stable reference/page footers, and dynamic rows replace fixed scan artefacts | Historical arithmetic anomaly is not copied | CT, Session, Combined variants | `RC-SYN-05` to `07`, colour/mono |
| Classes VI-VIII | No direct restricted page | Grouped academic path | English papers, social/science groups, personality, chart, legends, signatures | Historical source page unavailable | Requirement-driven grouping | Frozen paper/group configuration controls presence and calculation | CT, Session, Combined variants | `RC-SYN-08` to `10`, colour/mono |
| Classes IX-X | `source-01` page 1 for CT | Secondary grouped academic path | English papers, History/Geography/Social, Physics/Chemistry/Biology/Science, personality, totals, chart, legend, signatures | Session/Revision/Preboard/Combined direct pages unavailable | Exact A4 dynamic pagination; pattern-safe three-series chart | No historical maximum/weight/rank/pass rule copied | CT; shared Session/Revision/Preboard structure; configured Combined | `RC-SYN-11` to `13`, colour/mono |

Rendered pages, not text extraction, were the layout reference. Source extraction or arithmetic errors were treated as anomalies.

## Implementation decisions

- Canonical schema version 2 separates five families and their variants.
- New bindings fail closed unless the canonical family, class, report type, active template version, and combined approval match.
- Existing legacy families remain readable for immutable historical publications but are not newly bindable.
- Publication content freezes cohort average/high values, scheme and grade-scale references, attendance basis, template/signature/publication versions, and configured Parent/Guardian identity.
- The PDF uses the approved transparent logo and Georgia Bold when available, with a safe bold fallback.
- Academic tables derive columns from frozen components and omit unused cells dynamically.
- All five mark states remain textually distinct; zero is a numeric Present value.
- Monochrome charts combine solid, diagonal hatch, horizontal pattern, outlines, and direct values.
- KG page 8 uses a compact table that retains the configured 8.5-point minimum while keeping the canonical booklet at ten pages.

## Synthetic proof pack

`pnpm.cmd qa:report-print-accept1a` creates an ignored restart-safe pack with 26 individual PDFs, colour/monochrome merged PDFs, deterministic ZIP output, fixed metadata, hashes, manifest, and printer instructions. Every PDF is rendered twice and byte-compared. The generator verifies valid A4 page sizes and exact ten-page KG output. The data covers long identities and subjects, multiple papers/groups, zero, absent, exempt, N/A, not-entered preview, maxima, decimals, multiple legends, rank on/off, long remarks, attendance extremes, multilingual-compatible text, and signature combinations.

No real source value is used in generated evidence.

## Acceptance status

- Prior technical rendering integrity: complete and preserved at `1620cbbcf67448f6d6e783568b384307413fae39`.
- Source-layout fidelity: confirmed insufficient before printing; pre-print recalibration in progress.
- Old physical packs: retained as technical evidence and `SUPERSEDED_FOR_VISUAL_APPROVAL`.
- `LEGACY_REFINED` selected and source-locked as the single production direction through `NALANDA_LEGACY_REFINED_COLOUR` and `NALANDA_LEGACY_REFINED_MONOCHROME`.
- `LEGACY_EXACT`: ignored historical comparison evidence only; not an ordinary-user template choice.
- R3 visual-direction and separate edge-case packs: regenerated for user review with frozen synthetic reconciliation.
- R4 targeted corrections: KG two-line cover identity and restored hierarchy; legacy academic-grade suppression; single-scale Class X grading; exact displayed-number reconciliation; leaf-only chart default; compact state codes; minimum readability sizes; synthetic not-for-issue footer.
- R4 review evidence: ignored eight-page visual pack and separate four-page edge-case pack only.
- R4.1 targeted correction: configured group averages, corrected `484.07 / 600` Class IX total, one-cohort chart invariants, conditional group-row note, grayscale official-logo derivative, and rendered RGB-channel validation.
- R4.1 review evidence: ignored four-page visual micro-pack and separate four-page edge-case pack only; no complete pack regenerated.
- Full synthetic print-pack regeneration: not yet approved.
- Physical colour/monochrome/photocopy acceptance: paused; no physical printing has occurred.
