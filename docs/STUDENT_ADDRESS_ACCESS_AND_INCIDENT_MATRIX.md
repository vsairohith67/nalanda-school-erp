# Student Address Access and Incident Matrix

## Status

- Status: DRAFT — APPROVAL PENDING
- Scope: proposed Tier 1 postal address and text-derived suppressed Tier 2 aggregates only
- Coordinate decision: OMIT_ALL_COORDINATES_FROM_21B
- Exact-coordinate permission: NONE; no role has a default or exceptional coordinate permission in Prompt 21B
- Minimum aggregate group proposed: 10
- No schema or runtime implementation was performed.

This matrix is a decision artifact, not an active permission grant. Formal leadership and qualified Indian privacy/legal approval are absent.

## Role matrix

All checks are server-side, deny-by-default, purpose-bound, and academic/child scoped. Existing generic Student permissions do not grant address access.

| Role | Page | API | Direct-object access | Edit/request | Verify/approve | Aggregate | Export | Audit | Delete/generalise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin | Exceptional governance/admin page only | Exceptional endpoints after reauthentication | Only under recorded purpose | Exceptional correction, never silent | No default operational approval | Suppressed | Suppressed aggregate only if approved | Governance | Execute under separate Director instruction |
| Director | Proposed full authorised page | Proposed full authorised API projection | Current/specified Student only | Direct correction with reason where policy permits | Verify/approve if appointed | Suppressed | No routine full address; approved suppressed aggregate only | Full restricted metadata | Approve purge/generalisation |
| Principal | Proposed purpose-limited view | Purpose-limited read/decision | Specified Student only | No default edit | Approve if formally appointed | Suppressed | No | Decision audit | No |
| Admin | Entry/correction queue | Create/update pending correction only | Assigned/specified Student only | Process entry/request; no self-approval | Verification only if appointed; no default approval | No | No | Own workflow metadata | No |
| Teacher | No address page | Denied | Denied | Denied | Denied | Denied by default | Denied | Denied | Denied |
| Viewer/Auditor | Aggregate page only | Suppressed aggregate endpoint only | Denied | Denied | Denied | Minimum group 10 | Formula-safe suppressed aggregate only if approved | Safe metadata only if appointed | Denied |
| Accountant | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied |
| Parent | Linked-child current-address/request page only | Linked-child projection/request only | Linked child only | Submit request; no direct overwrite | Denied | Denied | Denied | Own request status only | Denied |
| public user | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied |

## Page, API, export, and audit rules

- Address pages and APIs require dedicated permissions; `VIEW_STUDENTS`, `EDIT_STUDENTS`, and `EXPORT_STUDENTS` are insufficient.
- APIs return explicit allowlisted fields and `Cache-Control: private, no-store`.
- A role denied the page is also denied the API. Hiding navigation does not grant protection.
- Any sensitive view uses an opaque record identifier, fresh authorization, and no address in the URL.
- No full-address print, routine CSV, clipboard helper, share URL, or generic Student export is proposed.
- Suppressed aggregate CSV, if approved, uses the same minimum group 10 and complementary suppression as the page.
- Audit includes actor, role, permission, purpose/reason code, record ID, action class, decision, result count, timestamp, request ID, and export digest.
- Audit excludes address body, correction payload, evidence image, search text, coordinate, map viewport, or provider response.
- Exact and approximate coordinates are omitted from Prompt 21B, so no page, API, role, export, emergency path, or audit role receives a coordinate permission.

## Direct-object access

Every object request must prove:

1. authenticated user;
2. dedicated address permission or linked-Parent relationship;
3. active role and academic context;
4. exact Student/correction ownership;
5. approved purpose and action;
6. current address/correction version;
7. no deletion/generalisation restriction; and
8. no incident suspension.

List access never substitutes for object access. IDs returned elsewhere do not authorize address retrieval.

## Cross-child prevention

- Parent access is derived from current server-side StudentGuardian linkage for the requested child.
- A shared Guardian, sibling, household, phone, surname, locality, or address does not grant access to another child.
- Parent correction submission binds the server-selected linked child; the client cannot supply an arbitrary owner.
- Staff search results omit address until the user passes the dedicated object authorization.
- Blocked tests must cover another Parent’s child, unlinked sibling, Teacher, Viewer, Accountant, public user, stale link, and guessed object ID.
- Error messages do not reveal whether another child/address exists.

## Emergency access process

No emergency or break-glass access is approved. A future process would require:

1. a defined emergency class and named incident coordinator;
2. reauthentication and a specific Student/object;
3. recorded reason and time limit no longer than four hours;
4. least-privileged Tier 1 view only;
5. real-time notification to Director/privacy owner;
6. no export, screenshot, coordinate, map, or bulk access;
7. automatic expiry and session revocation; and
8. review within one school day.

Until leadership approves the process and names accountable people, emergency access is denied.

## Incident roles

| Incident duty | Proposed organisational role | Accountable person | Approval state |
| --- | --- | --- | --- |
| Operational owner | Director or records owner | Not supplied | PENDING |
| Privacy owner | School privacy/grievance owner | Not supplied | PENDING |
| Security owner | System security administrator | Not supplied | PENDING |
| Incident coordinator | Director or delegated incident lead | Not supplied | PENDING |
| Parent communication owner | Principal/safeguarding communications lead | Not supplied | PENDING |
| Regulator/legal escalation | Qualified Indian privacy/legal adviser | Not supplied | PENDING |
| Evidence preservation | Security owner with privacy oversight | Not supplied | PENDING |
| Access suspension | Super Admin under coordinator instruction | Not supplied | PENDING |
| Post-incident review | Director, privacy, security, operational owners | Not supplied | PENDING |

Missing accountable persons blocks Prompt 21B.

## Response stages

### 1. Detect and classify

Record the report time, reporter, suspected action, affected system, possible Student count, and whether view, screenshot, export, restore, cache, or provider disclosure may have occurred. Do not copy the address into the incident ticket.

### 2. Contain

Suspend the affected permission/session/export path, preserve necessary logs, prevent further disclosure, and stop any restoration or deletion job that could destroy evidence.

### 3. Assess

Determine affected records, fields, actors, recipients, time window, copies, backups, exports, screenshots, and child-safety impact. Qualified counsel confirms current notification duties and timelines.

### 4. Notify and support

Notify leadership and named owners. When required, communicate clearly with affected Parent/guardian or child through the approved route without exposing another family. Record regulator/legal escalation.

### 5. Correct and recover

Correct false data, revoke access, invalidate sessions, delete unauthorised copies where lawful, reconcile backups/restores, and verify that service is safe before re-enabling.

### 6. Review

Complete a post-incident review, assign controls, verify evidence retention/deletion, and review the access/retention policy within 30 days.

## Evidence requirements

Privacy-safe incident evidence may include:

- timestamp and request ID;
- actor/user ID and role;
- permission and purpose code;
- route/action class;
- target record ID;
- result count and status;
- export file digest and recipient acknowledgement;
- session/key revocation evidence;
- backup/restore version and reconciliation result;
- containment and notification timestamps; and
- corrective-action verification.

Evidence must not include the full address, correction payload, Parent/child names, contact details, admission number, evidence image, coordinate, or map screenshot unless qualified legal/privacy direction specifically requires a tightly controlled copy.

## Screenshot and export risk

An authorised user can still photograph or screenshot a visible address. Technical controls cannot eliminate that risk. Required operational controls include purpose notice, least privilege, no bulk lists, short sessions, reauthentication for exceptional access, visible confidentiality warning, staff training, audit/anomaly review, sanctions policy, and an incident route.

No screenshot is accepted as a source, verification record, communication attachment, or routine audit artifact. No routine full-address export is proposed. Raw-coordinate export is prohibited.

## Review frequency

- Role and permission review: every three months.
- Individual access assignment review: every three months and on staff role change/exit.
- Aggregate threshold and differencing review: annually and after a cohort-size change.
- Incident-role/contact test: every six months.
- Emergency-access exercise: annually, only after approval.
- Export-recipient/deletion review: after every approved export.
- Full matrix review: every 12 months and within 30 days after an incident or material legal change.

No real Student data appears in this matrix. No address/location was collected, no map/geocoder/provider was implemented, and no Browser location permission was requested.
