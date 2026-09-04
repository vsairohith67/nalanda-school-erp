# Communication Current-State Audit

Audit base: latest authorised `origin/main` at implementation start. OCR PR #19 remains an isolated open workstream and no OCR file, migration, route, document payload, extracted value, or candidate value is used here.

## Prompt 19A/19B/19C reconciliation

| Component | Classification | 1A treatment |
| --- | --- | --- |
| 19A in-app templates, campaigns, reviewed snapshots, inbox and aggregate reports | `CURRENT_AND_REUSABLE` | Preserved as a compatibility foundation; new event-generated intents use the unified outbox. |
| 19B one-way WhatsApp consent, changed-number protection, MOCK provider, queue, cost/rate controls and signed fixtures | `CURRENT_BUT_NEEDS_CONSOLIDATION` | Preserved; live activation now also requires the unified parent and WhatsApp child gates. Historical tables remain backed up. |
| 19B inbound chat or unrestricted free-form messaging | `MISSING` by design | Explicitly excluded. |
| 19C SMS/Email profiles, consent, templates, batches, MOCK workers, receipts and operations | `CURRENT_BUT_NEEDS_CONSOLIDATION` | Source inspection proved this is substantial implemented software, not documentation only. Preserved and additionally gated by unified parent/channel flags. |
| Native push provider | `PROVIDER_DISABLED` | Only a provider-neutral adapter and synthetic endpoint boundary exist. |
| Shared server-owned intent, cross-channel outbox, receipt and backup contract | `MISSING` before 1A | Added by this release. |

## Module audit

| Area | Current classification | Consolidation path |
| --- | --- | --- |
| Account invitation and recovery | `MOCK_ONLY` / secure local sink | Keep one-time, hash-only, environment/user-bound token security; emit generic security intents later, never plaintext tokens to logs or backup. |
| MFA, passkey, session, device and account events | `CURRENT_DOMAIN_OUTBOX` or audit-only | Template catalogue provides privacy-minimised security notice intents. |
| Admissions | `MISSING` for unified delivery | Future module event adapter; no arbitrary applicant broadcasting. |
| Payments/receipts and family collection | `CURRENT_DOMAIN_OUTBOX` | Generic receipt-available template; provider failure has no finance authority. |
| Attendance and Safe Exit | `CURRENT_DOMAIN_OUTBOX` | Preserve consent/pass authority and fallback tasks; unified delivery remains an effect only. |
| Reports and Classwork/Homework | `CURRENT_DOMAIN_OUTBOX` | Generic available-in-app templates; no marks or attachments externally. |
| Parent Meetings | `CURRENT_DOMAIN_OUTBOX` | Preserve assigned participants and linked-child checks. |
| Support/complaints | `CURRENT_DOMAIN_OUTBOX` | Generic status template; complaint bodies remain excluded. |
| Library and payslip request | `CURRENT_DOMAIN_OUTBOX` | Generic reminder/available-in-app contract; no attachment delivery. |
| Transport, Cafeteria, Event Media | `PROVIDER_DISABLED` while module flag is off | A source module must be active before it may emit an intent. |
| Offline Sync and native device events | `CURRENT_DOMAIN_OUTBOX` or local status | Security/operations intent families only; no sync payload or device secret. |
| Biometric Staff Attendance | `CURRENT_DOMAIN_OUTBOX` or audit-only | Generic Staff correction/admin incident only; no punch or biometric detail. |
| Backup/migration/dependency incidents | `CURRENT_COMMON_FOUNDATION` via technical operations | In-app leadership alert template; no infrastructure secret externally. |

The staged approach avoids deleting valid domain queues, rewriting historical records, or pretending incompatible domain payloads are interchangeable.
