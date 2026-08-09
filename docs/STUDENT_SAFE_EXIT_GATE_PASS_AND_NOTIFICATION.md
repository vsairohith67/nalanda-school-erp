# Student Safe Exit, Gate Pass and Guardian Notification

**Requirement:** `V1-SAFE-033`  
**Implementation:** `SAFE-EXIT-1A`  
**Boundary:** local/private, synthetic copied-database QA only; no deployment, real departure, live WhatsApp provider or real-data onboarding

## Safety invariant

A normal early departure requires all of: current linked-Guardian consent, exact Principal/Director approval, approved handover, active single-use gate pass, verified gate checkout, authoritative Parent notification and append-only audit. Denied, missing, stale or unreachable-Parent consent fails closed. A Student cannot approve release. Gate Staff can verify and check out only; they cannot create consent or approval.

The restricted emergency path additionally requires the exact permission, Principal/Director authority, current password re-authentication, an approved emergency category and reason, recorded Parent-contact attempts, safe destination/handover, a second authorised confirmer or a recorded reason why one was unavailable, leadership alert, Parent notification attempts and immutable audit. A late or unreachable Parent is not an emergency. Solo departure is off by default and requires a current versioned standing Guardian authorisation.

## Lifecycle and records

The explicit request lifecycle supports `REQUESTED`, `CONSENT_PENDING`, `CONSENT_VERIFIED`, `CONSENT_DENIED`, `PARENT_UNREACHABLE`, `UNDER_SCHOOL_REVIEW`, `APPROVED`, `READY_FOR_HANDOVER`, `CHECKED_OUT`, `RETURNED_TO_CAMPUS`, `CANCELLED`, `EXPIRED`, `EMERGENCY_OVERRIDE`, `UNAUTHORISED_EXIT_SUSPECTED`, `UNAUTHORISED_EXIT_CONFIRMED` and `CLOSED`.

New records are additive and reuse Student, active enrollment, Guardian links, IAM role/child context, timetable Teacher scope, Academic Calendar, Notification Centre, Support/safeguarding references and audit conventions. Request submission, consent, approval, pass issue, handover, campus presence, incident action and notification history are append-only; hard deletion is blocked. Expected-version compare-and-set and idempotency keys serialize approval and checkout.

Campus presence is separate from daily attendance. Events cover check-in-compatible on-campus default, early departure, return, normal dismissal interoperability and unauthorised-exit incident. No attendance row is silently rewritten. The restricted live roster is derived from active enrollment and the latest immutable presence event.

## Consent and handover

Accepted consent is authenticated linked-Parent approval, current standing authorisation, Staff-recorded verified telephone consent using the registered Guardian contact plus witness/supervisor, or a private written-consent reference where policy permits. A call attempt alone is never consent.

Standing authority is immutable and versioned by series, Student/class, allowed days/minutes, effective dates, conditions, Guardian approval method, self-departure flag and revocation version. The default self-departure flag is false.

Handover supports linked Guardian, pre-authorised or one-time Parent-authorised pickup, ambulance/emergency responder, lawful authority and governed Student self-departure. Stored pickup data is minimal: name, relationship, masked contact, Parent-authorisation evidence and optional policy-approved verification reference. Identity-document images are not collected by default.

## Gate-pass security

The pass is random, opaque, HMAC-signed, 5–60 minute bounded, default 30 minute, and single-use. The QR payload contains only a token version, random nonce, expiry and signature—never a Student name, phone number or database ID. A separate eight-character manual code is stored only as a SHA-256 digest. Verification rejects tampering, expiry, reuse, cancellation, stale approval, wrong Student, wrong recipient/method, inactive enrollment and an already-off-campus Student. Checkout atomically consumes the pass and claims the Student active-checkout key.

The authenticated print view shows Student, class/section, approved time, handover method, expiry, authorising role and status. It prints **NALANDA PUBLIC SCHOOL** in Georgia Bold.

## Notifications and incidents

Every material event creates one authoritative in-app campaign/recipient and retry-safe per-user/channel outbox rows. Push uses only a verified local test-sink subscription in this phase. Lock-screen copy is generic and details require authenticated opening. WhatsApp is restricted to the existing approved template/consent adapter in `MOCK`; any live mode is rejected. Provider references are privacy-safe and full provider payloads are not stored. Delivery failure never rolls back a departure. Critical emergency/unauthorised-exit failure opens a Director phone-contact fallback task.

An unauthorised-exit report creates no pass. It creates a restricted request/incident, last-known safe location/time when available, append-only search/contact/location/located/return actions, immediate Parent and leadership notification, and an optional link to the cleared Support/safeguarding workflow. No automatic disciplinary conclusion exists. Parent access is limited to the authorised minimal alert/status; incident narrative and actions remain leadership-restricted.

## Permissions and scope

Separable permissions are `REQUEST_STUDENT_DEPARTURE`, `RECORD_PARENT_CONSENT`, `APPROVE_STUDENT_DEPARTURE`, `EMERGENCY_OVERRIDE_STUDENT_DEPARTURE`, `VERIFY_GATE_PASS`, `COMPLETE_STUDENT_CHECKOUT`, `RECORD_STUDENT_RETURN`, `RECORD_UNAUTHORISED_EXIT`, `VIEW_LIVE_CAMPUS_ROSTER` and `VIEW_DEPARTURE_AUDIT`.

Parent scope is revalidated through the current StudentGuardian link on every object action. Teacher initiation resolves active User → StaffMember → TimetableTeacher → exact TimetableAssignment. Gate Staff receives only pass verification, checkout, return, roster and own notifications. Accountant and Viewer are denied by default. Restricted incident access requires exact leadership/safety authority.

All APIs are authenticated, private/no-store, bounded, unsafe-method origin/CSRF protected by the shared middleware and use no state-changing GET. There is no public Student lookup, PII in push/logs, external AI processing, live provider call or transport dependency.

## Recovery and operations

Backup version 38 preserves the request, consent, standing authority, pass digests/status, handover, event, presence, incident/action, notification outbox and fallback task. It excludes push subscriptions, signing keys, session tokens, provider credentials and full provider payloads. Restore is bounded, relationship-validated and idempotent. The migration widens the preserved IAM assignment role check for `GATE_STAFF` and adds only safe-exit tables, indexes and fail-closed SQLite triggers.

Browser and release evidence is recorded separately in `docs/evidence/SAFE_EXIT_1A_QA_RELEASE_EVIDENCE.md`. Next governed phase after independent clearance is `OBS-1A`.
