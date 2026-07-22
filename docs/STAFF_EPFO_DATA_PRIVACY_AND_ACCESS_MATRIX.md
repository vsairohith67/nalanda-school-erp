# Staff EPFO Data Privacy and Access Matrix

## Status and purpose

This is a proposed Prompt 22A governance design, not an approved privacy notice or runtime permission matrix. It covers Staff DOB, limited EPFO/EPS status, optional UAN last four digits, correction/verification, age-58 review and compliance-checklist metadata. It excludes full UAN, Aadhaar, PAN, bank details, EPFO credentials, OTPs, portal sessions, document images, claim data and pension amounts.

The permitted purposes are:

1. maintain a Staff-requested or authorised, human-verified DOB record;
2. record neutral EPFO/EPS administrative review states;
3. enable a future Director-only review reminder;
4. allow Staff correction and restricted audit; and
5. support a future checklist without claiming statutory compliance.

The data must not be used for dismissal, retirement decisions, salary action, contribution automation, benefit promises, surveillance, ranking, public content, marketing or AI profiling.

## Proposed dedicated permissions

| Permission | Scope |
| --- | --- |
| `VIEW_STAFF_DOB` | View exact DOB only on restricted Staff records |
| `MANAGE_STAFF_DOB` | Enter unverified DOB/source and administer correction queue |
| `VERIFY_STAFF_DOB` | Verify/reject/correct with source category, reason and append-only event |
| `VIEW_STAFF_EPFO_STATUS` | View restricted status fields and masked UAN last four |
| `MANAGE_STAFF_EPFO_STATUS` | Edit neutral review/status fields; never make a legal determination |
| `VIEW_EPFO_AGE58_REMINDERS` | View Director-only future reminder dashboard/detail |
| `MANAGE_EPFO_COMPLIANCE` | Acknowledge/review/checklist workflow when formally assigned |
| `VIEW_OWN_STAFF_COMPLIANCE` | View own approved fields/correction status through linked Staff identity |
| `VIEW_EPFO_COMPLIANCE_AGGREGATES` | View suppressed counts only; no row, DOB or identifier access |

Do not infer any of these from `VIEW_STAFF`, `MANAGE_STAFF`, `IMPORT_STAFF`, finance, attendance, public-site or communication permissions.

## Recommended default role matrix

`A` = allowed by default; `C` = only after named formal assignment; `O` = own linked Staff only if self-service is approved; `G` = suppressed aggregate only; `-` = denied.

| Role | View DOB | Manage DOB | Verify DOB | View EPFO status | Manage EPFO status | Age-58 reminders | Compliance | Own view | Aggregate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Super Admin | C | C | C | C | C | C | C | - | A |
| Director | A | A | A | A | A | A | A | - | A |
| Principal | A | - | - | - | - | - | - | - | G |
| Accountant | - | - | - | C | C | - | C | O | G |
| Admin | A | A | - | - | - | - | - | O | - |
| Teacher/Staff | - | - | - | - | - | - | - | O | - |
| Viewer | - | - | - | - | - | - | - | - | G |
| Parent | - | - | - | - | - | - | - | - | - |
| Public/unauthenticated | - | - | - | - | - | - | - | - | - |

Super Admin is not a routine HR operator. Exceptional access must be logged. Principal DOB access must be justified by an approved operational purpose. Accountant access is opt-in assignment, status-only and masked; it does not grant unrelated HR-note or exact-DOB access. Admin can prepare DOB/correction records but cannot verify them by default. Own-view access is deferred until a private Staff self-service design is approved and server-side linked-Staff isolation is tested.

Viewer aggregates require a separate permission, minimum-group suppression approved by privacy counsel, no drill-down and no export of small groups. “Viewer” must never receive exact DOB or identifier data.

## Surface controls

| Surface | Required control |
| --- | --- |
| Staff list/search | No exact DOB, age, EPFO status or UAN last four in ordinary rows or search indexes |
| Restricted Staff detail | Re-authorize permission and record access server-side; mask identifier; log view |
| Correction queue | DOB/source/reason only; no document image or ID number |
| Age-58 dashboard | Director permission; due-window count and restricted link; no exact DOB in cards |
| Checklist | Restricted statuses and safe evidence reference; disclaimer always visible |
| Export | No broad DOB/UAN CSV; only separately approved aggregate report |
| Print | Disabled by default; if later approved, watermark/restricted-purpose warning and access event |
| Screenshots | Persistent on-screen warning that screenshots are outside normal audit controls |
| API | Explicit allowlisted DTO per permission; never return entire StaffMember/related User |
| Logs/errors | No DOB, UAN last four, correction text, evidence reference or portal data in ordinary logs/errors |
| Backup | Explicit versioned allowlist, encryption-before-cloud-upload and restricted restore |
| PWA/offline | Excluded from service-worker/runtime caches and generic offline pages |
| AI Assistant | Excluded from documentation/aggregate registries, prompts, retrieval and evaluation fixtures |
| Public website | Excluded from public-content models, metadata, SEO, feeds and structured data |
| Communications | Excluded from notice, email, SMS, WhatsApp, push and template merge fields |

## Purpose notice and Staff rights

Before collection, provide a versioned, plain-language notice that identifies:

- the school/operator and a real contact for questions;
- each purpose and the exact data categories;
- which values are required for the approved administrative purpose and which are optional;
- that age 58 triggers review only and does not direct retirement/termination;
- who may access exact DOB, limited EPFO status and masked last four;
- correction, completion, update and grievance procedure;
- source/evidence handling and the no-unnecessary-image rule;
- retention, archive, backup expiry and legal-hold rules;
- incident contact and escalation;
- no portal automation or credential collection; and
- the effective date/version and professional approval reference.

The Staff member may submit a correction without exposing another Staff record. The outcome must be visible through an approved private channel or delivered privately by an authorised operator. Rejection requires a neutral reason and escalation path. A correction never overwrites restricted history.

## Data-entry and display rules

- Unknown is not false. Use controlled unknown/disputed/guidance-required states.
- Display full DOB only to exact-DOB roles. Other approved surfaces use a due window, not date or age.
- Display UAN only as `********1234`; do not reveal or reconstruct the other digits.
- Reject free text containing patterns that appear to be Aadhaar, PAN, full UAN, password, OTP, bank number or URL/session token.
- Do not upload or paste an EPFO screen, Aadhaar, PAN, bank statement or source-document image.
- Evidence reference is an opaque internal reference to an approved physical or separately governed record, not a file path or identifier.
- Use synthetic values only in unattended QA, clearly prefixed `QA22B`, and clean them before final backup.

## Access logging and immutable history

At minimum, append events for create, source/status change, verification, correction request, correction outcome, restricted view, export refusal/approval, reminder acknowledgement/snooze/resolution, checklist change and restore. Each event records actor, permission, action, record ID, India-local displayed time plus canonical timestamp, reason category, record version and safe metadata.

Do not place exact DOB or any UAN digits in a general-purpose audit description. Detailed restricted history needs its own permission and projection. Ordinary permission denials may record route, actor and action, not requested Staff personal data.

## Retention and end-of-employment plan

No fixed post-employment number of years is approved in Prompt 22A. A qualified labour/privacy professional must map each field and event to a statutory, contractual, pension/claim, limitation and operational purpose before go-live.

Interim design:

| Lifecycle | Treatment |
| --- | --- |
| Active employment | Keep only approved current facts and restricted append-only history |
| `INACTIVE` or `LEFT` | Remove from routine lists/reminders; retain only while a documented EPFO/employment/legal purpose remains |
| Correction resolved | Keep prior values only in restricted immutable history for the approved audit period |
| Purpose expired | Purge DOB/status/last-four/evidence reference unless law or a documented hold requires retention |
| Legal/professional hold | Record owner, basis, scope, start and review date; do not use an indefinite generic hold |
| Audit history | Retain on a separately approved schedule with minimised metadata |
| Backup copies | Inherit the same classification; expire through the encrypted backup retention process, not manual ad-hoc deletion |

Deletion/archival automation is blocked until the schedule is approved. Restore must not silently resurrect data past its approved retention state; a future design needs tombstone/expiry semantics or a documented post-restore purge.

## Backup and recovery

Prompt 22A leaves backup version 37 unchanged. Prompt 22B must increment the backup format only when the new fields/events are implemented and must:

- explicitly include only approved fields and controlled status/event arrays;
- exclude full UAN, credentials, OTPs, source images and authentication data;
- encrypt before any off-device upload using the existing cloud-backup boundary;
- validate enum/date/reference/actor links and reject cross-Staff attachment;
- restore parent Staff rows before restricted events;
- remain backward compatible with version 37;
- preserve local-newer verified data and append-only event identity;
- produce masked counts, not personal values, in restore reports; and
- test expiration/hold behavior in isolated copied-database rehearsal.

## Incident boundary

Suspected disclosure of DOB, UAN digits or compliance status must trigger containment, access-log preservation, scope assessment, leadership/privacy-owner escalation, professional advice and documented Staff notification decisions. Do not paste affected values into chat, email, tickets, AI tools or ordinary logs. Exact legal notification duties must be confirmed under the law operative on the incident date.

## Approval questions

Before Prompt 22B begins, record named approvals for:

1. precise purpose and mandatory/optional fields;
2. Principal DOB access and any Accountant assignment;
3. whether own-Staff self-service is in 22B or deferred;
4. post-employment field/event/backup retention periods;
5. evidence-reference system and source-document handling;
6. privacy notice, grievance contact and incident owner;
7. minimum aggregation/suppression threshold; and
8. confirmation that full UAN remains omitted.

