# HR-PAYSLIP-REQ-1 Independent QA

**Date:** 2026-08-09

**Implementation branch:** `hr/staff-payslip-request-secure-delivery`

**Implementation commit:** `7594ffb33e4d4ae05541570bd29b265032198c69`

## Security validation rubric

- [x] Untrusted request, PDF and document-handle inputs reach only explicitly validated, role- and object-scoped operations.
- [x] PDF intake and qpdf protection fail closed, preserve visible content, and do not expose passwords or keys through arguments, logs, storage or backups.
- [x] Password reveal requires the exact owning Staff context, recent re-authentication, valid session, origin/CSRF controls and rate limits; plaintext is transient.
- [x] Issued/replaced documents are immutable, private/no-store, session-bound, independently hash-verifiable and recoverable with the external key only.
- [x] Fresh copied-database, Browser, migration, backup/restore and rollback evidence covers positive paths, negative controls, concurrency and forced failures without operational-data mutation.

## Preflight

- Feature branch, remote and implementation commit are synchronized.
- Private `main` and `origin/main` remain at `6e531e5f893922bee7bcc0774852ce9fe81203d8`.
- Git safety passed with a clean worktree before QA artifacts.
- Operational database SHA-256 is `1AA6B2A4542F6B3316A1E32B846C1FDD07DC0B14A7335288FAC2529CB374CDE7`.
- Operational baseline is 0 Students / 0 active enrollments / 0 Payments / 0 Guardians / 0 Staff, four protected accounts, zero sessions/payroll runs/payslip versions.
- Additive migration `20260808213000_staff_payslip_request_secure_delivery` is the sole unapplied migration.

## Validation results

- Static changed-surface review completed across schema/migration, permissions, APIs, UI, PDF/crypto/storage, notifications and backup/restore.
- Reproduced and corrected compressed-object-stream active-content evasion; the qpdf-backed regression now rejects hidden JavaScript/OpenAction dictionaries.
- Corrected preparation assignment so only an effective `PREPARE_PAYSLIP_REQUEST` grantee appears or may be assigned.
- Corrected approval optimistic concurrency and India-time-zone required-by comparisons.
- Fresh `PAYSLIPREQ1QA` copied-database matrix passed role defaults, explicit Accountant grant, Staff/Parent isolation, lifecycle, overlap/stale/concurrent controls, combined/separate issue, replacement, immutable deletion refusal, metadata restore twice, encrypted asset restore twice and cleanup twice.
- First copied production-runtime Browser batch passed Staff multi-month request, Teacher/Parent context isolation, Director review/approval/issue/replacement, explicitly granted Accountant upload without issue authority, Principal/Admin/Viewer default denial, transient re-authenticated password reveal and clearing, protected download, exact 1366x768 and 390x844 layouts, light/dark themes, zero page overflow, zero console/hydration errors and no native dialogs.
- Browser review found and corrected missing management document-version/access presentation and missing assigned-preparer notification; both now have focused regression evidence.
- Second production-runtime Browser batch verified the corrections end to end: the assigned Accountant received exactly one private inbox item, management saw retained version hashes/source preview plus Staff view/reveal/download events, and cancellation/rejection remained governed. Exact 390x844 audit rendering had zero horizontal overflow; Browser logs, hydration errors and native dialogs remained zero.
- Both Browser runtimes were stopped and all proven `PAYSLIPREQ1QA` databases, files, notifications, logs and processing directories were removed and inspected twice. The operational database remained byte-identical.

## Independent lifecycle and month evidence

- The joining month is calculated in `Asia/Kolkata`, including a UTC/India month-boundary fixture. A month before joining, an incomplete/future month and a month after an approved payroll-eligibility end all failed closed.
- `UNKNOWN` was hidden, an existing immutable Prompt 23I payslip was labelled `ALREADY_ISSUED`, and no salary amount was needed to authorise a historical month.
- All ten governed states were observed in append-only events: `SUBMITTED`, `UNDER_REVIEW`, `PREPARATION_IN_PROGRESS`, `READY_TO_ISSUE`, `PARTIALLY_ISSUED`, `ISSUED`, `REJECTED`, `CANCELLED`, `SUPERSEDED` and `EXPIRED`.
- A linked corrected-copy request could target only the owning Staff member's rejected/cancelled request. Final issue atomically superseded that prior request. Issued-document corrections remained on the separate immutable replacement path.

## PDF, password and delivery evidence

- Focused security/governance/backup/qpdf validation passed 4 files and 19 tests. The independent qpdf inspection reported AESv3/R=6, correct-password open, wrong/no-password refusal, distinct opening/owner credentials, printing allowed, and extraction/document/form/annotation modification denied.
- Ordinary and multi-page synthetic PDFs passed. Wrong extension/MIME/magic, truncation, malformed xref, oversize/page-limit, JavaScript/OpenAction (including compressed object streams), Launch, URI/GoToR, embedded file, XFA, form/annotation, encrypted input, traversal/symlink, timeout and resource-boundary classes failed closed before issue storage.
- AES-256-GCM envelopes are version-bound and authenticated. Wrong key/binding/tag fail; plaintext passwords and keys are absent from the database, backup properties, notifications, URLs and audit payloads. Reveal is ownership-, Staff-context-, valid-session-, recent-reauth- and rate-limit-gated, and Browser proof showed the value absent before reveal and cleared after close.
- Staff received only the no-store protected derivative through an opaque session-bound authorisation. Management source access remained separately permissioned and audited. Replaced derivatives became unavailable to Staff while management history remained.

## Release gates and operational migration

- Routes: 320 pages / 495 APIs.
- Lifecycle backfill: dry run, zero changes.
- Typecheck: passed.
- Full suite: 193 files / 1,736 tests passed; the three environment-gated qpdf tests were run separately and all passed.
- Production build: passed with the bounded 4 GB Node heap and clean stderr.
- Backup: version 37 generated before and after migration; no password hash property, plaintext PDF password, session secret or encryption key property was present.
- Git safety: passed.
- The protected pre-migration database was 7,086,080 bytes with SHA-256 `1AA6B2A4542F6B3316A1E32B846C1FDD07DC0B14A7335288FAC2529CB374CDE7`. Its retained raw rollback copy and two restore rehearsals were byte-identical; both rehearsals returned SQLite integrity `ok` and zero foreign-key violations.
- The single additive migration `20260808213000_staff_payslip_request_secure_delivery` applied once; repeat deploy was a no-op and migration status is clean. Post-migration SHA-256 is `78960F7700A9E89CF1D05FA9B1EAE09C7E101886F8F22A6C1D3D88BCD0506F18` with integrity `ok` and zero foreign-key violations.
- Operational counts remain 0 Students / 0 active enrollments / 0 Payments / 0 Guardians / 0 Staff, four protected users (one active), and zero payroll policies, salary structures, compensation assignments, payroll periods/runs/results, Prompt 23I payslip versions, payslip requests and secure document versions.

## Release boundary

No real Staff document or salary value was used. No Email, SMS or WhatsApp provider was activated. Full Payroll/ESS remains separately permissioned V1.5 scope. No deployment or real-user onboarding was authorised. A maintained qpdf installation and external secret-managed keyring remain deployment-time prerequisites; their absence fails closed and no operational secret was requested or stored during QA.
