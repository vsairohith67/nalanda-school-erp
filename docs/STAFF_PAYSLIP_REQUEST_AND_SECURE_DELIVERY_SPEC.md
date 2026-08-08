# Staff Payslip Request and Secure Delivery Specification

**Requirement:** `V1-HR-PSR-001`<br>
**Scope:** V1 workflow specification only; no implementation is authorised by GOV-RECON-1<br>
**Decision date:** 2026-08-08

## Purpose and boundary

Provide a privacy-safe workflow in which a Staff member requests one or more already-recorded payslips and authorised management prepares, uploads and issues the exact documents. This is not a payroll-calculation feature.

The current Prompt 23I release provides immutable calculated payslip snapshots, Staff-owned authenticated download and private/no-store retrieval. It does **not** provide the request queue, uploaded password-protected source document, status notification, separated preparation/upload/issue, download audit, governed replacement workflow or password-delivery controls defined here. Existing code is reusable evidence, not proof that this requirement is complete.

## Actors and default authority

| Actor | Default V1 authority |
| --- | --- |
| Staff member | Create, view and, where permitted, cancel only their own requests; download only issued documents linked to their own Staff account; view only their own download history. |
| Director / Super Admin | View the request queue; review, reject, replace and issue subject to separable permissions. |
| Accountant | No salary-document access by role alone. May receive explicit preparation and/or upload permissions without final-issue permission. |
| Principal | No salary-document access by default. |
| Other roles | No access. |

Preparation, upload and final issue must be three separately assignable permissions. The same person may hold more than one only through an explicit role/profile decision; the audit trail must still record each action separately.

## Staff experience

1. Requests are own-account only. The authenticated User must resolve server-side to one active Staff identity; a submitted Staff identifier is never trusted.
2. Eligible months are the intersection of:
   - the Staff joining month onward;
   - no later than the latest completed salary month; and
   - administrator-configured record availability.
3. A request may cover one or multiple eligible months.
4. The requester selects a bounded purpose category and may add an optional private explanation and optional required-by date.
5. The service refuses duplicate or overlapping open requests for any covered month. A closed rejected/cancelled request may be resubmitted under a documented rule.
6. The Staff view exposes an accessible chronological status timeline with safe, non-salary metadata.
7. The requester may cancel before issue only in permitted pre-issue states. Cancellation requires confirmation and remains audited.
8. Every material status change generates an in-app notification. Material changes are submission, review start, information request, rejection, cancellation, upload/replacement readiness and final issue.
9. After issue, the Staff member receives a private authenticated download action, never a public document URL.
10. The Staff member sees only their own document-download history, including date/time, document version and safe device/session metadata; it must not reveal IP or device data beyond the approved retention policy.

## Management workflow

1. Director and Super Admin have a request queue and privacy-safe dashboard/in-app notifications.
2. A request moves through explicit states such as `SUBMITTED`, `UNDER_REVIEW`, `PREPARATION`, `UPLOADED`, `READY_TO_ISSUE`, `ISSUED`, `REJECTED`, `CANCELLED` and `REPLACED`. Exact state names may change during implementation, but terminal and transition semantics must not.
3. Preparation, upload and final issue are permission-separable.
4. An authorised uploader may upload one PDF per month or one governed combined PDF.
5. Every stored document is linked to the exact request and exact covered month set. A combined PDF may not silently include an uncovered month.
6. Rejection requires a bounded safe reason and an optional private management note. It notifies the requester without exposing internal commentary.
7. Replacement requires a reason, a new immutable version and an explicit link to the superseded version. Replacement does not delete or rewrite the earlier document or audit trail.
8. Issued versions are immutable.
9. Audit evidence records requester, reviewer, preparer, uploader, issuer, replacement actor, every authorised view and every download. Actor IDs stay private and are exposed only through authorised audit surfaces.

## Document security and integrity

1. Reuse the existing private-document, authenticated-download, no-store and encrypted-storage patterns where their controls are proven suitable.
2. Retrieval is authenticated and server-authorised on every request with `private, no-store` caching. Staff ownership is checked server-side.
3. There is no public, permanent or guessable document URL; object-store identifiers and filesystem paths never reach the client.
4. Document bytes are prohibited from Git, logs, Notion, Asana and Basic Memory Cloud.
5. The issued PDF is password-protected. A date of birth, phone number, employee ID or predictable combination of those values is not an acceptable password by itself.
6. The PDF and its password are not sent in the same notification or channel. The approved password-recovery/delivery mechanism must be designed and threat-reviewed before implementation.
7. A plaintext document password must not appear in application logs, analytics, traces, database backups, export files or support tickets. Any recoverable secret must use an approved encrypted-secret design; otherwise use one-time derivation/reset semantics.
8. Flatten the issued PDF where the selected PDF tooling supports it. Restrict modification and copying while allowing printing, while acknowledging that PDF permission flags are deterrents rather than absolute controls.
9. Store and verify SHA-256 for the exact issued bytes.
10. Store an immutable document version and a school verification reference suitable for a future QR code. The QR-ready identifier must not reveal salary data or provide unauthenticated document access.
11. Describe the document as **tamper-evident**, never impossible to alter.
12. Replacement preserves the former version, hashes, status and audit history.

## Data model and API requirements for a later implementation

The later implementation should add, without overloading calculated payroll tables:

- a request root with requester Staff link, covered-month set, purpose, private explanation, required-by date, state, version and idempotency key;
- administrator record-availability configuration;
- immutable request events;
- immutable document versions linked to request and covered months, with encrypted storage locator, byte hash, safe verification reference and supersession link;
- permission-separated action records;
- authorised view/download events;
- in-app notification links containing identifiers only, never bytes, passwords or salary values.

All create and transition endpoints require idempotency/concurrency protection. Object retrieval must re-check active User-to-Staff ownership at request time.

## Exited Staff access and retention decision gate

No retention period or exited-Staff access rule is assumed. Before implementation, school leadership, legal/privacy advisers and operations must approve:

- whether an exited Staff member retains portal access, and for how long;
- an identity-verification and offline retrieval path when portal access is removed;
- the retention period for requests, document bytes, hashes and access logs;
- legal-hold and deletion exceptions;
- who may authorise post-exit release or replacement.

Until that decision is recorded, exited Staff retrieval must fail closed and authorised management must not improvise delivery through email or messaging.

## Explicit V1 exclusions

- salary calculations;
- salary structures;
- automatic deductions;
- EPF, ESI or TDS filing;
- automatic payslip generation;
- automatic payroll posting.

## Acceptance gates

- Own-account request, month eligibility, overlap refusal and cancellation are independently tested.
- Director/Super Admin queue and permission separation are independently tested; Principal default denial is verified.
- Single-month, multi-month, combined-document, rejection and replacement paths preserve exact months and immutable versions.
- Every view/download is audited and Staff history is ownership-filtered.
- Password, encrypted storage, hash, flattening/permissions and separate-channel controls receive security review.
- Private/no-store responses, unguessable locators, PWA-cache exclusion and log/backup exclusions are verified.
- Exited-Staff access and retention decisions are approved before release.
