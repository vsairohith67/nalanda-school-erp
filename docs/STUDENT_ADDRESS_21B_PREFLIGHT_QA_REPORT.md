# Prompt 21B-Preflight-QA: Student Address Approval-Gate Verification

## Status

- QA date: 2026-07-19
- Scope: approval-record and documentation QA only
- Prompt 21B runtime implementation: not authorised and not performed
- Evidence-authenticity result: approval evidence remains visibly absent
- Approval-gate integrity result: passed; missing evidence is not represented as approval
- Release decision: `PROMPT_21B_REMAINS_BLOCKED`

This report verifies the engineering approval gate. It does not independently provide legal advice, declare legal sufficiency, authenticate a person who was not supplied, or convert a draft recommendation into school approval.

## Pre-flight evidence

| Check | Result |
| --- | --- |
| Page routes | 274 |
| API routes | 375 |
| Prisma schema SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Migration files | 41 |
| Backup format | version 37 |
| Operational database SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |
| Students | 8 |
| Active enrollments | 8 |
| Active, non-cancelled Payments | 19 |
| Collected | INR 99,100 |
| Lifecycle dry run | 8 scanned, 8 already enrolled, 0 missing, 0 created, no data changed |
| Typecheck | passed |

No Student address value was read to produce these counts.

## Documents reviewed

- `STUDENT_ADDRESS_21B_APPROVAL_RECORD.md`
- `STUDENT_ADDRESS_PRIVACY_NOTICE_DRAFT.md`
- `STUDENT_ADDRESS_RETENTION_AND_DELETION_POLICY_DRAFT.md`
- `STUDENT_ADDRESS_ACCESS_AND_INCIDENT_MATRIX.md`

All mandatory headings, enum values, role rows, lifecycle categories, incident responsibilities, surface exclusions, blocker statuses, and final-gate fields are present.

## Defects found and fixed

| ID | Documentation traceability defect | Fix |
| --- | --- | --- |
| P21B-QA-01 | House/residence photographs were outside the proposed fields but were not independently listed as omitted in the field-minimisation decision | Added `housePhotograph: OMITTED`, excluded doorway images/access codes, and aligned the notice |
| P21B-QA-02 | Coordinate omission implied that no coordinate permission existed, but the access matrix did not state the no-permission/default-role result directly | Added `Exact-coordinate permission: NONE` and denied coordinate permission to every page, API, role, export, emergency path, and audit role |
| P21B-QA-03 | Ordinary logs and public structured data were excluded across the policy set but not independently traceable in the backup/restore projection | Added explicit exclusions for ordinary/access/error/analytics/telemetry logs and public structured data/metadata/sitemap/search markup |

These fixes make the proposed restrictions easier to audit. They do not approve the proposal, resolve a blocker, or change runtime behavior.

## Evidence-authenticity QA

Result: **AUTHENTICALLY PENDING**.

- No leadership approving person, school role, approval date, approved scope, approved precision, approved access/retention/incident decision, or meeting/signature reference was supplied.
- No qualified Indian privacy/legal reviewer name, role, organisation/professional capacity, review date, written reference, lawful-basis assessment, child/guardian notice assessment, optionality assessment, retention/deletion assessment, processor assessment, or breach-responsibility assessment was supplied.
- The records explicitly say `Not supplied`, `PENDING`, `AWAITING_APPROVAL`, and `NOT LEGALLY APPROVED`.
- Candidate purposes and proposed roles are labelled as decision inputs, not signatures or approvals.
- The software team does not imply an external reviewer and does not fabricate legal advice.

The QA can confirm consistency and non-fabrication from the available records. It cannot independently declare legal sufficiency.

## Purpose and minimisation QA

Result: **STRUCTURALLY COMPLETE; APPROVAL PENDING**.

The three candidate purposes are specific: authorised physical correspondence, address-quality/correction, and suppressed locality planning. Each includes a proposed owner role, necessity, minimum fields, optionality, access, lower-risk alternative, retention proposal, and prohibited secondary uses.

addressLine2, landmark, district, verifiedAt, and verifiedBy remain optional. Coordinates, house photographs, device-location history, and live location are omitted. Home visits, fee-collection visits, attendance policing, marketing, profiling, ranking, targeting, surveillance, AI, and unrelated communications are not approved purposes.

## Precision QA

Result: **EXPLICIT AND CONSERVATIVE; APPROVAL PENDING**.

- Tier 1 structured postal address is the recommended maximum individual precision.
- Tier 2 is limited to suppressed locality aggregates derived from text, with proposed minimum group 10.
- Coordinate decision: `OMIT_ALL_COORDINATES_FROM_21B`.
- Tier 3 is deferred to a separate approval and implementation phase.
- Tier 4 exact residence is prohibited.
- Tier 5 live/device location is prohibited.
- No coordinate permission exists for any role or exceptional path.

## Notice QA

Result: **COMPLETE DRAFT; NOT APPROVED**.

The notice explains the unapproved candidate purpose, minimum fields, optional/required decision state, proposed roles, linked-Parent correction process, draft retention, no tracking, no public/Parent map, no third-party geocoding, complaint-route requirement, version, effective-date state, and legal/leadership approval requirement.

The approved version, effective date, notice owner, and complaint/contact route remain `AWAITING_APPROVAL`. The notice cannot be issued.

## Access QA

Result: **COMPLETE PROPOSAL; NOT APPROVED**.

- Super Admin: exceptional governance/administration only.
- Director: proposed authorised administration/audit.
- Principal: purpose-limited view/decision if appointed.
- Admin: entry/correction processing without default self-approval.
- Teacher: no home-address access by default.
- Viewer/Auditor: suppressed aggregates only.
- Accountant: no access.
- Parent: linked-child current-address view and correction request only.
- Public: no access.

Exports are separately controlled. No routine full-address export is proposed. No exact or approximate coordinate permission exists.

## Retention and deletion QA

Result: **EXPLICIT DRAFT; NOT APPROVED**.

Active, transferred, withdrawn/left, and graduated Students are treated explicitly. Draft periods cover current and superseded addresses, correction payloads/evidence, audit history, generalised locality, temporary files, aggregate exports, backup expiry/reconciliation, and exceptional holds. Deletion verification covers operational, temporary, export, public, PWA, AI, communication, log, provider, backup, and secondary-role review.

The records reject indefinite retention and “retain as needed.” Exact backup expiry and all draft periods still require leadership and qualified privacy/legal approval.

## Incident-ownership QA

Result: **RESPONSIBILITIES COMPLETE; ACCOUNTABLE PERSONS MISSING**.

Operations, privacy, security, incident coordination, Parent communication, legal/regulatory escalation, evidence preservation, access suspension, and post-incident review each have a proposed organisational role. Every accountable person remains `Not supplied` and `PENDING`. This independently keeps Prompt 21B blocked.

## Backup, PWA, AI, logs, and public-site QA

Result: **PROJECTION COMPLETE; APPROVAL PENDING**.

The proposed design:

- uses explicit permission-safe JSON backup allowlists;
- includes only minimised correction/audit metadata;
- keeps encrypted cloud-backup coverage inside the existing protected boundary;
- limits restore to Super Admin execution under Director instruction;
- reconciles deletion/generalisation and prevents stale overwrite;
- excludes PWA/offline cache;
- excludes the public website and public structured data/metadata/sitemap/search markup;
- excludes AI Assistant tools;
- excludes communication templates;
- excludes ordinary/access/error/analytics/telemetry logs; and
- introduces no provider state.

## Blocker-consistency QA

All 15 mandatory blockers use an allowed enum and remain `UNRESOLVED`:

1. approved purpose;
2. approved precision tier;
3. qualified legal/privacy review;
4. approved Parent notice;
5. mandatory/optional decision;
6. field-minimisation decision;
7. role matrix;
8. aggregate threshold;
9. export policy;
10. retention and deletion;
11. exit/transfer treatment;
12. incident ownership;
13. backup/restore projection;
14. coordinate omission or separate approval; and
15. leadership signature/reference.

The approval record’s internal final gate is `PROMPT_21B_BLOCKED`. It does not claim `SAFE_TO_BEGIN_PROMPT_21B`. The QA release decision is therefore mechanically required to be `PROMPT_21B_REMAINS_BLOCKED`.

## No-implementation QA

- Schema hash remains unchanged.
- Migration count remains unchanged.
- Routes and APIs remain unchanged.
- Backup version remains 37.
- Operational database hash and business counts remain unchanged.
- No structured Student-address/location table, model, correction record, route, API, page, or export was created.
- No coordinate field, location record, map/geocoder dependency, provider request, credential storage, or Browser location permission exists.
- Source scans found no `navigator.geolocation`, permission query, map/geocoder/provider dependency, or provider request path.
- Browser QA observed 14 resources, all from `http://localhost:3000`; it found zero address/location navigation links, zero location form controls, zero map containers, and zero mapping/geocoding/provider resource matches. No location-permission prompt appeared.
- The pre-existing nullable legacy `Student.address` was not read or changed.

## Release decision

`PROMPT_21B_REMAINS_BLOCKED`

Prompt 21B implementation is not safe to begin. Prompt 21C and Prompt 21D remain outside scope and blocked. The gate may be re-evaluated only after the school supplies real leadership evidence, a real qualified Indian privacy/legal written review, named accountable incident owners, approved notice/contact route, and recorded resolution of every mandatory blocker.
