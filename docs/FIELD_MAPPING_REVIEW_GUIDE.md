# Field Mapping Review Guide

Review source meaning before syntax. Confirm authority by period, stable identifiers, null/blank meaning, enum/date/decimal rules, parent references, sensitivity, target service contract and wave. Do not map directly to database columns.

Compare source and proposed normalized values. Approve only deterministic trim/NFC, declared dates, controlled codes and safe contact formatting. Reject spelling/DOB/gender/identifier/amount/class/link inference.

Classify every field as required, optional or conditional and as `MIGRATE_REQUIRED`, `MIGRATE_OPTIONAL`, `DERIVE_AFTER_IMPORT`, `KEEP_AS_ARCHIVE_ONLY`, `DO_NOT_MIGRATE` or `LEGAL_OR_PRIVACY_DECISION_REQUIRED`. Record unsupported reasons and the named approver.

After any mapping change, version the catalogue and repeat the dry run. Previous reports become superseded, not silently edited.
