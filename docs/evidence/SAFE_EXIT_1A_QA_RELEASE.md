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

## STUDENT-EXIT-1A v39 governance completion addendum

Date: 2026-08-10<br>
Retained branch: `safety/student-early-departure-gate-pass`<br>
Release tag: `student-early-exit-v39-2026-08-10`

The existing release was audited against the stricter child-safety prompt before editing. Four material gaps were found and closed additively: temporary out-pass expected-return/overdue escalation, separate leadership approval for standing self-departure, append-only correction evidence, and an explicit attendance-reconciliation flag with policy snapshot. The single hardening migration is `20260809224500_student_exit_return_standing_corrections`; backup format is version 39. The canonical register requirement remains `V1-SAFE-033`, so no duplicate requirement or count increase was made.

Fresh `SAFEEXIT1` and Browser copied-database fixtures proved normal Parent approval and denial, verified telephone/in-person/authorised pickup evidence, current Guardian scope, pending then leadership-approved standing authority, revocation, emergency re-authentication/contact attempts/second verification, signed one-use pass concurrency, temporary checkout/overdue/return, retry-safe notification test sinks, delivery-not-consent, attendance separation, append-only correction, and logical restore twice. Production Browser QA covered Parent, Teacher, Principal/Director, Gate, Accountant and Viewer at 1366 x 768, exact 390 x 844 and 1024 x 768, light/dark, keyboard focus, 44 px controls and no horizontal overflow. Console/hydration errors, native dialogs and clean production stderr were zero. Synthetic Browser fixtures and runtimes were removed and cleanup was inspected twice.

The serialized gate passed 328 page routes / 528 API routes, a zero-change lifecycle dry run, the full partitioned typecheck, 197 passed test files / 1 skipped, 1,750 passed tests / 3 environment-gated qpdf tests, the bounded 4 GB production build, backup v39 and Git safety. Fresh installation reports 16 migrations / 277 models / 277 tables. The protected pre-migration database SHA-256 is `41F8DCE54360D9B47714AD1C97CEA8BF0C9AD1723FDF8DA906AA5C45F79AC0C1`; after the sole additive migration it is `F0101B30697EB20D78733F3A2AED914BC6DD1D50CE546924240FB97C38BF9D2E`. Repeated deploy was a no-op. All operational Student, enrollment, Guardian, Staff, payment and Student-exit counts remain zero; the four protected accounts and zero sessions remain unchanged.

Logical backup `nalanda-fee-control-backup-2026-08-10-00-12.json` and the DATA-0B post-clean rehearsal validated version 39, zero sensitive keys, SQLite integrity, byte-identical rollback, two disposable restores, exact zero-business baseline and unchanged operational hash. Used/expired-pass state, notification deduplication, current status, corrections and immutable event history are covered by the copied-data restore matrix; no provider secret or reusable QR image is backed up.

No real Student release occurred, no real Student/Guardian/notification destination was used, no live push or WhatsApp provider was activated, notification delivery is not consent, attendance remains separately governed, and deployment/real-user onboarding remain unauthorised. Next governed phase: `OBS-1A`.
