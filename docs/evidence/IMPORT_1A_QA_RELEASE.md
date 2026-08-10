# IMPORT-1A Independent QA and Release Evidence

Date: 2026-08-10

Result: `BULK_ONBOARDING_CLEARED`

IMPORT-1A is cleared locally/private for the governed software workflow. This
does not authorise a real workbook, operational Student/Guardian/Staff import,
deployment, provider activation, or real Parent/Staff account activation.

## Independent corrections

- routed `qa:import1a` through the isolated copied-database wrapper;
- made rollback compare every batch-owned record with its recorded after-hash
  and block on later manual edits, account activation, Support, Payroll,
  Payment, Attendance, Marks, Report Card, Classwork and Safe Exit activity;
- completed bounded possible-match decisions for Student, Guardian and Staff,
  with explicit reasons, safe create/link behavior and ambiguous-link refusal;
- added workbook-level Guardian-contact and scoped roll-number collision checks;
- expanded malicious OOXML/container and upload-boundary coverage;
- enforced 44 px onboarding controls and visible focus styling.

## Workbook and file-security evidence

All three generated template families passed parser-based structure checks.
The cover uses `NALANDA PUBLIC SCHOOL` in Georgia Bold; required sheets,
metadata, code lists, validations, protected cells, example-row exclusion,
date/phone guidance and Unicode values were verified. Tests refuse macros,
external links, embedded objects, encryption, hidden unexpected sheets,
malformed/high-expansion containers, excessive dimensions, traversal,
symlinks, extension/MIME/size mismatches and formulas in user-entry cells.
Rejected files created no retained private residue.

## Validation, execution and rollback evidence

Copied-database QA proved all-or-nothing execution, exact lineage,
same-request idempotent replay, changed-request refusal, forced-failure atomicity,
account activation count zero, reconciliation, restore v41 and exact rollback.
Manual edits correctly block automatic rollback without deleting the record.
The stress batch completed and rolled back exactly with 1,000 Students, 1,500
Guardians, 1,000 Student-Guardian links, 1,000 enrollments, 100 Staff and 4,600
row outcomes in 9.7 seconds. No provider was called.

## Browser and accessibility evidence

The private Import Centre passed at 1366 x 768 and exact 390 x 844 in light and
dark themes. It had no page-level horizontal overflow, all visible workflow
actions were at least 44 px, the mobile drawer returned focus to its opener,
and fresh console warning/error counts were zero. Director, Principal, Admin
and Computer Operator access passed; Principal could not approve the Staff
fixture. Accountant, Teacher, Parent and Viewer were routed to `/unauthorized`.
Server-side permissions remain authoritative.

## Verification ledger

| Gate | Evidence |
| --- | --- |
| Focused QA | 19 onboarding/workbook/governance/shell tests passed |
| Full tests | 201 files passed, 1 skipped; 1,777 tests passed, 3 skipped |
| Typecheck | Complete partitioned repository typecheck passed |
| Production build | Passed after the final accessibility correction |
| Routes | 331 page routes; 545 API routes |
| Fresh migration/restore | 18 migrations; clean install, copied migration twice and restore twice passed |
| Backup | Logical backup v41 and restore are idempotent; private workbook bytes, passwords and active session secrets are excluded |
| Git safety | Candidate, staged and tracked scans passed |

## Operational migration and baseline

Before migration, the operational SQLite hash was
`0D84B0E65FAF68BABE7D661506401345B0B2E223AE0749C7D18C488125B73BFE`.
Fresh logical backup
`nalanda-fee-control-backup-2026-08-10-16-22.json` has SHA-256
`F2CAED8E63D1F9D71AB1717E8A3C0D7AF8983D86EC5B0C615AD120B31A63C08D`.
The protected raw rollback copy was byte-identical to the source at 8,327,168
bytes and the same pre-migration hash.

Only migration `20260810184500_governed_bulk_onboarding` was applied. The clean
post-migration hash is
`65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.
Before and after migration the business/account baseline remained: 0 Students,
0 active enrollments, 0 Payments, INR 0 active payment amount, 4 Users, 4 active
role assignments and 1 active Super Admin. All three onboarding tables contain
zero rows.

## Release boundary

The retained feature branch, `main`, and annotated tag
`bulk-onboarding-v41-2026-08-10` are the governed release references. Real
onboarding requires a separately approved maintenance/import phase with fresh
logical, raw-database and applicable encrypted-asset backups plus reconciliation
and rollback readiness. The next governed phase is `RELEASE-OPS-1A`.
