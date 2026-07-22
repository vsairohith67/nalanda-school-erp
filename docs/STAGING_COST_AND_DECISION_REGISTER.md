# Staging Cost and Decision Register

Pricing snapshot: 2026-07-23, USD before tax/FX. Refresh official provider pages before approval. No purchase was made.

## Monthly planning ranges

| Category | Low | Expected | High | Notes/risk |
| --- | ---: | ---: | ---: | --- |
| VPS/managed compute | $7 | $12–25 | $44 | 1 GB is evaluation-only; 2 GB is starting recommendation; 4–8 GB if measured. Render 2 GB is $25; Lightsail 2 GB example is $12. |
| Persistent storage | included–$1 | $1–5 | $15 | VPS SSD may be bundled; Render SSD $0.25/GB-month; separate block disk/provider pricing varies. |
| Snapshots/backups | $1 | $3–10 | $25 | Lightsail snapshot example $0.05/GB-month; off-host object/version/requests/retention add cost. |
| Central logs | $0 | $5–20 | $50 | Free tier may be small/short; immutable retention and egress can dominate. |
| Monitoring/alerts | $0 | $0–10 | $30 | Basic provider metrics plus one external HTTPS monitor; paging/SMS excluded. |
| Domain/DNS/TLS | $0 | $0 | $5 | Existing domain; one record often no incremental cost; managed TLS free. No DNS action now. |
| Bandwidth/egress | included | $0–5 | $25 | India/Mumbai allowances and backup/log egress differ. |
| **Estimated total** | **$8** | **$21–75** | **$194** | Wide evaluation band; taxes, FX and support excluded. |

Email, SMS, WhatsApp, AI, OCR cloud APIs, payment processing, production databases and Schoolknot services are excluded and remain disabled. Free tiers are not approved if they sleep, erase disk, cap retention, lack private access, or encourage production identifiers. Renewal/FX/tax, snapshot growth, log ingestion and data egress are explicit risks.

## India-region considerations

- Recommended VPS evaluation uses a provider with an India region; Lightsail pricing specifically references Asia Pacific (Mumbai), with different transfer allowance. Confirm exact data residency/support/backup region before purchase.
- Render's current listed regions include Singapore but not India. Singapore is a latency/residency trade-off requiring user approval.
- Confirm invoices/GST, card/billing owner, support response, export/deletion, status history, DPA/privacy terms and breach notification before real data is ever considered.

## Decisions requiring the user

| ID | Decision | Recommended default | Status |
| --- | --- | --- | --- |
| D1 | Hosting provider/region | 2 GB Linux VPS in Mumbai; managed persistent-disk container in Singapore fallback | `USER_DECISION_REQUIRED` |
| D2 | Monthly budget/currency/tax owner | approve expected $21–75/month envelope and billing alerts | `USER_DECISION_REQUIRED` |
| D3 | Staging hostname | `staging.nalandaps.com`; preserve all Google Workspace records | `USER_DECISION_REQUIRED`; no DNS change |
| D4 | Access | named Director + DevOps + QA, optional IP/VPN/MFA layer | `USER_DECISION_REQUIRED` |
| D5 | Data | synthetic only now; copied-data rehearsal only by separate written approval | synthetic default fixed; exception undecided |
| D6 | Backup destination/region | encrypted off-host object/drive with versioning and separate credential | `USER_DECISION_REQUIRED` |
| D7 | Logging/monitoring provider | immutable log sink + external HTTPS/disk/backup alerts | `USER_DECISION_REQUIRED` |
| D8 | Uptime | scheduled office-hours staging unless continuous PWA/update testing requires 24x7 | `USER_DECISION_REQUIRED` |
| D9 | Operators/support | name patching, deploy, incident, privacy and billing owners | `USER_DECISION_REQUIRED` |

No architecture decision requires purchasing before DEVOPS-1C-QA. Actual deployment remains blocked until D1–D4, D6–D9 and central logging are resolved.
