# UX-1A-QA Recovery — Batch 3 Checkpoint

Date: 2026-07-30 (Asia/Kolkata)
Branch: `ux/shared-login-shell-redesign`
Starting implementation commit: `e7d549187e51660e82f8904158e85449d50c79a5`

## Security and error-state results

- Unauthenticated private API request: `401`, generic response, `private, no-store`.
- Authenticated copied Parent request to a leadership-only API: `403`, generic permission response, `private, no-store`.
- Authenticated missing page: safe branded `404` with no stack, filesystem path, raw role enum, or database identifier in the visible error state.
- Copied disabled account: denied with the exact generic login message and no enumeration.
- Trusted-source failure burst on a separate copied-database runtime: ninth response remained generic `401`; tenth and repeated responses were generic `429` with `Retry-After` and `private, no-store`.
- Isolated missing-schema runtime: login returned a generic `500`, `private, no-store`, with no stack, SQLite, Prisma, path, or source leak.
- Public website response retained its public-content-only boundary; `/sw.js` remained no-store and its static-cache policy continued to reject APIs, private/no-store responses, documents, redirects, errors, and responses carrying cookies.
- Focused security/PWA/API/UX tests: 67/67 passed.

The intentional 429 and 500 checks ran on separate localhost ports and isolated database/runtime paths. Both runtimes were stopped by verified listener PID after the checks.

## Change Password result

- Current password required; wrong current password, weak password, and mismatched confirmation denied.
- Valid copied-user change succeeded, expired the current cookie, invalidated a second stale session, rejected the old password, and accepted a fresh login with the replacement.
- The fixture password was restored without printing or persisting the ephemeral replacement.
- Audit entries contained only `OWN_PASSWORD_CHANGED`; details were absent.
- UI fields retained password types and correct autocomplete, the policy was visible, no value attribute serialized a password, and the submit target measured 44px after the QA fix.

## Regression smoke result

Independent production Browser smoke passed for:

- Students, Payments, Receipt Audit, Student Attendance, Staff Attendance, and Homework;
- Exams, Marks, report cards, Library, certificates, and notifications;
- notification management, WhatsApp, SMS/email, AI Assistant, fee-register OCR, and Cloud Backup;
- public website administration, the public website, and the authenticated not-found state;
- Teacher and Parent portal shells retained from the completed Batch 1 role matrix.

Every checked route reached its intended safe surface with zero document-level horizontal overflow and no visible raw role enum. Browser warning/error logs were 0, hydration errors were 0, and native dialogs were absent.

## Final clean-runtime confirmation

A fresh copied-database production runtime on a new localhost port completed a 390x844 login, dashboard, and logout pass with:

- console warnings/errors: 0;
- dialog present: no;
- document-level horizontal overflow: no;
- authenticated shell absent after logout: yes;
- production stderr: 0 bytes at checkpoint.

No operational database was used by any Batch 3 mutation or synthetic workflow.
