# Staff Payslip Secure PDF and Password Threat Model

## Protected assets

- management source PDF: encrypted at rest, management-only;
- Staff derivative: AES-256 PDF encryption where qpdf supports it, printing allowed, modification/copy/form/annotation changes restricted;
- opening password: random 32-character high-entropy secret per document version;
- owner password: separate random secret used only during protection and never persisted;
- SHA-256 and opaque verification reference: integrity/status evidence without salary or identity disclosure.

The derivative is described as **Password-protected, editing-restricted and tamper-evident**. Permission flags deter ordinary editing; they do not make alteration technically impossible.

## Threats and controls

| Threat | Control |
| --- | --- |
| Malicious or malformed upload | PDF extension/MIME/magic/parser/xref/page/size validation; active content, attachments, password, forms and value-changing annotations refused. |
| Command or log disclosure | Fixed absolute executable, no shell interpolation, password input through qpdf `@-`, bounded timeout, redacted exceptions. |
| Database or backup disclosure | Opening password stored only as an AES-256-GCM authenticated envelope with key version, nonce, tag and document-version binding. Key excluded from DB and backup. |
| Cross-Staff access | Active Staff context plus exact server-side ownership at list, reveal and download time. |
| Management password discovery | No management reveal route or DTO; Director, Super Admin and Accountant cannot decrypt Staff opening passwords. |
| Stolen/stale link | Opaque handle plus short-lived session-bound HMAC authorisation; current active version rechecked. |
| Replacement race | Transactional active-version uniqueness, expected request version and append-only supersession link. |
| Browser/PWA persistence | Private/no-store, no public path, no service-worker caching, transient reveal state cleared on close/timeout. |

Reveal additionally requires current-password re-authentication, valid non-revoked session, Staff context, rate limiting and privacy-safe audit. The password never enters notifications, URLs, exports, client logs or general APIs. The PDF and password are never carried in the same notification payload.

Missing/wrong envelope keys, missing qpdf capability, corrupt assets and derivative-validation failure all fail closed. Operational secret provisioning is deferred; only synthetic QA keys are authorised in this phase.
