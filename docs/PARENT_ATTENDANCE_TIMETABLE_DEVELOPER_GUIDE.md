# Prompt 23D Developer Guide

Authoritative services are `resolveActiveParentChildContext`, `loadParentAttendance`, `loadParentExaminationTimetables` and `lib/examination-timetables.ts`. Page/API code must call these services; it must not reproduce a weaker permission-only or client-ID filter.

Parent GET APIs use opaque `childContext` plus `contextVersion`, return private/no-store DTOs and contain no mutations. Any new Parent projection must start from the same exact active User/session/Parent assignment/Guardian/enrollment proof. Never add remarks, Staff identities, raw IDs, draft content or audit payloads to the DTO.

Timetable mutations use same-origin/CSRF middleware, bounded bodies/rows, leadership permissions, idempotency keys, expected-version compare-and-set and serializable transactions. Published rows and audit events are database protected. Extend lifecycle transitions only with a migration, restore ordering, copied-database concurrency tests and independent QA.

Run `pnpm.cmd qa:23d` before Browser QA. It copies the operational database, deploys the migration twice, creates only `PARENT23D` fixtures, proves exact child scope, lifecycle/concurrency/rollback and version-37 backup/restore, checks the operational database hash, then removes both copies. `pnpm.cmd build` uses Next.js Turbopack's sequential compile and generate production modes after the mandatory standalone typecheck, avoiding a duplicate monolithic compiler pass inside the build. The final build alone may use a bounded 4 GB Node heap. Browser runtime, full tests and build must remain sequential.

Known deliberate boundaries: counts-only attendance until calendar/percentage policy approval; no Parent correction/dispute; no live messages; no classwork, events/holiday calendar, appointments, transport, payroll or admissions CRM.
