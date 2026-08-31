# Real-Data Privacy and Retention Gates

This is a decision framework, not legal certification. Future onboarding needs named approval for legal basis, Parent/Staff notice, minimisation, sensitive identifiers, health/CWSN, photographs, payroll, historical retention, vendor export rights/contract restrictions, off-site processing, deletion, backups and access roles.

| Category | Preparation decision |
|---|---|
| Core approved identity/academic references | `MIGRATE_REQUIRED` or `MIGRATE_OPTIONAL` after mapping/owner review |
| Derived operational state | `DERIVE_AFTER_IMPORT` where safe |
| PDFs and unsupported history | `KEEP_AS_ARCHIVE_ONLY` or `DO_NOT_MIGRATE` |
| Aadhaar, PEN, APAAR | `LEGAL_OR_PRIVACY_DECISION_REQUIRED`; default excluded |
| Social/minority category | `LEGAL_OR_PRIVACY_DECISION_REQUIRED`; default excluded |
| CWSN/disability, medical, blood group | `LEGAL_OR_PRIVACY_DECISION_REQUIRED`; default excluded |
| Parent education, photographs, signatures | explicit minimisation/consent/retention decision |
| Bank details, salary/payroll | `DO_NOT_MIGRATE` in general onboarding; separate scope required |
| Biometric identifiers/templates/device credentials | `DO_NOT_MIGRATE` |

Retention categories are original packages, working copies, validation/duplicate reports, approvals, logs, rejected rows, backups, temporary extraction and document/media packages. Final periods require owner/privacy approval. Temporary data must have containment and deletion receipts; never claim deletion until storage confirms it.

Access is least privilege across Source Custodian, Preparer, Reviewers, Technical Operator and Final Owner. Source content must not leave the approved private environment: no GitHub/public CI, tracker, cloud AI, hosted OCR or source-field telemetry.
