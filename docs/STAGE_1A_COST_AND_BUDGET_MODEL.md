# STAGE-1A Cost and Budget Model

Evidence and price date: **2026-08-15**. Currency: Indian rupees using Indian digit grouping. This document is an estimate, not a quote, purchase, invoice, or authorization.

## Assumptions and calculation rules

- Verified provider list prices are kept in USD so they can be rechecked against the linked official source immediately before approval.
- Planning FX is **USD 1 = INR 97.00**. This deliberately rounds above the latest retrievable official reference near INR 96.25. Refresh the rate at approval using the [RBI reference-rate archive](https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx) or [FBIL](https://www.fbil.org.in/).
- Estimated tax is **18% GST**. DigitalOcean and AWS explicitly document 18% India GST; the invoice treatment for Vultr and Render, registered GSTIN, place of supply, and any reverse-charge responsibility must be confirmed before purchase. Sources: [DigitalOcean India tax](https://docs.digitalocean.com/platform/billing/taxes/ind/) and [AWS India tax](https://aws.amazon.com/tax-help/india/).
- Calculation: `verified USD price × INR 97 × 1.18`, rounded to the nearest rupee for budget display. Annual is 12 monthly charges; no prepayment discount is assumed.
- The existing domain is not repurchased here. DNS and TLS are budgeted as INR 0 only because this phase proposes a subdomain record and Caddy/Render-managed certificate, not because the GoDaddy account capability or renewal terms were authenticated. See the [DNS evidence gap](STAGE_1A_DOMAIN_DNS_CHANGE_PLAN.md).
- Setup labor, support, school broadband, client devices, and staff time are excluded because no approved rates were supplied.

## Three approval budgets

### 1. Minimal controlled staging

Vultr Mumbai `vc2-1c-2gb`: 1 vCPU, 2 GB RAM, 55 GB SSD, 2 TB transfer.

| Cost item | Basis | Monthly | Annual | Classification |
| --- | --- | ---: | ---: | --- |
| Compute and included SSD/transfer | Verified $10 | INR 1,145 | INR 13,735 | Converted estimate incl. 18% GST |
| Automatic backup | Verified 20% = $2 | INR 229 | INR 2,747 | Converted estimate incl. 18% GST |
| DNS/TLS | Existing domain; Caddy certificate | INR 0 | INR 0 | Estimate; GoDaddy capability unverified |
| Provider setup fee | No published setup fee in selected plan | INR 0 | INR 0 | Verify at checkout |
| **Controlled minimum total** | Verified $12 before tax | **INR 1,374** | **INR 16,482** | Planning ceiling before optional costs |

Storage assumption: start with no real data and 0 current private-file bytes; reserve **1 GB/month** of synthetic private files plus matched backups. Stop adding test files or resize before the 55 GB disk reaches 50% utilization. This tier is appropriate only for controlled office-hours staging and has limited memory headroom.

Optional encrypted off-host application backup storage/egress: **INR 300/month estimate**, excluded until a destination and retention price are approved. Total with that allowance would be INR 1,674/month or INR 20,088/year.

### 2. Recommended school staging

Vultr Mumbai `vc2-2c-4gb`: 2 vCPU, 4 GB RAM, 80 GB SSD, 3 TB transfer.

| Cost item | Basis | Monthly | Annual | Classification |
| --- | --- | ---: | ---: | --- |
| Compute and included SSD/transfer | Verified $20 | INR 2,289 | INR 27,470 | Converted estimate incl. 18% GST |
| Automatic backup | Verified 20% = $4 | INR 458 | INR 5,494 | Converted estimate incl. 18% GST |
| Encrypted off-host matched backup | Planning allowance | INR 300 | INR 3,600 | Estimate; provider not selected |
| DNS/TLS | Existing domain; Caddy certificate | INR 0 | INR 0 | Estimate; GoDaddy capability unverified |
| Provider setup fee | No published setup fee in selected plan | INR 0 | INR 0 | Verify at checkout |
| **Recommended total** | $24 verified base + optional backup allowance | **INR 3,047** | **INR 36,564** | Approval budget |

Storage assumption: **2 GB/month** of synthetic private files, logs, and matched backup growth with daily/weekly retention. The 80 GB disk includes the OS and release directories. Alert at 40%, stop and review at 50%, and keep at least two verified off-host restore points after a destination is authorized.

### 3. Future production-shaped single-instance tier

AWS Lightsail Mumbai 4 GB Linux bundle: 2 vCPU, 4 GB RAM, 80 GB SSD, and 2 TB effective Mumbai transfer allowance (one-half of the nominal 4 TB listed for this bundle).

| Cost item | Basis | Monthly | Annual | Classification |
| --- | --- | ---: | ---: | --- |
| Compute/SSD/transfer bundle | Verified $24 | INR 2,747 | INR 32,964 | Converted estimate incl. 18% GST |
| Snapshot provision | $0.05/GB-month × 80 GB = $4 ceiling | INR 458 | INR 5,494 | Conservative estimate; actual stored snapshot GB may differ |
| Encrypted off-host matched backup | Planning allowance | INR 500 | INR 6,000 | Estimate; provider not selected |
| DNS/TLS | Existing domain; Caddy certificate | INR 0 | INR 0 | Estimate; GoDaddy capability unverified |
| **Production-shaped planning total** | $28 provider provision + backup allowance | **INR 3,705** | **INR 44,458** | Not a production authorization |

Storage assumption: **5 GB/month** total private-file and retained-backup growth until real operational evidence exists. This is only a production-shaped single-instance budget. Real data, real users, production cutover, and provider activation remain separately blocked.

## Comparable verified provider prices

| Candidate | Verified USD/month before tax | Estimated INR/month incl. 18% | Estimated INR/year incl. 18% | Notes |
| --- | ---: | ---: | ---: | --- |
| Vultr 2 GB + automatic backup | $12.00 | INR 1,374 | INR 16,482 | Lowest safe controlled tier |
| Vultr 4 GB + automatic backup | $24.00 | INR 2,747 | INR 32,964 | Recommended base; off-host backup extra |
| DigitalOcean 2 GiB + daily backup | $15.60 | INR 1,786 | INR 21,427 | $12 compute + 30% daily backup |
| DigitalOcean 4 GiB + daily backup | $31.20 | INR 3,571 | INR 42,854 | $24 compute + 30% daily backup |
| AWS Lightsail 2 GB + full 60 GB snapshot provision | $15.00 | INR 1,717 | INR 20,603 | $12 bundle + estimated $3 snapshot |
| AWS Lightsail 4 GB + full 80 GB snapshot provision | $28.00 | INR 3,205 | INR 38,459 | $24 bundle + estimated $4 snapshot |
| Render Standard + 10 GB disk | $27.50 | INR 3,148 | INR 37,772 | Workspace and overage costs may add |
| Render Standard + 25 GB disk | $31.25 | INR 3,577 | INR 42,923 | Singapore; higher managed-platform lock-in |

Sources: [Vultr live plans](https://api.vultr.com/v2/plans?type=vc2&per_page=500), [Vultr backup pricing](https://docs.vultr.com/products/storage/backups/faq), [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets), [DigitalOcean backup pricing](https://docs.digitalocean.com/products/backups/details/pricing/), [AWS Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), [Render pricing](https://render.com/pricing), and [Render disks](https://render.com/docs/disks).

## Excluded and optional costs

Excluded unless separately selected and priced:

- domain renewal, transfer, premium DNS, paid certificate, or GoDaddy add-on;
- managed email, SMS, WhatsApp, Push, payment gateway, AI/OCR API, live monitoring vendor, or live provider fee;
- real-data migration, PostgreSQL, object-storage application redesign, CDN, WAF, VPN/identity provider, or professional support;
- egress above included limits, tax/FX/card fees, restore assistance, log ingestion/retention, and staff operations;
- production uptime commitment, high availability, secondary region, multi-instance scaling, or disaster-recovery host.

Staging live messaging/payment/AI integrations remain disabled even if a provider offers a free allowance.

## Budget upgrade gates

These are proposed approval thresholds, not current facts:

| Signal | Proposed action |
| --- | --- |
| Monthly invoice forecast exceeds approved budget by 10% | Stop nonessential test activity; obtain user approval before resizing or adding service |
| Memory >70% for 15 minutes or process RSS p95 >1.4 GB on 2 GB | Move to the 4 GB tier after diagnosis and approval |
| CPU >70% for 15 minutes or request p95 >750 ms | Profile first; resize only if CPU is causal |
| Persistent disk >40% | Forecast growth and retention; prepare resize/cleanup decision |
| Persistent disk reaches 50%, DB reaches 10 GB, or backup reserve is insufficient | Stop growth-producing tests; approve storage expansion before continuing |
| Transfer reaches 70% of allowance | Review caching, backup egress, and next-tier price |
| More than one writable instance is required | Do not add a writer; begin separate PostgreSQL/architecture decision |

## Payment gate

No card, PayPal account, payment method, billing profile, purchase, free-trial activation, or resource was added in STAGE-1A. Provider checkout must wait for the user's explicit decisions on provider, budget, payment-method permission, tax owner, and STAGE-1B resource-creation authority. A billing alert at 80% of the approved monthly ceiling is mandatory in the later implementation plan.

Related: [Provider comparison](STAGE_1A_HOSTING_PROVIDER_COMPARISON.md) · [Domain/DNS change plan](STAGE_1A_DOMAIN_DNS_CHANGE_PLAN.md) · [Private staging security plan](STAGE_1A_PRIVATE_STAGING_SECURITY_PLAN.md) · [User decision package](STAGE_1A_USER_DECISION_PACKAGE.md)
