# Release-Candidate Checklist

## Report-card scope gate — 2026-08-12

- [x] Classes I-X consolidated correction register confirmed complete by the user.
- [ ] Classes I-X replacement colour and true-monochrome acceptance packs generated after R5 corrections.
- [x] Classes I-X R5-A1 focused digital regression, A4, white-background, fixed-grid, collision, photocopy-pattern and true-monochrome checks passed.
- [x] Classes I-X R6-A1 header, dense-chart, two-row, compact-legend and authoritative monochrome-pattern checks passed.
- [x] Classes I-X R8 single-line summary, dense-table priority, adaptive chart, 15 mm signature and colour/true-monochrome digital checks passed.
- [ ] Classes I-X R8 final digital review approved by the user.
- [ ] Classes I-X physical colour, native-monochrome and photocopy acceptance passed.
- [x] KG/LKG/UKG excluded from V1 release-candidate completeness.
- [x] KG implementation, tests, migrations, commits and ignored evidence preserved for V1.5.
- [x] `kg-report-cards-v1-5` remains default-off for V1 operational release.
- [x] Existing issued/historical report snapshots remain readable and immutable.
- [ ] V1 final cross-module QA run only after Classes I-X physical acceptance.

Current gate: `IN_PROGRESS_PHYSICAL_ACCEPTANCE_PENDING`. R8 final digital review and the paused Classes I-X-only physical candidates are generated. Physical printing remains paused. Do not print them until user digital approval; physical acceptance, merge and tag remain pending.
