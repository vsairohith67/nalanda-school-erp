# Prompt 23I-QA independent release evidence

Date: 2026-08-08
Branch: `feature/payroll-payslips-employee-self-service`
Base main commit: `0d6cc25e`
Backup version: 37
Release tag: `payroll-ess-v37-2026-08-08`
Decision: independently cleared for fast-forward release

## Independent review and corrections

Every changed payroll model, migration, route, page, permission, calculation,
report, export, PDF and backup helper was reviewed. QA made these bounded fixes:

- salary-report totals are suppressed by unique Staff contributor for Viewer
  cohorts below three, and Viewer access remains aggregate-only even if a
  permission is misconfigured;
- cancelled or rejected advances do not contribute approved/balance totals;
- future compensation assignments cannot overlap and revisions cannot select an
  expired structure version;
- issued payslip snapshots exclude internal formula/source-version references;
- backup restore validates all payroll graph links, including recovery results,
  prior assignments, revisions, periods and superseded payslips;
- the Windows hard-link safety check compares exact bigint file identities so
  unrelated high-value file indexes cannot collide under parallel tests.

## Fresh copied-database matrix

The isolated `PAY23IQA` matrix used two Super Admins, Director, Accountant,
Principal, Admin/Computer Operator, Viewer, multiple Staff/Teachers, a Teacher +
Parent user and inactive Staff. It covered different structures, revisions,
attendance/leave states, advances and recoveries. The operational database was
not used for fixtures.

Hand calculations passed for full month, mid-month joining, eligibility end,
unpaid leave, configured half-day, fixed/percentage and zero components,
rounding, arrears, manual adjustment, advance recovery and exact gross,
deduction and net totals. Missing/unlocked inputs and unconfigured half-days
failed closed. No statutory formula was inferred.

Versioning/workflow proof covered effective dates, future revision, draft,
calculated, under-review, approved, locked, payslips-issued and reversed states;
locked immutability; preserved prior history; stale-version refusal; concurrent
calculation/approval idempotence; exactly-once issue; and forced rollback.

Advance proof covered concurrent approval, rejection, schedule revision,
cancellation, recovery, remaining balance, duplicate and over-recovery refusal,
and reversal/history. It created no transfer or disbursement. Finance table
counts stayed byte-for-byte unchanged and accounting posting remained
`DISABLED`, so no Payment, receipt, fee allocation, expense or Cash Book movement
was created.

## Privacy, payslip and Browser proof

Director/Super Admin oversight and exact Accountant preparation access passed.
Principal, Admin and Computer Operator were denied by default. Staff saw only
their linked profile; cross-user payslip/advance probes were denied. The Teacher
+ Parent user had to switch explicitly to Staff context; Parent context redirected
to Access Restricted and exposed no payroll navigation or data. Viewer values
below three contributors were suppressed and no salary ranking existed.

Issued payslips matched approved totals, remained immutable/versioned, and used
authenticated no-store opaque downloads. Long names/components and colour plus
monochrome printer-safe A4 PDFs passed. No full bank data, Aadhaar, PAN, UAN,
password, audit payload or raw internal identifier appeared.

The in-app Browser verified payroll administration and ESS at 1366x768 and exact
390x844 in light and dark. Actions were at least 44 px, keyboard focus was
visible, dialogs/tables were accessible, mobile content was contained, and there
were no native dialogs, hydration failures, runtime stderr, console warnings or
console errors. Accountant privilege separation and Parent-context denial were
also exercised through the rendered UI.

## Migration, backup, cleanup and release gates

- Reviewed additive migration applied once to the exact-zero operational
  baseline; repeat deploy was a no-op and all 11 migrations report clean.
- Students, active enrollments, Payments, Guardians and Staff remain zero; all
  13 payroll tables also remain zero. Four protected users/assignments are
  unchanged and there is one active Super Admin.
- The pre-migration SQLite rollback copy is ignored and SHA-256 byte-identical
  to its source. The post-migration backup is version 37, contains 202 arrays and
  all payroll collections, and two independent restore rehearsals passed.
- Browser and copied-database runtimes/files were removed and cleanup was
  inspected twice; no `PAY23IQA` business row reached the operational database.
- Sequential gates passed: 313 pages/480 APIs, zero-change lifecycle dry-run,
  3 GB typecheck, 26 focused safety/payroll tests, 189 files/1,706 tests, 4 GB
  production build, backup/restore and Git safety.

No deployment, real Staff payroll, bank disbursement, statutory filing,
EPFO/ESI automation, live provider or real-data onboarding is authorised. The
next governed phase is Prompt 23J - Transport Routes, Stops, Vehicles and Bus
Passes.
