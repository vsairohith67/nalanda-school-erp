# IMPORT-1A Governed Bulk Onboarding

## Release boundary

IMPORT-1A is a private, local implementation for governed Student, Guardian,
Student-Guardian link, academic-year enrollment and Staff onboarding. It does
not authorise real-data import, deployment, live providers, Parent or Staff
account activation, payments, balances, marks, attendance, payroll, documents,
government identifiers, transport or cafeteria data. Implementation and QA use
fresh synthetic fixtures on copied databases only.

## Architecture and transaction boundary

The private Import Centre at `/onboarding` orchestrates thirteen explicit
steps: bundle selection, template download, private upload, validation, issue
review, error workbook, duplicate resolution, dry-run review, approval,
execution, reconciliation, safe rollback and history. The module reuses
`Student`, `Guardian`, `StudentGuardian`, `AcademicYearEnrollment`,
`StaffMember`, IAM permission profiles and OBS-1A background-job records. It
does not create parallel domain masters.

`OnboardingBatch` stores an opaque batch reference, workbook and plan hashes,
version/status, approval/execution state, private-storage metadata and bounded
retention. `OnboardingRowOutcome` provides source-row lineage and target hashes.
`OnboardingAuditEvent` is append-only status and evidence history. Execution
runs one fixed import order inside one Prisma transaction. Any error rolls back
every domain and lineage write in that execution.

Private workbook bytes live below `ONBOARDING_STORAGE_ROOT` or the default
`storage/onboarding` root with opaque names, exclusive creation, restricted
file/directory modes, canonical-path checks, symlink refusal, bounded size and
SHA-256 verification. They are never public URLs, PWA assets, ordinary JSON
backup content, Git artifacts, logs or planning attachments.

## Workbook families and versioning

The ERP generates three `.xlsx` bundles:

1. `STUDENT_GUARDIAN`
2. `STAFF`
3. `COMBINED`

All include Instructions, Template Metadata, Academic Years, Classes and
Sections, Students, Guardians, Student-Guardian Links, Enrollments, Code Lists,
Validation Summary and Import Batch Reference. Staff and Combined include the
Staff sheet. Template version `1.0` is bound to application schema
`IMPORT-1A-2026-08-10`; unknown template/schema/bundle combinations fail closed.
The cover contains `NALANDA PUBLIC SCHOOL` in Georgia bold. Instruction,
metadata, reference and placeholder sheets are protected. Entry sheets contain
controlled dropdowns and no formulas. Example rows are marked `YES` and are
excluded from import.

Reference exports contain display values only. The workbook contains no
internal database IDs and no real school data. A future correction/update
family requires separate explicit authorisation and a new mode/version; the
current mode is `CREATE_AND_LINK` only.

## Data dictionary

### Students

`Import Row Key`, `Admission Number`, `Student Full Name`, `Father Name`,
`Mother Name`, `Phone`, `Alternate Phone`, `Date of Birth`, `Academic Year`,
`Class`, `Section`, `Roll Number`, `Student Status`, bounded `Notes`, and
`Example Row`. Admission number is required because no governed sequence
reservation mode is authorised.

### Guardians and relationships

Guardian fields are row key, name, relationship, mobile, alternate mobile,
email, communication preference, Parent-account proposal and example marker.
Link fields are link row key, Student row key, Guardian row key, relationship,
primary-contact flag, fee-visibility flag, reminder flag and example marker.
One Guardian can link to multiple Students and one Student can link to multiple
Guardians. Contact values are not verified login aliases. A Parent-account flag
creates only a lineage proposal with status `PENDING_ACTIVATION`.

### Enrollments

Enrollment row key, Student row key, academic year, class, section, roll
number, enrollment date, status and example marker. Academic year/class/section
must exactly match an active `TimetableClassSection` display reference.

### Staff

Staff row key, employee code, name, Staff type, designation, department,
joining date, work/personal email, mobile, role proposal, portal-account
proposal, employment status, bounded notes and example marker. Designation and
department resolve against current approved Staff reference values. A portal
flag creates only a pending IAM proposal; no User, password, active role or
verified alias is created.

Excluded fields include Aadhaar, PAN, UAN, bank data, salary, statutory
identifiers, medical data, residential coordinates, payment data, marks,
attendance, documents, transport and cafeteria details.

## Validation and file security

Container validation occurs before workbook parsing. Limits are 10 MiB upload,
160 ZIP entries, 64 MiB total expansion, 14 sheets, 5,000 rows per sheet, 64
columns and 4,000 characters per cell. The parser rejects malformed signatures
or central directories, traversal, ZIP bombs, password-protected packages,
macros or binary parts, ActiveX/OLE/embedded objects, external relationships,
hidden or duplicate/unexpected sheets, formula cells, formula-injection text,
unknown headers, missing sheets and unsupported versions.

Field validation normalises Unicode NFC, whitespace, enums, Indian mobile
numbers and exact `YYYY-MM-DD` or `DD/MM/YYYY` dates. It checks required values,
future dates, email shape, within-workbook row-key/admission/employee/link and
enrollment duplicates, cross-sheet orphans, active academic references,
existing Student admission numbers, Guardian contact candidates and Staff
codes. Ambiguous or inactive reference results block approval.

Every issue carries a stable code, severity, sheet, original row, column,
message and suggested action. Error workbooks neutralise spreadsheet-formula
prefixes in every generated value and remain private/no-store.

## Duplicate and conflict policy

No row is silently overwritten. Exact existing identifiers require a recorded
`LINK_EXISTING`, `SKIP` or `REJECT_ROW` decision with a reason. `CREATE_NEW` is
refused when a governed identifier already exists. `UPDATE_EXISTING` is refused
because update mode is not authorised. Links/enrollments that depend on skipped
rows are blockers. Resolutions are part of the plan hash and become stale when
the workbook, reference data or target records change.

## Permissions and approval

The module registers nine narrow permissions: template download, upload,
validate, resolve, approve, execute, audit, rollback and reference export.
Super Admin and Director receive full default authority. Principal can prepare,
review and approve only the Student/Guardian bundle and cannot execute or roll
back by default. Admin can prepare/resolve but not approve or execute. Computer
Operator can download/upload/validate/audit but not resolve, approve, execute or
roll back. Accountant, Teacher, Parent and Viewer are denied by default.

Approval, execution and rollback require current-password re-authentication and
a bounded reason. Plan/workbook hashes, version and expiry are rechecked.
Privileged IAM proposals require separation of duties and cannot be approved by
their uploader. Non-privileged batches use the documented single-actor model:
permission plus re-authentication is sufficient, while approval remains a
separate action from execution.

## Dry run, execution and idempotency

Dry-run output shows workbook/template hashes, per-sheet rows, creates, links,
enrollments, skips, warnings, blockers, duplicate decisions, affected academic
years/classes/departments/designations, pending account proposals, fixed import
order, rollback feasibility and estimated execution size. Plans expire after
30 minutes.

Execution re-parses the hash-verified private workbook and recomputes the plan,
reference hash and target hash. It claims the approved batch with optimistic
versioning and a unique idempotency key, then creates or links records in the
approved order in one transaction. A matching replay returns the stored result;
the same key with different input is refused. Observability stores only safe
job status, duration timestamps, attempt count and error fingerprints.

## Reconciliation and rollback

Reconciliation reports created, linked, skipped and pending-account-proposal
counts plus a checksum. Each affected row retains source sheet/row/key, action,
status, target reference and before/after hashes.

Automatic rollback is available only for exact batch-owned creations that
remain unchanged and have no later payment, attendance, marks, report card,
classwork, Safe Exit, account activation or Staff edit dependency. Preview and
execution require re-authentication and a reason. Rollback deletes dependent
links/enrollments before Staff/Guardian/Student records and retains immutable
audit/lineage. Any dependency blocks automatic rollback and requires a manual
compensating reconciliation; executed updates are outside this phase.

## Backup, recovery, retention and observability

Logical backup version 41 preserves privacy-safe template/batch/plan/issue/
resolution/lineage/outcome/rollback metadata. Actor IDs, reasons, submitted
values, raw target IDs, private storage paths and workbook bytes are removed or
hashed. Restore is idempotent and recreates metadata as `RECOVERY_REQUIRED`
under the restoring operator. A batch cannot be approved or executed until the
encrypted private workbook is separately recovered and revalidated.

Source and error workbooks default to a 30-day purge deadline. Purge execution
is deliberately not automated in IMPORT-1A; it requires a separately reviewed
retention job. OBS-1A exposes aggregate awaiting-validation/approval/execution,
recovery-required, validation/execution pass/fail, duplicate/replay and rollback
block counts. It never exposes filenames, row values, contacts, people or file
paths.

## Future real-data go-live checklist

Real onboarding remains blocked until a later explicit approval records all of:

- named authorised operators and exact roles;
- approved template/schema and reference-data freeze;
- validated workbook hash and zero unresolved blockers;
- fresh logical backup, byte-identical raw DB backup and encrypted private-asset backup;
- isolated restore rehearsal with recorded hashes;
- maintenance window and communication plan;
- two-person review where privileged IAM proposals exist;
- exact dry-run/reconciliation totals and spot-check method;
- idempotency key custody and rollback/manual-correction plan;
- post-import IAM activation remains in AUTH-2B/IAM-1A;
- no payment, marks, attendance, payroll or document import in this phase.

## Known limitations and technical debt

- No authorised correction/update workbook exists.
- Reference data for Staff designation/department comes from current approved
  Staff values because dedicated masters are not present.
- Validation/execution is synchronous and sequential; OBS-1A records each run,
  but a future bounded queue may be warranted for much larger approved imports.
- Private workbook encryption-at-rest relies on the deployment/private-storage
  policy; no provider or external key service is activated here.
- Automatic retention purge and private-asset restore tooling require separate
  implementation and policy approval.
- Principal bundle scope is enforced in the service and UI; custom permission
  grants still require governance review.
- No real-data scale or physical operator acceptance is claimed.
