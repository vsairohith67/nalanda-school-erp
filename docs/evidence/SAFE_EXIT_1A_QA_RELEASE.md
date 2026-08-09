# SAFE-EXIT-1A Independent QA Release

Date: 2026-08-09  
Feature branch: `safety/student-early-departure-gate-pass`  
Release tag: `student-safe-exit-v38-2026-08-09`

## Independent safety proof

Only copied `SAFEEXIT1QA` and `SAFEEXIT1BROWSER` fixtures were used. Independent review hardened same-origin and bounded-body handling, linked-Guardian and standing-authorisation revalidation, approval snapshot staleness, incident/pass separation, same-day campus state, retry recovery and immediate leadership fallback. The copied-database matrix deployed twice, restored version-38 data twice, preserved append-only request/consent/approval/pass/presence/handover/notification/incident/audit records, and proved single-use checkout under concurrency without rewriting attendance.

Production-runtime Browser QA covered Parent, Teacher, Office, Principal, Director, Gate Staff, Accountant and Viewer at 1366 x 768 and exact 390 x 844 in light/dark. It proved the dedicated Parent route and navigation, linked-context isolation, role-restricted controls, live roster, 44 px actions, keyboard focus, no page overflow, readable print, manual verification, one successful checkout and reuse denial. The printed pass showed **NALANDA PUBLIC SCHOOL** in Georgia bold; the QR remained an opaque signed token. Browser console warnings/errors and production stderr were zero after remediation.

## Migration, recovery and operational baseline

The additive migration `20260809140000_student_safe_exit_gate_pass` was rehearsed twice on a protected copy; the second deploy was a no-op. The raw rollback artifact matched the pre-migration operational SHA-256 `5305C7EBCD5EE68B8976F3A7707FBCE73A8904457C3928ADC4545F3C66EDDE54`. After the proven operational migration, the database SHA-256 is `41F8DCE54360D9B47714AD1C97CEA8BF0C9AD1723FDF8DA906AA5C45F79AC0C1`, migration status is clean, and all Student, active-enrollment, Payment, Guardian, Staff, Support and Safe Exit tables remain zero. The four protected accounts remain exactly one active `SUPER_ADMIN` and inactive/suspended `ADMIN`, `ACCOUNTANT` and `VIEWER`; sessions remain zero.

Version-38 logical backup and restore coverage excludes passwords, signing/session secrets, push subscriptions, full provider payloads and unnecessary Guardian data. No real departure was processed, no live WhatsApp provider was activated, emergency override remains policy-controlled and default release without current consent is blocked.

## Release boundary

The final serialized release sequence passed 328 page routes, 527 API routes,
zero-row lifecycle dry run, full partitioned typecheck, 197 passing test files
(one skipped), 1,749 passing tests (three skipped), production build, version-38
backup `nalanda-fee-control-backup-2026-08-09-22-06.json` and Git safety. The
retained feature branch, synchronized private `main` and annotated release tag
are verified identical after release. No deployment, live provider, real-data
onboarding or transport workflow is included. Next governed phase: `OBS-1A`.
