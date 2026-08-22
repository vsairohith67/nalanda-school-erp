# Transport and Cafeteria V1.5 Optional Operations Foundations

Prompt ID: `OPTIONAL-OPS-V1_5-1A`

## Clearance boundary

These are software foundations only. `TRANSPORT_V1_5` and `CAFETERIA_V1_5` are governed, production `DEFAULT-OFF` features with a zero-percent rollout. Their presence does not state or imply that Nalanda Public School operates transport or cafeteria services. No real route, Student assignment, menu, enrollment, or meal participation data is activated by the migration, seed process, backup process, or application startup.

Normal navigation, pages, parent views, and business APIs are absent or fail closed while a feature is disabled. A synthetic-QA override is accepted only outside production, only with `OPTIONAL_OPS_SYNTHETIC_QA=1`, and only for an isolated database identified as synthetic/optional-operations. Production ignores that override. Neither module defines a background job.

## Architecture and authority

Transport and Cafeteria use separate Prisma models, services, API trees, workspaces, audit streams, reports, and restore logic. There is no shared operations god-table.

Super Admin holds default management authority. Director and Principal receive the established read/report/export convention, without automatic management. Teacher, Computer Operator, Accountant, Viewer, Parent, and Student receive no module management permission by default. Parent receives only linked-child read access. The service layer additionally denies broad or management actions for Parent and Student even if a permission payload is tampered with.

Every page and API performs server-side authentication, feature evaluation, and authorization. Mutation endpoints also enforce same-origin requests, JSON content type, bounded request size, input allowlists, optimistic versions where records are mutable, foreign-key ownership checks, and server-side business rules.

## Transport foundation

Transport supports vehicles, routes, approved stops, ordered morning/evening route stops, optional Staff references for driver/attendant duties, route capacity, effective-dated Student assignments, a privacy-minimal roster, linked-child parent reference, and CSV export.

Capacity is a hard-block policy across effective-date intervals. Vehicle/route capacity cannot be negative or zero, route capacity cannot exceed vehicle capacity, overlapping assignments cannot exceed route capacity, and an atomic conditional update protects concurrent assignment. Reassignment requires the exact current assignment key/version, closes the prior row, links a new historical row, and preserves immutable route/stop/timing snapshots and the original reason. Current roster and parent state are derived from the effective dates, so a scheduled assignment does not replace the current view early.

Vehicles, routes, stops, and route-stops cannot be made inactive while a current or scheduled assignment depends on them. View-only workspaces receive a privacy-minimal roster and no Student/Staff option directories; those directories are returned only to the matching manager. CSV endpoints require their distinct export capability.

Broad rosters and exports contain only admission number, Student name/class/section, route, and approved stop/timing references. They do not select home address, personal Staff contact, other Students in a parent view, or tracking data.

Out of scope: GPS, maps, route optimisation, telematics, mobile driver tracking, automatic alerts, automatic Safe Exit departure, absence inference, and permanent Driver IAM role creation.

## Cafeteria foundation

Cafeteria supports a catalog, categories, availability, date/day menus, a bounded meal-plan code, effective-dated Student opt-in, idempotent order/participation records, a serving roster, linked-child parent reference, and CSV export. Current opt-in is derived from the service date; scheduled changes do not replace the current parent or serving view early. Meal records must match the Student, effective enrollment, meal-plan code, menu date, and meal slot.

Detailed dietary or medical data is deliberately omitted. Enrollment reasons are controlled operational codes, and meal-plan codes reject health/diagnosis terms. Medically significant restrictions require a separately approved health-data workflow with its own purpose, access, review, retention, and incident controls.

There is no wallet, stored card, online payment, fee/receipt posting, delivery service, or money mutation. `CafeteriaChargeReference` is a type-only future integration boundary that explicitly marks financial mutation as prohibited.

## Audit, backup, migration, and recovery

Creation/change events for vehicles, routes/stops, Transport assignments, catalog/menu data, Cafeteria enrollments, and meal records use separate privacy-safe audit tables. Audit metadata contains stable internal/public references and state transitions, not addresses, telephone numbers, health information, or credentials.

Backup version 43 includes both module families in separate arrays and omits actor user IDs. Restore maps Students by admission number and Staff by Staff code, retains public historical references, rejects cross-route stop substitution and cross-Student/date/slot/meal-plan meal substitution, verifies foreign keys, and is idempotent. The schema change is additive in migration `20260822090000_optional_operations_v1_5_foundations`; copied-database checks cover fresh deploy, upgrade rehearsal, schema equivalence, backup/restore, and recovery. The operational database must have identical SHA-256 before and after QA.

## QA activation

Focused QA uses only freshly migrated isolated databases and synthetic records. The governed test command is:

```powershell
pnpm.cmd qa:optional-operations
```

It covers multiple vehicles/routes/stops, capacity boundaries, duplicate and concurrent assignment, effective-dated history, inactive references, foreign-key substitution, linked-child/cross-child access, catalog/menu availability, date boundaries, duplicate meal records, CSV formula neutralisation, audit privacy, protected academic/finance/attendance/Safe Exit table non-mutation, and idempotent restore.

## Release state

- `TRANSPORT — SOFTWARE CLEARED / DEFAULT-OFF`
- `CAFETERIA — SOFTWARE CLEARED / DEFAULT-OFF`

The release retains both feature flags at zero-percent rollout. It does not
apply the migration to the operational database, create real records, activate
either service, deploy the application, or enable an external provider.
