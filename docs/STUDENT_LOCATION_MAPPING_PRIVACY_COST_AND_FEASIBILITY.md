# Student Location Mapping: Privacy, Cost, Feasibility and Decision Gate

## Document status

- Prompt: 21A
- Review date: 2026-07-19
- Status: documentation and decision only
- Decision: **CONDITIONAL GO FOR 21B**
- Current implementation: none
- Current backup format: version 37, unchanged

This document does not create a schema, migration, route, API, map, geocoder, provider account, credential, permission request, address conversion, or location record. No Student address was submitted to a third party during this review.

## Executive decision

Nalanda can proceed to Prompt 21B only after the school approves the purpose, notices, access matrix, retention rules, and the child-data legal review described below. Prompt 21B should cover structured postal addresses and a privacy-safe correction workflow. It may design a separate, nullable location record for manually confirmed coarse locations, but it must not enable automatic geocoding, a live provider, a map, exact-house coordinates, bulk conversion, or generic coordinate export.

The recommended default is:

1. retain a structured postal address because it supports normal school administration;
2. use locality, postal code, and district for most planning;
3. use coarse locality centroids only when an approved aggregate question cannot be answered from address fields;
4. allow a rounded approximate point only as an exceptional, separately permissioned value;
5. do not collect exact residential coordinates in Prompt 21B;
6. defer maps to Prompt 21C and provider-assisted geocoding to Prompt 21D.

This is a conditional rather than unconditional go. Child home-location data creates a credible safety and surveillance risk, and the limited legal review did not find an authoritative Telangana requirement for a school to hold residential coordinates.

## Current-state findings

The current `Student` record contains one nullable, unstructured `address` field. It contains no latitude or longitude. Guardian links, enrollment history, and role permissions already exist, but there is no dedicated address-correction workflow or location permission.

Two existing implementation patterns make careless coordinate additions unsafe:

- full Student rows are currently selected in generic backup generation, so adding location fields directly to `Student` could silently place them in backups;
- Student CSV export currently serializes full selected rows, so new fields could silently become exportable.

Prompt 21B must replace implicit inclusion with explicit field allowlists. Location access must not be inherited from `VIEW_STUDENTS`, `EDIT_STUDENTS`, or `EXPORT_STUDENTS`.

## Purpose and necessity test

| Proposed purpose | Minimum data that can satisfy it | Coordinate needed? | 21A decision |
| --- | --- | --- | --- |
| Contacting or delivering school documents | Structured postal address | No | Allowed with notice and access controls |
| Checking catchment/locality distribution | Locality, district, postal code | Usually no | Prefer address-derived aggregate |
| Planning transport routes | Approved stop/locality and aggregate demand | Possibly coarse | Separate future assessment |
| Emergency response | Verified address plus authorised emergency process | Usually no continuous point | Do not create general map access |
| Door-to-door fee collection, attendance policing, or staff monitoring | Exact home point or tracking | Yes | Prohibited |
| Live bus/student tracking | Device location and movement history | Yes | Outside scope and prohibited |

The school must write one approved purpose before 21B begins. “Useful later”, broad analytics, or general management convenience is not a sufficient purpose.

### Use-case discovery matrix

| Use case | Business owner | Legitimate purpose | Minimum data / precision | Access roles | Retention need | Exact point? | Lower-risk alternative | Separate-module boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Admissions catchment understanding | Director / admissions lead | Understand broad areas currently served | Locality/district counts; Tier 1 | Leadership aggregate | Annual planning snapshot | No | Group structured locality text | Admissions CRM remains separate |
| Broad locality distribution | Director / Principal | Resource and service-area planning | Locality/postal code; Tier 1 | Leadership aggregate | Current year plus approved trend window | No | Postal-code/locality counts | Prompt 21C only if a map adds proven value |
| Future branch planning | School governing body | Long-term facilities assessment | Suppressed coarse aggregates; Tier 1/2 | Restricted leadership | Approved planning project | No household point | Locality counts plus approved external demographic data | Separate strategic planning project |
| Outreach resource allocation | Director | Allocate authorised school information activity | Locality-level counts; Tier 1 | Leadership aggregate | Campaign planning period | No | Area totals without child-level lists | Communications/outreach approval remains separate |
| Home-visit administration | Named safeguarding/operations owner | Exceptional authorised visit | Verified address; Tier 1, possibly Tier 3 after separate policy | Time-bound named staff only | Visit case plus short policy period | Usually no | Case-specific verified postal address | Separate safety, lone-worker, consent, incident, and access policy |
| Emergency contact support | Principal / safeguarding lead | Respond to a specific emergency | Verified current address and Guardian contact | Break-glass named leadership | Incident record policy | No general map | Postal address through a time-bound emergency workflow | Separate audited emergency module; no standing Teacher access |
| Transport demand planning | Transport owner | Estimate potential stops/routes | Locality or approved stop plus aggregate demand; Tier 1/2 | Transport leadership aggregate | Route-planning cycle | No home point | Approved stop/locality counts | Separate transport module and privacy assessment |
| Live bus/Student tracking | Transport owner | Movement monitoring | Device/history location; Tier 5 | Would require a new restricted system | Continuous history | Yes | Scheduled transport communications without tracking | Prohibited here; any future proposal needs a new authority and policy |
| Route grouping | Transport owner | Group families into service areas | Locality/stop; Tier 1/2 | Approved transport planners | Route year | No | Manually approved stop group | Future transport module; no exact home markers |
| Document delivery planning | Administration | Deliver official physical documents | Postal address; Tier 1 | Named Admin | Active need plus records policy | No | Existing verified postal workflow | Remains ordinary records administration, not a map |
| Jurisdiction or statutory reporting | Compliance owner | Meet a cited legal/Board obligation | Only fields explicitly required | Named compliance staff | Statutory duration | Not found | Address/locality fields named by the authority | Separate compliance workflow after authoritative citation |
| Address-quality checks | Admin / records owner | Correct incomplete Student records | Structured address and status; Tier 1 | Admin/reviewer, linked Parent | Current record plus short correction audit | No | Parent/staff verification without coordinates | Core Prompt 21B candidate |
| Scholarship/service eligibility | Authorised programme owner | Apply a legally valid area criterion | Usually locality/jurisdiction, not point | Case-specific reviewers | Programme/statutory duration | No by default | Documentary jurisdiction evidence | Separate fairness/legal review; never infer income/caste/religion |

Location must not become a proxy for caste, religion, income, disability, health, social status, attendance, behaviour, fee status, or academic performance.

## Data precision tiers

| Tier | Data | Example precision | Default use | Decision |
| --- | --- | --- | --- | --- |
| 0 | No address or coordinate | No location record | Respect unknown/not collected states | Supported |
| 1 | Structured postal address | Locality, city, district, state, postal code | Administration and aggregate grouping | Recommended default |
| 2 | Locality centroid or coarse grid | Roughly kilometre-scale; explicit centroid label | Privacy-preserving aggregate analysis | Optional after approval |
| 3 | Rounded approximate residential point | Roughly neighbourhood-scale; never represented as exact | Exceptional operational case | Disabled by default; separate permission |
| 4 | Exact house/building point | Door or parcel-scale coordinate | Identifiable home marker | No-go for 21B and 21C default |
| 5 | Device/live/history location | Movement, timestamps, route history | Tracking | Prohibited |

Decimal places are not a complete privacy control. Prompt 21B must store an explicit precision category and intended use. A Tier 2 or Tier 3 value must never be displayed or described as an exact home.

### Tier-by-tier handling

| Tier | Necessity/value | Privacy/provider risk | Display/export | Backup | Correction/deletion |
| --- | --- | --- | --- | --- | --- |
| 0 | Correct state when no justified collection or no fixed address | Lowest | Show status only; no inferred marker | Status only if operationally needed | Parent may provide/correct; no fabricated replacement |
| 1 | High value for ordinary administration | Identifiable child data; no provider needed | Full address only to dedicated roles; excluded from generic export/print | Explicit encrypted projection and approved retention | Request/review workflow; remove/generalise after approved retention |
| 2 | Useful for broad locality analysis when text grouping is insufficient | Reidentification in small cohorts; provider unnecessary | Thresholded aggregate only; no identity/raw export | Include only if purpose and backup retention are approved | Recompute/invalidate on locality change; delete before/with purpose end |
| 3 | Limited exceptional operational value | High stalking/safety risk and false-accuracy risk | Named authorised roles only; no Parent/Teacher/Viewer/raw export | Separate high-risk field projection | Dual review; invalidate on address change; shorter retention |
| 4 | No current justified value | Critical home-identification and provider exposure | No display or export under current policy | Must not exist in 21B/initial 21C backup | Not collected; later phase needs a new written decision |
| 5 | No legitimate purpose in this programme | Critical surveillance and movement-history risk | Prohibited | Prohibited | Prohibited |

## Minimum proposed Prompt 21B fields

This is a design recommendation, not a schema instruction.

### Structured address

- `addressLine1`
- `addressLine2` (optional)
- `locality`
- `cityOrTown`
- `district`
- `state`
- `postalCode` (nullable; validated when present)
- `countryCode` (default `IN`, editable only by authorised staff)
- `addressStatus`: `UNKNOWN`, `UNVERIFIED`, `PARENT_CONFIRMED`, `SCHOOL_VERIFIED`, `RETURNED_FOR_CORRECTION`
- `addressSource`: `MIGRATED_LEGACY`, `STAFF_ENTRY`, `PARENT_REQUEST`, `IMPORT`
- verification and reviewer timestamps/identifiers

Unknown must remain different from blank, refused, not applicable, and not yet verified. Do not use `0,0`, empty text, a fabricated postal code, or a school address as a missing-value substitute.

### Optional, separate coarse location record

If leadership and counsel approve coordinate storage, keep it separate from the general Student row:

- nullable latitude and longitude;
- `precisionTier`: only `LOCALITY_CENTROID` or `ROUNDED_APPROXIMATE` in 21B;
- `accuracyMetres` when actually known;
- `locationSource`: manual locality selection or manual pin confirmation only;
- `locationStatus`: `UNVERIFIED`, `CONFIRMED`, `INVALIDATED`;
- verified-by and verified-at;
- invalidation reason and timestamp.

Do not add provider name, provider response, formatted provider address, place metadata, or automatic geocode timestamps in 21B. Do not retain indefinite old coordinate versions. Audit events should record actor, action, field category, reason, and time without duplicating the full old address or coordinate.

### Data that must not be collected

- live or historical device location;
- house photos, entry instructions, Wi-Fi/Bluetooth identifiers, or route traces;
- location derived from Aadhaar or another government identifier;
- staff or student attendance surveillance coordinates;
- unreviewed provider payloads;
- precise points for siblings duplicated across multiple records;
- hidden coordinates in free text, logs, URLs, analytics, screenshots, or filenames.

## Access and permission matrix

| Role | Structured address | Coarse point | Exact point | Corrections/audit | Map |
| --- | --- | --- | --- | --- | --- |
| Super Admin | With dedicated permission | Exceptional, audited | Not in 21B | Permission/policy administration and purge when separately granted | 21C only |
| Director | With dedicated permission | Exceptional, audited | Not in 21B | Review, correction oversight, audit, and policy approval | 21C only |
| Principal | With dedicated permission | Disabled by default | No | Review if granted | Aggregates first in 21C |
| Admin | Entry/correction when granted | No default access | No | Process requests | No default map |
| Teacher | No general access | No | No | No | No |
| Accountant | No | No | No | No | No |
| Viewer | Aggregate locality counts only | No raw points | No | No | Thresholded aggregates only |
| Parent/Guardian | Linked child’s current postal address | No coordinate display | No | Submit correction request | No |
| Public/unauthenticated | No | No | No | No | No |

Proposed 21B permissions:

- `VIEW_STUDENT_ADDRESSES`
- `MANAGE_STUDENT_ADDRESSES`
- `REVIEW_STUDENT_ADDRESS_CORRECTIONS`
- `SUBMIT_OWN_CHILD_ADDRESS_CORRECTION`
- `VIEW_STUDENT_ADDRESS_AUDIT`
- `PURGE_STUDENT_LOCATION_DATA`

Proposed later permissions:

- `VIEW_STUDENT_LOCATION_AGGREGATES`
- `VIEW_STUDENT_LOCATION_MAP`
- `VIEW_APPROXIMATE_STUDENT_POINTS`
- `VIEW_EXACT_STUDENT_POINTS` (created only if a later decision allows exact points; no default role)
- `EXPORT_LOCATION_AGGREGATES`
- `REQUEST_STUDENT_GEOCODING`
- `APPROVE_GEOCODING_RESULT`
- `MANAGE_GEOCODING_PROVIDER`

No raw coordinate export permission is recommended for 21B or the initial 21C.

## Correction and verification workflow

1. An authorised staff member enters or migrates the postal address.
2. The record remains `UNVERIFIED`; migration must never imply verification.
3. A linked Parent may submit a correction request for their child only. The request does not overwrite the approved address.
4. An authorised reviewer compares the request with permitted evidence and accepts, partially accepts, or rejects it with a reason.
5. A coarse point, if enabled, remains null until a separate manual confirmation. Address edits invalidate the prior point.
6. A different authorised reviewer should approve exceptional Tier 3 points.
7. Audit stores decision metadata without placing full addresses in generic logs.
8. Parent and staff can request correction or erasure where applicable; statutory and operational retention exceptions must be recorded.

No automatic Student match, silent overwrite, bulk geocode, or provider result acceptance is allowed.

## Data lifecycle

### Collection

- identify staff entry, Parent request, approved import, or legacy migration as the source;
- show the approved notice before new collection;
- label each field required or optional; a coordinate is optional under the current recommendation;
- support `UNKNOWN` and `NO_FIXED_ADDRESS` without coercing a false value;
- migrate legacy text through preview and explicit confirmation, never silent parsing.

### Verification and use

- keep address status (`UNVERIFIED`, `PARENT_CONFIRMED`, `SCHOOL_VERIFIED`) separate from coordinate status and precision;
- provider-derived or manually pinned values are never automatically school-verified;
- use Tier 1 for administration and approved thresholded aggregates;
- use Tier 2/3 only for the recorded purpose and permission.

### Correction, departure, retention, and deletion

- a Parent request creates a review item and invalidates no approved value until accepted;
- an accepted address change invalidates the old point immediately;
- on transfer/exit, remove or generalise coordinates at the policy trigger rather than retaining them merely because the Student row remains;
- retain statutory postal records only for a cited duration;
- expire provider metadata, temporary payloads, exports, and correction evidence separately;
- carry erasure/deletion decisions into backup-expiry and post-restore reconciliation.

### Export

- coordinates are prohibited by default;
- any later exceptional export requires a named purpose, dedicated permission, reauthentication, minimal columns, masking/generalisation, formula-safe CSV, expiry instructions, and audit;
- the initial 21B/21C should provide aggregate export only, not raw points.

## Map and aggregate privacy rules for Prompt 21C

- The first map view should be locality counts or coarse cells, not individual markers.
- Suppress groups below a configurable minimum of 10 and protect against subtractive differencing.
- Do not label a cluster of one, expose names/admission numbers, or provide drill-down to a home.
- Do not return or display contact details, Parent names, admission numbers, fees, marks, attendance, medical information, or other unrelated Student attributes.
- Keep high-risk map access server-authorised, purpose-bound, and audited.
- Disable print, screenshot-style export, shareable map URLs, and coordinate query strings.
- Return only the fields required for the current view; never fetch exact points and hide them only in the browser.
- Use `Cache-Control: private, no-store`; do not place location responses in Cache Storage, IndexedDB, localStorage, service-worker caches, analytics, notifications, or AI retrieval.
- Do not expose Student locations to public pages, Parent notices, communication templates, or generic reports.

## Backup, restore, export, print, and deletion

Prompt 21B must decide data-classification behavior before adding any field:

- database backup may include the minimum current address/location data only through an explicit reviewed projection;
- backup encryption, access, off-device custody, retention, restore rehearsal, and deletion propagation must be documented;
- generic Student export must explicitly deny location fields;
- any future aggregate export must suppress small groups and spreadsheet formulas;
- exact or approximate coordinates must never enter ordinary Student CSV, receipt, ID card, certificate, timetable, report card, print view, or communication;
- restore must not broaden permissions or enable a provider;
- deletion must cover the primary record, superseded copies where legally permitted, provider jobs, temporary files, queues, caches, exports, and backup-expiry schedule;
- restored records with invalid or missing provenance must return to an unverified/disabled state.

Backup version remains 37 in Prompt 21A because no persistent data changed.

## AI, PWA, public-site, and device boundaries

- Student address and location are prohibited AI-assistant source fields.
- No location question, answer, coordinate, address, evidence, or aggregate with a small group may enter model prompts or assistant audit.
- The PWA remains static-assets-only. Location pages and APIs must be network-only and never available offline.
- Do not request browser/device location permission.
- Do not add geofencing, background sync, push, deep links containing coordinates, or offline map packs.
- Public website, sitemap, metadata, analytics, and contact forms must not expose or collect Student location data.

## Legal and regulatory review

This is an engineering review, not legal advice.

The Digital Personal Data Protection Act, 2023 establishes lawful-purpose, notice, consent or legitimate-use, security, breach, children’s-data, access, correction, erasure, grievance, and cross-border obligations. The final Digital Personal Data Protection Rules, 2025 and commencement notifications were published in November 2025, with provisions taking effect in stages. At this review date, major substantive processing duties are scheduled for later commencement; qualified Indian counsel must confirm the exact operative date and transitional duties before 21B.

Child-related exemptions in the Rules are purpose-limited. The school must not assume that an educational-institution exemption authorises home-location mapping. The limited official review found address-record concepts in education rules but no authoritative Telangana requirement to collect residential coordinates.

Required pre-21B legal decisions:

- identify the Data Fiduciary and processor roles;
- record the specific purpose and lawful basis for postal address and any coordinate;
- approve clear parent/guardian and age-appropriate notices;
- determine whether verifiable parental consent or a narrow exemption applies;
- define retention, erasure, correction, grievance, breach, and processor-contract procedures;
- assess cross-border/provider transfer and government-access risk;
- decide whether a privacy impact assessment and child-safety review are mandatory internally;
- verify Telangana school, Board, transport, and emergency requirements with an authorised adviser.

Primary references:

- [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf)
- [MeitY collection: Digital Personal Data Protection Rules, 2025, commencement notification, and corrigendum](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025)
- [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [Commencement notification G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [Department of School Education, Telangana](https://schooledu.telangana.gov.in/)
- [Central Model Rules under the Right of Children to Free and Compulsory Education Act](https://www.education.gov.in/sites/upload_files/mhrd/files/upload_document/RTI1.pdf)

## Prompt 21D geocoding privacy architecture

If a provider phase is later approved, the safe flow is:

1. Staff enters or a linked Parent confirms the address.
2. The application normalises format locally without inventing missing parts.
3. An authorised staff user explicitly requests one geocode and records a purpose/reason.
4. The server checks provider readiness, environment, budget, quota, permission, address version, and idempotency.
5. The provider receives only the minimum address text, without Student, admission, Guardian, fee, marks, attendance, or contact identifiers.
6. The server validates response schema, country/expected region, result type, precision, and candidate count.
7. The UI shows confidence limitations and multiple candidates without claiming verification.
8. No candidate is automatically accepted.
9. Staff selects, corrects, generalises, or rejects the result.
10. A coordinate is saved only after confirmation and within the allowed precision tier.
11. Provider metadata is reduced to the minimum needed for provenance/terms; response bodies are not logged.
12. Address version changes invalidate the coordinate.
13. Re-geocoding requires a new reason and cost/quota check.
14. Timeouts, one bounded retry, rate limits, and a kill switch prevent floods.
15. Audit records safe metadata, not address or coordinate.

Credentials remain environment-only and server-only; endpoints are fixed; LIVE remains disabled by default; MOCK and manual modes remain available. Prompt 21A writes no adapter.

## Security-control checklist

- dedicated address, correction, audit, map, aggregate, provider, and purge permissions;
- distinct approximate/exact point permission; exact permission has no default role;
- server allowlist projections and no generic query/GraphQL exposure;
- minimum aggregate group 10 and anti-differencing controls;
- per-user and per-operation throttling;
- no raw address/coordinate/provider body in logs or errors;
- no coordinate in URL, browser history, analytics, AI, notifications, public structured data, or communication templates;
- selected-provider CSP and key/domain/IP/API restrictions;
- sensitive map-access audit, session timeout, and reauthentication before exceptional export;
- warning that screenshots/prints create uncontrolled copies, with print/export disabled;
- copied-database or synthetic-only QA;
- encrypted backup/restore coverage with explicit projections;
- `private, no-store`, PWA network-only, and no browser cache;
- incident, provider-outage, quota, key-compromise, correction, purge, and restore rehearsals.

## Failure and data-quality workflows

| Case | Safe behavior and user message |
| --- | --- |
| Incomplete address | Save only if policy permits; mark `UNVERIFIED`/incomplete and ask for missing administrative fields; do not geocode |
| Invalid postal code | “Enter a valid six-digit Indian postal code or leave it unknown”; never pad/invent |
| Duplicate address | Warn that Students may share a household; do not merge identities automatically |
| Multiple siblings/Students at one household | Permit shared locality/address after review; keep linked-child authorization independent |
| Hostel or temporary residence | Record address type/status and expiry; do not imply permanent home |
| Parent and Student addresses differ | Preserve the approved Student-residence purpose and separate Guardian contact semantics |
| No fixed address | Use an explicit protected status; never block essential service or fabricate coordinates |
| Changed address | Create correction review; accepted change invalidates prior coordinate |
| Multiple provider candidates | Show candidates and uncertainty to authorised reviewer; no auto-selection |
| Locality-only provider result | Store only Tier 2 if approved; never promote to residential point |
| Low confidence | “No reliable location was found. Confirm manually or keep the coordinate empty.” |
| Rooftop/exact coordinate unavailable | Prefer coarse/no point; do not keep retrying or infer a door |
| Result outside expected district/state/country | Reject by default and require manual address correction/review |
| Provider outage | Preserve address; show provider unavailable; no automatic background retry |
| Quota exceeded or billing disabled | Disable requests and use manual/address-only workflow |
| API key blocked/compromised | Kill provider, rotate out of band, review usage; never show key details |
| Provider terms/pricing change | Pause LIVE and repeat legal/procurement/cost review |
| Intentionally approximate Parent entry | Respect declared approximation; do not silently “improve” it |

Safe messages must avoid returning raw provider errors, full addresses, coordinates, keys, billing identifiers, or internal endpoints.

## Phase boundaries

### Prompt 21B: conditional scope

- structured address data model and legacy-address migration preview;
- null-safe unknown/unverified semantics;
- Parent own-child correction request and staff review;
- dedicated permissions and server-side projections;
- append-only minimal audit;
- optional separate coarse location record, manual only, default null;
- explicit backup/restore and export allowlists;
- clear privacy notice, retention/deletion behavior, and transfer/exit handling;
- exact responsive Browser QA at 1366x768, 1024x768, 768x1024, 390x844, 375x667, and 320x568, including light/dark and allowed/blocked roles;
- no map, provider, geocoding, exact point, device permission, AI use, or public exposure.

### Prompt 21C: later map gate

- thresholded locality aggregates first;
- optional coarse maps only after threat-model controls pass;
- role-specific server projections, audit, privacy QA, light/dark and 390x844 QA;
- manual/verified coordinates only, clustering, minimum group 10, safe aggregate reports, and no Parent/public map;
- no exact points by default, raw coordinate export, tracking, or provider calls.

### Prompt 21D: later provider gate

- provider contract, processor terms, data residency/transfer review, retention/deletion evidence;
- written confirmation that stored outputs and intended display comply with provider terms;
- key restrictions, budgets, quotas, kill switch, staging isolation, retry/idempotency, and human approval;
- provider-neutral adapter, MOCK default, LIVE disabled, environment-only key, explicit one-address requests, provider health, confidence/manual confirmation, and privacy-safe audit;
- current official provider/pricing re-review and no public Nominatim production integration;
- MOCK-only QA before supervised live pilot;
- no production batch until accuracy, privacy, cost, incident, and deletion rehearsals pass.

## Traceable Prompt 21A requirements checklist

| Requirement | Evidence |
| --- | --- |
| Use-case matrix | “Use-case discovery matrix” |
| Precision tiers | “Data precision tiers” and tier handling |
| Current legal review | “Legal and regulatory review” with official sources/date |
| Child-location threat model | `STUDENT_LOCATION_THREAT_MODEL_AND_DATA_POLICY.md` |
| Field minimisation | “Minimum proposed Prompt 21B fields” |
| Access matrix | “Access and permission matrix” |
| Map privacy | “Map and aggregate privacy rules for Prompt 21C” |
| Provider comparison | `MAPPING_PROVIDER_COMPARISON_AND_COST_MODEL.md` |
| Official pricing and scenarios | Provider document, reviewed 2026-07-19 |
| Geocoding lifecycle | “Prompt 21D geocoding privacy architecture” |
| Retention/deletion/export | “Data lifecycle” and threat-model policy |
| Security controls | “Security-control checklist” |
| Failure cases | “Failure and data-quality workflows” |
| 21B/21C/21D boundaries | “Phase boundaries” |
| Final recommendation | “Final recommendation” |
| No implementation/data change | Document status and focused tests |

## Unresolved questions

- Which one or two purposes will leadership actually approve?
- Is postal address mandatory for every Student, and how will no-fixed-address cases be supported without exclusion?
- What exact retention periods apply during enrollment, after transfer/exit, to correction requests, and to audit?
- Does qualified Indian counsel determine that coordinate collection is lawful and necessary for the approved purpose, and what children’s notice/consent or exemption applies?
- Are Telangana/Board/transport rules applicable to this school, and where is the authoritative citation?
- Should 21B omit coordinate fields entirely until a 21C need is approved?
- Who owns break-glass emergency access, incident response, grievance resolution, purge approval, and annual access review?
- What aggregate threshold above 10 is appropriate for Nalanda’s small cohorts?
- Can a future provider contractually accept child residential address data, and what are its storage, display, deletion, transfer, subprocessor, training, and breach terms?
- What measured accuracy does a Hyderabad/Telangana pilot achieve, including apartment and locality ambiguity?

## Leadership decision checklist

- [ ] Approve a named purpose and business owner.
- [ ] Approve Tier 1 as the default and decide whether Tier 2/3 is necessary.
- [ ] Confirm Tier 4 exact points and Tier 5 tracking remain prohibited.
- [ ] Obtain qualified Indian privacy/legal review and authoritative Telangana/Board advice.
- [ ] Approve guardian/child notice, optionality, correction, grievance, and no-fixed-address handling.
- [ ] Approve the role/permission matrix and emergency/break-glass owner.
- [ ] Approve retention, transfer/exit generalisation, deletion, backup-expiry, and restore reconciliation.
- [ ] Approve generic export/print denial and aggregate threshold.
- [ ] Confirm 21B has no live provider/map and uses synthetic QA only.
- [ ] Name security, data, incident, QA, and operational owners.
- [ ] Record go/no-go in the project register before implementation begins.

## Release gate and stop conditions

Prompt 21B must not start until all of these are recorded:

- leadership-approved purpose and precision tier;
- qualified legal/privacy review;
- approved child/guardian notice and correction route;
- named data owner, security owner, and incident owner;
- retention and deletion schedule;
- role/permission matrix;
- explicit backup and export projections;
- confirmation that Prompt 21B remains provider-free and exact-point-free.

Stop the phase if a stakeholder requires live tracking, exact-house mapping by default, generic export, Teacher-wide home access, public Nominatim, silent geocoding, or provider use without reviewed terms and a kill switch.

## Final recommendation

**CONDITIONAL GO FOR 21B.** Build structured postal address and correction controls only after the release-gate approvals. Keep coordinates separate, nullable, coarse, manual, and disabled by default. Do not enable a map or live geocoding provider. If the legal review or leadership cannot justify a coordinate purpose, use the **NO PROVIDER / MANUAL ADDRESS ONLY** path and omit coordinates entirely.

## Prompt 21B preflight approval record

Prompt 21A and Prompt 21A-QA are fully cleared. The 2026-07-19 Prompt 21B preflight created the reviewable approval package but found no leadership approval evidence and no qualified Indian privacy/legal review evidence. The approval record therefore remains `PENDING`, all mandatory release blockers remain `UNRESOLVED`, and its final gate is `PROMPT_21B_BLOCKED`.

The recommended lowest-risk implementation boundary is now more conservative: Tier 1 structured postal address, linked-Parent correction requests, authorised school verification, restricted audit history, and optionally suppressed Tier 2 locality counts derived from text. The proposed coordinate decision is `OMIT_ALL_COORDINATES_FROM_21B`. It is not yet formally approved. Any future Tier 3 coordinate requires a separate approval and implementation phase; Tier 4 and Tier 5 remain prohibited.

No schema, migration, structured address field, coordinate, route, API, correction form, map, geocoder, provider, credential, operational record, or Browser location permission was added. Backup remains version 37. See `STUDENT_ADDRESS_21B_APPROVAL_RECORD.md` and its three linked drafts before any further decision.
