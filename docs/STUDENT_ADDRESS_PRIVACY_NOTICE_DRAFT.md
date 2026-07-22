# Student Postal Address Privacy Notice — Draft

## Approval warning

- Document status: DRAFT — NOT LEGALLY APPROVED
- Approved version: AWAITING_APPROVAL
- Effective date: AWAITING_APPROVAL
- Notice owner: AWAITING_APPROVAL
- Complaint/contact route: AWAITING_APPROVAL

This draft is written for Parent, guardian, and age-appropriate child review. It is not active policy, leadership approval, or legal advice. The school must obtain qualified Indian privacy/legal review and formal leadership approval before using it.

## Plain-language explanation

The school is considering keeping a structured postal address for a Student. A postal address is private child and family information. If approved, the school would collect only the fields needed for the stated school purpose, restrict who can see them, let a linked Parent request a correction, and remove or generalise the information under an approved schedule.

Prompt 21B would not track a child, place a home on a public map, or send the address to a third-party geocoding service.

## Purpose

No purpose is approved yet. Leadership must select and record a specific purpose and accountable owner before collection begins. Candidate purposes under review are authorised physical school correspondence, maintaining an accurate school record, and suppressed locality-level planning. The address must not be reused for fee-collection visits, attendance policing, marketing, profiling, ranking, targeting, surveillance, AI, or unrelated communications.

## Minimum fields

The proposed minimum structured fields are:

- addressLine1;
- locality;
- city;
- state;
- postalCode;
- country;
- address source; and
- verification status.

addressLine2, landmark, district, verifiedAt, and verifiedBy are proposed only where necessary. Verification actor data would be restricted. Latitude, longitude, coordinate precision, device position, movement history, live location, house/residence photographs, doorway images, and access codes are excluded from Prompt 21B.

## Optional and required fields

The decision on whether any address is mandatory is awaiting approval. The school must not assume that every family is required to provide one.

If address collection is approved:

- addressLine2, landmark, district, and other nonessential details remain optional;
- a Parent may leave optional fields blank;
- `unknown` and `no fixed address` must be supported without requiring an explanation that exposes personal circumstances;
- existing Students are not automatically forced to complete or verify a legacy address; and
- an incomplete or absent address does not block admission, attendance, learning, fee payment, reports, certificates, or Parent access unless a separate lawful rule and accommodation are formally approved.

## No tracking, map, or geocoding

- No live or device tracking occurs.
- No location permission is requested from a browser or phone.
- No public or Parent map occurs.
- No exact or approximate residential coordinate is collected in Prompt 21B.
- No third-party geocoding occurs in Prompt 21B.
- No address is sent to Google Maps, Mapbox, OpenStreetMap/Nominatim, an AI service, or another mapping provider in Prompt 21B.

## Who may access the address

The access matrix is awaiting approval. The proposed low-risk model is:

- authorised Director/records roles may administer and audit an approved purpose;
- authorised Admin staff may process an entry or correction without self-approving it;
- a Principal may view or approve only if formally assigned;
- Teachers and Accountants have no residential-address access by default;
- a Viewer/Auditor receives only locality aggregates suppressed below a minimum group of 10;
- a Parent may view only the current approved postal address of the linked child and submit a correction request;
- no Parent sees another child’s address; and
- public users have no access.

Every access decision must be enforced on the server. Display hiding alone is insufficient.

## Parent correction rights

A linked Parent may ask the school to correct the child’s current postal address. A request does not immediately overwrite the current record. The existing approved address stays effective while an authorised office reviewer checks the request and any evidence that policy permits. An authorised role approves or rejects, records a minimal reason, and shows the final status to the Parent. Another child or household record is never exposed merely because an address matches.

The approved notice must state the response period and grievance route. Proposed response target: resolve or escalate within 30 calendar days. This period is not approved yet.

## Retention

Retention is awaiting leadership and qualified legal/privacy approval. The current draft proposes:

- current full address only during active enrollment;
- access restriction immediately on transfer, exit, or graduation;
- removal of full address lines and landmark after 90 days unless an approved hold applies;
- locality-only generalisation for a maximum of 12 further months when an approved aggregate purpose exists;
- correction payload removal 90 days after closure;
- minimised audit metadata for two years; and
- exported aggregate file deletion within seven calendar days.

Encrypted backups may retain data only until their approved expiry. An older restore must reapply deletion/generalisation decisions. These proposed periods are not effective policy.

## Complaints and contact

The approved school privacy/grievance contact has not been supplied. Until that role, contact route, and escalation route are formally recorded, this notice cannot be issued and Prompt 21B remains blocked.

The final notice must explain how a Parent or child can:

- ask a question;
- request correction or deletion where applicable;
- challenge a rejection;
- complain to the school;
- escalate to the qualified legal/privacy route; and
- receive an accessible response without exposing another child.

## Incident or breach communication

If an address is viewed, exported, disclosed, restored, cached, or shared without authority, the school would contain the incident, suspend affected access, preserve privacy-safe evidence, determine affected children and records, and follow the qualified adviser’s current notification duties. The appointed Parent-communication owner would give clear, child-safe information when required without revealing another family’s data.

Incident roles, accountable persons, timelines, and legal/regulatory escalation are awaiting approval. Their absence blocks implementation.

## Approval record

This notice becomes usable only after:

- a specific purpose and collection basis are approved;
- required and optional fields are settled;
- the access and retention decisions are approved;
- the school supplies the notice owner and complaint/contact route;
- qualified Indian privacy/legal review is recorded in writing;
- leadership records an approving person, date, scope, and reference; and
- the Prompt 21B approval record contains no unresolved mandatory blocker.

No real Student data appears in this draft. No schema or runtime implementation was performed.
