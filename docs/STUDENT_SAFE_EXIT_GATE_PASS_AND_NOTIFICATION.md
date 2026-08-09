# Student Safe Exit, Gate Pass and Guardian Notification

**Requirement:** `V1-SAFE-033`  
**Implementation:** `SAFE-EXIT-1A`  
**Boundary:** local/private, synthetic copied-database QA only; no deployment, real departure, live WhatsApp provider or real-data onboarding

## Safety invariant

A normal early departure requires all of: a current approved authorisation mode, exact Principal/Director approval, approved handover, active single-use gate pass, verified gate checkout, authoritative Parent notification and append-only audit. Approved authorisation modes are authenticated linked-Parent approval, verified telephone consent, in-person eligible-Guardian pickup, Parent-authorised pickup person, or a current leadership-approved standing self-departure authorisation. Denied, missing, stale or unreachable-Parent consent fails closed. A Student cannot approve release. Gate Staff can verify and check out only; they cannot create consent or approval.

The restricted emergency path additionally requires the exact permission, Principal/Director authority, current password re-authentication, an approved emergency category and reason, recorded Parent-contact attempts, safe destination/handover, a second authorised confirmer or a recorded reason why one was unavailable, leadership alert, Parent notification attempts and immutable audit. A late or unreachable Parent is not an emergency. Solo departure is off by default and requires a current versioned standing Guardian authorisation.

## Lifecycle and records

The explicit request lifecycle supports `REQUESTED`, `CONSENT_PENDING`, `CONSENT_VERIFIED`, `CONSENT_DENIED`, `PARENT_UNREACHABLE`, `UNDER_SCHOOL_REVIEW`, `APPROVED`, `READY_FOR_HANDOVER`, `CHECKED_OUT`, `RETURN_EXPECTED`, `RETURNED_TO_CAMPUS`, `CANCELLED`, `EXPIRED`, `EMERGENCY_OVERRIDE`, `UNAUTHORISED_EXIT_SUSPECTED`, `UNAUTHORISED_EXIT_CONFIRMED` and `CLOSED`.

New records are additive and reuse Student, active enrollment, Guardian links, IAM role/child context, timetable Teacher scope, Academic Calendar, Notification Centre, Support/safeguarding references and audit conventions. Request submission, consent, approval, pass issue, handover, campus presence, incident action and notification history are append-only; hard deletion is blocked. Expected-version compare-and-set and idempotency keys serialize approval and checkout.

Campus presence is separate from daily attendance. Events cover check-in-compatible on-campus default, early departure, temporary return, normal dismissal interoperability and unauthorised-exit incident. Every request snapshots the governing attendance policy and raises a reconciliation flag where relevant. No daily, half-day, examination or report-card attendance row is silently rewritten; only the existing attendance-correction workflow may resolve the flag. The restricted live roster is derived from active enrollment and the latest immutable presence event.

## Consent and handover

Accepted consent is authenticated linked-Parent approval, current standing authorisation, Staff-recorded verified telephone consent using the registered Guardian contact plus witness/supervisor, or a private written-consent reference where policy permits. A call attempt alone is never consent.

Standing authority is immutable and versioned by series, Student/class, allowed days/minutes, effective dates, departure pattern, masked emergency contact, Guardian approval method, self-departure flag and revocation version. It starts `PENDING_SCHOOL_APPROVAL`; only an exact Principal/Director action creates the active approved version. The default self-departure flag is false, use never converts a one-time permission into a standing permission, and revocation is immediate.

Temporary exit requires an expected return time. Checkout creates an immutable release event and `RETURN_EXPECTED`; return creates a separate immutable event. An overdue processor emits a canonical overdue event and management escalation once, while a late or missing return remains visible in history. Return notifications follow the request setting. None of these events changes attendance automatically.

Handover supports linked Guardian, pre-authorised or one-time Parent-authorised pickup, ambulance/emergency responder, lawful authority and governed Student self-departure. Stored pickup data is minimal: name, relationship, masked contact, Parent-authorisation evidence and optional policy-approved verification reference. Identity-document images are not collected by default.

## Gate-pass security

The pass is random, opaque, HMAC-signed, 5–60 minute bounded, default 30 minute, and single-use. The QR payload contains only a token version, random nonce, expiry and signature—never a Student name, phone number or database ID. A separate eight-character manual code is stored only as a SHA-256 digest. Verification rejects tampering, expiry, reuse, cancellation, stale approval, wrong Student, wrong recipient/method, inactive enrollment and an already-off-campus Student. Checkout atomically consumes the pass and claims the Student active-checkout key.

The authenticated print view shows Student, class/section, approved time, handover method, expiry, authorising role and status. It prints **NALANDA PUBLIC SCHOOL** in Georgia Bold.

## Notifications and incidents

Every material event creates one authoritative in-app campaign/recipient and retry-safe per-user/channel outbox rows. This includes consent request/decision, school approval, actual or emergency release, temporary return, overdue return, cancellation and append-only release correction. Push uses only a verified local test-sink subscription in this phase. Lock-screen copy is generic and details require authenticated opening. WhatsApp is restricted to the existing approved template/consent adapter in `MOCK`; any live mode is rejected. Provider references are privacy-safe and full provider payloads are not stored. Delivery failure never rolls back a departure. Critical emergency/unauthorised-exit failure opens a Director phone-contact fallback task. Delivery or read status is never consent.

An unauthorised-exit report creates no pass. It creates a restricted request/incident, last-known safe location/time when available, append-only search/contact/location/located/return actions, immediate Parent and leadership notification, and an optional link to the cleared Support/safeguarding workflow. No automatic disciplinary conclusion exists. Parent access is limited to the authorised minimal alert/status; incident narrative and actions remain leadership-restricted.

## Permissions and scope

Separable permissions are `REQUEST_STUDENT_DEPARTURE`, `RECORD_PARENT_CONSENT`, `APPROVE_STUDENT_DEPARTURE`, `EMERGENCY_OVERRIDE_STUDENT_DEPARTURE`, `VERIFY_GATE_PASS`, `COMPLETE_STUDENT_CHECKOUT`, `RECORD_STUDENT_RETURN`, `RECORD_UNAUTHORISED_EXIT`, `VIEW_LIVE_CAMPUS_ROSTER`, `VIEW_DEPARTURE_AUDIT`, `MANAGE_STANDING_EXIT_PERMISSION` and `CORRECT_STUDENT_EXIT_RECORD`.

Parent scope is revalidated through the current StudentGuardian link on every object action. Teacher initiation resolves active User → StaffMember → TimetableTeacher → exact TimetableAssignment. Gate Staff receives only pass verification, checkout, return, roster and own notifications. Accountant and Viewer are denied by default. Restricted incident access requires exact leadership/safety authority.

All APIs are authenticated, private/no-store, bounded, unsafe-method origin/CSRF protected by the shared middleware and use no state-changing GET. There is no public Student lookup, PII in push/logs, external AI processing, live provider call or transport dependency.

## Recovery and operations

Backup version 39 preserves the request, consent, standing authority and its leadership approval, pass digests/status, handover, release/return event, attendance-reconciliation snapshot, incident/action, notification outbox, contact fallback task and append-only correction event. It excludes push subscriptions, signing keys, session tokens, provider credentials, temporary QR images, unnecessary identity documents and full provider payloads. Restore is bounded, relationship-validated and idempotent. The original migration widens the preserved IAM assignment role check for `GATE_STAFF`; the single hardening migration `20260809224500_student_exit_return_standing_corrections` adds only return/attendance/standing-approval fields, correction evidence, indexes and fail-closed SQLite triggers.

## Parent and operator guide

Parents use the linked-child portal to request departure or explicitly approve/deny a Staff request, select the permitted pickup method/person, review current status and history, and report an unexpected release through Support. An approval is version-bound and expires; a material request change invalidates it. Parents do not approve through a notification receipt.

Staff record a request, not consent, when relaying a Student request. Principal/Director users review current consent and exact Student scope, approve the handover, issue the pass, review temporary-return escalation and append corrections without altering release history. Gate users scan or enter one opaque pass, verify Student and pickup/release method, then record checkout or return. They cannot approve, create consent or browse unrelated family/academic information.

## Emergency runbook and threat model

Use emergency override only for a bounded safeguarding/emergency category when Parent confirmation is unavailable. Confirm current exact permission and recent password re-authentication; record each contact attempt and why confirmation is unavailable; select a safe handover; obtain the second gate verification; then notify every eligible Guardian immediately. If required digital delivery fails, complete the urgent manual-contact task. Never use the path for convenience or lateness.

Primary threats are cross-family or cross-child access, stale Guardian links, forged/replayed/expired passes, duplicate or concurrent checkout, an approval mistaken for release, a notification mistaken for consent, ordinary-role emergency escalation, silent attendance rewriting, mutable release history, sensitive notification/log content and provider failure inside the release transaction. Controls are server-side object revalidation, version-bound opaque handles, HMAC-signed random passes with one-use compare-and-set, exact permissions and re-authentication, immutable events/corrections, a separate attendance flag, privacy-minimal outbox content, local test sinks and transaction-independent retry/fallback.

Browser and release evidence is recorded separately in [SAFE_EXIT_1A_QA_RELEASE.md](evidence/SAFE_EXIT_1A_QA_RELEASE.md). Next governed phase after independent clearance is `OBS-1A`.
