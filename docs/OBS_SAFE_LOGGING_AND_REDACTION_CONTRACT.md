# Safe Logging and Redaction Contract

Operational logs contain only timestamp, level, stable event name, safe correlation ID, component, environment, error fingerprint, and bounded scalar metadata.

Keys shaped like passwords, tokens, cookies, secrets, database URLs, contacts, addresses, salary, marks, complaints, document/file/path data, payment references, headers, bodies, payloads, IP addresses, or gate/QR data are dropped. Text redaction removes bearer values, email addresses, phone-like values, IP addresses, absolute Windows/Unix paths, control characters, and long secret-shaped strings.

Server errors exposed to ordinary clients are fixed privacy-safe messages. Full stack detail is limited to authorised local operator logs; the ordinary dashboard displays fingerprints and safe summaries only. No raw request/response body or provider payload belongs in operational records.

Regression tests must submit secret-shaped and PII-shaped values and assert their absence from serialized output and persisted safe metadata.
