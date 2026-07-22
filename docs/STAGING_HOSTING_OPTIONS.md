# Staging Hosting Options

Evidence review date: 2026-07-23. Prices and regions can change; refresh official pages before purchase. No account or resource was created.

## Decision summary

- **Recommended:** small Linux VPS in an India region, one Node process, Caddy/nginx, systemd, local SSD, encrypted off-host backup later. AWS Lightsail Mumbai is a concrete evaluable example, not a purchase decision.
- **Fallback:** managed container web service with one attached persistent disk and managed TLS. Render Singapore is a concrete example; India is not currently listed.
- **Rejected for current SQLite:** serverless functions, managed application platforms with ephemeral-only filesystems, multi-instance/container orchestration, and any network-mounted database file.

The recommendation is based on controllable SQLite/file persistence, predictable maintenance/rollback, India-region availability, and auditable singleton scheduling—not lowest sticker price.

## Comparison

| Option | Next.js / SQLite | HTTPS and domains | Deploy/backup/monitoring/secrets | Cost/complexity/region | Decision |
| --- | --- | --- | --- | --- | --- |
| Managed container + persistent disk | Next.js supported. SQLite works only with one service instance and all private paths mounted. | Managed ingress/TLS/custom subdomain is strong. | Git/image deploys, secret store, metrics/logs and health checks are convenient. Disk-backed deploy may stop old instance first; migrations must run at runtime under a singleton lock. Application-consistent backups still required. | Render example: Starter $7/512 MB or Standard $25/2 GB, SSD $0.25/GB-month; regions are Oregon, Ohio, Virginia, Frankfurt, Singapore—no India listed. Medium lock-in, low/medium ops. | **Fallback**. Use 2 GB class unless measurements prove smaller. |
| Small Linux VPS | Full Next.js/Prisma support. Local SSD is the most direct fit for single-host SQLite, journal/WAL/SHM, OCR, and backup files. | Caddy or nginx terminates TLS; custom subdomain supported after later DNS approval. | Release directories + systemd + file lock + local snapshots/validated backups. OS patching, firewall, log shipping and cert/proxy operation are the operator's responsibility. | Lightsail example: $7/1 GB, $12/2 GB, $24/4 GB Linux bundles; Mumbai listed (transfer allowance differs); snapshots $0.05/GB-month. Low vendor lock-in, medium/high ops. | **Recommended**: 2 GB starting size, measured before resizing. |
| Windows-hosted internal staging machine | Current Windows checkout works and SQLite remains local. | Trusted public HTTPS on phones requires reachable routing/certificate/DNS; self-signed LAN TLS is not physical PWA certification. | Familiar local operations, but power, patching, remote access, backups, uptime and perimeter controls are manual. | Existing hardware may have low incremental cost; India-local. High operational and physical single-point risk. | **Local rehearsal only**, not the preferred external staging host. |
| Serverless hosting | Next.js is compatible, but the SQLite/private-file architecture is not. Vercel Functions document a read-only filesystem with only writable `/tmp` scratch space and automatic concurrency. | Excellent managed HTTPS/domain support. | Automatic scale/failover conflicts with one writer and local persistence. Requires a managed database/object storage redesign. | Usage-based/free tiers; low ops, high architecture mismatch/lock-in. | **Rejected** until database and private storage are redesigned. |
| Managed app platform without persistent disk | Next.js can run, but SQLite/OCR/backups are lost on restart. Heroku documents that dyno writes are discarded on stop/restart and not visible to other dynos. | Managed HTTPS/domain and secret storage are good. | Deploy/monitoring good; data durability impossible without external DB/object storage. | Subscription/usage-based; low ops, high mismatch. | **Rejected** for current SQLite. |

## Official-source notes

- Render states that only the disk mount path persists, the disk is accessible to one service instance, a disk-backed service cannot scale to multiple instances, and attaching a disk prevents zero-downtime deploys: [Persistent Disks](https://render.com/docs/disks).
- Render automatically provisions/renews TLS for custom domains and redirects HTTP to HTTPS: [Custom Domains](https://render.com/docs/custom-domains). Current region list: [Regions](https://render.com/docs/regions). Current compute/disk figures: [Pricing](https://render.com/pricing).
- AWS Lightsail pricing lists Linux bundles, Mumbai transfer considerations, block storage, and snapshot pricing: [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/).
- Vercel documents a read-only function filesystem and a 500 MB writable `/tmp`: [Function runtimes](https://vercel.com/docs/functions/runtimes).
- Heroku documents an ephemeral per-dyno filesystem discarded on stop/restart: [Dynos](https://devcenter.heroku.com/articles/dynos#ephemeral-filesystem).
- Next.js recommends a reverse proxy in front of a self-hosted server and explains single-instance persistent local cache behavior: [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

## Provider evaluation gate

Before choosing a provider, confirm in writing: exact region, 2 GB minimum instance, persistent local SSD semantics, one-instance pinning, managed or self-managed TLS, secret store, console/SSH recovery, snapshot mechanics, egress, log export, billing alerts, support ownership, and deletion/export procedure. A free tier with ephemeral disk or sleep is not acceptable.
