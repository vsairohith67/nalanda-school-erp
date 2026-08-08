# Staff Payslip Request Developer Guide

## Boundary and reuse

The workflow reuses `StaffMember`, `User`, IAM role context and sessions, the Notification Centre, private/no-store response conventions, append-only audits and backup version 37. It does not call payroll calculation, create payroll results, generate salary PDFs, or post to Payment, Expense, Cash Book or banking records. Prompt 23I remains a separate V1.5 permission surface.

The additive models are `StaffPayslipRequest`, `StaffPayslipRequestMonth`, `StaffPayslipRequestEvent`, `StaffPayslipMonthAvailability`, `StaffPayslipDocumentVersion`, `StaffPayslipDocumentMonth` and `StaffPayslipAccessEvent`. Public keys are opaque; numeric IDs and storage paths never enter client DTOs.

Staff APIs live under `/api/my-payslip-requests`; management APIs live under `/api/payslip-requests`. Every service call resolves the active server-held role context. Staff identity comes from the active User-to-Staff link, never a client Staff identifier. Mutations use expected versions or unique request keys; overlapping open Staff/month requests and concurrent issue/replacement fail closed.

## PDF and secret configuration

Set an absolute, validated `QPDF_EXECUTABLE_PATH`. The adapter invokes qpdf without a shell and supplies both opening and owner passwords through standard input using qpdf's `@-` argument-file mode. It enforces a timeout and private processing directory, validates the derivative and refuses service when capabilities are missing.

`PAYSLIP_REQUEST_KEYRING_JSON` supplies versioned external AES-256 keys. No key belongs in Git, SQLite, backup JSON or planning systems. `PAYSLIP_REQUEST_STORAGE_ROOT` and `PAYSLIP_REQUEST_TEMP_ROOT` must resolve to private, non-public directories. Development and QA use only synthetic copied-database keys.

## Verification

Run the copied-database matrix with `pnpm.cmd qa:payslipreq1`, focused tests, typecheck, isolated Browser fixtures, the full suite, final 4 GB build, backup and Git safety sequentially. The migration may remain unapplied on the operational database until independent QA approves it. Never point fixtures, qpdf processing or asset restore at `prisma/dev.db`.

The access token on a Staff download is opaque, session-bound and short lived. Both route and service re-check active ownership/current version. `Cache-Control: private, no-store` and PWA exclusion are mandatory. Every Staff portal view, password reveal, management source preview and download records only privacy-safe access metadata.
