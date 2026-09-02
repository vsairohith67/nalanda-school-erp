# Real-Data Onboarding Preparation 1A

## Release boundary

`REAL_DATA_ONBOARDING_PREPARATION_1A` is an offline, provider-independent preparation and review layer for a future controlled migration. It adds source inventory, chain-of-custody, mapping, bounded file inspection, deterministic synthetic dry runs, duplicate and reconciliation reports, approval gates, rollback design, and operator guidance.

This release processes **synthetic data only**. It does not receive, inspect, transform, validate or import Nalanda records. It does not create a public import route, modify Prisma, access an operational database, deploy staging, activate users, process OCR, or authorise production migration. The existing `real-data-imports` production flag remains OFF at 0%.

## Architecture

The preparation engine is [provider-independent code](../lib/onboarding-preparation.ts) with no Prisma client, `DATABASE_URL`, network upload, telemetry or subprocess access. It reads an operator-supplied local package directory, verifies `manifest.json`, mapping-sensitive file metadata and file hashes, rejects undeclared entries, inspects bounded CSV/XLSX files, applies the reviewed mapping catalogue, and writes reports only to a newly created operator-selected directory. Source bytes are read-only and re-hashed after the dry run.

The engine extends, but does not replace, cleared IMPORT-1A. Existing IMPORT-1A remains the authoritative private Student/Guardian/Staff `CREATE_AND_LINK` workflow with approval, execution, lineage and safe rollback. This phase supplies the earlier source-preparation layer and future finance/history/document decisions; it does not call IMPORT-1A execution.

## Commands

```powershell
pnpm.cmd onboarding:mapping:validate
pnpm.cmd onboarding:synthetic -- --output tmp/real-data-onboarding-preparation-1a/package
pnpm.cmd onboarding:package:validate -- --package tmp/real-data-onboarding-preparation-1a/package
pnpm.cmd onboarding:dry-run -- --package tmp/real-data-onboarding-preparation-1a/package --output tmp/real-data-onboarding-preparation-1a/reports
pnpm.cmd onboarding:report -- --package <private-package-directory> --output <new-private-report-directory>
```

The final two commands are equivalent review modes. CLI stdout contains only package IDs, hashes, counts, states and destinations; it does not print source rows, names, contacts, marks or financial values.

## Source inventory and authority

No source is assumed to exist. Each candidate source must use the source inventory schema and record owner, custodian, export method/date, academic-year/domain coverage, format/encoding, row and attachment counts, checksum, confidentiality, retention, limitations, approvals and wave eligibility.

Allowed authority states are `AUTHORITATIVE_PRIMARY`, `AUTHORITATIVE_BY_PERIOD`, `SUPPORTING_EVIDENCE`, `DERIVED`, `HISTORICAL_REFERENCE`, `UNVERIFIED`, `CONFLICTING`, `INCOMPLETE` and `DO_NOT_IMPORT`. Row count never determines authority. A configurable, owner-approved decision register governs conflicts.

## Package and file preservation

Every package has a versioned manifest and one or more individually hashed files. Future operations must keep `ORIGINAL_SOURCE_BYTES` immutable and separately protected from `NORMALIZED_WORKING_COPY`. A new byte sequence receives a new package identity; a changed mapping receives a new dry run. Corrections are decision records, never edits to the original evidence.

Only bounded CSV and XLSX are admitted. XLSM, macros, legacy binary XLS, executables, arbitrary archives, password cracking and embedded/external spreadsheet content are refused. Attachments and paper/PDF sources are inventory entries only.

## Mapping domains

The catalogue contains 89 entries mapped to existing or proposed service contracts rather than database columns:

1. School and academic structure.
2. Students.
3. Guardians and Student links.
4. Staff and assignments.
5. Enrolment and lifecycle.
6. Finance opening position and verified history.
7. Academic history.
8. Documents/media inventory.
9. Optional operational decisions and sensitive-field gates.

Mappings retain source value and proposed normalized value. Safe proposals are limited to whitespace/NFC, declared dates, controlled-code casing, and phone/email formatting. Names, DOB, gender, identifiers, classes, links and financial amounts are never invented or silently corrected.

## Synthetic QA package

The deterministic generator defaults to 120 Students, 160 Guardians and 30 Staff plus academic structure, enrolment, finance, attendance, marks and document-manifest files. All people and contacts use explicit `STUDENT-MIGRATION-*`, `GUARDIAN-MIGRATION-*`, `STAFF-MIGRATION-*` and `SYN-PHONE-*` markers. The adversarial variant adds an exact duplicate identifier, scientific-notation identifier, formula, overlong cell, sensitive-field gate, invalid date, unknown class, missing Guardian reference and financial difference.

Generated files are temporary QA artifacts. They are not evidence of real source quality, real scale, a successful import or operator acceptance.

## Dry-run results

Every dry run creates:

- `PACKAGE_VALIDATION.json`
- `FIELD_MAPPING_REPORT.csv`
- `ROW_ERROR_REPORT.csv`
- `DUPLICATE_CANDIDATES.csv`
- `REFERENCE_ERRORS.csv`
- `FINANCIAL_RECONCILIATION.csv`
- `IMPORT_WAVE_SUMMARY.json`
- `APPROVAL_CHECKLIST.md`

CSV cells are formula-neutralized. Reports identify fields by safe file/row/field IDs. Detailed source and normalized values appear only in the private field-mapping report. The tool requests owner-only directory/file modes (`0700`/`0600`) where the operating system supports them; the approved private storage ACL remains an operator gate, especially on Windows. Dry-run output always records `actualImports: 0`, `authoritativeWriteCount: 0`, and `readyForPrivateStagingImport: false` until separate approvals exist.

## Approval and separation of duties

The designed stages are `SOURCE_RECEIVED`, `SOURCE_VERIFIED`, `MAPPING_PREPARED`, `DRY_RUN_COMPLETE`, `DATA_OWNER_REVIEW`, `PRIVACY_REVIEW`, `FINANCE_RECONCILED`, `TECHNICAL_APPROVAL`, `OWNER_APPROVAL`, `READY_FOR_PRIVATE_STAGING_IMPORT`, `REJECTED` and `SUPERSEDED`.

Future roles are Source Custodian, Data Preparer, Domain Reviewer, Finance Reviewer, Privacy Reviewer, Technical Operator and Final Owner Approver. One person must not silently export, transform, approve and import every domain. This is an internal control, not a government workflow.

## Quality scorecard

Quality is reported separately for provenance coverage, required-field completeness, format validity, reference integrity, duplicate resolution, financial reconciliation, privacy-decision coverage, approval coverage and rollback readiness. These dimensions must not be collapsed into a misleading readiness percentage.

## Actual-onboarding entry gates

Actual onboarding remains blocked until all applicable gates pass:

1. Repository is private.
2. Private HTTPS staging exists and ownership is approved.
3. Source packages are securely received, hashed and provenance-verified.
4. Data owners, authority and source conflicts are decided.
5. Privacy/minimisation, sensitive fields and retention are approved.
6. Mappings and duplicate process are approved.
7. Finance opening position is reconciled.
8. Synthetic and private-staging dry runs pass.
9. Encrypted backup, restore and rollback rehearsal pass.
10. Owner explicitly approves exact waves and package/mapping hashes.
11. Real users remain inactive through post-import validation.
12. Production cutover receives a separate decision.

## Owner questions for the future phase

The future questionnaire must record legacy systems/files, academic years and historical depth, authoritative sources, approximate Student/Staff counts, fee-history and opening-due requirements, Guardian quality, documents/photos, sensitive fields, retention, desired deadline, named operators/reviewers, acceptable downtime and legacy fallback period. Unknown answers remain unknown; this preparation release does not need them.

## Current state

- Real data: **NOT RECEIVED OR PROCESSED**.
- Repository visibility: **PUBLIC at preparation time; actual onboarding blocked**.
- Private staging: **REQUIRED, NOT CREATED BY THIS RELEASE**.
- Real users: **INACTIVE / NOT AUTHORISED**.
- OCR: PR #19 remains separate and blocked; document scanning is unavailable.
- Deployment, DNS, provider purchase and activation: **NOT AUTHORISED**.

See the [current-state audit](./REAL_DATA_ONBOARDING_CURRENT_STATE_AUDIT.md), [package specification](./IMPORT_PACKAGE_SPECIFICATION.md), [validation rules](./DATA_VALIDATION_RULES.md), [privacy gates](./REAL_DATA_PRIVACY_AND_RETENTION_GATES.md), and the generated [future execution prompt](./prompts/REAL_DATA_ONBOARDING_1A_R1.md).
