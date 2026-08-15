# STAGE-1A User Decision Package

Evidence date: **2026-08-15**. Status: `USER_CHOICE_REQUIRED`. This sheet records choices only; it does not itself authorize a purchase, DNS change, deployment, real-data upload, real-user activation, live provider, secret storage, or PostgreSQL migration.

## Recommended decision set

| Decision | Conservative default | Select / replace |
| --- | --- | --- |
| Hosting provider/tier | **Vultr Cloud Compute, 2 vCPU / 4 GB / 80 GB**, with automatic backups | `________________` |
| Monthly budget | **INR 3,100/month**, including estimated GST and INR 300 off-host-backup allowance | `INR ________________ / month` |
| Hosting region | **Mumbai, India** | `________________` |
| Staging subdomain | **`staging-erp.nalandaps.com`** | `________________` |
| Private access | **Host/proxy IP allowlist plus a separate named staging gate**; use mesh VPN instead if operator IPs are dynamic | `________________` |
| Backup retention | **14 daily + 8 weekly**, with at least two encrypted off-host restore points after destination approval | `________________` |
| May a payment method be added? | **No, not until the billing owner and exact checkout total are reviewed** | `Yes / No` |
| May Codex create one cloud resource in STAGE-1B? | **No until provider, budget, payment, owner, and deletion/rollback decisions are complete** | `Yes / No` |
| May GoDaddy DNS changes later be applied? | **No until an authenticated full-zone read, minimal diff, and separate DNS review pass** | `Yes / No` |

The user can answer in ordinary language or fill this table. **No exact approval phrase is required.** Ambiguous or omitted choices remain `No/not authorized`.

## Alternative selections

### Provider

- **Recommended:** Vultr 4 GB Mumbai, estimated INR 2,747/month including planned 18% GST for compute plus provider backup; INR 3,047/month including the optional off-host-backup allowance.
- **Lowest safe controlled staging:** Vultr 2 GB Mumbai, estimated INR 1,374/month including planned GST; limited memory headroom and staging-only.
- **Fallback:** AWS Lightsail 4 GB Mumbai with a full-disk snapshot provision, estimated INR 3,205/month including planned GST before the off-host-backup allowance.
- **Managed fallback:** Render Standard plus 10 GB disk in Singapore, estimated INR 3,148/month including planned GST before workspace/egress/off-host backup costs.
- **Safe alternative:** DigitalOcean 4 GiB Bangalore plus daily backup, estimated INR 3,571/month including planned GST.

Prices, FX, tax, storage, bandwidth, and lock-in are detailed in [Hosting Provider Comparison](STAGE_1A_HOSTING_PROVIDER_COMPARISON.md) and [Cost and Budget Model](STAGE_1A_COST_AND_BUDGET_MODEL.md). All estimates must be refreshed at checkout.

### Private access

- `IP allowlist + named staging gate` — recommended when school/admin egress IPs are stable.
- `Mesh VPN + named staging gate` — recommended when operator devices roam; adds a provider/device-management decision.
- `Cloudflare Access + named staging gate` — strong identity option but adds Cloudflare, proxy/DNS, and identity-provider scope.

An unlisted public URL, robots-only protection, or shared Basic Auth alone is not selectable. See [Private Staging Security Plan](STAGE_1A_PRIVATE_STAGING_SECURITY_PLAN.md).

### Backup retention

- `14 daily + 8 weekly` — recommended.
- `7 daily + 4 weekly` — controlled minimum for short-lived synthetic staging.
- A longer policy can be entered with an approved budget and off-host destination.

Provider snapshots never replace matched application-consistent SQLite plus private-asset backups and a restore rehearsal.

## Fixed conditions that are not optional choices

- Exactly one writable Node process and one persistent local SSD/volume.
- Separate synthetic-only SQLite DB, private-file root, and secrets.
- No horizontal/multi-region writer, serverless/ephemeral SQLite, network-mounted SQLite, or PostgreSQL migration.
- Exclusive maintenance windows for migration and restore; matched DB/private-asset backup; daily backup and restore rehearsal.
- HTTPS, visible staging banner, noindex/robots refusal, access gate/allowlist, secure cookies, and private/no-store responses.
- OBS-1A monitoring; live email, SMS, WhatsApp, Push, payment, AI, and cloud OCR disabled.
- No public Student/Parent access, real school data, real-user activation, production cutover, or unapproved provider integration.
- Preserve the existing `nalandaps.com` public site, `www`, Google Workspace MX, SPF, DKIM, DMARC, verification, and every unrelated DNS record.

## Separate later gates

A `Yes` for STAGE-1B cloud-resource creation is limited to the selected single staging resource and its approved backup/firewall components. It does not imply DNS permission, deployment permission, payment-method permission, real-data permission, or production permission.

A `Yes` for later GoDaddy DNS changes is limited to the reviewed `staging-erp` diff in the [Domain/DNS Change Plan](STAGE_1A_DOMAIN_DNS_CHANGE_PLAN.md). It does not authorize `erp`, root, `www`, mail, nameserver, DNSSEC, or unrelated changes.

Before either gate is exercised, the implementation package must show the refreshed checkout total, payment owner, exact resource/region, deletion and rollback plan, full authenticated DNS baseline, and a preview of all external changes.

## STAGE-1A evidence available for the decision

- RC/main/tag commit: `26a47632f7c1e9c9b5f2b48de8c9b56d60428aed`; tag `nalanda-erp-v1-rc1-v41-2026-08-14`.
- Actual release archive: 46,040,035 bytes; fresh production build passed.
- Operational SQLite: 8,409,088 bytes; 18 migrations; backup version 41; byte-immutability check required again at handoff.
- Local load sample: 200/200 requests at concurrency 10, zero failures; about 552 MB working set after load.
- PWA transfer sample: about 0.52 MB first-use response bodies and 0.029 MB cached/revalidated model.
- Public DNS shows no `staging-erp` or `erp` record. Authenticated GoDaddy capability remains an evidence gap.
- The exact privacy-safe status was written and re-fetched successfully in the existing Notion staging page, Asana Nalanda project, and Basic Memory Cloud governance note. The supplied Canvs board was readable, but an edit to the existing status node did not persist after reload; authenticated/persistent edit capability is an evidence gap. No other Canvs board was used or created.
- No cloud resource, purchase/payment, payment method, DNS change, deployment, secret, real-data upload, or real-user activation was authorized or performed by this package.

## Response template

The user may respond with only the choices they want to change; unmentioned defaults remain unapproved until explicitly selected.

```text
Provider/tier:
Maximum monthly budget in INR:
Region:
Staging subdomain:
Private-access method:
Backup retention:
Payment method may be added: Yes/No
STAGE-1B may create one approved cloud resource: Yes/No
Later GoDaddy staging DNS change may be applied: Yes/No
```

Related: [Hosting provider comparison](STAGE_1A_HOSTING_PROVIDER_COMPARISON.md) · [Cost and budget model](STAGE_1A_COST_AND_BUDGET_MODEL.md) · [Domain/DNS change plan](STAGE_1A_DOMAIN_DNS_CHANGE_PLAN.md) · [Private staging security plan](STAGE_1A_PRIVATE_STAGING_SECURITY_PLAN.md)
