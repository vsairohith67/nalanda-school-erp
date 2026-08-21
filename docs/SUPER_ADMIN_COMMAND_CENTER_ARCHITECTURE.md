# Super Admin Command Center Architecture

- **Prompt:** `SUPER-ADMIN-COMMAND-1A`
- **Phase:** Read-only foundation
- **Route:** `/super-admin/command-center`
- **API:** `GET /api/super-admin/command-center`
- **Role boundary:** exact `SUPER_ADMIN` only
- **Schema change:** none

## Purpose

The Command Center is a private composition layer over Nalanda ERP systems that
already own their data and workflows. It presents bounded summaries and links to
the owning modules. It does not create, approve, update, delete, dispatch,
generate, or submit operational records.

The shared authenticated application shell, theme controls, IAM session, and
navigation remain authoritative. The Command Center does not introduce another
application shell or another authorization system.

## Exact authorization boundary

The page uses the existing server-side IAM guard with both `VIEW_DASHBOARD` and
the exact active role `SUPER_ADMIN`. The API repeats the same permission plus
exact-role guard. A Director, Principal, Accountant, Admin, Computer Operator,
Gate Staff, Teacher, Parent, Student, Viewer, or a delegated profile on any
non-Super-Admin active role is denied even if navigation is manually bypassed.

Navigation visibility is a convenience only. It is not the security boundary.
Session revocation, authorization-version changes, expired assignments, forced
password changes, and disabled accounts continue to fail closed through the
existing IAM session resolver.

The private route and API use per-request rendering and `private, no-store`
caching. The endpoint accepts no role, scope, expansion, or object identifier
query parameter.

## Composition model

The server creates one bounded response with four independently protected
source groups:

1. Today.
2. School Pulse.
3. System Health.
4. Recent Activity.

The response also carries static, code-reviewed links and programme statuses for
Quick Access, My Work Programme, UDISE+, and Mobile. Static status entries do not
read or write operational data.

Reads run in parallel where they are independent. Every dynamic read is bounded
by an existing indexed status/date lookup, an aggregate, a small current-day
relation, or an explicit `take` limit. Each source has a 1.5 second presentation
timeout. A timeout is `DEGRADED`; another failure is `UNAVAILABLE`; a legitimate
zero is `EMPTY`; data returned normally is `OK`. Failed sources return safe text
and never expose raw exceptions.

One source failure cannot blank the other source groups. An unavailable source
is displayed as `Not available`, never as zero.

## Reused systems

### IAM

- Existing persisted sessions and active role assignments.
- Existing effective-permission evaluation.
- Exact active-role enforcement on both page and API.
- Existing middleware origin, request-size, CSP, and private-cache controls.

### OBS-1A

System Health calls the existing `getTechnicalOperationsDashboard` reader. It
presents privacy-safe status for application, database, migrations, backup,
storage, release/build, background work, notifications/providers, document
processing, and security/account signals. It does not register a collector,
write a check run, activate a provider, or transmit telemetry.

### Immutable audit and event sources

Recent Activity merges small, newest-first slices from existing IAM,
Admissions, Support, payslip-request, Safe Exit, and report-card event sources.
It returns at most 12 entries. It omits details JSON, reasons, request hashes,
tokens, paths, attachments, network data, financial payloads, internal database
identifiers, and password/credential events. Actor database identifiers are used
only for a bounded server-side display-name lookup and never leave the server.

### Existing module data

Today and School Pulse use existing Student, enrollment, Guardian, Staff,
attendance, payment aggregate, Admissions, Examination, report-card, Support,
payslip-request, Safe Exit, calendar, leave, and OBS records. Cards link to the
existing owning modules. No downstream workflow is copied into the page.

## Performance and safety budgets

- Local synthetic p95 target: at most 2 seconds.
- Source presentation timeout: 1.5 seconds.
- Recent Activity: at most 12 returned events.
- Upcoming important events: at most 3 returned events.
- No PDF/report generation.
- No AI call.
- No external provider call.
- No schema or Prisma migration.
- No operational write or view-generated audit side effect from this service.
- No-store responses and no shared/private dashboard cache.

## UI behavior

The responsive page uses the existing design tokens and shell. Desktop uses a
clear priority grid; narrow screens collapse to a one-column flow. Links and
controls keep a minimum 44 px target. Loading uses an accessible skeleton.
Empty, degraded, and unavailable states remain text-visible and do not rely on
colour alone. Focus uses the existing visible focus convention. React escapes
all displayed activity text; unsafe HTML is not used.

## Downstream dependency order

1. Read-only Command Center foundation.
2. Diary, Tasks and Reminders, and Contacts and Suppliers directory.
3. Permission-scoped Universal Search.
4. Citation-grounded Smart AI.

Whiteboard remains planned and Canvs remains the governed planning surface.
This phase adds no Diary, task, reminder, directory, search, AI, or whiteboard
persistence or fake functionality.

## UDISE+ and Mobile boundary

UDISE+ shows Prompt 15D as the completed read-only foundation and Prompt 15E as
waiting for current portal evidence. It does not scrape or automate government
submission.

Mobile status records that responsive web and the PWA foundation are cleared,
physical-device certification waits for staging, and native Android and Apple
apps are not implemented. No Android Studio, Java, Xcode, or native toolchain is
installed by this phase.

## Independent QA clearance

`SUPER-ADMIN-COMMAND-1A-QA` independently verified the full feature diff and
cleared the foundation on 2026-08-21. The exact Super Admin UI/API boundary,
tamper resistance, source isolation, bounded activity, private/no-store headers,
privacy-safe labels, no-write behavior, and OBS-1A reuse passed focused and full
regression tests. Security scan `3707f275-d229-4cd5-ab47-069e32260df8` covered
all changed runtime source files and returned no findings.

Browser QA passed 1366 x 768 and exact 390 x 844 in light and dark modes with
no horizontal overflow, native dialogs, console errors, hydration errors, or
clean-runtime stderr. Twenty warm local synthetic API loads measured p95 1,729
ms. The operational database stayed byte-identical at SHA-256
`65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.

The final sequential gate passed 334 page routes, 548 APIs, lifecycle dry run,
typecheck, 216 passing test files with one intentionally skipped file (1,921
passing tests and 3 intentional skips), production build, logical backup version
41, and Git safety. Basic Memory was attempted once and unavailable:
`BASIC_MEMORY_SYNC_SKIPPED_SUBSCRIPTION_EXPIRED`. No deployment or provider
activation occurred. Result: `SUPER_ADMIN_COMMAND_CENTER_CLEARED`.
