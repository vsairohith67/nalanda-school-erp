# Staging Data and Privacy Policy

## Default rule

Staging is synthetic-only. It contains no real Student/staff/guardian data, Schoolknot export, fee balance/payment, contact information, uploaded document/photo, biometric/location data, live messaging recipient, or live payment/provider data. Operational `prisma/dev.db` is never uploaded or onboarded.

## Approved synthetic fixtures

- Names use the fixed obvious markers `QA-DIRECTOR`, `QA-PRINCIPAL`, `QA-TEACHER`, `QA-PARENT` and `QA-STUDENT`; admission/user IDs start `QA-`.
- Domains use `example.invalid`; phone-like fields use reserved/non-routable test patterns and must never be capable of delivery.
- Amounts/classes/marks are fabricated and cannot reproduce the operational 8/8/19/INR 99,100 baseline.
- Documents/images are generated test assets with no person, handwriting, metadata, logo licensing issue, or copied Schoolknot content.
- Test accounts are least-privilege, have different strong temporary passwords generated directly on the server, use MFA/allowlisting if later approved and supported, and carry an expiry date. Credentials are privately handed to the named tester, never stored in Git/docs/logs/chat, and the transient seed variables are removed immediately.

## Access, screenshots, and lifecycle

- Named Director/DevOps/QA users only; no shared accounts. Review access monthly and at phase end.
- Test-user maximum lifetime 30 days unless renewed; disable within 24 hours of staff/contract change.
- Reset/delete synthetic transactional data after each test cycle and the whole environment at least every 90 days. Retain only redacted aggregate evidence.
- Screenshots must exclude tokens, browser password UI, personal-looking fields, full contacts, balances/marks/documents and provider consoles. Use synthetic markers; store in the approved private evidence location for 90 days, then review/delete.
- Backups inherit the same classification and deletion schedule; destroy expired keys/artifacts through an audited procedure.

## Incident response

If real or suspected real data enters staging: stop access and jobs, preserve minimal audit evidence, notify the privacy/security owner, identify source/scope/recipients/backups/screenshots/logs, revoke accounts/secrets, remove data and derived artifacts under approval, prove zero remaining copies, and record corrective controls. Do not silently relabel it synthetic.

## Operational-data prohibition

DEVOPS-1D does not include a copied-production-data exception. The operational database, backups, Schoolknot data and derived real-person records are prohibited from staging. The real operational DB remains untouched and receives no `_prisma_migrations` onboarding or `migrate resolve`.
