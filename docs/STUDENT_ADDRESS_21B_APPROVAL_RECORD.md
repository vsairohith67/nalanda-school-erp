# Student Address Prompt 21B Approval Record

## Record status

- Record date: 2026-07-19
- Record purpose: leadership, legal, privacy, safety, retention, access, and release governance only
- Prompt 21A status: fully cleared
- Schema or runtime implementation: none
- Real Student address data reviewed or reproduced in this record: none
- This record does not constitute leadership approval or legal advice.

# Decision Status

Decision status: PENDING

No approving person, leadership reference, qualified Indian privacy/legal reviewer, written legal reference, or approved Parent notice was supplied or found. Creating this record does not resolve those omissions.

# Scope Proposed for Prompt 21B

The following is the lowest-risk scope presented for formal decision. Every item remains `PENDING`; none is approved merely because it appears here.

| Capability | Approval state | Proposed boundary |
| --- | --- | --- |
| Structured postal address | PENDING | Tier 1 structured text only |
| Parent correction requests | PENDING | Linked child, request-only, no immediate overwrite |
| School verification | PENDING | Authorised office review and separate approval |
| Address audit history | PENDING | Restricted, minimised, time-limited history |
| Restricted aggregate locality reporting | PENDING | Tier 2 text-derived counts with minimum group 10 and suppression |
| Optional coordinates | PENDING | Not permitted in Prompt 21B |

Coordinate decision: OMIT_ALL_COORDINATES_FROM_21B

This exact coordinate decision is the conservative proposed 21B boundary. Formal leadership and qualified privacy/legal approval are still missing, so the corresponding release blocker is not resolved.

# Approved Purpose

Approved purpose status: PENDING

There is no approved purpose. The following candidates are decision inputs, not approvals.

| Purpose name | Business owner | Why the school may need it | Minimum necessary fields | Required or optional | Roles needing access | Lower-risk alternative considered | Proposed retention requirement | Prohibited secondary uses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Student-record correspondence | Proposed owner role: Director or records owner; named owner not supplied | Deliver authorised physical school records when electronic delivery is unsuitable | addressLine1, locality, city, state, postalCode, country; addressLine2/landmark only if voluntarily needed | Collection decision PENDING; optional subfields remain optional | Director and authorised Admin; Parent sees linked child | Parent-confirmed contact channel or collection at school | Draft: active enrollment plus 90 days, then remove full address unless an approved hold applies | Fee collection visits, marketing, profiling, staff convenience, AI, public display |
| Address-quality and correction | Proposed owner role: Director or records owner; named owner not supplied | Keep a current school record and allow a linked Parent to correct it | Structured address, source, verification state, correction state, minimal audit metadata | Collection decision PENDING | Director, Principal where approved, authorised Admin, linked Parent | Parent/staff confirmation without coordinates or copied evidence | Draft: current record lifecycle; correction payload 90 days after closure; restricted audit two years | Surveillance, unrelated communications, ranking, eligibility inference |
| Suppressed locality planning | Proposed owner role: Director; named owner not supplied | Understand broad service areas without household-level reporting | locality or postalCode and aggregate count only | Optional analytical use | Director; Viewer/Auditor only suppressed output | Current-year locality counts without a map | Draft: annual aggregate snapshot for two school years; no raw address retained in the report | Individual targeting, sensitive-outcome joins, small-cohort inference, publication |

Before approval, leadership must select a specific purpose, supply the accountable business owner, and record why the selected fields are necessary. Broad analytics, future usefulness, convenience, home visits, fee collection, attendance policing, or live tracking are not approved purposes.

# Leadership Approval

- Decision status: PENDING
- Approving person: Not supplied
- School role: Not supplied
- Approval date: Not supplied
- Approved scope: Not supplied
- Approved precision tier: Not supplied
- Approved access matrix: Not supplied
- Approved retention policy: Not supplied
- Approved incident owner: Not supplied
- Approval reference or meeting note: Not supplied
- Conditions or limitations: Not supplied

These entries intentionally show missing evidence. They are not blanks to be interpreted as complete.

# Qualified Indian Privacy/Legal Review

- Review status: PENDING
- Reviewer name: Not supplied
- Reviewer role: Not supplied
- Organisation or professional capacity: Not supplied
- Review date: Not supplied
- Written reference: Not supplied
- Lawful-basis assessment: Not supplied
- Child/guardian notice assessment: Not supplied
- Mandatory-versus-optional field assessment: Not supplied
- Retention and deletion assessment: Not supplied
- Processor/provider assessment: Not supplied; Prompt 21B is proposed as provider-free
- Incident and breach responsibility assessment: Not supplied
- Unresolved legal questions: lawful basis; operative DPDP duties and dates; children-related duties or exemptions; notice/consent route; optionality; grievance handling; retention; deletion; transfer/exit handling; incident notification; Telangana/Board requirements
- Non-fabrication statement: The software team has not fabricated and must not fabricate qualified Indian privacy/legal review. This engineering record is not legal advice.

Qualified review has not occurred on the evidence available. Status remains `PENDING`, and Prompt 21B remains blocked.

# Precision Decision

Precision decision status: PENDING

| Tier | Meaning | Prompt 21B decision |
| --- | --- | --- |
| Tier 0 | No address | Must remain a supported state for unknown or no-fixed-address cases |
| Tier 1 | Structured postal address | Recommended maximum individual-level precision; approval still pending |
| Tier 2 | Locality-level aggregate | May be considered only as suppressed counts derived from locality text; approval still pending |
| Tier 3 | Rounded approximate point | Requires a separate approval and later implementation phase; not permitted in 21B |
| Tier 4 | Exact residential coordinate | PROHIBITED |
| Tier 5 | Live/device location | PROHIBITED |

Prompt 21B is eligible for approval only at Tier 1 and, optionally, text-derived aggregate Tier 2 reporting. Tier 3 requires a separate approval. Tier 4 and Tier 5 remain prohibited.

# Field-Minimisation Decision

Field-minimisation approval status: PENDING

The table is the proposed minimum. `REQUIRED` means required only when a structured address is voluntarily or lawfully collected under an approved policy; it does not make address collection mandatory for every Student.

| Proposed field | Proposed decision | Minimisation rule |
| --- | --- | --- |
| addressLine1 | REQUIRED | Minimum delivery line when an address is supplied |
| addressLine2 | OPTIONAL | Omit when not needed |
| locality | REQUIRED | Minimum locality text for postal quality and approved aggregation |
| landmark | OPTIONAL | Discourage sensitive or access-detail content |
| city | REQUIRED | Postal city/town |
| district | OPTIONAL | Collect only where operationally necessary |
| state | REQUIRED | State/union territory |
| postalCode | REQUIRED | Postal routing field; validate as text |
| country | REQUIRED | Explicit country; do not infer silently during import |
| addressSource | REQUIRED | Parent, authorised office, migration, or other approved source code |
| verificationStatus | REQUIRED | Distinguish unknown, unverified, pending, verified, and rejected |
| verifiedAt | OPTIONAL | Present only after an authorised verification |
| verifiedBy | OPTIONAL | Restricted actor reference only after verification; never public/exported |
| ParentCorrectionStatus | REQUIRED | Required only for a correction request; not a property of every address |
| latitude | OMITTED | All coordinates omitted from Prompt 21B |
| longitude | OMITTED | All coordinates omitted from Prompt 21B |
| coordinatePrecision | OMITTED | All coordinates omitted from Prompt 21B |
| coordinateSource | OMITTED | All coordinates omitted from Prompt 21B |
| housePhotograph | OMITTED | No residence photograph, doorway image, access code, or image-derived location |
| deviceLocationHistory | OMITTED | No device position, route, movement, or historical location |
| liveLocation | OMITTED | No live tracking or Browser/device location request |

# Mandatory or Optional Collection

- Mandatory-versus-optional decision: PENDING
- Address collection is not assumed to be mandatory.
- Permitted reason for `unknown`: the school or Parent does not yet have a reliable current postal address, or a legacy record has not been verified.
- Permitted reason for `no fixed address`: the child/family has no stable postal residence; this state must not expose explanatory personal details.
- Parent decline: a Parent must be able to omit optional fields. Whether the entire address may be declined requires qualified review and leadership decision.
- Existing Students: no bulk conversion, compulsory completion, or automatic verification is authorised. The existing legacy nullable address remains untouched during this preflight.
- Workflow blocking: incomplete or absent address must not block admission, attendance, fee payment, learning, reporting, certificates, Parent access, or another school workflow unless a separately approved lawful rule identifies the exact workflow and alternative accommodation.

# Parent and Child Notice

Parent-notice status: PENDING

- Notice owner: Proposed organisational role is the school privacy/records owner; accountable person not supplied
- Approved notice version: Not supplied
- Purpose: Not approved; candidate purposes appear above
- Fields collected: Not approved; proposed minimum appears in the field-minimisation table
- Roles accessing them: Not approved; proposed access matrix appears below
- Correction process: linked Parent request, office review, authorised decision, status returned to Parent
- Retention: Not approved; draft periods require leadership and qualified review
- Complaint/contact route: Not supplied
- Consequences of not providing optional information: no penalty or unrelated workflow block is proposed
- No live tracking occurs.
- No public map occurs.
- No third-party geocoding occurs in Prompt 21B.

The separate privacy-notice draft is not effective or legally approved.

# Access Matrix

Access-matrix approval status: PENDING

Every permission must be server-enforced and separately tested. Ordinary Student-view/edit/export rights must not imply address access.

| Role | View full address | Edit address | Verify address | Approve correction | View aggregate locality reports | Export | View audit | Delete/generalise data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin | Exceptional governance access only | Exceptional administration only | No default operational verification | No default; only if explicitly appointed | Suppressed aggregate | No routine full export; suppressed aggregate only if approved | Governance/audit access | Execute only under separately approved deletion instruction |
| Director | Proposed full authorised administration | Proposed direct office correction with reason | Yes, if appointed | Yes, if appointed | Suppressed aggregate | No routine full export; suppressed aggregate only if approved | Yes | Approve deletion/generalisation; execution separation preferred |
| Principal | Proposed view for approved purpose | No default direct edit | Yes, if appointed | Yes, if appointed | Suppressed aggregate | No | Limited decision audit | No |
| Admin | Proposed entry and correction processing | Prepare/update pending values; no self-approval | Verify evidence only if separately appointed | No default | No child-level report; aggregate only if explicitly granted | No | Own workflow events only | No |
| Teacher | No | No | No | No | No by default | No | No | No |
| Viewer/Auditor | No | No | No | No | Suppressed aggregates only | Suppressed aggregate CSV only if approved | Governance-safe audit metadata only if appointed | No |
| Accountant | No | No | No | No | No | No | No | No |
| Parent | Linked child current approved postal address only | No direct edit; correction request only | No | No | No | No | Own request status only, not staff audit | No |
| public user | No | No | No | No | No | No | No | No |

# Aggregate Privacy Threshold

- Aggregate-threshold approval status: PENDING
- Proposed exact minimum group size: 10
- Suppression behavior: any count below 10 is replaced by `SUPPRESSED`; totals and complementary cells must also be suppressed when subtraction could reveal a small group
- `Other/Unknown`: combine only when the resulting group is at least 10 and the label does not expose a rare locality; otherwise suppress
- Small neighbouring categories: may be combined only by a stable, predeclared rule and only when the combined group is at least 10
- CSV aggregate: proposed only for authorised roles, with the identical suppression rules, formula-safe cells, query/audit metadata, and no raw rows

The value 10 is a proposed holding threshold from Prompt 21A, not a leadership-approved threshold.

# Export Decision

- Export-policy approval status: PENDING
- Full-address export: not proposed for routine use
- Roles allowed: none for routine full address; Director or authorised Viewer/Auditor may be considered for suppressed aggregate export only
- Approved purpose: Not supplied
- Reauthentication requirement: required for any future approved export
- Approval requirement: purpose-specific Director approval before each non-routine export
- Masking: no full address or household-level row; suppressed aggregate cells only
- Formula-safe output: required
- Audit requirement: actor, purpose, scope, filters, row/cell count, suppression result, timestamp, and file digest; never address text
- Exported-file retention: proposed maximum seven calendar days, followed by verified deletion; recipient handling approval is still required
- Raw-coordinate export: prohibited; no coordinates exist in the proposed 21B scope

# Retention and Exit Policy

Retention approval status: PENDING

These are explicit draft periods for review, not approved policy:

| Record/state | Draft rule |
| --- | --- |
| Active Students | Retain the current approved postal address only while the Student has an active enrollment; review at least annually |
| Transferred Students | At transfer/exit, restrict access immediately; after 90 days remove address lines and landmark unless an approved hold applies |
| Students who left | Same as transferred Students: full address removed after 90 days unless held |
| Graduated Students | Full address removed after 90 days unless an approved records/legal hold applies |
| Generalised locality | After full-address removal, retain locality/district/postalCode only for a maximum of 12 months for an approved aggregate purpose, then delete |
| Pending correction requests | Resolve or escalate within 30 days; do not retain copied evidence by default |
| Rejected corrections | Delete proposed address payload 90 days after final notice; retain only minimised decision metadata for the audit period |
| Audit history | Retain minimised audit metadata for two years from the event; no address body or coordinate |
| Backup expiry | Address/correction data may remain only until each encrypted backup reaches the existing approved backup-expiry schedule; the exact schedule and deletion propagation must be approved before implementation |
| Exported files | Maximum seven calendar days under the proposed export rule |
| Legal or operational hold | Named Director plus qualified legal/privacy owner must record scope, reason, start date, review date no later than 90 days, and release decision |

The authorised owner who must approve or replace these draft periods is the school records/privacy owner, with qualified Indian privacy/legal review and leadership reference. No such owner/person or approval is currently supplied.

# Correction and Verification Workflow

1. Parent submits a correction request.
2. The request is linked only to the Parent’s child through server-side object access.
3. The existing approved address remains effective until approval.
4. The authorised office reviews supporting evidence where required; evidence copies are avoided unless policy explicitly permits them.
5. An authorised role other than the submitting Parent approves or rejects.
6. The change reason is recorded without unnecessary personal detail.
7. The prior version remains in restricted, time-limited history.
8. The Parent is shown the final status for the linked child.
9. Coordinate data, if ever added in a separately approved later phase, is invalidated after an address change.

# Incident and Breach Ownership

Incident-owner approval status: PENDING

Organisational roles are proposed below, but accountable persons have not been supplied. Missing named ownership blocks implementation.

| Responsibility | Proposed organisational role | Accountable person |
| --- | --- | --- |
| Operational owner | Director or appointed records owner | Not supplied |
| Privacy owner | Appointed school privacy/grievance owner | Not supplied |
| Security owner | Appointed system security administrator | Not supplied |
| Incident coordinator | Director or formally delegated incident lead | Not supplied |
| Parent communication owner | Principal or appointed safeguarding/communications lead | Not supplied |
| Regulator/legal escalation | Qualified Indian privacy/legal adviser plus Director | Not supplied |
| Evidence preservation | Security owner with privacy-owner oversight | Not supplied |
| Access suspension | Super Admin under incident-coordinator instruction | Not supplied |
| Post-incident review | Director, privacy owner, security owner, and operational owner | Not supplied |

# Backup and Restore Projection

Backup/restore approval status: PENDING

- Address fields in JSON backup: proposed yes only through a reviewed explicit allowlist; never by broad Student-row serialization
- Correction events in JSON backup: proposed yes for minimised status/reason/audit metadata; supporting evidence and unnecessary address copies excluded
- Restore authority: proposed Super Admin execution under Director-approved recovery instruction; ordinary Admin/Teacher/Viewer/Accountant/Parent cannot restore
- Retention interaction: deletion/generalisation actions must be recorded for reconciliation after an older backup restore; expired backups must be removed under the approved backup schedule
- Encrypted cloud-backup coverage: proposed only inside the existing encrypted database-backup boundary after field-level review; no plaintext provider copy
- PWA/offline cache: excluded
- Public website: excluded
- Public structured data, metadata, sitemap, and search markup: excluded
- AI Assistant: excluded
- Communication templates: excluded
- Ordinary application, access, error, analytics, and telemetry logs: address body and location data excluded
- Restore collision: restore must not overwrite a newer verified address or pending correction silently
- Restore ownership: restored records retain Student ownership/linkage but verification becomes review-required when version/provenance cannot be reconciled
- Provider state: no provider exists in Prompt 21B and restore must not introduce one

# Release Blockers

The allowed blocker values are `RESOLVED`, `UNRESOLVED`, and `NOT_APPLICABLE`.

| Mandatory blocker | Status | Evidence/result |
| --- | --- | --- |
| approved purpose | UNRESOLVED | No approved purpose or accountable business owner supplied |
| approved precision tier | UNRESOLVED | Tier 1-only is recommended but not formally approved |
| qualified legal/privacy review | UNRESOLVED | No qualified reviewer or written reference supplied |
| approved Parent notice | UNRESOLVED | Draft only; owner, version, approval, and contact route missing |
| mandatory/optional decision | UNRESOLVED | Address collection is not assumed mandatory; decision missing |
| field-minimisation decision | UNRESOLVED | Proposed field table is not approved |
| role matrix | UNRESOLVED | Proposed matrix is not approved |
| aggregate threshold | UNRESOLVED | Proposed minimum 10 is not approved |
| export policy | UNRESOLVED | Proposed suppressed-only policy is not approved |
| retention and deletion | UNRESOLVED | Draft periods lack leadership and qualified review |
| exit/transfer treatment | UNRESOLVED | Draft 90-day/generalisation rules are not approved |
| incident ownership | UNRESOLVED | Organisational roles proposed; accountable persons missing |
| backup/restore projection | UNRESOLVED | Projection is drafted but not approved |
| coordinate omission or separate approval | UNRESOLVED | `OMIT_ALL_COORDINATES_FROM_21B` is proposed but not formally approved |
| leadership signature/reference | UNRESOLVED | No approving person, date, signature, or meeting reference supplied |

# Final Gate Decision

Final gate decision: PROMPT_21B_BLOCKED

The decision is mechanically consistent: one or more mandatory blockers are `UNRESOLVED`—in fact, all are unresolved. `SAFE_TO_BEGIN_PROMPT_21B` is forbidden until leadership evidence, qualified Indian privacy/legal review, and every mandatory blocker are recorded as `RESOLVED`.

Prompt 21B implementation is not safe to begin. Prompt 21C and Prompt 21D are also outside this record and remain blocked.

## No-implementation baseline

| Evidence | Value |
| --- | --- |
| Prisma schema SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Migration-file count | 41 |
| Page routes | 274 |
| API routes | 375 |
| Backup version | 37 |
| Operational database SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |
| Business-count baseline | 8 Students; 8 active enrollments; 19 active non-cancelled Payments; INR 99,100 collected |

No real Student address appears in this document. No schema, migration, structured address field, coordinate field, location model, route, API, Parent correction form, map, geocoder, provider package, provider call, API key, operational record, or Browser location permission was created by this governance phase. Backup version remains 37.
