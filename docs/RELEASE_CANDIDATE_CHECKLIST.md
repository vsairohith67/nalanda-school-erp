# Release-Candidate Checklist

## Report-card scope gate — 2026-08-12

- [x] Classes I-X consolidated correction register confirmed complete by the user.
- [x] Classes I-X replacement colour and true-monochrome acceptance packs generated after R5 corrections.
- [x] Classes I-X R5-A1 focused digital regression, A4, white-background, fixed-grid, collision, photocopy-pattern and true-monochrome checks passed.
- [x] Classes I-X R6-A1 header, dense-chart, two-row, compact-legend and authoritative monochrome-pattern checks passed.
- [x] Classes I-X R8 single-line summary, dense-table priority, adaptive chart, 15 mm signature and colour/true-monochrome digital checks passed.
- [x] Classes I-X R8 final digital review approved by the user (`R8_DIGITAL_DESIGN_APPROVED`).
- [x] Classes I-X physical colour, native-monochrome and photocopy acceptance passed on Canon imageCLASS MF244dw / A4.
- [x] KG/LKG/UKG excluded from V1 release-candidate completeness.
- [x] KG implementation, tests, migrations, commits and ignored evidence preserved for V1.5.
- [x] `kg-report-cards-v1-5` remains default-off for V1 operational release.
- [x] Existing issued/historical report snapshots remain readable and immutable.
- [ ] Run the separately governed `V1-FINAL-1A` cross-module QA after this report-card clearance.

Current report-card gate: `REPORT_PRINT_ACCEPTANCE_CLEARED`. The previous `PHYSICAL_PRINT_GATE_PENDING` gate is closed after successful colour, native-monochrome and one-generation photocopy observations. KG remains outside V1. No deployment or real report issuance occurred. Next governed phase: `V1-FINAL-1A`.
