# Super Admin Command Center Scope

- **Recommended prompt:** `SUPER-ADMIN-COMMAND-1A — Super Admin Command Center Foundation`
- **Classification:** `CLEARED`
- **Target lane:** V1.5 product work

## Product decision

Nalanda should build one Super Admin Command Center programme, not separate Diary, task, reminder, contact, search, monitoring, whiteboard, and AI applications. The programme retains ordered phases and evidence gates. Its first phase should be a permission-scoped, read-only composition layer over the ERP foundations already cleared. It may begin before hosting with synthetic data and existing APIs.

`SUPER-ADMIN-COMMAND-1A` is the single recommended immediate implementation phase. Private staging remains a parallel operational track.

## Existing foundations to reuse

- Leadership/management dashboard and established module navigation.
- OBS-1A technical and operational monitoring described in the [observability architecture](./OBSERVABILITY_OPERATIONS_ARCHITECTURE.md).
- IAM, release controls, safe logs, and existing role-scoped APIs.
- Academic calendar lifecycle in the [academic calendar model](./ACADEMIC_CALENDAR_MODEL_AND_LIFECYCLE.md).
- Vendor and publisher-bill foundations in the [expense/vendor workflow](./EXPENSE_AND_VENDOR_WORKFLOW.md).
- Existing read-only assistant safety contract in the [AI assistant workflow](./AI_ASSISTANT_SAFETY_AND_READ_ONLY_RETRIEVAL_WORKFLOW.md).

OBS-1A is `CLEARED`; the Command Center must extend and present it, not duplicate its collection or operational logic.

## Current gaps

- The Digital Diary is a working Notion template, not proven ERP code: `NOT_IMPLEMENTED`.
- General tasks and reminders remain `PARTIAL` because academic calendar/event lifecycle exists but general work orchestration does not.
- A consolidated publisher/vendor/contact directory is `PARTIAL`.
- Universal permission-scoped search is `NOT_IMPLEMENTED`.
- A full ERP infinite-whiteboard engine is `NOT_IMPLEMENTED`.
- Citation-based Smart AI is `PARTIAL` and remains downstream of directory and search work.

## Phase 1 scope

`SUPER-ADMIN-COMMAND-1A` should provide:

- a responsive Super Admin landing surface using existing design and navigation conventions;
- read-only operational, academic, finance, people, communications, and release-status summaries from existing authorised APIs;
- actionable exception cards that link to the existing owning module rather than edit records in place;
- clear source, timestamp, loading, empty, stale, partial, and failure states;
- a read-only OBS-1A summary with a link to the existing technical operations detail;
- explicit provider state such as mock, disabled, sandbox, or live, without activating anything;
- saved view/layout preferences only if they can be implemented without weakening access or audit controls;
- mobile-responsive behaviour consistent with the shared web application.

The phase should prefer no new operational schema. If an implementation design later identifies a genuine persistence need, that schema decision must be proposed and reviewed separately.

## Follow-on Command Center product

After the read-only foundation is accepted, one integrated product may add:

- Digital Diary workflows;
- personal and assigned tasks;
- reminders and governed calendar integration;
- Life OS-style work planning within school roles;
- publisher, book-supplier, vendor, official, and contact directory records;
- permission-scoped universal search.

The [calendar future module plan](./ERP_CALENDAR_FUTURE_MODULE_PLAN.md) is planning input, while the cleared academic calendar remains the source for implemented calendar behaviour.

## Required dependency order

1. Command Center read-only foundation.
2. Diary/tasks/reminders and governed directory records.
3. Universal permission-scoped search.
4. Citation-based Smart AI.

Universal Search must precede Smart AI. Publisher/vendor/contact records must exist before AI may answer supplier questions. AI must inherit the caller's permissions and cite the exact accessible ERP source.

## Canvs and whiteboard boundary

The canonical Canvs ERP board is the current governed visual architecture surface. The product should evaluate links, embeds, or controlled integration with that board where practical. It should not immediately build a second complete infinite-whiteboard engine. Any future in-ERP whiteboard remains `NOT_IMPLEMENTED` until a separate user need, ownership model, retention rule, permission model, and build-versus-integrate decision are accepted.

## Explicit exclusions from Phase 1

- Record creation, approval, bulk action, or other operational writes.
- Deployment, DNS changes, provider activation, real data, or real users.
- UDISE 15E fields or government-portal automation.
- Live WhatsApp, email, SMS, push, payment, or AI-provider calls.
- Universal search, semantic/vector retrieval, autonomous actions, or AI-generated writes.
- A new monitoring backend or whiteboard engine.
- Cross-role aggregation that exposes data the signed-in role cannot already access.

## Focused acceptance requirements

- Super Admin sees only authorised school and operational data.
- Other roles cannot access the surface or its backing responses unless explicitly allowed.
- Every summary identifies its source and freshness.
- Partial source failure does not invent zeros or present stale data as current.
- Navigation reaches existing owning modules without side effects.
- Provider states are accurate and cannot activate a provider.
- OBS-1A is reused and not duplicated.
- Responsive keyboard, phone, tablet, and desktop behaviour is covered.
- Focused component/API/permission tests pass; no full production build is required for the documentation phase.

## Later operational dependency

Private HTTPS staging is required before independent staging QA, physical-device certification, live-like provider sandbox validation, or real-user acceptance. It is not required to begin synthetic, read-only Command Center development.

## SUPER-ADMIN-COMMAND-1A implementation checkpoint (2026-08-21)

The foundation is implemented on
`feature/super-admin-command-center-foundation` with one exact-role page and one
private, no-store composition endpoint. It reuses IAM, OBS-1A, immutable
audit/event sources, and existing module records. The response is bounded,
timeout-aware, partial-result capable, and read-only. No schema, migration,
provider, AI, search, Diary, task, directory, or whiteboard persistence was
added. See the [Command Center architecture](./SUPER_ADMIN_COMMAND_CENTER_ARCHITECTURE.md).

Status at implementation handoff: `SUPER_ADMIN_COMMAND_CENTER_READY_FOR_QA`.

## SUPER-ADMIN-COMMAND-1A-QA clearance (2026-08-21)

Independent QA cleared the exact-role page and API boundary, read-only source
composition, partial-result behavior, privacy filtering, OBS-1A reuse, and
responsive/accessibility contract. Director route and tampered API attempts
were denied, the operational database remained byte-identical at SHA-256
`65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`, and a
complete security diff scan returned no findings. Browser checks passed at
1366 x 768 and exact 390 x 844 in light and dark modes. Twenty warm synthetic
loads measured p95 1,729 ms.

The sequential release gate passed 334 page routes, 548 APIs, lifecycle dry
run, typecheck, 1,921 tests with 3 intentional skips, production build, backup
version 41, and Git safety. No schema, migration, operational write, provider,
AI, search, Diary, task, directory, or whiteboard scope was added. Status:
`SUPER_ADMIN_COMMAND_CENTER_CLEARED`. The next governed product phase is
`SUPER-ADMIN-WORK-1A`.

## SUPER-ADMIN-WORK-1A implementation handoff (2026-08-21)

The first Personal Work Programme is implemented on
`feature/super-admin-work-programme-1a` and is ready for independent QA. The
three former future cards—Diary, Tasks & Reminders, and Contacts & Suppliers—
now open one exact-owner, exact-`SUPER_ADMIN` My Work workspace. Private,
bounded summaries are composed into Command Center behind an independent
failure boundary.

The additive schema contains only owner-isolated diary, task, contact and
privacy-safe audit records. No sharing, Universal Search, Smart AI, whiteboard
editing, external provider messaging, procurement/payment automation or
academic-integrity change is included. The required dependency order remains:
`Diary / Tasks / Contacts -> Universal Search -> Smart AI`.

See the [Personal Work Programme architecture](./SUPER_ADMIN_WORK_PROGRAMME_ARCHITECTURE.md).

## SUPER-ADMIN-WORK-1A-QA clearance (2026-08-21)

Independent QA cleared Diary, Tasks & Reminders, Contacts & Suppliers, the My
Work shell and bounded Command Center summaries. Exact active `SUPER_ADMIN`
access and two-owner isolation passed at page, route, API and service layers;
all released non-Super-Admin roles and delegated profiles were denied. Fresh and
copied migration/recovery, privacy-safe audit, no-provider side effects,
representative volume and exact desktop/mobile light/dark Browser QA passed.
The operational database remained byte-identical and the additive migration was
not applied operationally. Status: `SUPER_ADMIN_WORK_CLEARED`. Universal Search
is next; Smart AI remains downstream and Whiteboard remains planned.

## WHITEBOARD-BRIDGE-1A implementation handoff (2026-08-22)

The former planned Whiteboard card now opens one exact `SUPER_ADMIN`-only route,
`/super-admin/whiteboard`. That page is a lightweight, private/no-store reference
surface for the one canonical Nalanda ERP Canvs board. It uses a fixed validated
destination and safe external new-tab behavior. Alternate query, redirect,
target, protocol, host, path, or board-ID inputs cannot replace the destination.

This bridge adds no iframe, Canvs authentication/token, server-side board fetch,
sync, board-content storage, migration, operational write, Search adapter, Smart
AI feature, or whiteboard engine. The Command Center card is `AVAILABLE`; the
bridge is independently cleared. See the
[Whiteboard Bridge architecture](./SUPER_ADMIN_WHITEBOARD_BRIDGE.md).

## WHITEBOARD-BRIDGE-1A-QA clearance (2026-08-22)

Independent QA cleared the exact-Super-Admin route, fixed canonical destination,
safe external link, unavailable-configuration state, responsive light/dark UI,
and database-neutral boundary. All released non-Super-Admin roles plus delegated
dashboard access were denied. Academic Integrity v1.1, My Work, and Command
Center behavior remained intact. The full release gate passed 338 page routes,
551 APIs, lifecycle dry run, typecheck, 1,950 tests with 3 intentional skips,
production build, backup version 41, and Git safety. Status:
`WHITEBOARD_BRIDGE_CLEARED`.
