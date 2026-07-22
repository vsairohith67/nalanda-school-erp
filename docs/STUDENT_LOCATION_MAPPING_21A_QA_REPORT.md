# Prompt 21A-QA: Student Location Mapping Planning QA Report

## Status

- QA date: 2026-07-19
- Scope: documentation, privacy, policy, provider, cost, and feasibility QA only
- Prompt 21A entry gate: passed before QA began
- Planning decision: **CONDITIONAL GO**
- Prompt 21A status: **fully cleared**
- Prompt 21B status: **not safe to begin until the listed leadership and legal/privacy blockers are resolved**

No location was collected. No Student address was inspected or processed. No map/geocoder/provider adapter was implemented. No external map, tile, or geocoding request was made. No credential was requested, entered, generated, or stored.

## Pre-flight evidence

| Check | Result |
| --- | --- |
| Page routes | 274 |
| API routes | 375 |
| Prisma schema SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Migration files | 41; no location migration |
| Operational database SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |
| Backup format | version 37 |
| Students | 8 |
| Active enrollments | 8 |
| Active, non-cancelled Payments | 19 |
| Collected | INR 99,100 |
| Lifecycle dry run | 8 scanned, 8 already enrolled, 0 missing, 0 created, no data changed |
| Typecheck | passed |

## Defects found and fixed

| ID | Documentation defect | Fix |
| --- | --- | --- |
| QA-01 | Lower-risk alternatives and separate-module boundaries were present in prose/decision text but not independently traceable for every use case | Added explicit columns and values for every use case |
| QA-02 | The threat model relied on the package review date instead of stating its own official-source review date and legal disclaimer | Added a document-status section dated 2026-07-19 |
| QA-03 | Super Admin and Director were combined in one access row | Split the roles and stated their distinct correction, audit, policy, and purge responsibilities |
| QA-04 | Annual admissions and address corrections were combined in one maintenance-cost total | Added separate formulas and scenario columns |
| QA-05 | Development/staging usage was an assumption but not a separately calculated capacity | Added geocoding and map-load development/staging formulas and scenario values |
| QA-06 | Prompt 21C’s prohibited marker/payload attributes did not list every required category in one explicit rule | Added contacts, Parent names, admission numbers, fees, marks, attendance, medical, and unrelated attributes |
| QA-07 | One threat row named a recovery owner without an implementation phase | Added the restore phase |
| QA-08 | The current public Nominatim policy now explicitly addresses generic no-code/low-code/LLM integration | Added the updated official policy consideration without changing the existing prohibition |

These were planning-document clarity defects. No runtime defect or data repair was required.

## No-implementation QA

Independent source scans found:

- no latitude, longitude, location-point, or geocoder field in the Student model;
- only the existing nullable legacy `address` field;
- no location migration, address-location API, Student map route, or geocoding API;
- no Mapbox, Leaflet, MapLibre, Google Maps, or geocoding dependency;
- no provider environment-variable/key name or credential pattern;
- no `navigator.geolocation`, browser permission query, or location-permission request;
- no map, tile, geocoding, or provider request path;
- no new coordinate column in the operational schema;
- no operational mutation and no backup-version increase.

Prompt 21A and 21A-QA remain documentation/tests only.

## Use-case and precision QA

Every proposed use now records a business owner, legitimate purpose, minimum data/precision, access roles, retention, exact-point necessity, lower-risk alternative, and separate-module boundary. Vague future convenience is explicitly rejected.

Tiers 0 through 4 are fully evaluated; Tier 5 remains an explicit prohibited tracking category:

- Tier 0 supports unknown/no-fixed-address states.
- Tier 1 postal address is the recommended default.
- Tier 2 locality centroid is optional for approved aggregates.
- Tier 3 rounded approximate point is exceptional and disabled by default.
- Tier 4 exact residence is not approved for 21B or initial 21C.
- Tier 5 device/live/history tracking is prohibited.

Display, export, backup, correction, and deletion behavior differs by tier. Parent coordinate visibility is not assumed, rounding is not treated as sufficient by itself, and missing/unknown/unverified states remain distinct.

## Legal and privacy QA

The package cites official MeitY sources for the DPDP Act, 2023, final DPDP Rules, 2025, commencement notification, and corrigendum collection. It is dated 2026-07-19 and covers purpose, notice, minimisation, children’s data, accuracy, correction/erasure, safeguards, breach response, processors, transfers, and provider contracts.

Browser re-verification confirmed the official MeitY collection and final Rules PDF remained available. The package correctly states that commencement is staged, education-related exemptions are purpose-limited, no authoritative Telangana coordinate mandate was found in this limited review, and qualified Indian counsel must confirm the applicable basis, notices, exemptions, duties, and dates. It provides no definitive legal opinion.

## Threat-model QA

All 35 threats include likelihood, impact, control, residual risk, owner, and phase. Coverage includes stalking, harassment, kidnapping/physical harm, burglary targeting, insider/overprivileged access, account compromise, Parent cross-child access, screenshots, CSV/export, logs/errors, backups/restore, provider disclosure, key abuse, cluster reidentification/differencing, API enumeration, stolen/shared devices, PWA/browser storage, AI leakage, public indexing, stale points, deletion gaps, and profiling.

The highest residual risks remain authorised-user screenshots, compromised leadership accounts, provider/transfer exposure, small-cohort inference, backup retention, and harmful secondary use. These require operational controls in addition to code.

## Access and map-privacy QA

Super Admin, Director, Principal, Admin, Teacher, Viewer, Accountant, Parent/Guardian, and public users now have explicit rows. Teacher and Accountant receive no residential location access by default. Viewer receives thresholded aggregates only. Parent sees the linked child’s approved postal address and submits a correction request; no coordinate is displayed. Exact-point access would require a separate permission with no default role, and raw-coordinate export is prohibited.

Prompt 21C is limited to authenticated server-scoped aggregates/manual verified coordinates, clustering, minimum group 10, anti-differencing, generalisation, purpose/audit controls, and role-aware projections. It prohibits Parent/public maps, low-zoom identity, contacts, Parent names, admission numbers, fees, marks, attendance, medical data, raw export, print/share URLs, PWA/localStorage/IndexedDB/Cache Storage, AI, communications, and public-site use.

## Provider QA

Official documentation was re-reviewed through Browser on 2026-07-19 without submitting an address:

- Google India pricing still showed 70,000 monthly free-usage events for Dynamic Maps and Geocoding, then current USD tiers; the page showed “Last updated 2026-07-15 UTC”.
- Google’s Geocoding policy still linked use to the customer agreement, identified place IDs as a caching exception, and required Google Maps attribution.
- Mapbox documentation still distinguished temporary results, which cannot be cached, from permanent results, which may be stored indefinitely and require a card or enterprise contract.
- Mapbox pricing still distinguished GL JS map loads, temporary geocoding, and permanent geocoding.
- Public Nominatim still required an identifying client, attribution/ODbL, an absolute maximum of one request per second, strong bulk limits, no autocomplete/systematic queries, and no personal/confidential submissions; policy/availability may change.
- Nominatim 5.3.2 installation guidance still described PostgreSQL/PostGIS/updates and substantial full-planet hardware/storage/import requirements.

The comparison does not describe any option as permanently free, does not recommend public Nominatim, contains no credential, proposes no scraping, and leaves provider selection for a later reviewed Prompt 21D.

## Cost-model QA

The model now separately calculates:

- initial geocoding plus retry;
- annual new admissions;
- annual address corrections;
- monthly production map loads;
- development/staging capacity;
- manual verification;
- self-hosted infrastructure/operations variables;
- quota/alert controls;
- worst-case misuse.

The 800, 1,000, and 2,000 Student scenarios show formulas, assumptions, request counts, current free allowances, USD provider rates, INR staff time, review date, exclusions, and estimate warnings. Free allowances are explicitly not guaranteed free operation.

## Lifecycle and phase-boundary QA

Collection, notice, source, verification, use, Parent correction request, reviewer decision, address-version binding, coordinate invalidation, retention, transfer/exit generalisation, deletion, provider-metadata expiry, export prohibition, backup expiry, and restore reconciliation are covered.

- Prompt 21B: structured address/correction foundation and optional manual coarse point only; no map or provider.
- Prompt 21C: restricted aggregate/coarse map using verified stored values only; no provider geocoding.
- Prompt 21D: provider-neutral adapter, MOCK default, LIVE disabled, environment-only restricted key, one-address server request, quota/cost/health controls, and manual acceptance.

No boundary overlap was found after QA.

## Decision and release blockers

The evidence supports only structured postal address collection plus, if necessity is approved, optional manually verified coarse coordinates. It does not support exact-home mapping or live/provider geocoding now.

**Decision: CONDITIONAL GO.**

Prompt 21B must not begin until leadership and qualified Indian privacy/legal review record:

- one or more specific purposes and business owners;
- permitted precision and whether coordinate fields should be omitted entirely;
- lawful basis, child/guardian notice, and correction/grievance handling;
- exact retention periods and transfer/exit/deletion behavior;
- dedicated permissions, aggregate threshold, emergency access, and incident owners;
- explicit backup/restore/export projections;
- confirmation that 21B is provider-free, map-free, exact-point-free, and synthetic-QA-only.

## Final verification

| Command/evidence | Final result |
| --- | --- |
| `pnpm.cmd routes:list` | passed; 274 page routes and 375 APIs, unchanged |
| `pnpm.cmd lifecycle:backfill` | passed; 8 scanned, 8 enrolled, 0 created, no data changed |
| `pnpm.cmd typecheck` | passed |
| `pnpm.cmd test` | 1,313 tests across 143 files passed |
| `pnpm.cmd build` | passed with the established 4 GB bounded Node heap; 406/406 static-generation entries |
| `pnpm.cmd backup` | passed; `nalanda-fee-control-backup-2026-07-19-19-43.json` |
| Final backup version | 37 |
| Final schema SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`, unchanged |
| Final migration files | 41, unchanged |
| Final operational DB SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`, unchanged |
| Final business baseline | 8 Students, 8 active enrollments, 19 Payments, INR 99,100 collected |

Regression coverage for authentication, Parent portal, Student workflows, PWA, AI Assistant, OCR, Cloud Backup, public website, communications, backup/restore, and all existing modules passed through the full suite and production build.

Prompt 21A and Prompt 21A-QA are fully cleared. Prompt 21B is **not yet safe to begin** because its leadership and qualified legal/privacy release blockers remain deliberately unresolved.

## Prompt 21B preflight addendum

The subsequent 2026-07-19 governance preflight did not alter the cleared Prompt 21A-QA result. It created:

- `STUDENT_ADDRESS_21B_APPROVAL_RECORD.md`;
- `STUDENT_ADDRESS_PRIVACY_NOTICE_DRAFT.md`;
- `STUDENT_ADDRESS_RETENTION_AND_DELETION_POLICY_DRAFT.md`; and
- `STUDENT_ADDRESS_ACCESS_AND_INCIDENT_MATRIX.md`.

Actual evidence found: no leadership approving person/date/reference and no qualified Indian privacy/legal reviewer/written reference. Therefore the approval status is `PENDING`, all 15 mandatory blockers are `UNRESOLVED`, the coordinate proposal is `OMIT_ALL_COORDINATES_FROM_21B`, and the final decision is `PROMPT_21B_BLOCKED`.

Tier 1-only is the recommended low-risk boundary. No coordinate is approved by default. No schema or runtime implementation was performed, and no Prompt 21C or 21D work began.
