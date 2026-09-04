# Server-Owned Recipient Resolution

Clients cannot submit an email address, phone number, push token, arbitrary user ID, Student ID, or recipient list to a delivery provider. Domain code selects one reviewed policy and a bounded source-record scope; the server resolves current relationships.

Implemented policies are current account user, active Guardians for exact Students, active Staff relations, authorised leadership, exact Support participants, and exact approved invitation candidate. Large audiences require preview metadata, a reviewed count, approval and step-up evidence.

## Parent safety

`ACTIVE_GUARDIANS_FOR_STUDENTS` queries active Students, active Guardian links permitted to receive reminders, active Guardians, and active linked Parent accounts. The result is deduplicated by Guardian across siblings. No contact is returned to a client. Dispatch repeats contact and status checks; changed contact digests suppress the queued item. Target APIs independently re-authorise the current linked child.

## Staff safety

`ACTIVE_STAFF_RELATION` requires an active StaffMember linked to an active account. Personal/work contact precedence is never guessed: the authoritative current field selected by channel must exist, and a governed contact-point version/digest is carried. Inactive or terminated Staff are suppressed.

## Snapshot rules

The intent stores a hash of the reviewed subject/user audience, not plaintext destinations. New recipients are not silently added after approval. At dispatch the system rechecks account/link status, consent, suppression, contact version, expiry, and channel flag; it may remove a recipient but cannot expand the snapshot.
