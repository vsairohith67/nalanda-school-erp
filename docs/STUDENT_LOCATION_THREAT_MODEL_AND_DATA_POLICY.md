# Student Location Threat Model and Data Policy

## Document status

- Prompt: 21A / 21A-QA
- Official-source review date: 2026-07-19
- Status: policy and threat-model planning only
- Current implementation: none
- Legal status: engineering policy proposal, not legal advice

## Scope and classification

This policy covers Student postal addresses, localities, postal codes, approximate points, exact points, derived clusters, correction evidence, access audit, exports, backups, and provider jobs. Prompt 21A creates none of them.

Student home-location data is classified as **high-risk child personal data**. Exact and approximate coordinates can reveal a child’s residence, routines, family links, socioeconomic signals, or vulnerability even when names are omitted. A coordinate is not anonymous merely because it is shown as a marker or cluster.

## Policy principles

1. Purpose limitation: collect only for a written, approved school purpose.
2. Data minimisation: postal/locality data before coordinates; coarse before exact.
3. Default denial: no role inherits location access from ordinary Student access.
4. Server-side isolation: send only authorised fields, never “fetch then hide”.
5. Human verification: provider or migrated output is untrusted.
6. Child safety: no tracking, surveillance, ranking, stigma, or behavioural inference.
7. Short retention: invalidate and remove data when the purpose ends.
8. Accountable access: sensitive view, correction, export, purge, and policy changes are auditable.
9. Fail closed: missing role, purpose, provenance, or provider state denies the action.
10. No secondary use: no advertising, AI training, model prompt, public analytics, or unrelated communication.

## Assets and trust boundaries

Protected assets include current addresses, coordinates, address history, parent requests, verification evidence, access logs, backups, exports, screenshots, and provider request/response data.

Threat actors include an unauthorised employee, overprivileged Teacher, compromised leadership account, malicious insider, person holding a stolen/shared device, Parent attempting another child’s record, external provider/subprocessor, holder of a leaked API key, API attacker, accidental CSV or screenshot recipient, backup thief, search crawler, and an otherwise authorised user acting outside the recorded purpose.

Trust boundaries:

- public browser to authenticated application;
- Parent to linked-child server authorization;
- staff browser to role/permission enforcement;
- application to database and private backup;
- application to a future geocoding provider;
- production to development/staging;
- operational data to reports, CSV, print, PWA cache, AI, and public website;
- active records to retention, deletion, and restored backups.

## Threat register

| ID | Threat | Likelihood | Impact | Required control | Residual risk | Owner / phase |
| --- | --- | --- | --- | --- | --- | --- |
| L-01 | Teacher, Accountant, Viewer, or Parent accesses another child’s address | Medium | Critical | Dedicated permissions, linked-child checks, server projections, blocked-role tests | Low after QA | Engineering / 21B |
| L-02 | New coordinate fields leak through generic Student CSV | High without change | Critical | Explicit export allowlist; deny raw coordinates; regression test | Low | Engineering / 21B |
| L-03 | Coordinates silently enter backup and later restore with broad access | High without change | High | Reviewed backup projection, encryption, restore permission reset, retention | Medium | Engineering + data owner / 21B |
| L-04 | Exact markers identify homes through zoom or cluster-of-one | High | Critical | No exact points; k>=10 aggregates; coarse cells; no drill-down | Low/Medium | Product + privacy / 21C |
| L-05 | Differencing two aggregate views reveals a child | Medium | High | Stable buckets, minimum counts, adjacent suppression, query limits | Medium | Analytics owner / 21C |
| L-06 | Provider receives identifiable child address | Medium if live | High | No provider in 21B/21C; processor review, minimised requests, contract | Medium | Legal + security / 21D |
| L-07 | Public Nominatim receives confidential addresses or blocks service | High if chosen | High | Explicit prohibition on public Nominatim | Low | Engineering / all |
| L-08 | API key theft creates unbounded cost or data misuse | Medium | High | Server-only restricted keys, per-API/app separation, quotas, alerts, kill switch | Medium | Security / 21D |
| L-09 | Bulk geocoding creates false points and unsafe decisions | Medium | High | Preview, rate limit, human confirmation, confidence/provenance, no auto-accept | Medium | Operations / 21D |
| L-10 | Migrated free-text address is labelled verified | High | Medium | Migration status `UNVERIFIED`; explicit verification workflow | Low | Operations / 21B |
| L-11 | `0,0`, school coordinates, or blank text represents unknown | Medium | High | Nullable fields, explicit unknown status, validation | Low | Engineering / 21B |
| L-12 | Address edit leaves a stale coordinate | High | High | Address-version binding and automatic invalidation | Low | Engineering / 21B |
| L-13 | Sibling records create inconsistent or duplicated home points | Medium | Medium | Household-aware review without broadening Parent access; consistency warning | Medium | Operations / 21B |
| L-14 | Free-text notes contain landmarks, access codes, or hidden coordinates | Medium | High | Structured fields, disallowed-content guidance, limited notes, review | Medium | Operations / 21B |
| L-15 | Location appears in logs, URLs, analytics, error reports, or telemetry | Medium | Critical | POST bodies, redaction, no query coordinates, structured safe errors, telemetry denylist | Low/Medium | Security / 21B-21C |
| L-16 | Browser/PWA stores private map or API response offline | Medium | High | Network-only, `private, no-store`, service-worker deny tests, cache clearing | Low | PWA owner / 21C |
| L-17 | AI assistant reveals or infers a child’s location | Medium | Critical | Source-field denylist, prompt/output scan, no small groups | Low | AI owner / 21B onward |
| L-18 | Map is printed, screenshotted, or shared outside its purpose | Medium | High | No print/export/share, warning, session controls, audit and training | Medium | Operations / 21C |
| L-19 | Parent correction overwrites approved data or targets another child | Medium | Critical | Request-only workflow, linked-child check, review, version conflict | Low | Engineering / 21B |
| L-20 | Compromised staff account enumerates addresses | Medium | Critical | MFA/deployment control, throttling, purpose/audit, anomaly review, session security | Medium | Deployment/security |
| L-21 | Deleted location survives exports, temp files, provider jobs, or backups | High without process | High | Deletion inventory, expiry schedule, provider deletion evidence, restore re-deletion list | Medium | Data owner / 21B-21D |
| L-22 | Restored old backup re-enables provider or resurrects invalid point | Medium | High | Restore defaults provider off; mark provenance/verification stale; reconcile deletions | Low/Medium | Recovery owner / restore |
| L-23 | Development or QA uses real Student addresses | Medium | Critical | Synthetic-only fixtures, environment guards, cleanup and zero-count proof | Low | QA / all |
| L-24 | Exact location becomes a proxy for caste, income, religion, disability, or risk | Medium | Critical | No profiling/ranking; approved aggregate purposes only; fairness review | Medium | Leadership/privacy |
| L-25 | Emergency exception becomes permanent broad access | Medium | High | Separate time-bound break-glass workflow, reason, alert, after-review | Medium | Leadership / future |
| L-26 | Provider terms prohibit stored output or require a specific map | Medium | High | Written terms determination before selection; no live use while unclear | Low | Procurement/legal / 21D |
| L-27 | Foreign processing or subprocessors create unassessed transfer risk | Medium | High | Data-flow and subprocessor review, contractual controls, transfer/legal decision | Medium | Legal / 21D |
| L-28 | Exact points in attachments or screenshots evade record deletion | Medium | High | Prohibit uploads/screenshots as source; controlled correction UI only | Medium | Operations / 21B |
| L-29 | Small school cohort makes “anonymous” locality counts identifiable | High | High | k>=10, coarse aggregation, suppress rare combinations, no repeated slicing | Medium | Privacy / 21C |
| L-30 | Live or historical device location is added as “accuracy improvement” | Low/Medium | Critical | Explicit product prohibition, no permission request or device identifier | Low | Leadership / all |
| L-31 | Stolen/shared device or browser history reveals a viewed home | Medium | Critical | No URL/query coordinates, short session, reauthentication, no-store, logout clearing | Medium | Deployment + PWA / 21B-21C |
| L-32 | Public page, metadata, sitemap, or crawler indexes a location | Low/Medium | Critical | Hard public/private projection boundary, no public route/source, crawl tests | Low | Public-site owner / 21B onward |
| L-33 | Leaked backup exposes addresses and child links | Medium | Critical | Encryption, key separation, access/retention, off-device controls, restore audit | Medium | Recovery/security owner |
| L-34 | Location disclosure enables stalking, harassment, burglary, or kidnapping | Low/Medium | Critical | No exact points, strict access, aggregation, incident response, no screenshot/export | Medium | Leadership/safeguarding |
| L-35 | Browser/API enumeration reconstructs raw markers despite hidden UI | Medium | Critical | Object-scope checks, opaque IDs, throttling, minimal viewport payload, security tests | Low/Medium | Engineering / 21C |

## Mandatory technical controls

### Authorization and projection

- enforce session, role, dedicated permission, academic-year scope, and Parent linked-child scope on the server;
- use allowlisted select/projection objects for every API, export, backup, print, and report;
- never return raw location fields to an unauthorised client;
- require a fresh, reasoned action for exceptional sensitive access;
- test one allowed and multiple blocked roles.

### Application and storage

- keep coordinate data separate from the general Student row;
- encrypt transport and production storage according to deployment policy;
- no secrets in source, database, logs, or browser storage;
- validate latitude/longitude range and reject non-finite, `0,0` sentinel, or disallowed precision;
- invalidate location when its source address changes;
- use optimistic version checks for correction approval;
- use accessible in-app dialogs, not native alert/confirm/prompt.

### Browser and PWA

- location endpoints use `Cache-Control: private, no-store`;
- service worker never handles or caches location pages, APIs, tiles, or provider responses;
- no localStorage, sessionStorage, IndexedDB, Cache Storage, clipboard automation, or URL query coordinates;
- no browser geolocation permission;
- CSP/connect-src changes require separate provider review;
- clear sensitive client state on logout and navigation.

### Reporting and aggregation

- default to locality/postal-code counts;
- minimum cell size 10, configurable upward for small cohorts;
- suppress complementary/adjacent cells when totals allow subtraction;
- do not combine location with rare disability, medical, fee, caste, religion, attendance, or disciplinary dimensions;
- never rank Teachers, families, or localities by sensitive outcomes;
- no recipient-level read/open tracking.

### Audit

Audit may include actor ID, role, permission, record ID, action class, purpose/reason code, decision, timestamp, request ID, and result count. Audit must not include full address, coordinate, provider response, map viewport, search text, or evidence image. Audit access and retention are separately permissioned.

## Provider and key policy

Prompt 21B and 21C run with no live provider. For 21D:

- a provider profile is disabled by default and restored disabled;
- credentials are environment-only, server-only, restricted to required APIs and origins/IPs;
- staging and production use separate projects/keys/quotas;
- each request has an idempotency key, one bounded retry, timeout, and explicit one-address purpose;
- no autocomplete, bulk job, or background conversion by default;
- daily and monthly call caps, spend alerts, and a manual kill switch are mandatory;
- provider request/response retention is minimised and documented;
- do not send Student/admission identifiers with an address;
- never use the public OSM Nominatim service for Student data.

## Incident and breach response

Potential incidents include unauthorised view/export, key exposure, provider misrouting, abnormal enumeration, cache persistence, screenshots, backup loss, and false mapping that creates safety harm.

1. Disable the affected route/provider/key and preserve privacy-safe evidence.
2. Identify affected fields, children, time window, recipients, exports, backups, and processors.
3. Stop further disclosure; revoke sessions and credentials as appropriate.
4. Notify the named Data Protection/incident owner and school leadership.
5. Follow current Indian legal notification duties and counsel-confirmed timelines.
6. Inform affected Data Principals/guardians when required, in clear language without exposing another child.
7. Correct or invalidate false locations.
8. document containment, deletion, recovery, and prevention.

## Retention and deletion policy template

Before 21B, leadership must fill exact durations:

| Data | Proposed trigger | Required decision |
| --- | --- | --- |
| Current postal address | While enrolled plus approved administrative period | Legal/records owner duration |
| Coarse point | While its written purpose remains active | Shorter than postal address |
| Correction request | Closure plus grievance/audit period | Exact duration |
| Verification evidence | Review completion | Prefer no copy; otherwise minimal short retention |
| Access audit | Security/accountability period | Exact duration and access |
| Temporary import/geocode payload | Successful review or failed-job expiry | Hours/days, not indefinite |
| Export | Immediate controlled download; no server copy by default | Recipient handling policy |
| Backup copy | Existing encrypted retention schedule | Document expiry and deletion propagation |

Deletion must be idempotent, authorised, previewable, logged without sensitive body content, and verified across operational storage, temporary storage, jobs, caches, provider copies, and backup-expiry workflow.

## Parent and Student rights workflow

- provide a clear notice of fields, purpose, source, recipients/processors, retention, rights, grievance contact, and consequences of optional refusal;
- linked Parent can view the current approved postal address for their child and submit a correction;
- a request creates a pending version, never an immediate overwrite;
- acknowledge and resolve requests within the counsel-approved period;
- document lawful reasons for retaining a field when erasure is refused;
- never expose another sibling/household record solely because the address matches.

## Verification evidence required before each phase

### 21B

- permission matrix tests;
- blocked Parent/Teacher/Viewer/Accountant routes;
- migration preview with synthetic data;
- unknown versus unverified tests;
- correction concurrency and audit tests;
- address-change invalidation test;
- generic export and backup projection tests;
- AI, PWA, public, print, and log exclusion tests;
- synthetic cleanup and final database zero-change/reconciliation evidence.

### 21C

- aggregate threshold and differencing tests;
- server projection and exact-point exclusion;
- no-cache/service-worker checks;
- no print/export/share;
- audit with no location body;
- desktop and exact 390x844 in-page viewport evidence;
- light/dark and keyboard/screen-reader dialog QA.

### 21D

- reviewed provider contract and data-flow diagram;
- storage/display/attribution/deletion determination;
- restricted-key and quota evidence;
- MOCK-only failure, retry, duplicate, kill-switch, deletion, and cost tests;
- supervised synthetic or consented pilot only;
- no unattended bulk production conversion.

## Policy decision

Tier 1 structured postal data is the default. Tier 2 is permitted only for approved aggregate necessity. Tier 3 is exceptional and disabled by default. Tier 4 and Tier 5 are prohibited until a new written privacy, necessity, legal, security, and leadership decision explicitly replaces this policy.

## Prompt 21B preflight governance status

Prompt 21A and Prompt 21A-QA are fully cleared, but Prompt 21B remains blocked. The approval record is `PENDING` because no leadership reference, qualified Indian privacy/legal reviewer, approved notice, mandatory/optional decision, approved access/retention/export policy, or accountable incident owner was supplied.

For the lowest-risk path, `OMIT_ALL_COORDINATES_FROM_21B` is the exact proposed coordinate decision. Tier 1 structured postal address is the recommended maximum individual precision; any Tier 2 output is a suppressed locality count with proposed minimum group 10. Tier 3 needs a separate later approval, while Tier 4 exact residence and Tier 5 live/device location remain prohibited.

The access, incident, notice, and retention documents are decision drafts only. No schema or runtime implementation was performed, no location/address data was collected or processed for this preflight, no map/geocoder/provider was used, and backup remains version 37.
