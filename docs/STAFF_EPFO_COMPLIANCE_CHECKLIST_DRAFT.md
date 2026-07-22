# Staff EPFO Compliance Checklist Draft

## Mandatory disclaimer

This is a Prompt 22A design draft for a possible Prompt 22D workflow.

> A checked item records only that an authorised person performed or reviewed the described administrative step and recorded a safe evidence reference. It does not prove statutory compliance, EPFO acceptance, contribution correctness, coverage, EPS eligibility, claim entitlement, pension amount, retirement status, or completion of an external portal action.

The checklist must be reviewed and approved by a current EPFO consultant/CA/labour-law professional or qualified lawyer before implementation. It must be re-reviewed when EPFO procedures, the Code on Social Security, rules, schemes, circulars or portal workflows change.

## Proposed checklist state

Each item uses one of:

- `NOT_STARTED`
- `IN_REVIEW`
- `REVIEWED_NO_DISCREPANCY_RECORDED`
- `DISCREPANCY_RECORDED`
- `NOT_APPLICABLE_WITH_REASON`
- `PROFESSIONAL_GUIDANCE_REQUIRED`
- `BLOCKED_SOURCE_UNAVAILABLE`

Do not use `COMPLIANT`, `ELIGIBLE`, `APPROVED_BY_EPFO`, `PENSION_CONFIRMED` or similar claims.

Each item may store: status, assigned owner, reviewed date, next-review date, controlled discrepancy type, bounded safe note, opaque evidence reference, professional-guidance flag, record version and append-only events. It must not store a document image, full UAN, Aadhaar, PAN, bank detail, credential, OTP, portal session, claim form or pension calculation.

## Draft checklist categories

| Category | Review question | Safe evidence/reference | Escalation trigger |
| --- | --- | --- | --- |
| Staff identity/profile reviewed | Has the authorised operator compared the approved Staff profile fields with the permitted source? | Source category and opaque internal reference | Conflicting name/DOB/profile or unnecessary ID requested |
| DOB verified | Is exact DOB verified, unverified, conflicting, unknown or correction pending? | DOB verification event/version | Conflict, future date, implausible age, leap-day policy issue |
| EPFO coverage status reviewed | Has a qualified owner reviewed the reported coverage state without making an automated legal determination? | Review date/owner and professional reference if used | Establishment/employee coverage uncertainty |
| UAN availability reviewed | Is availability known, and if available is only optional last four recorded? | Availability status and masked last four | Duplicate/linkage/correction suspicion or request for full UAN |
| KYC/profile status reviewed | Is the external profile status reported as reviewed/discrepant without storing underlying identity data? | Status and safe reference | Aadhaar/UAN mismatch, portal difference or correction needed |
| e-nomination status reviewed | Has status been reviewed without nominee personal data? | Status and review date | Staff requests assistance or external process unclear |
| Joining/exit dates reviewed | Are current ERP joining/status facts and reported EPFO dates reviewed for discrepancy? | Existing `dateOfJoining`, Staff status and safe status reference | Previous employment, portal difference, Staff left or exit action unclear |
| Monthly compliance owner identified | Is one named authorised role responsible for the review period? | User ID/role and period | No owner, role conflict or segregation concern |
| Discrepancy recorded | Is the discrepancy neutrally categorized with no sensitive free text? | Controlled type and safe note | Any item requiring portal/professional correction |
| Corrective action assigned | Is an internal follow-up owner/date recorded without claiming external submission? | Owner, due date and action category | Overdue, role lacks authority, external action requested |
| Professional/EPFO guidance required | Is the need for current qualified guidance explicit? | Guidance status and safe reference | Coverage, EPS, contribution, age-58, previous service, duplicate UAN |
| Completion evidence reference | Is there a permitted opaque reference, not a sensitive document or public link? | Approved reference token | Document/image/identifier would be stored |
| Next review date | Is a human-approved date recorded? | Date and responsible owner | Date based on unverified legal rule or overdue |

## Workflow design for Prompt 22D

1. Create a checklist version for one Staff member and review period.
2. Assign an authorised owner; no self-approval where segregation is required.
3. Complete items with controlled statuses and safe evidence references.
4. Record discrepancies separately from corrective actions.
5. Mark `PROFESSIONAL_GUIDANCE_REQUIRED` rather than guessing.
6. Submit the checklist for Director review.
7. Director acknowledges administrative completion only.
8. Lock that version; later changes create a new version and append-only events.

There is no “certify compliance” button. Completion is not available while a required item is `NOT_STARTED`; however, a checklist may close as `REVIEW_COMPLETED_WITH_OPEN_GUIDANCE` so the ERP does not encourage false answers.

## Role boundary

- Director: view, assign, review, acknowledge and reopen.
- Super Admin: exceptional governance only.
- Accountant: prepare/review only when formally assigned `MANAGE_EPFO_COMPLIANCE`; masked identifiers only.
- Principal: aggregate/read-only only if separately approved.
- Admin: no EPFO checklist authority by default.
- Teacher/Staff: own approved status/correction view only; no checklist editing.
- Viewer: suppressed aggregate counts only.
- Parent/Public: no access.

Every API and report must enforce the dedicated permission server-side. Ordinary Staff, finance, attendance, communication, AI or public-site permissions do not grant access.

## Safe evidence rules

Allowed: controlled source type, date reviewed, authorised reviewer, physical-file/register reference that exposes no identifier, professional engagement reference, and external procedure status such as `STAFF_ACTION_PENDING` or `EPFO_RESPONSE_PENDING`.

Prohibited: document uploads, screenshots, Aadhaar/PAN/UAN numbers, bank data, passwords/OTPs, browser session data, claim content, medical data, full portal response, copied email/message text, public share link and absolute filesystem path.

## Reports

Prompt 22D reports may show counts by review state, due month, guidance-needed state and controlled discrepancy category. They must suppress small groups at an approved threshold, provide no row drill-down to Viewer, exclude exact DOB/UAN digits, be formula-safe and never label a count “statutorily compliant.”

## Exceptions

- Missing/conflicting DOB: checklist remains open; no age calculation.
- UAN unavailable/duplicate suspected: record neutral discrepancy; obtain current guidance.
- Previous employment: do not infer service or merge identity.
- Portal differs: do not overwrite external data or claim submission.
- Staff reaches 58 while employed: keep employment/status unchanged and use the required review wording.
- Staff leaves: review joining/exit and retention obligations; do not erase automatically.
- Professional guidance pending: retain owner/next date; closing with open guidance is explicit.
- Wrong role: deny without sensitive payload and append safe access-denial audit.

## Prompt 22D release gate

Prompt 22D remains out of scope until Prompt 22B and Prompt 22C boundaries are separately cleared, the current legal/EPFO transition is refreshed, a qualified professional approves the checklist, evidence/retention owners are named, aggregate suppression is approved, and no-portal-automation tests are specified.

