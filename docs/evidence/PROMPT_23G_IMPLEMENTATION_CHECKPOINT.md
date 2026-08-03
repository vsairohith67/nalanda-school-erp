# Prompt 23G Implementation Checkpoint

Branch: `feature/consolidated-board-reporting`

Prompt 23G adds governed consolidated and Class IX/X comparison reporting over
locked result snapshots and current issued report versions. The operational
business baseline remains zero and the additive migration is not applied to the
operational database during implementation.

The `REPORT23G` copied-database harness covers raw and weighted schemes,
different maxima, compatible and incompatible comparisons, present zero,
absent, exempt, N/A and not-entered states, configured groups, ties, two
sections, revision/preboard sources, exact Teacher scope, linked/self scope,
Viewer suppression, denied roles, concurrent idempotency, immutable rows,
forced rollback and two backup restores.

Final in-app Browser proof used a copied production-like `REPORT23G-BROWSER`
database at 1366 x 768 and 390 x 844. Principal dark desktop and light mobile,
Teacher, linked Parent and low-count Viewer surfaces had no horizontal overflow,
sub-44 px actions, native dialogs, hydration or console errors. Keyboard focus
had a visible 2 px outline. Teacher options contained only the exact assigned
section; Parent output had one linked source/row; Viewer section B emitted only
`SUPPRESSED` aggregates and no Student/admission columns. The Class IX package
showed the board boundary and explicit percentage-normalised compatibility.
Private CSV export returned 200 and appended Viewer export history. Six report
generation POSTs and one export POST succeeded; runtime and copied fixtures were
removed and inspected twice. Full regression/build, feature push and external-
system closure remain the final implementation gates.

Independent Prompt 23G-QA must use fresh `REPORT23GQA` fixtures and is the only
phase authorised to apply the additive operational migration, merge main and
create the governed release tag. Deployment, public results, official board
submission and real-user/data onboarding remain unauthorised.

Independent QA later identified that report filter controls rendered at 38 px
despite the implementation proof recording compliant action targets. Prompt
23G-QA corrected the filters to 44 px and re-ran the complete desktop/mobile,
light/dark role matrix; the independent evidence supersedes that one
implementation-stage measurement.
