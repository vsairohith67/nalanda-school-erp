# Report-Card Template Catalog

**Catalog ID:** `GOV-RECON-1-RC-CATALOG`<br>
**Audit date:** 2026-08-08<br>
**Status:** privacy-safe source metadata reconstructed; canonical school source layouts and physical print approvals are missing

## Source-asset search result

A repository-wide search of tracked documentation, evidence, asset, PDF, screenshot and generated-output paths found **zero original Nalanda report-card PDFs, screenshots or approved template assets**. Independent QA also searched `C:\Users\dell\Documents` for `Student Progress Report Card.zip` and the three named privacy-safe companion files; none were present. Historical QA documents state that temporary generated PDFs were cleaned after verification; those files are not canonical design sources and are not present now. No layout is inferred from a missing file.

The current application contains four code-defined template families and a governed renderer. They are implementation evidence, not proof of equivalence to Nalanda's original physical report cards. QA reconstructed safe source metadata in `docs/NPS_STUDENT_PROGRESS_REPORT_CARD_SOURCE_CATALOG.md` and `docs/student_progress_report_card_source_manifest.csv`; neither file contains Student data or document bytes.

## Current code-defined inventory

| Template/source | Class or group | Examination coverage | Orientation | Colour/mono | Pages | Layout family | Required fields and graph | Signatures | Publication support | Current renderer | Automated evidence | Physical print evidence | Approval/source gap |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| `KG_DEVELOPMENTAL_BOOKLET` definition | LKG/UKG through family matching; QA exact sample LKG | Scheme-driven exam | A4 portrait | Both | Variable | KG developmental booklet | Student/school/exam identity, developmental/rubric areas, attendance/remarks where present; performance bar | Configured signature labels/areas | Issued-only linked-Parent delivery; individual/merged/ZIP jobs | `lib/report-pdf.ts` | Synthetic LKG colour/mono PDF, A4, long-name/page checks | None | Original LKG/UKG approved sample missing; UKG not independently sample-matched |
| `PRIMARY_10_40_SKILLS` definition | Classes I–V through family matching; QA exact sample III | Scheme-driven exam | A4 portrait | Both | Variable | Primary marks plus skills | Subject/component marks, maxima/result, skills/rubrics, attendance/remarks where present; pattern-capable performance bar | Configured signature labels/areas | Same | `lib/report-pdf.ts` | Synthetic III colour/mono PDF and packaging checks | None | Approved I–V canonical sample and exam-variation decision missing |
| `SECONDARY_10_40_GROUPED` definition | Classes VI–VIII through family matching; QA exact sample VIII | Scheme-driven exam | A4 portrait | Both | Variable | Middle grouped-marks family (legacy code label retained) | Grouped subjects/components, maxima, weightages/result, attendance/remarks where present; pattern-capable performance bar | Configured signature labels/areas | Same | `lib/report-pdf.ts` | Synthetic VIII colour/mono PDF and packaging checks | None | Approved VI–VIII canonical sample and exam-variation decision missing |
| `RETAINED_MULTI_EXAM_I_X` definition | Code can match Classes I–X; canonical secondary scope remains IX–X pending approval; QA exact sample X | Multi-examination retained layout | A4 landscape | Both | Variable | Secondary retained multi-exam comparison | Multi-exam subject/component values, variable maxima/result and performance graph | Configured signature labels/areas | Same | `lib/report-pdf.ts` | Synthetic X colour/mono PDF, landscape and package checks | None | Original retained/class IX/X source and approval missing |

## Capability coverage

| Capability | Current evidence | Catalog judgment |
| --- | --- | --- |
| LKG | Exact synthetic QA for KG family | `IMPLEMENTED_CODE_EVIDENCE`; canonical source/print approval missing |
| UKG | Family matching only | `IMPLEMENTED_BUT_UNVERIFIED_FOR_EXACT_CLASS` |
| Classes I–V | Primary/retained families can cover them; exact synthetic III only | `PARTIALLY_VERIFIED` |
| Classes VI–VIII | Secondary/retained families can cover them; exact synthetic VIII only | `PARTIALLY_VERIFIED` |
| Class IX | Retained family can cover it | `IMPLEMENTED_BUT_UNVERIFIED_FOR_EXACT_CLASS` |
| Class X | Exact synthetic retained-family QA | `IMPLEMENTED_CODE_EVIDENCE`; canonical source/print approval missing |
| Examination-specific variations | Versioned examination/scheme/template snapshots | `PARTIALLY_IMPLEMENTED`; no approved source catalog by examination |
| Variable internal/external maxima and weightages | Versioned scheme components and calculation policy | `IMPLEMENTED_AND_TESTED` at calculation level; visual acceptance pending |
| Colour output | Renderer/QA | `IMPLEMENTED_AND_TESTED` digitally |
| Printer-safe monochrome | Renderer uses monochrome/pattern distinctions; QA-generated PDF | `IMPLEMENTED_AND_TESTED` digitally; physical print missing |
| Pattern-distinguishable graphs | Monochrome hatch/pattern handling in renderer | `IMPLEMENTED_CODE_EVIDENCE`; physical B/W legibility missing |
| Class/section bulk | Governed batch/jobs | `IMPLEMENTED_AND_TESTED` |
| Merged PDF | Governed job | `IMPLEMENTED_AND_TESTED` |
| Individual PDFs | Governed job | `IMPLEMENTED_AND_TESTED` |
| ZIP | Governed job | `IMPLEMENTED_AND_TESTED` |
| Immutable publication/template snapshots | Template and issued report-card version snapshots | `IMPLEMENTED_AND_TESTED` |
| Linked-Parent delivery | Issued-only and child-link authorised | `IMPLEMENTED_AND_TESTED` |
| A4 portrait/landscape | Portrait for three families; landscape retained family | `IMPLEMENTED_AND_TESTED` digitally |
| Long names/page breaks | Synthetic PDF QA | `IMPLEMENTED_AND_TESTED` digitally |
| Signatures | Configurable labels/areas | `IMPLEMENTED_CODE_EVIDENCE`; school approval missing |
| Physical colour print | No evidence | `MISSING` |
| Physical black-and-white print | No evidence | `MISSING` |

## Canonical upload checklist

Upload only privacy-safe blank or fully redacted sources. One canonical sample is sufficient where several examinations/classes truly share the same layout; do not upload duplicates.

1. **KG developmental family:** one canonical LKG/UKG sample if the layouts are identical; otherwise one sample per distinct LKG and UKG layout.
2. **Primary Classes I–V family:** one canonical sample if all five classes and examinations share the layout; otherwise one per genuinely distinct layout family.
3. **Secondary Classes VI–VIII family:** one canonical sample if all three share the layout; otherwise one per distinct family.
4. **Class IX/Class X or retained multi-exam family:** one sample if IX and X share the exact layout; otherwise one IX and one X sample. A separate sample is needed only for an examination whose layout is materially different.

For each distinct family provide:

- a blank original PDF, editable source, or high-resolution straight scan with all personal data removed;
- exact class range and examinations covered;
- page order, A4 orientation, margins and expected duplex/single-sided printing;
- mandatory fields, tables, maxima/weightage display rules, grade/remark areas and graph type;
- signature, seal and date areas, including who signs each position;
- approved logo, colours, fonts and minimum monochrome contrast;
- whether an internal/external, term, annual or multi-exam variation changes layout rather than only data;
- approval owner and dated sign-off reference;
- one physical colour print and one physical black-and-white print for final acceptance.

Do not upload real Student marks, contact details, identifiers or signatures. The catalog remains `MISSING_OR_UNAVAILABLE_SOURCE` for a family until its canonical sample and approval reference are recorded.
