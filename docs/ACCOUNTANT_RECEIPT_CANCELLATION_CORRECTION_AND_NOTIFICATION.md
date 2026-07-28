# Accountant Final-Receipt Cancellation, Correction and Leadership Notification

## RECON-1A status — 28 July 2026

Prompt 23B and FIN-2B were initiated in parallel. Their preserved final Git lineage applies the Prompt 23B-QA consolidation first and the two FIN-2B commits second. RECON-1A changes no finance behavior: it records this document as the authoritative supersession for Accountant final-receipt policy while retaining all unrelated Prompt 23B conclusions.

FIN-2A privacy/export/receipt-integrity hardening and FIN-2B/FIN-2B-QA are complete. No approved or implemented `FIN-2C` scope exists. Refund, chargeback, live gateway/settlement, Day Closer, payroll and employee self-service remain separate evidence and approval gates.

## FIN-2B policy

FIN-2B deliberately supersedes only the earlier FIN-2A and Prompt 23B wording that prohibited Accountant final-receipt cancellation or left Accountant correction unresolved. Every FIN-2A privacy, export, receipt-integrity, reconciliation, audit and concurrency safeguard remains in force.

An active Accountant may cancel or correct a final issued receipt only when the effective role bundle contains the exact narrow permission:

- `CANCEL_FINAL_RECEIPT` for whole-receipt cancellation;
- `CORRECT_FINAL_RECEIPT` for governed correction.

Super Admin, Director and Accountant receive both permissions by default. Principal, Admin, Viewer/Auditor, Teacher and Parent do not. Broad finance permissions such as `MANAGE_FINANCE`, `EDIT_PAYMENTS` or the legacy `CANCEL_PAYMENTS` do not substitute for either authority. The page, dialog, authenticated API and transaction helper use the same server-side policy.

Cancellation is not deletion and is not a refund. Correction never silently overwrites a final receipt.

## Cancellation transaction

Cancellation claims the expected receipt version and changes every `Payment` component under the logical receipt in one database transaction. A split Cash plus UPI receipt cannot be partially cancelled. The transaction synchronizes `ReceiptNote`, reverses fee allocation, reopens dues, removes the effective amount from Daily Collection, Cash Book live sources and dashboard collection totals, and appends immutable receipt audit rows. The original `Payment` and `ReceiptNote` records remain.

The print and exports derive the effective cancelled state from `Payment` rows. Receipt Audit and Student Ledger retain the original financial history. Repeating a completed request is financially idempotent; competing attempts can produce only one logical result. A stale expected version returns conflict. Failure of financial change, audit or required notification persistence rolls the entire transaction back.

## Governed correction

A non-financial correction is limited to safe transaction-reference or remarks metadata. It creates an immutable before/after audit version and keeps the original receipt number, amount, date, modes, Student, admission and allocations.

A financial correction uses governed cancellation and reissue. Amount, Student/admission, fee type or term allocation, payment mode/account, payment date and the academic year implied by the corrected Student/date are treated as financial facts. The original logical receipt is cancelled intact, a new linked replacement receipt is issued with a new `-R1` to `-R99` number, and both sides receive immutable supersession/reissue audit linkage. The target Student must exist in Student Master and only the finance-minimised identity is used. Allocations and dues reconcile against the replacement. The original receipt number and history remain immutable. This is not an in-place edit, deletion or refund.

## Locked accounting days

For an Accountant, a related Cash Book day is mutable only when no day record exists or its state is `DRAFT` or `REJECTED`. `SUBMITTED`, `APPROVED`, `LOCKED` and any other non-mutable state block the ordinary Accountant action with a controlled response. The financial rows and stored snapshot remain untouched, while an idempotent in-app review alert is created for active Directors and Super Admins.

Existing authorised leadership correction remains the correction path. Leadership action changes the live financial source while preserving the locked snapshot, so source drift remains visible for reconciliation. FIN-2B does not silently rewrite a locked snapshot and does not add a large approval subsystem.

## Leadership notification and privacy

Every successful Accountant cancellation or correction creates one logical unread in-app notification for each active Director and Super Admin. The idempotency key is tied to the immutable receipt audit event. Reading a notification does not delete its history.

Visible content is limited to the safe receipt reference, action, amount/date, Accountant display label, privacy-filtered reason, India-local timestamp, old/new or replacement reference, reconciliation warning where applicable, and the internal `/receipt-audit` link. It excludes guardian contact, address, date of birth, Aadhaar-related values, marks, medical information, credentials, session data, internal database identifiers and unnecessary Student details. No WhatsApp, SMS, email, push or provider call is made.

If no active Director or Super Admin exists, the valid financial action is not rolled back. A safe skipped delivery row and system-health/audit warning record the leadership-coverage defect.

## Receipt Audit operator guide

1. Open **Receipt Audit** or **Payments**, then open the final receipt review.
2. Confirm the receipt number, amount, date, payment-mode summary and component count.
3. Choose **Cancel entire receipt** or **Correct final receipt** only for a genuine correction.
4. Enter a specific reason of 3 to 500 trimmed characters. Do not enter markup, contact details or other sensitive Student information.
5. Review the history-preservation, dues/collection and locked-day warning in the in-app dialog.
6. Submit once. On a version-conflict response, refresh and re-review instead of forcing the request.
7. Verify Receipt Audit, dues, Ledger, Daily Collection, Cash Book, dashboard, print/export state, and the Director/Super Admin notification inboxes.

The dialog is keyboard accessible, traps focus while open, returns focus on close and does not use native browser prompts.

## API contract

The cancellation and correction endpoints require an authenticated active session, exact permission, object access, same-origin/CSRF protection, bounded JSON, expected version, meaningful safe reason and an active final receipt. Responses are private/no-store and use controlled 400, 403, 404, 409 or 500 results without exposing Prisma details, filesystem paths or secrets.

## Independent FIN-2B-QA closure

Independent QA on 28 July 2026 used only ignored `FIN2BQA` synthetic fixtures in a fresh copied SQLite database. It verified the exact permission defaults, authenticated API and page-route enforcement, five denied roles, reason/version/origin controls, split-receipt atomicity, `ReceiptNote`, allocation/dues and reporting reconciliation, non-financial versions, financial cancellation/reissue, immutable receipt numbers, original/replacement linkage, locked-day review, exactly-once leadership notification, privacy minimisation, missing-leadership warning, concurrent/retry idempotence, forced rollback, print/export state, and no external delivery channel.

QA found and fixed two defects before clearance:

- generic payment-view access could load the governed edit page even though the APIs and actions were narrowly protected; the page now requires restore, `CANCEL_FINAL_RECEIPT`, or `CORRECT_FINAL_RECEIPT` authority before it resolves the receipt;
- version-37 restore skipped immutable `PaymentAudit` rows when the original actor account was absent; restore now preserves the original actor display snapshot and links the required local foreign key to the authorised restore operator.

The copied version-37 backup contained 27 FIN2BQA Payment components, 19 immutable audits, nine `ReceiptNote` rows, seven in-app leadership campaigns and 12 recipient rows. A separate copied restore preserved all 27 components, all 19 audits, all nine notes, the `973103` to `973103-R1` correction history, and remained count-idempotent on retry. Cleanup returned zero FIN2BQA users, Students, enrollments, Payments, notes, audits, Cash Book days, campaigns, recipients and events in two consecutive inspections; the copied database, runtime credential state and logs were then removed.

Production Browser QA covered Accountant controls/dialogs, the locked-day warning, the corrected/replacement print views, Receipt Audit, Director and Super Admin inboxes, and denied Admin access. Desktop `1366x768` and exact mobile `390x844` passed in light and dark themes with no page horizontal overflow, no visible control below 44 px, labelled required reason, modal focus containment/return, no native dialog, zero console warnings/errors or hydration errors, and zero production stderr bytes.

Final verification passed 274 page routes, 378 API routes, zero-write lifecycle backfill, typecheck, 1,520 tests across 165 files, the 212/212 production build, version-37 backup/restore and Git safety. No Prisma schema or migration change was required; backup format remains version 37.

FIN-2B adds no payroll, refund, chargeback, payment gateway, provider delivery, staging deployment or unrelated Schoolknot gap work.

Pre-existing local operational data of unverified provenance, currently believed to be sample/demo data. Deletion remains separately gated by DATA-0A.
