# SUPPORT-1A threat model

| Threat | Control |
| --- | --- |
| Public account/Student enumeration | Generic 202 response, opaque reference, HMAC evidence, throttling and honeypot |
| Cross-family or cross-context access | Active role/session, opaque child handles and Guardian-link revalidation on every read/write |
| Staff browsing colleague/accused complaints | Own/assignment queue scope, confidentiality permission and complained-about assignment refusal |
| Internal-note disclosure | Distinct message type, exact permission, requester serializer filters and notification exclusion |
| File active content or path abuse | MIME/magic/structure/decode validation, qpdf checks, re-encoding, opaque storage, symlink/traversal refusal |
| Stale/concurrent workflow | Expected-version CAS, transaction boundaries and unique idempotency keys |
| Sensitive notification/export leakage | Safe fixed copy, aggregate/bounded formula-safe export, masking and low-count suppression |
| Recovery loss or ownership drift | Version-37 logical metadata plus encrypted asset backup, hashes and double restore |
| Provider/AI exfiltration | In-app only; no live Email/SMS/WhatsApp or external AI processing |
