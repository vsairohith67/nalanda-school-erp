# Schoolknot Vendor Export and Data Dictionary Request

Status: **request pack only; no credential requested and nothing downloaded**

## General request

Provide synthetic or irreversibly redacted samples, documentation and diagrams. Do not provide passwords, tokens, private keys, production database access or live personal values.

For every module provide stable tenant/branch/record IDs, relationships, field name/type/nullability, status dictionary, timezone/currency/unit rules, formulas, filters, row counts, created/updated/deleted metadata, actor/source provenance, attachment manifest, export format/encoding and checksum.

## Role and module inventory

Provide the effective role/permission matrix and feature flags for Management, Principal, Teacher, Parent, Accountant, Employee, HR/payroll, timetable owner, librarian and transport owner, including page/API/action, object/class/section/subject/child/branch scope and displayed-designation mapping.

Provide field dictionaries and export inventories for:

- Students, Guardians, siblings, academic years, enrollment, lifecycle and corrections;
- Staff/Teacher identity, links, attendance, leave, substitutions and employee self-service;
- timetable classes/sections/subjects/Teachers/assignments/periods/entries/publication;
- Homework, Assignments, Classwork, submissions, resubmissions, feedback and attachments;
- exams, assessments, marks, missing states, moderation, locks, corrections, report-card versions and formulas;
- notices, messages, events, holidays, audience/delivery/read/correction history;
- admissions consent/source/enquiry/application/follow-up/conversion/deduplication/retention;
- Library catalogue/copies/members/circulation/reservations/fines/incidents/stock;
- transport routes/stops/vehicles/riders/bus passes and, only if used, GPS metadata/retention/consent;
- payroll, payslips, salary history, advances, deductions, exit settlement and approvals;
- certificates, transfer/Class X documents, ID cards, custody and handover;
- discipline/support, cafeteria and inventory/assets only if enabled and used.

## Finance schema

Provide fee structures, invoices/dues, concessions, allocations, tenders, transaction/reference IDs, receipts and formulas; refund/reversal/cancellation state machines; original transaction links; approvals; ledger entries; gateway callback/retry/idempotency and settlement IDs; Day Closer batches, snapshots, reopen/lock and reconciliation; report/export schemas and synthetic samples.

## Attachments and storage

Provide opaque object ID, parent record, filename, MIME, size, checksum, malware state, encryption/storage class, authorization rules, signed-link lifetime, version, retention/legal hold and deletion state. Do not provide public URLs or live files.

## Audit, backup and integrations

- Complete audit event catalogue, actor/role/branch/session/request fields, reason/before-after reference, immutability, retention, export and timezone.
- Backup types/scope/encryption/location/key ownership/retention, RPO/RTO and latest restore-test evidence.
- Integration inventory, provider/data region/direction/event/webhook/retry/idempotency/monitoring/offboarding, without credentials.
- Bulk create/update/delete/import preview, validation, confirmation, approval, partial failure, rollback/recovery and immutable batch history.
- Deletion/correction semantics for every operational and historical record, including restored data.

## Acceptance for a future transfer

No data transfer begins until the school names the owner/purpose, approves the minimum datasets and retention, receives synthetic samples/dictionaries, defines reconciliation and rollback, provisions an encrypted untouched archive and isolated working copy, and approves copied-database rehearsal and cleanup. A successful file download alone is never migration evidence.
