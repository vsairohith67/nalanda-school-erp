# Academic Report Comparison Compatibility Rules

Comparisons are evidence over already-published values, never a new result
calculation.

1. Formula version, rounding-policy version, paper codes, component codes and
   calculation modes must match. A mismatch is refused and visibly explained.
2. `STRICT_MATCH` additionally requires equal paper/component maxima and
   contribution weights. No conversion is attempted.
3. `PERCENTAGE_NORMALIZED` may be explicitly selected only when the structure,
   formula and rounding rules match but maxima differ. It compares the issued
   percentages as percentage-point deltas; it does not rescale marks, grades or
   components.
4. Weighted and raw schemes, different paper sets, or changed formula versions
   are incompatible. They remain visibly separated.
5. Missing issued sources produce completion/missing evidence, not inferred
   marks. Unissued or unlocked records never enter a report.

The comparison preview is advisory. The server repeats compatibility checks
against exact locked and issued versions before storing a run.
