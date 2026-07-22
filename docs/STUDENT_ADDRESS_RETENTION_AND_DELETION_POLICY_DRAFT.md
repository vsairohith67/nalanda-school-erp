# Student Address Retention and Deletion Policy — Draft

## Status and authority

- Status: DRAFT — AWAITING LEADERSHIP AND QUALIFIED INDIAN PRIVACY/LEGAL APPROVAL
- Policy owner: proposed school records/privacy owner; accountable person not supplied
- Approving authority: not supplied
- Approved version: AWAITING_APPROVAL
- Effective date: AWAITING_APPROVAL
- Review frequency: proposed every 12 months and after every relevant incident or legal change

This draft contains explicit reviewable periods. They are proposed limits, not active authority to collect or retain Student addresses.

## Principles

1. No collection without an approved purpose, notice, optionality decision, and owner.
2. Keep only the current minimum Tier 1 postal record.
3. Never keep coordinate or live-location history in Prompt 21B.
4. Restrict access immediately when the operational purpose ends.
5. Generalise before prolonged retention where locality is sufficient.
6. Delete from operational data, temporary files, exports, and expired backups through verifiable workflows.
7. A legal or operational hold is exceptional, scoped, dated, reviewed, and released.
8. A restored backup must not silently resurrect data that had reached deletion or generalisation.

## Active lifecycle

- Current address: proposed retention only while a Student has an active enrollment and the approved purpose remains valid.
- Review: proposed confirmation at least once each academic year and after an accepted Parent correction.
- Superseded address: proposed restriction immediately; retain only in restricted version history for 90 days after approval of the replacement, then delete address body and keep minimised audit metadata.
- Unknown/no fixed address: retain only the status code needed for operation; do not retain narrative reasons.
- Verification evidence: inspect rather than copy by default. If a copy is expressly approved, delete within 30 days after the decision unless a documented dispute requires a hold.

## Transfer, exit, and graduation lifecycle

At transfer, exit, or graduation:

1. remove ordinary staff access immediately;
2. close or escalate pending corrections within 30 days;
3. retain the full approved address for no more than 90 days for approved exit administration;
4. after 90 days, delete addressLine1, addressLine2, and landmark unless a recorded hold applies;
5. if an approved aggregate purpose exists, retain only locality, district, state, postalCode, and country for a maximum of 12 additional months;
6. after that 12-month period, delete the generalised locality record; and
7. preserve only non-address audit metadata for its approved audit period.

The same proposed treatment applies to transferred, withdrawn, left, and graduated Students unless the final policy documents a lawful distinction.

## Correction history

| Data | Proposed maximum |
| --- | --- |
| Pending correction request | 30 days to resolve or escalate |
| Accepted proposed-address payload | 90 days after decision, then delete body |
| Rejected proposed-address payload | 90 days after final notice, then delete body |
| Supporting evidence copy | Avoid; if approved, 30 days after decision |
| Minimal decision metadata | Two years |
| Parent-visible status | While request remains within the two-year audit period, without rejected address body |

Audit metadata may identify the actor, action class, child record ID, timestamp, decision, and minimal reason code. It must not store full address text, evidence image, map data, coordinate, or provider response.

## Audit retention

- Proposed period: two years from each event.
- Access: Director, appointed privacy owner, and specifically appointed Auditor only.
- Annual review: verify that logs contain no address body and purge expired events.
- Incident extension: an event may be held only under the exceptional-hold process below.

## Generalisation and deletion

Generalisation removes household-level fields and retains only approved locality fields. It is not anonymisation when a small group can identify a child.

- Aggregate output requires a minimum group of 10.
- Small or complementary cells are suppressed.
- Locality retained for an aggregate purpose must not remain linked in routine Viewer output to a Student.
- Deletion must be idempotent, authorised, previewable, and logged without the deleted address.
- The deletion result records counts, scope, actor, approval reference, timestamp, and verification digest.

## Backup expiry and restore

- New address and correction fields may enter JSON backup only through an explicit reviewed allowlist after approval.
- Backup remains version 37 during this documentation phase.
- Before implementation, leadership must approve the exact existing encrypted-backup expiry schedule that will govern address data.
- Each deletion/generalisation produces a restricted reconciliation marker retained until every backup capable of restoring the old value has expired.
- Restore is limited to Super Admin execution under a Director-approved recovery instruction.
- Restore must compare address version, Student ownership, correction state, deletion/generalisation markers, and verification provenance.
- A restored older address cannot overwrite a newer approved address silently.
- Restored unverifiable address data returns to a review-required state.
- PWA cache, public website, AI Assistant, communication templates, analytics URLs, logs, and provider storage are outside the backup projection and must never receive the address.

The exact backup-expiry period is unresolved. The authorised school records/privacy owner and qualified legal/privacy reviewer must approve it before Prompt 21B.

## Temporary files and exports

- No routine full-address export is proposed.
- Any approved suppressed aggregate export expires after seven calendar days.
- Temporary preview or correction data expires after 24 hours unless linked to an active request.
- Formula-safe CSV is required.
- Address bodies and coordinates must not appear in filenames, URLs, audit messages, or export metadata.
- The responsible recipient confirms deletion; the privacy owner verifies exceptions.

## Exceptional hold

A hold requires:

- Director approval;
- qualified legal/privacy owner review;
- a specific reason and affected record scope;
- start date;
- review date no later than 90 days after start;
- access list;
- evidence-preservation requirements;
- release decision and date; and
- deletion/generalisation immediately after release when the normal period has elapsed.

“Retain as needed,” indefinite holds, and silent extensions are prohibited.

## Responsible roles

| Duty | Proposed role | Accountable person |
| --- | --- | --- |
| Approve purpose and periods | Director plus records/privacy owner | Not supplied |
| Confirm legal/privacy periods | Qualified Indian privacy/legal reviewer | Not supplied |
| Operate corrections | Authorised Admin/records staff | Not supplied |
| Approve corrections | Director or appointed Principal | Not supplied |
| Execute purge/generalisation | Super Admin under approved instruction | Not supplied |
| Verify deletion | Privacy owner plus independent Auditor | Not supplied |
| Reconcile restored data | Recovery owner plus privacy owner | Not supplied |
| Review policy annually | Director, privacy, security, operational owners | Not supplied |

Missing accountable persons and approvals block implementation.

## Review frequency

- Full policy and access review: every 12 months.
- Retention-job result review: monthly after implementation.
- Backup-expiry reconciliation: after every restore and quarterly.
- Incident-triggered review: within 30 days of containment.
- Legal-change review: before the changed requirement is applied.

## Deletion verification

Verification must confirm:

- operational fields removed or generalised;
- pending/superseded payloads removed;
- temporary data removed;
- exports expired and recipient confirmation recorded;
- no PWA/offline, public, AI, communication, log, or provider copy exists;
- no public structured data, sitemap, metadata, analytics, or telemetry copy exists;
- backup reconciliation marker remains until final capable backup expiry;
- counts and hashes do not include address content; and
- a second authorised role reviewed the result.

## No live-location history

Prompt 21B has no latitude, longitude, approximate point, device location, route, movement, timestamped position, map, or geocoder history. Tier 4 exact residential coordinates and Tier 5 live/device location are prohibited. Any future Tier 3 proposal requires a separate approval and implementation phase; this draft does not approve it.

No real Student data appears in this draft. No schema or runtime implementation was performed.
