# Report-Card Template Gap and Print Acceptance

**Requirement:** `V1-EXAM-RC-TEMPLATE-001`<br>
**Status:** V1 blocker; current digital renderer is partial evidence, not canonical acceptance

## Gap statement

Nalanda currently has a versioned report-card engine, four code-defined layout families, immutable issue snapshots, linked-Parent delivery and digital PDF/package QA. It does not have a version-controlled library of school-approved original template sources, exact mapping/approval for every distinct class/examination family, or evidence of physical colour and black-and-white acceptance. Therefore this requirement is `PARTIALLY_IMPLEMENTED` and cannot be marked complete.

## Required catalog governance

Each canonical template family must have:

- a stable template ID and human-readable name;
- source-file hash and safe repository/storage reference (never real Student data);
- covered classes and examinations;
- layout/orientation/page policy;
- version, effective academic year and status;
- approved school fields, maxima/weightage presentation, graph and signature areas;
- renderer mapping and immutable definition/print-settings snapshot;
- approval owner, date and reference;
- supersession link when changed;
- digital QA and physical print acceptance evidence.

A template version is immutable after it has been used for an issued report card. Corrections create a new version; they never rewrite the source used by an issued card.

## Digital acceptance matrix

For every distinct family and every materially different exam variation, verify:

| Area | Acceptance |
| --- | --- |
| Data correctness | Exact Student, class/section, examination, subject/component, raw/weighted result, maxima, grade, attendance, remark and version values match the locked publication snapshot. |
| Scope | The family covers only its approved class/exam mapping; missing mappings fail closed. |
| Layout | Correct A4 portrait/landscape, margins, page count/order, no clipped content, stable page breaks and readable continuation headers. |
| Edge cases | Long Student/school/subject names, maximum row counts, empty optional fields, multi-page results, Unicode names and signatures remain legible. |
| Colour | Approved colours and sufficient contrast; important meaning does not rely on colour alone. |
| Monochrome | Text remains legible and graph series/statuses are distinguishable by pattern/shape as well as shade. |
| Packaging | Individual PDF, class/section bulk, merged PDF and ZIP contain exactly the approved issued versions with deterministic safe filenames. |
| Privacy | Parent receives issued versions for linked children only; retrieval is authenticated and private/no-store; no PWA cache. |
| Integrity | Exact template/publication snapshots, report-card version, PDF hash and supersession chain are preserved. |
| Accessibility | Logical reading order where supported, meaningful labels, minimum readable type size and no information encoded only by colour. |

## Physical print protocol

For each distinct family, use a synthetic/redacted maximum-content specimen and record printer model, driver/settings, paper stock, scaling, duplex mode, date and reviewer.

1. Print the approved colour specimen at 100%/actual size on the school's intended colour device.
2. Print the same specimen in black-and-white/grayscale on the school's intended monochrome device.
3. Measure or visually verify margins, clipping, page order, table/grid alignment, type size, graph/legend distinction, signatures/seal space and scan/copy readability.
4. Verify long names, maximum subjects/components and every page break.
5. If both portrait and landscape are used, test both and verify automatic orientation is not silently scaled.
6. Test a merged class/section package and confirm no Student begins on the wrong side/page when the school uses duplex printing.
7. Have the authorised academic/administrative reviewer sign the acceptance record or reject it with exact corrections.
8. Store only the privacy-safe specimen, hash, settings and approval reference. Do not store real report cards in Git, Notion, Asana, Basic Memory or Canvs.

## Completion rule

This requirement becomes complete only when all distinct template families in `docs/REPORT_CARD_TEMPLATE_CATALOG.md` have canonical source evidence, exact coverage mapping, digital acceptance, physical colour acceptance, physical black-and-white acceptance and dated school approval. Passing renderer tests alone is insufficient.
