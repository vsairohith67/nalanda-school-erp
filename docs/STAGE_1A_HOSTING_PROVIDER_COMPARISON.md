# STAGE-1A Hosting Provider Comparison

Evidence date: **2026-08-15**. This is a read-only planning package. It creates no cloud resource, subscription, deployment, payment method, DNS record, secret, database migration, real-data upload, or user activation.

## Decision summary

- **Recommended:** Vultr Cloud Compute `vc2-2c-4gb` in Mumbai, one Linux VM and one writable Node process, subject to the user decisions in the [decision package](STAGE_1A_USER_DECISION_PACKAGE.md). It offers 2 vCPU, 4 GB RAM, 80 GB local SSD, 3 TB transfer, Indian regions, and automatic backups for a verified base-plus-backup price of USD 24/month before tax.
- **Lowest safe controlled tier:** Vultr `vc2-1c-2gb` in Mumbai with automatic backups, USD 12/month before tax. The measured Windows load stayed within 2 GB, but this tier has limited operating headroom and is staging-only.
- **Fallback:** AWS Lightsail 4 GB Linux bundle in Mumbai plus snapshots. It is a conservative, well-documented VM fallback with more account and operations complexity.
- **Managed fallback:** Render Standard with one persistent disk in Singapore. It enforces the single-instance disk boundary, but costs more, has no India region, exposes only the disk mount path as durable, and makes disk-backed deployment/migration recovery more constrained.
- **Rejected:** free/sleeping or ephemeral services, serverless functions, scale-to-zero, multi-instance writers, network-mounted SQLite, and active/active or multi-region SQLite.

No option is approved or purchased by this document.

## Authoritative release checkpoint

The measurement target is the synchronized private `main` release candidate, not an older staging estimate.

| Item | Captured value |
| --- | --- |
| Result | `V1_RELEASE_CANDIDATE_CLEARED` |
| RC tag | `nalanda-erp-v1-rc1-v41-2026-08-14` |
| RC/main/tag commit | `26a47632f7c1e9c9b5f2b48de8c9b56d60428aed` |
| Pull request | Private PR #5, merged |
| Route/build result | 333 page routes / 547 API routes; Next.js 15.5.21 production build passed |
| Database/migrations | SQLite 8,409,088 bytes; 18 migrations applied; Prisma schema up to date |
| Backup format | Version 41 |
| Operational baseline | 0 Students, 0 active enrollments, 0 Payments, INR 0 collected; four protected accounts and one active Super Admin |

The current migration interpretation follows [Operational Prisma Migration-Baseline Onboarding](OPERATIONAL_MIGRATION_BASELINE_ONBOARDING.md) and the current [V1 Release-Candidate Manifest](V1_RELEASE_CANDIDATE_MANIFEST.md). `deployment:integrity-check`, Prisma migration status, and Git safety passed on 2026-08-15.

## Measured application envelope

These are local measurements of the actual RC. They are sizing evidence, not a production SLA.

| Measurement | Result | Interpretation |
| --- | ---: | --- |
| Git-tracked source | 2,216 files; 16,864,698 bytes | The reviewable application source, not a client download. |
| Working folder excluding `.git` | 38,197 files; 7,710,203,139 bytes | Includes local dependencies, build output, and historical rehearsals; not a deploy payload or phone app size. |
| `node_modules` | 1,643,418,209 bytes | Development/runtime dependency tree; never sent wholesale to a browser. |
| Fresh `.next` build | 188,184,563 bytes | Server build plus static assets. |
| Fresh framework release package | 10,955 files; 191,991,860 bytes uncompressed; 46,040,035-byte archive | Actual release packaging evidence; archive SHA-256 `78c588174396bdc69627a2d0c0e4ed0573cad728043937f36d5b0c763b912bfe`. |
| Operational SQLite | 8,409,088 bytes | Remains server-side. Hash captured separately for immutability verification. |
| Current private-file roots | 0 bytes present | Staging must still reserve durable growth space for private files. |
| Historical local backup corpus | 288 files; 264,357,258 bytes | June-August QA/release accumulation; evidence of growth mechanics, not a production forecast. |
| PWA first compressed response set | 518,187 bytes | Login, manifest, service worker, and Browser-observed assets over local HTTP; excludes protocol overhead. |
| PWA cached/revalidated response model | 29,349 bytes | Immutable assets treated as cached; dynamic/no-store responses re-fetched. |

The server does **not** transmit the 7.71 GB working folder, Git history, database, private uploads, or server bundle to a Parent device. The current web/PWA first-use transfer was about 0.52 MB in the measured local response set. A future native mobile binary would be built and measured separately; its size is not the development folder size.

### Runtime memory and CPU

The RC was started against a byte-identical ignored copy of the zero-business database. No operational database was opened by the measurement server.

| Profile | CPU | Working set | Private bytes | Result |
| --- | ---: | ---: | ---: | --- |
| Idle after startup | 11.453 s cumulative startup CPU | 426,598,400 bytes | 443,535,360 bytes | Stable local process |
| 200 GETs, concurrency 10 | +5.125 s CPU over 2.750 s wall time | 551,927,808 bytes | 566,521,856 bytes | 200/200 succeeded; 0 failures; 2,653,650 response bytes |

Endpoints represented login, deployment health, manifest, and a public informational page. This Windows measurement does not promise Linux production performance. It supports **2 GB as the minimum controlled staging tier and 4 GB as the recommended headroom tier**. Existing RC synthetic 800-student database evidence recorded direct-read p95 0.94 ms and direct-write p95 4.72 ms with no busy/error result; that is database-fixture evidence, not 800 simultaneous users or a production capacity promise.

## Current provider comparison

Verified prices are the provider's published USD list prices retrieved on 2026-08-15. INR and tax conversions are estimates described in the [cost model](STAGE_1A_COST_AND_BUDGET_MODEL.md).

| Candidate | CPU/RAM | Durable local storage | Bandwidth | Backup/snapshot price | Region | Verified monthly USD before tax | Payment | Complexity / lock-in | SQLite and staging decision |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| **Vultr Cloud Compute** | 1 vCPU/2 GB minimum; recommended 2 vCPU/4 GB | 55 GB or 80 GB local SSD in the selected plan | 2 TB or 3 TB | Automatic backups add 20% of instance price | Mumbai, Bengaluru, Delhi NCR | $10 + $2 backup = **$12** minimum; $20 + $4 = **$24** recommended | Valid card or PayPal-linked account is required to register/use paid service | Medium operations; low/medium VM lock-in | **Recommended.** One VM/process and local SSD comply. Conditional for ~800 students only within measured single-instance signals; not 800 concurrent users. |
| **DigitalOcean Droplet** | 1 vCPU/2 GiB; 2 vCPU/4 GiB | 50 GB or 80 GB local SSD | 2 TB or 4 TB | Weekly 20%; daily 30%; snapshots $0.06/GiB-month | Bangalore (`BLR1`) | $12 + daily backup = **$15.60** minimum; $24 + daily backup = **$31.20** recommended | Paid account requires an accepted payment method; exact method/billing owner must be approved | Medium operations; low/medium VM lock-in | **Safe alternative.** One Droplet/process complies; 4 GiB preferred for school-shaped staging. |
| **AWS Lightsail** | 2 vCPU/2 GB; 2 vCPU/4 GB | 60 GB or 80 GB SSD bundle | 3 TB/4 TB nominal, with one-half allowance in Mumbai: 1.5 TB/2 TB | $0.05/GB-month snapshots; automatic daily snapshots retain seven | Mumbai | **$12** or **$24**, plus measured snapshot GB | Paid AWS account/payment method required; India GST treatment is documented | Medium/high account and operations complexity; low application lock-in | **Fallback.** Static IP, one VM/process, and local disk comply; strong recovery documentation. |
| **Render Web Service + disk** | Standard 1 CPU/2 GB | Persistent SSD, priced per GB; only the mount path persists | Hobby workspace 5 GB/month; Pro 25 GB; overage follows current plan price | Encrypted daily disk snapshots retained at least seven days; app-consistent SQLite backup still mandatory | Singapore is the reasonably close listed region | Standard **$25** + 10 GB disk at $0.25/GB = **$27.50** | Payment method needed for paid service/overage continuity | Lower OS work, higher platform/mount/deploy lock-in | **Managed fallback.** One disk permits only one instance and prevents zero-downtime deployment. Safe only with exact durable mount and controlled migration startup. |

### Requirement-by-requirement result

All four paid candidates can run a long-lived Node/Next.js service, keep private environment values, support a custom domain and HTTPS, provide sufficient RAM at the chosen tier, and restart predictably. On the three VM providers, Caddy is the proposed managed-certificate reverse proxy; Caddy documents automatic certificate issuance/renewal when approved A/AAAA records point at the host and ports 80/443 are reachable. Render supplies managed custom-domain TLS.

The decisive constraint is storage topology:

| Provider | One writable process | Local durable SQLite | DB/private files together | Exclusive migration/restore | Compliance |
| --- | --- | --- | --- | --- | --- |
| Vultr | Pin one systemd Node service | Yes, selected VM disk | Yes | Operator-controlled maintenance mode | **Complies** |
| DigitalOcean | Pin one systemd Node service | Yes, selected Droplet disk | Yes | Operator-controlled maintenance mode | **Complies** |
| AWS Lightsail | Pin one systemd Node service | Yes, bundle SSD | Yes | Operator-controlled maintenance mode | **Complies** |
| Render | Disk attachment prevents multiple instances | Yes only below the exact mount path | Yes only if every private path is relocated below it | Must be runtime/shell controlled; disk is unavailable to build/pre-deploy/one-off jobs | **Complies with extra restrictions** |

Provider snapshots supplement but do not replace a matched, application-consistent SQLite plus private-asset backup. The current cleared boundary in [Staging SQLite Feasibility and Limits](STAGING_SQLITE_FEASIBILITY_AND_LIMITS.md) remains authoritative: one writer, same-host volume, serialized jobs, stopped-writer restore, no network-shared file, and no horizontal/multi-region writers. This package does not migrate to PostgreSQL.

## Proposed upgrade and PostgreSQL triggers

These are **proposed future signals**, not observed current scale:

- move from 2 GB to 4 GB if memory exceeds 70% for 15 minutes, process RSS p95 exceeds 1.4 GB, or swap/termination occurs;
- resize CPU if CPU exceeds 70% for 15 minutes or authenticated request p95 exceeds 750 ms after application diagnosis;
- expand storage at 50% utilization, a 10 GB database, or when retained matched backups/private assets would exceed 70% of the volume;
- diagnose immediately if `SQLITE_BUSY` exceeds 0.1% of write requests or five events/hour, write-queue p95 exceeds 250 ms, integrity/backup age alerts fire, or restore exceeds 30 minutes;
- propose PostgreSQL only when the school requires more than one writable instance, the single-writer availability/RTO is unacceptable, recurring lock/latency persists after transaction tuning, or validated backup/restore windows cannot meet the approved objectives.

Crossing a signal triggers measurement and a separately governed architecture decision. It does not authorize PostgreSQL, scaling, or migration.

## Official sources

- Vultr: [live plans API](https://api.vultr.com/v2/plans?type=vc2&per_page=500), [live regions API](https://api.vultr.com/v2/regions?per_page=500), [Cloud Compute provisioning](https://docs.vultr.com/products/compute/instances/cloud-compute/provisioning), [backup price and limits](https://docs.vultr.com/products/storage/backups/faq), and [billing/payment documentation](https://docs.vultr.com/public/doc-assets/pdfs/collection_item/platform-billing.pdf).
- DigitalOcean: [Droplet pricing](https://www.digitalocean.com/pricing/droplets), [regional availability](https://docs.digitalocean.com/platform/regional-availability/), [backup pricing](https://docs.digitalocean.com/products/backups/details/pricing/), [snapshot pricing](https://docs.digitalocean.com/products/snapshots/details/pricing/), and [payment methods](https://docs.digitalocean.com/platform/billing/manage-payment-methods/).
- AWS: [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), [bundle specifications](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html), [Mumbai transfer treatment](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-your-amazon-lightsail-bill.html), and [automatic snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-snapshots.html).
- Render: [instance types](https://render.com/docs/compute-plans), [persistent disks](https://render.com/docs/disks), [regions](https://render.com/docs/regions), [custom domains/TLS](https://render.com/docs/custom-domains), [environment values](https://render.com/docs/configure-environment-variables), [outbound bandwidth](https://render.com/docs/outbound-bandwidth), and [current pricing](https://render.com/pricing).
- Architecture: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [SQLite appropriate uses](https://sqlite.org/whentouse.html), [SQLite WAL](https://sqlite.org/wal.html), and [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

Related: [Cost and budget model](STAGE_1A_COST_AND_BUDGET_MODEL.md) · [Domain/DNS change plan](STAGE_1A_DOMAIN_DNS_CHANGE_PLAN.md) · [Private staging security plan](STAGE_1A_PRIVATE_STAGING_SECURITY_PLAN.md) · [User decision package](STAGE_1A_USER_DECISION_PACKAGE.md)
