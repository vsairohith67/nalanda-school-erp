# STAGE-1A Domain and DNS Change Plan

Evidence date: **2026-08-15**. Domain: `nalandaps.com`. This is a no-change plan: no DNS record, nameserver, registrar setting, certificate validation, or provider resource was created or modified.

## Read-only public DNS baseline

The public results below were resolved on 2026-08-15 before documentation work. They are privacy-safe record content, not an authenticated full-zone export.

| Name/type | Observed value |
| --- | --- |
| `nalandaps.com A` | `76.223.105.230`, `13.248.243.5` |
| `www.nalandaps.com CNAME` | `nalandaps.com` |
| Root MX | Google Workspace set headed by `ASPMX.L.GOOGLE.COM`, with the published alternate Google MX hosts |
| Root TXT | Google verification, a retained `D7805277` value, and `v=spf1 include:_spf.google.com ~all` |
| `_dmarc.nalandaps.com TXT` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |
| Nameserver authority | GoDaddy `domaincontrol.com`; SOA serial `2026073003`, TTL 600 |
| `staging-erp.nalandaps.com` | No public A, AAAA, CNAME, MX, or TXT answer |
| `erp.nalandaps.com` | No public A, AAAA, CNAME, MX, or TXT answer |

This query cannot enumerate hidden or selector-specific records. The future pre-change gate must export/read the **entire authenticated GoDaddy zone**, including Google Workspace MX, SPF, all DKIM selectors, DMARC, Google verification, CAA, SRV, TXT, redirects, and every unrelated record. Absence from the small public query is not evidence of absence.

## GoDaddy capability evidence gap

The existing board/session did not provide an authenticated GoDaddy DNS view. The Browser reached GoDaddy sign-in, and no credentials were entered or disclosed. Public SOA data confirms GoDaddy-hosted nameservers only; it does not prove account ownership, permission level, DNSSEC state, UI behavior, or billing treatment.

Therefore this package **does not make a final claim that subdomains require or do not require a separate purchase**. DNS standards allow additional host labels, but the actual GoDaddy account capability and any product/billing condition must be verified read-only in an authenticated session before STAGE-1B approval. If access remains unavailable, DNS work remains blocked rather than guessed.

## Proposed names and roles

| Host | Proposed use | Current action |
| --- | --- | --- |
| `staging-erp.nalandaps.com` | Synthetic-only, gated staging | Plan only; user decision required |
| `erp.nalandaps.com` | Future production endpoint | Reserve in plan only; do not create in STAGE-1B staging work unless separately authorized |

The existing public site at the root and `www`, Google Workspace mail, SPF, DKIM, DMARC, verification, nameservers, and all unrelated records must remain byte-for-byte/value-for-value unchanged.

## Exact future record shapes

Resource-specific IPs and service targets do not exist because resource creation is unauthorized. Values are deliberately marked `TBD/not allocated`; they must be copied from the approved provider after creation and independently verified, never invented.

### Recommended Vultr VM

| Type | GoDaddy name/host | Future value | TTL | When |
| --- | --- | --- | ---: | --- |
| `A` | `staging-erp` | `TBD_VULTR_STATIC_IPV4_NOT_ALLOCATED` | 600 | Only after provider/resource and DNS approvals |
| `AAAA` | `staging-erp` | `TBD_VULTR_IPV6_NOT_ALLOCATED` | 600 | Optional; only if stable IPv6 and firewall/TLS are verified |
| `TXT` | `_acme-challenge.staging-erp` | `TBD_ONLY_IF_AN_APPROVED_DNS_CHALLENGE_REQUIRES_IT` | 600 | Normally unnecessary with Caddy HTTP/TLS-ALPN validation |
| `A` | `erp` | `TBD_FUTURE_PRODUCTION_STATIC_IPV4_NOT_ALLOCATED` | 600 | Future production authorization only |
| `AAAA` | `erp` | `TBD_FUTURE_PRODUCTION_IPV6_NOT_ALLOCATED` | 600 | Future production authorization only |

Default implementation shape: one `A` record for staging. Do not create `AAAA` until IPv6 reachability, firewall, and certificate handling pass. Caddy documents that approved A/AAAA records plus reachable ports 80/443 allow automatic HTTPS: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

### DigitalOcean Droplet alternative

| Type | Host | Future value | TTL |
| --- | --- | --- | ---: |
| `A` | `staging-erp` | `TBD_DIGITALOCEAN_RESERVED_OR_STABLE_IPV4_NOT_ALLOCATED` | 600 |
| `AAAA` | `staging-erp` | `TBD_DIGITALOCEAN_IPV6_NOT_ALLOCATED`, optional after verification | 600 |
| `A`/`AAAA` | `erp` | Production-specific values, `TBD/not allocated` | 600 |

### AWS Lightsail alternative

| Type | Host | Future value | TTL |
| --- | --- | --- | ---: |
| `A` | `staging-erp` | `TBD_LIGHTSAIL_STATIC_IPV4_NOT_ALLOCATED` | 600 |
| `AAAA` | `staging-erp` | `TBD_LIGHTSAIL_STATIC_IPV6_NOT_ALLOCATED`, only if supported and verified | 600 |
| `A`/`AAAA` | `erp` | Production-specific values, `TBD/not allocated` | 600 |

Lightsail must use a static IP before DNS is pointed at it; see [Lightsail DNS and static-IP guidance](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-dns-in-amazon-lightsail.html).

### Render managed fallback

| Type | Host | Future value | TTL |
| --- | --- | --- | ---: |
| `CNAME` | `staging-erp` | `TBD_RENDER_SERVICE.onrender.com` | 600 |
| `TXT` | Provider-generated verification host, if shown | `TBD_PROVIDER_GENERATED_VALUE` | 600 |
| `CNAME` | `erp` | `TBD_FUTURE_PRODUCTION_SERVICE.onrender.com` | 600 |

Do not add both an `A` and `CNAME` at the same name. Render's exact service target and any verification record exist only after service creation; use only the dashboard-generated values. Source: [Render custom domains](https://render.com/docs/custom-domains).

## Future change procedure

This procedure is not authorized now.

1. Obtain the decisions in the [user decision package](STAGE_1A_USER_DECISION_PACKAGE.md), including separate cloud-resource and GoDaddy-write permissions.
2. Authenticate privately in the Browser. Export/read the full GoDaddy zone and record DNSSEC, delegated nameservers, every row, and the user/account role without copying private account identifiers into documentation.
3. Re-resolve the public root, `www`, MX, TXT, SPF, known DKIM selectors, DMARC, CAA, staging, and ERP records. Compare with this baseline and the authenticated export.
4. Create and harden the approved **synthetic-only** provider resource. Capture its allocated target from the provider UI/API. Do not point DNS until direct-IP/service-host health, access gate, visible staging banner, noindex, private/no-store, disabled live providers, backup, restore, and rollback checks pass.
5. Present a minimal DNS diff containing only the approved staging record(s), exact values, TTL, expected effect, and rollback. Obtain DNS-change authority.
6. Apply only the approved staging row. Do not edit root, `www`, MX, SPF, DKIM, DMARC, verification, nameservers, DNSSEC, forwarding, or any unrelated row.
7. Resolve through at least two independent public resolvers, verify HTTPS/certificate hostname, verify the access gate precedes the application, and confirm root/`www` and Google Workspace records are unchanged.
8. If verification fails, remove/revert only the just-added staging row using the captured prior state. Do not improvise other DNS changes.

## Rollback and evidence

The DNS rollback unit is the exact staging row added during a later approved phase. The evidence package must contain redacted before/after zone views, public resolver results, certificate hostname/issuer/expiry, root/`www` health, mail/authentication record equality, and provider target identity. It must not contain credentials, account identifiers, secrets, or live private data.

## STAGE-1A result

- No authenticated GoDaddy write was attempted.
- No DNS record, nameserver, DNSSEC setting, redirect, domain product, or certificate-validation record was changed.
- No exact provider IP or service target was invented.
- `erp.nalandaps.com` remains future-only.

Related: [Provider comparison](STAGE_1A_HOSTING_PROVIDER_COMPARISON.md) · [Cost and budget model](STAGE_1A_COST_AND_BUDGET_MODEL.md) · [Private staging security plan](STAGE_1A_PRIVATE_STAGING_SECURITY_PLAN.md) · [User decision package](STAGE_1A_USER_DECISION_PACKAGE.md)
