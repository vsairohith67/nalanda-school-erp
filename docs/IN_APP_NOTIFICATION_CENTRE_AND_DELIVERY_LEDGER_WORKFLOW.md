# In-App Notification Centre and Delivery Ledger Workflow

> Prompt 19B reuses only approved/published Prompt 19A campaigns and immutable `NotificationRecipient` snapshots for optional WhatsApp template delivery. It never edits the original campaign or changes the IN_APP ledger. See `WHATSAPP_BUSINESS_ONE_WAY_COMMUNICATION_WORKFLOW.md`.

## Scope

Prompt 19A adds an authenticated, internal ERP Notification Centre. `IN_APP` is the only channel. The implementation does not send WhatsApp, SMS, email, push, or any other external message; it has no provider credentials, webhooks, contact-field delivery snapshots, external queues, Firebase code, service worker, or browser-dependent scheduler.

The ledger records what became available inside this ERP. It must never be described as proof of delivery outside the ERP. Read and acknowledgment are operational states, not signatures.

## Existing Parent Notices

Existing Parent Notices remain unchanged. Published notices are shown in `/parent/notifications` as a separate read-only **Legacy Notices** feed, using the existing linked-child ownership filter. They are not copied into `NotificationCampaign`, do not create `NotificationRecipient` rows, and do not receive fabricated read or acknowledgment history. The existing Parent portal notice area also remains available.

## Data model and immutability

Backup version 30 includes:

- `NotificationTemplate`: versioned plain-text template definitions and safe static action links.
- `NotificationCampaign`: draft content, audience definition, immutable publication snapshot, workflow timestamps, aggregate counters, correction and supersession links.
- `NotificationRecipient`: one deduplicated authenticated User per campaign, with minimal safe context and read/acknowledgment/dismissal history.
- `NotificationSkippedRecipient`: safe unresolved-target reasons without phone or email.
- `NotificationEvent`: append-only template, campaign, and recipient workflow history.

Template codes and campaign numbers are unique. A template edit cannot rewrite an existing campaign snapshot. Drafts are editable; submission freezes content and audience. Published messages cannot be edited. A correction is a new linked campaign, and withdrawal preserves recipient history.

## Content and action-link safety

Titles are limited to 120 characters and bodies to 2,000 characters. Content is plain text. HTML tags, script-like content, inline handlers, executable schemes, and arbitrary recipient-field interpolation are rejected. Only `schoolName` and `academicYear` are supported template placeholders.

Action paths must exactly match the central internal-route allowlist and begin with `/`. External URLs, protocol-relative URLs, query strings, fragments, path traversal, `javascript:`, and `data:` are rejected. Recipient-role validation also prevents a Parent message from linking to staff pages or a Teacher message from linking to Parent pages. Destination pages still perform their normal authorization checks.

## Audience resolution

Audience preview performs no writes. Final resolution happens transactionally at schedule or publication, rechecking active users and current ownership/scope before writing the immutable snapshot.

- Parent audiences resolve through active academic-year enrollment, Guardian-Student ownership, and the Guardian's active Parent User.
- A Parent targeted through multiple children receives one campaign/User recipient row. Minimal targeted-child labels are combined in that row.
- Teacher and Staff audiences require valid User-StaffMember links.
- Teacher timetable scope requires the exact User -> StaffMember -> TimetableTeacher -> TimetableAssignment chain and exact academic year, class, section, and subject.
- Incomplete links never broaden scope.
- Missing or inactive accounts become aggregate skipped reasons; they are not silently ignored or contacted externally.

Recipient snapshots contain no phone numbers or email addresses. Payload tampering is revalidated server-side.

## Teacher policy

Teachers may create `GENERAL`, `ACADEMIC`, and `HOMEWORK` drafts only for `TEACHER_TIMETABLE_SCOPE`, preview them, submit them for review, and see only their own submissions. Teachers cannot select arbitrary users, target the whole school, approve, publish, schedule, withdraw, export, publish emergency content, or inspect individual Parent read state. Leadership approval remains required.

## Campaign workflow

The normal workflow is:

`DRAFT -> READY_FOR_REVIEW -> APPROVED -> PUBLISHED`

The scheduled path is:

`DRAFT -> READY_FOR_REVIEW -> APPROVED -> SCHEDULED`

Cancellation requires a reason before publication. Withdrawal requires a reason after publication. Publication/expiry history can be archived. Every transition is compare-and-set and append-only audited.

Scheduling does not depend on an open Browser tab. Visibility is calculated from stored status, `scheduledFor`, `expiresAt`, and the server's India-local workflow rules each time the authenticated inbox is read. A scheduled recipient becomes visible at or after `scheduledFor`, including after application restart. Expiry removes it from the active inbox but preserves it in history. Withdrawal remains visible as withdrawn history to recipients who received it.

## Recipient states

Opening a notification records `firstViewedAt` and `readAt` once; repeat reads are idempotent. Acknowledgment is an explicit authenticated action and does not equal read or a legal/digital signature. A required-acknowledgment item cannot be dismissed before acknowledgment. Dismissal hides it from the active inbox while preserving history. One User cannot read, acknowledge, or dismiss another User's recipient row.

## Permissions and portals

The permission set separates own-inbox access, scoped drafting, template management, review, approval, schedule, publication, emergency publication, withdrawal, reports, export, and own acknowledgment.

- Super Admin and Director receive all notification permissions.
- Principal receives full notification management, emergency publication, reports, and export.
- Admin receives templates, creation, review, non-emergency schedule/publication, reports, and export; emergency publication is blocked by default.
- Teacher receives own inbox, timetable-scoped drafts, and own acknowledgment.
- Parent receives only their own linked-child inbox and own acknowledgment.
- Viewer/Auditor receives masked aggregate reports and an own inbox only when targeted; export is blocked.
- Accountant receives an own inbox only by default.

The main surfaces are `/notifications`, `/notifications/manage`, `/notifications/manage/new`, `/notifications/manage/[id]`, `/notifications/templates`, `/notifications/reports`, `/teacher/notifications`, and `/parent/notifications`. The notification bell requests only the authenticated User's unread count and refreshes on navigation/user actions without WebSockets or aggressive polling.

## Reporting and CSV

Leadership reporting is aggregate by campaign status, category, priority, audience, scheduled/publication state, intended targets, resolved Users, recipient rows, skipped reasons, read/unread, acknowledgment, dismissal, expiry, Teacher review queue, and corrections. Average read time is aggregate only.

Ordinary reports and CSV do not identify Parents who did not read, expose individual Parent read events, include phone/email/contact fields, Student private data, raw actor IDs, passwords, or secrets. CSV columns are explicitly allowlisted and formula-safe. Viewer/Auditor export is denied. Small campaigns do not reveal individual behavior through the aggregate view.

## Backup and restore

Version 30 backups preserve the five notification arrays, immutable snapshots, schedules, correction links, workflow history, and recipient states. Restore remains compatible with older backups, validates links and local User ownership, isolates same-code/same-number collisions, deduplicates campaign/User recipients, avoids cross-linking unrelated local identities, and is idempotent. Notification snapshots exclude contact fields and password hashes.

## Boundaries for later prompts

Prompt 19B is the separate future WhatsApp scope. Prompt 19C is the separate future SMS/email scope. Push/PWA work is not part of this foundation. A later prompt must make a new security, consent, provider, retry, credential, cost, and audit decision before any external delivery code is introduced.
# Prompt 19C external-channel reuse

Prompt 19C can create one-channel SMS or Email batches only from a published Prompt 19A campaign and its immutable `NotificationRecipient` audience. Preview and send re-resolve the current authoritative Guardian/Staff contact and independent channel consent; Prompt 19A never stores contact destinations and its in-app delivery ledger remains unchanged. SMS/Email acceptance or delivery evidence is not written back as an in-app read/acknowledgement.

# Prompt 19D PWA boundary

The privacy-safe PWA foundation does not cache campaigns, recipient ledgers, read/acknowledgement events, reports, APIs, or authenticated notification pages. It adds no push notification, notification permission, background sync, or offline acknowledgement queue. See `PWA_AND_MOBILE_APP_STRATEGY.md`.
