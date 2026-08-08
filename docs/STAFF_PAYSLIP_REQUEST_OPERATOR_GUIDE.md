# Staff Payslip Request Operator Guide

## Director and Super Admin

1. Open **Payslip Requests** and verify Staff identity, designation, requested months, purpose and required-by date.
2. Confirm every month remains governed and available. Historical availability may be recorded with a bounded authorisation reason without entering salary data.
3. Start review and assign preparation. External Excel preparation stays outside the ERP.
4. Review the management-only source preview, protected-version metadata and exact covered months.
5. Re-enter the current account password, attest to visible-content/month review, approve and issue.
6. For rejection or replacement, enter a bounded reason. A replacement always uses a new upload, password, derivative, hash and immutable version.

The uploader does not automatically become the issuer. Never reveal a Staff opening password; management roles have no reveal API. Do not send document bytes or passwords through Notification Centre, email, SMS or WhatsApp.

## Accountant with explicit grants

An Accountant needs the queue-view grant plus explicit preparation/upload grants. The default role has no salary-document authority. A granted Accountant may view assigned requests, prepare externally and upload a PDF, but cannot approve, issue, replace, manage month availability, reveal passwords or view restricted audit unless separately authorised.

## PDF intake

V1 accepts PDF only. Unsafe structure, truncation, password protection, JavaScript, launch/external actions, embedded attachments, forms or value-changing annotations are refused. Do not rename another format to `.pdf`. The source must contain the final externally prepared values; the ERP does not recalculate or rewrite them.

Use only the active protected derivative for Staff delivery. Management source preview is private/no-store and audited. No live messaging provider, real Staff onboarding or operational salary document is authorised in this phase.
