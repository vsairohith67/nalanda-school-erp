# NPS Report-Card External Sync Package

**Package ID:** `GOV-RECON-1-QA-RC-EXTERNAL-SYNC`<br>
**Prepared:** 2026-08-08<br>
**Content boundary:** privacy-safe summaries and identifiers only

## Decision summary

- Canonical Report-Card Template Library and physical print acceptance remain V1.
- The repository has four governed renderer families mapped in the privacy-safe source catalog: KG, primary, middle and secondary.
- The named raw ZIP and original canonical layouts were not available to this QA review. Their wording/layout has not been invented.
- Digital synthetic rendering is meaningful implementation/QA evidence but does not prove school-approved visual equivalence or physical printing.
- Physical colour and black-and-white acceptance remain required for every distinct approved family.

## Safe references

- `docs/NPS_STUDENT_PROGRESS_REPORT_CARD_SOURCE_CATALOG.md`
- `docs/student_progress_report_card_source_manifest.csv`
- `docs/REPORT_CARD_TEMPLATE_CATALOG.md`
- `docs/REPORT_CARD_TEMPLATE_GAP_AND_PRINT_ACCEPTANCE.md`
- Requirement `V1-RC-016`
- Governance implementation commit `9065917eb366f9a60d4f8a967b5a80a30a5ca6d3`

## External-system wording

Use: “Four privacy-safe source families are catalogued from code evidence: KG, primary, middle and secondary. Canonical blank/redacted school sources and physical colour/B&W acceptance remain a V1 gate.”

Do not copy the raw ZIP, original Student PDFs, rendered Student pages, names, admission numbers, marks, attendance, photographs, signatures or source-document bytes into any external project system.
