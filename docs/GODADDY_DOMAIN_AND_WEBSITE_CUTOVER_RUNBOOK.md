# GoDaddy Domain and Public Website Cutover Runbook

## Status and non-authorisation boundary

This is a planning runbook for a future approved cutover of the Nalanda Public School public website. Prompt 20D does not purchase hosting, deploy code, alter GoDaddy settings, change nameservers, edit DNS, request certificates, or move email.

No production action may be taken until the Director has approved the target host, change window, named owners, rollback authority, and verified DNS export. Provider interfaces change, so the operator must also use current GoDaddy and Google Workspace guidance during the approved window.

## Ownership

| Responsibility | Named owner required before launch |
|---|---|
| Business approval and public claims | Director |
| Public content approval | Principal or Director |
| GoDaddy account and renewal | Domain owner |
| DNS export and change execution | DNS operator |
| Google Workspace mail verification | Workspace administrator |
| Hosting, SSL, application health | Technical operator |
| Rollback decision | Director and technical operator |
| Post-launch monitoring | Technical operator and school office |

Record domain expiry, renewal method, registrar owner, recovery email, MFA owner, and emergency contact in the school’s controlled credential register. Never store registrar, DNS, hosting, Google Workspace, SMTP, or certificate credentials in the ERP or public CMS.

## Preserve the existing GoDaddy site

Before any DNS change:

1. Record current public URLs and capture dated screenshots of important pages.
2. Export or archive the existing GoDaddy website using a provider-supported method.
3. Save a read-only copy of approved public text, images, legal pages, redirects, and downloads.
4. Keep the existing site published while staging is evaluated.
5. Document exactly how the old site can be republished and who may authorise it.

Do not archive unapproved child photographs, private Staff details, Parent contacts, enquiry submissions, or credentials into the Prompt 20D repository.

## Export and classify DNS

Export the complete current DNS zone. If the registrar has no single export, create a dated inventory of every visible record with exact name, type, value, priority, TTL, and purpose.

Classify:

- website delivery: apex `A`/`AAAA`, `www` `CNAME`, redirects, staging;
- Google Workspace mail: `MX`;
- sender authentication: SPF `TXT`, DKIM selector `TXT`, DMARC `_dmarc` `TXT`;
- Google ownership/service verification: verification `TXT` or `CNAME`;
- other services and subdomains;
- nameserver, `SOA`, and DNSSEC state.

Keep the export in the controlled operations archive, not in source control, public screenshots, Prompt 20D content, or issue text.

## Google Workspace preservation gate

Unless a separate approved mail project says otherwise:

- do not change or remove `MX`;
- do not replace SPF or create a second SPF record;
- do not change or remove Google DKIM selectors;
- do not change or remove `_dmarc`;
- do not remove Google ownership/service-verification records;
- do not change nameservers for a website-only launch;
- do not alter Gmail routing, aliases, groups, or Workspace domain settings.

Before the window, capture Gmail activation and domain-authentication status. After any website change verify inbound, outbound, internal, and reply delivery, then verify SPF, DKIM, and DMARC results. If mail fails, stop and restore the exact exported values. School email continuity takes priority over website launch.

## Staging

Use a dedicated staging hostname such as `staging.nalandaps.com` only after approval. Staging must:

- use synthetic or copied data, never the operational database;
- expose no private ERP record;
- retain authenticated website administration;
- leave `PUBLIC_WEBSITE_INDEXING_ENABLED` other than literal `true`;
- return noindex metadata and a robots disallow policy;
- use a valid HTTPS certificate;
- preserve `/login` as the sole public portal entry;
- avoid analytics, public forms, uploads, and marketing integrations;
- contain only approved or explicit approval-pending public wording.

Validate hostname, certificate chain/expiry, redirects, canonical host, public/private cache headers, mobile behavior, accessibility, robots, sitemap, and rollback before production approval.

## TTL planning

At least one normal TTL interval before cutover:

1. identify only website records that would change;
2. record existing TTLs;
3. approve a temporary lower TTL where necessary;
4. leave mail and verification records unchanged;
5. wait for the previous TTL to age out.

Do not lower the whole zone. Restore approved steady-state TTLs after launch stabilises.

## Readiness gate

The future change window may begin only when:

- Prompt 20D-QA is cleared;
- required public pages and contact details are approved;
- Mandatory Disclosure is disabled unless separately approved;
- production host and HTTPS are healthy;
- staging is noindex and has no QA data;
- a current operational backup exists;
- old-site archive and restore are confirmed;
- final DNS export is complete;
- MX, SPF, DKIM, DMARC, and Google verification are recorded;
- proposed website-only DNS diff is peer reviewed;
- rollback values, owner, and monitoring contacts are present.

## Approved website-only cutover

During a separately authorised change window:

1. capture a final DNS export and timestamp;
2. confirm the old site responds;
3. apply only the approved website record changes;
4. do not edit nameservers, MX, SPF, DKIM, DMARC, or Google verification;
5. verify authoritative DNS;
6. verify apex and `www` over HTTPS;
7. verify redirects and certificate coverage;
8. verify public pages, `/login`, robots, sitemap, and accessibility paths;
9. repeat all mail checks;
10. record diff, timestamps, operator, approver, and results.

This runbook does not itself authorise those actions.

## Rollback

Rollback immediately for site outage, invalid HTTPS, private exposure, broken login, unexpected indexing, unapproved DNS drift, or mail failure.

1. Stop further changes.
2. Restore only changed website records to the final pre-change values.
3. Preserve MX, SPF, DKIM, DMARC, Google verification, nameservers, and DNSSEC.
4. Verify the old site and HTTPS.
5. Repeat inbound/outbound/internal mail checks.
6. Document the incident and keep the new site unavailable until corrected.
7. Retain staging and evidence for review.

## Post-launch monitoring and archival

Check authoritative/recursive DNS, apex/`www` HTTPS, redirects, public route health, robots, sitemap, login, cache headers, browser/server errors, inbound/outbound mail, SPF/DKIM/DMARC, broken links, assets, indexing, staging URLs, and QA content.

Record checks at launch, after one previous TTL, after 24 hours, and throughout the approved observation period. Keep explicit ownership for domain, hosting, certificate, renewals, old-site archive, and rollback.

## Evidence template

| Evidence | Value |
|---|---|
| Approval/change ticket | |
| Old-site archive | |
| Final DNS export timestamp | |
| Website-only DNS diff | |
| MX/SPF/DKIM/DMARC preserved | |
| Google verification preserved | |
| Staging noindex verified | |
| SSL verified | |
| Rollback owner | |
| Mail verification | |
| Monitoring owner | |
