# Schoolknot Synthetic Write-Test Plan

Status: **plan only; no test was run**

Run only in a vendor-approved non-production tenant with invented data. Never use a real Student, Guardian, Staff, payment, file, contact, credential or provider account.

| Test | Why / role | Synthetic setup and action | Validation and audit | Cleanup / boundary | Blocks |
|---|---|---|---|---|---|
| SWT-01 authorization | Menus cannot prove server scope; all roles | Owner role plus blocked role; direct URL/API and cross-object IDs | `403`/safe denial, unchanged data, actor/scope/result audit | Delete/quarantine tenant fixtures; no real IDs | Cutover |
| SWT-02 Teacher attendance | Critical Nalanda/source scope uncertainty; Teacher/Principal | Assigned class submit/lock/correct plus other section/class, no assignment, substitute and override cases | Exact assignment source, state timestamps, reasoned override and immutable trail | Copied/nonprod DB only | 23C implementation and Teacher cutover |
| SWT-03 Homework/Classwork/files | Submission/file lifecycle unproven; Teacher/Parent | Create/publish, submit/resubmit, feedback, correct/withdraw, unrelated child/class, expired link | Object authorization, versions, MIME/size/malware, notification and deletion state | Synthetic files; verify byte/object cleanup | 23F architecture and parity |
| SWT-04 marks | Moderation/assignment unproven; Teacher/Principal | Partial/complete entry, submit/return/approve/lock/correct, unassigned exam | Range/missing checks, segregation, history and direct denial | Remove synthetic exam cohort | Cutover evidence |
| SWT-05 report cards | Publication lifecycle unproven; Teacher/Principal/Parent | Issue, Parent view, correction/new version, withdrawal; Teacher direct issue denial | Immutable versions, audience isolation, actor/reason | Remove synthetic cohort after evidence | Cutover evidence |
| SWT-06 communications/events | Audience/side effects unproven; Principal/Teacher/Parent | Preview, approve/publish, deliver/read, correct/cancel/withdraw | Audience snapshot, delivery/read state, change history and blocked recipient | No live channel; MOCK/nonprod only | 23E and communication parity |
| SWT-07 leave/substitutes | Approval and dated duty scope; Staff/Teacher/Principal | Request/approve/reject/cancel, assign/confirm substitute | Authority, conflicts, exact duty access, notifications and history | Remove fixtures | Role parity |
| SWT-08 finance | Refund/gateway/Day Closer unproven; Accountant/Management | Split payment, duplicate reference, cancellation/refund approval, callback/retry and day close states | Ledger invariants, settlement/reconciliation, source drift, direct-delete denial | Approved nonprod merchant only; otherwise do not run | Finance feature design and cutover |
| SWT-09 Parent isolation | Single-child audit insufficient; Parent | Two linked children plus one unrelated child across every list/detail/file/export | Uniform denial and no cache/log leak | Remove links/users/files | Parent cutover |
| SWT-10 password/session | Legacy/source backend safety; all roles | Wrong/current password, policy failure, success, rate attempts, concurrent/idle/absolute/logout reuse | CSRF, rate limit, rotation/invalidation and no credential logging | Destroy test account/secrets | Parity evidence |
| SWT-11 admissions/bulk | Funnel and recovery unproven; Admissions owner | Consent, duplicate enquiry, follow-up/conversion; preview/confirm/cancel bulk action | Provenance, dedupe, retention, partial failure/recovery and batch history | Remove synthetic funnel | 23H and migration |
| SWT-12 exports | Contents/formulas/role scope unproven; authorised report roles | Generate only synthetic allowlisted reports from owner and blocked roles | Schema/count/formula, branch/role isolation, watermark/audit and retention | Destroy files and verify cleanup | Migration/cutover |

Vendor help is required for source tenant provisioning, role mapping, hidden feature flags, gateway callbacks, file storage, export schemas and cleanup confirmation. Nalanda implementation must not wait on Schoolknot parity evidence where the school has already approved a safer independent design, but cutover/migration claims still require the relevant proof.
