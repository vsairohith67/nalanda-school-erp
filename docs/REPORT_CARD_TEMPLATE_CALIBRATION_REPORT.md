# Report-Card Template Calibration Report

**Prompt:** `REPORT-PRINT-ACCEPT-1A`
**Branch:** `reporting/canonical-template-print-acceptance`
**Starting release:** commit `6693f8d3e4c975be748e8d7f103cd72f2ee36cfc`, tag `release-operations-v41-2026-08-10`, backup version 41
**Status:** V1 narrowed to Classes I-X; R5 consolidated corrections complete for digital review; KG foundation deferred to V1.5; physical printing remains paused

## 2026-08-12 scope amendment

Classes I-X remain the V1 report-card release requirement with status `IN_PROGRESS_PHYSICAL_ACCEPTANCE_PENDING`. LKG/UKG and the ten-page developmental booklet move to V1.5 with status `IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5`. This is a governance and availability change only: KG renderers, tests, migrations, historical commits and ignored evidence remain preserved. New KG operational creation, activation, binding and publication are default-off through the existing release-feature-flag framework; immutable issued/historical reports remain readable.

The R4.2 full and physical packs are preserved locally and marked `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS`. They must not be printed. The now-complete Classes I-X correction register is implemented in R5, which generates only ignored digital-review packs; no replacement physical pack is generated.

## Privacy and baseline

The restricted source PDFs were inspected only from neutral, ignored local copies. No original PDF, source rendering, overlay, Student/Parent identity, admission number, mark, rank, attendance, remark, photograph, or signature is tracked. The starting operational database had SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, 8,409,088 bytes, 18 applied migrations, zero business rows, four governed accounts, and one active Super Admin. End-of-phase integrity must match this baseline exactly.

## Evidence matrix

| Source family | Source pages | Current renderer | Matched sections | Missing/direct-source gaps | Visual differences | Policy differences | Calibration required | Physical specimen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KG | `source-02/03` pages 1-10 | Ten-page KG path in `lib/report-pdf.ts` | Cover, profile, instructions/legend, intellectual summary, detailed English/Hindi/Number/EVS/Rhymes/Story, personality, monthly attendance, growth, comments, signatures, promotion, back cover | No missing page structure | Canonical output expands cropped scans into exact A4 with the approved school header on page 1, stable reference/page footers, and privacy-safe identity labels | Frozen schemes and settings replace historical values/wording | Preserve foundation; defer activation and acceptance to V1.5 | Historical ignored evidence retained; excluded from V1 pack |
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

## R5 synthetic digital-review pack

R5 generates an ignored ten-page Classes I-X visual-direction pack and a separate six-page edge-case pack. The visual pack covers I-II Session/Combined, III-V Session, VI-VIII grouped, IX Combined and X CT/Revision in approved colour/true-monochrome combinations. The edge pack covers long names and subjects, AB/EX/NE/NA, close chart values, one-decimal reconciliation, conditional school status and grade boundaries. KG is excluded. The generator verifies deterministic bytes, A4 boxes, stable page counts, pure-white background samples and true grayscale before writing.

R4.2 full and physical artifacts remain preserved technical evidence under `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS`; R5 does not regenerate or authorise them.

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
- R4.2 full source-locked packs: generated and digitally verified at `4c0eb0b79e7b7a3b8b0c9bf5864ecf483c6178c1`, then superseded for V1 because they include KG and predate the complete Classes I-X correction register.
- Classes I-X R5 correction register: confirmed complete and implemented for user digital review.
- R5 digital evidence: ignored ten-page visual pack and six-page edge-case pack; synthetic-only and not for physical acceptance.
- Replacement Classes I-X-only physical pack: not authorised yet and not generated.
- Physical colour/monochrome/photocopy acceptance: paused; no physical printing has occurred.
- KG operational activation and physical acceptance: V1.5 only; not V1-cleared or production-ready.
