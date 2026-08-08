# NPS Student Progress Report-Card Source Catalog

**Catalog ID:** `GOV-RECON-1-QA-RC-SOURCE-CATALOG`<br>
**Review date:** 2026-08-08<br>
**Privacy status:** safe metadata only; contains no Student record, mark, attendance, photograph, signature or document byte<br>
**Evidence status:** `INFERRED_FROM_REPOSITORY`, `IMPLEMENTED_CODE_EVIDENCE`, `MISSING_OR_UNAVAILABLE_SOURCE`

## Source search result

The independent QA search did not locate `Student Progress Report Card.zip`, a prior `NPS_STUDENT_PROGRESS_REPORT_CARD_SOURCE_CATALOG.md`, `student_progress_report_card_source_manifest.csv`, or `NPS_REPORT_CARD_EXTERNAL_SYNC_PACKAGE.md` under `C:\Users\dell\Documents`. No ZIP, original Student PDF, rendered Student page or other private artifact was imported or committed.

This catalog is therefore a privacy-safe reconstruction from the four governed code families. It identifies the distinct source families the school must supply; it is not a claim that the missing original layouts were inspected or approved.

## Distinct source-family register

| Source family ID | Governance family | Current code family | Intended class coverage | Current digital evidence | Canonical source status | Physical print status |
| --- | --- | --- | --- | --- | --- | --- |
| `NPS-RC-KG-001` | KG | `KG_DEVELOPMENTAL_BOOKLET` | LKG/UKG; one source only if both layouts are identical | Portrait A4, colour/mono renderer and synthetic LKG QA | `MISSING_OR_UNAVAILABLE_SOURCE`; UKG exact mapping unapproved | Colour and B/W both missing |
| `NPS-RC-PRI-001` | Primary | `PRIMARY_10_40_SKILLS` | Classes I–V; one source only where class/exam layouts are identical | Portrait A4, marks/skills rendering and synthetic Class III QA | `MISSING_OR_UNAVAILABLE_SOURCE` | Colour and B/W both missing |
| `NPS-RC-MID-001` | Middle | `SECONDARY_10_40_GROUPED` (legacy code label) | Classes VI–VIII | Portrait A4, grouped marks/personality rendering and synthetic Class VIII QA | `MISSING_OR_UNAVAILABLE_SOURCE` | Colour and B/W both missing |
| `NPS-RC-SEC-001` | Secondary | `RETAINED_MULTI_EXAM_I_X` | Classes IX–X when source-approved; broader code matching is not canonical approval | Configurable multi-exam rendering, landscape option and synthetic Class X QA | `MISSING_OR_UNAVAILABLE_SOURCE`; exact IX/X and exam mapping unapproved | Colour and B/W both missing |

## Canonical-source acceptance fields

For each genuinely distinct family, the privacy-safe source record must capture:

- blank/redacted source reference and SHA-256;
- class range and exact examinations covered;
- page count/order, A4 orientation, margins, single/duplex expectation and scaling rule;
- required identity, academic, attendance, remark, grade, graph and signature fields;
- variable internal/external maxima and weightage presentation;
- approved colours/fonts/logo and monochrome pattern/contrast requirements;
- renderer mapping and immutable template version;
- approval owner, approval date and supersession reference;
- digital acceptance plus physical colour and black-and-white acceptance references.

Do not upload duplicate samples where one approved blank source covers several examinations. Do not store original Student report cards or any Student data in Git, Notion, Asana, Basic Memory or Canvs.
