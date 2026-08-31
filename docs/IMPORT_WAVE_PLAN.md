# Import Wave Plan

The authoritative machine-readable order is [import-waves.json](../config/onboarding/import-waves.json).

| Wave | Scope | Dependency |
|---|---|---|
| 0 | School setup, years, classes, sections, subjects, references | None |
| 1 | Students and Guardians | Wave 0 |
| 2 | Staff and assignments | Wave 0 |
| 3 | Enrolment and lifecycle | Wave 1 |
| 4 | Fee assignment and governed opening dues | Waves 1, 3 |
| 5 | Verified historical Payments | Wave 4 |
| 6 | Verified attendance/academic history | Waves 1, 3 |
| 7 | Documents/photos after storage/privacy approval | Waves 1, 2 |
| 8 | Justified optional operational modules | Wave 0 |

Each wave has a separate source package, dry run, validation, approval, pre-import backup, import batch, reconciliation and rollback decision. Parent/reference records precede children: year → class/section → Student → Guardian link → enrolment → fee assignment → Payment. Unresolved references are rejected.

Optional operations default to `START FRESH`. Academic history requires structured approved sources. Documents are inventory-only until storage, consent/legal basis and retention are approved. No wave in this preparation release is authorised to run.
