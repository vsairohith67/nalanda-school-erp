# Staging Cost and Decision Register

Pricing snapshot: 2026-07-24, USD before tax/FX. Refresh the exact supervised provider-console total before approval. No account, payment method or purchase was made.

## Current payment hold

AWS is excluded. Vultr Mumbai is the current technical recommendation, with Akamai/Linode Mumbai as fallback, but the user has deliberately paused every account/payment/billable step until the concepts and charges are explained later. This is not approval to sign up, link a payment method, select a paid plan, create a VPS, reserve an IP, enable backups, or start monitoring.

## Monthly planning ranges

| Category | Low | Expected | High | Notes/risk |
| --- | ---: | ---: | ---: | --- |
| VPS/managed compute | $10 | $10–12 | $25 | Vultr Mumbai 2 GB proposal is $10; Linode Mumbai and DigitalOcean Bangalore 2 GB are $12. No plan selected. |
| Persistent storage | included | included | $15 | Proposed VPS SSD is bundled; no extra disk authorised. |
| Snapshots/backups | $0 | $0 | $25 | No provider snapshot, automatic backup or off-host destination authorised. Vultr automatic backup would add 20%; snapshots are usage priced. |
| Central logs | $0 | $5–20 | $50 | Free tier may be small/short; immutable retention and egress can dominate. |
| Monitoring/alerts | $0 | $0–10 | $30 | Basic provider metrics plus one external HTTPS monitor; paging/SMS excluded. |
| Domain/DNS/TLS | $0 | $0 | $5 | Existing domain; one record often no incremental cost; managed TLS free. No DNS action now. |
| Bandwidth/egress | included | $0–5 | $25 | India/Mumbai allowances and backup/log egress differ. |
| **Initial compute-only proposal** | **$10** | **$10–12** | **$25** | Before tax/FX. Conservative Vultr planning envelope is $12: $10 compute plus $2 transfer contingency. |

Email, SMS, WhatsApp, AI, OCR cloud APIs, payment processing, production databases and Schoolknot services are excluded and remain disabled. Free tiers are not approved if they sleep, erase disk, cap retention, lack private access, or encourage production identifiers. Renewal/FX/tax, snapshot growth, log ingestion and data egress are explicit risks.

## India-region considerations

- Recommended VPS evaluation uses a provider with an India region. Vultr and Linode list Mumbai; DigitalOcean lists Bangalore. Confirm exact availability, data residency, support and backup region in the supervised console before purchase.
- Render's current listed regions include Singapore but not India. Singapore is a latency/residency trade-off requiring user approval.
- Confirm invoices/GST, card/billing owner, support response, export/deletion, status history, DPA/privacy terms and breach notification before real data is ever considered.

## Decisions requiring the user

| ID | Decision | Recommended default | Status |
| --- | --- | --- | --- |
| D1 | Hosting provider/region | Vultr 2 GB Linux VPS in Mumbai; Linode Mumbai fallback | `PAYMENT_GATED_DEFERRED` |
| D2 | Monthly budget/currency/tax owner | explain every charge, then separately approve the console-confirmed compute total | `PAYMENT_GATED_DEFERRED` |
| D3 | Staging hostname | `staging.nalandaps.com`; preserve all Google Workspace records | `USER_DECISION_REQUIRED`; no DNS change |
| D4 | Access | named Director + DevOps + QA, optional IP/VPN/MFA layer | `USER_DECISION_REQUIRED` |
| D5 | Data | synthetic only now; copied-data rehearsal only by separate written approval | synthetic default fixed; exception undecided |
| D6 | Backup destination/region | encrypted off-host object/drive with versioning and separate credential | `USER_DECISION_REQUIRED` |
| D7 | Logging/monitoring provider | immutable log sink + external HTTPS/disk/backup alerts | `USER_DECISION_REQUIRED` |
| D8 | Uptime | scheduled office-hours staging unless continuous PWA/update testing requires 24x7 | `USER_DECISION_REQUIRED` |
| D9 | Operators/support | name patching, deploy, incident, privacy and billing owners | `USER_DECISION_REQUIRED` |

Provider-neutral repository preparation requires no purchase. Actual deployment remains blocked until the user resumes and explicitly approves D1–D4 and each applicable D6–D9 gate. Without approved off-host backup and external monitoring, any later staging environment remains supervised-only and is not cleared for unattended continuous use.
