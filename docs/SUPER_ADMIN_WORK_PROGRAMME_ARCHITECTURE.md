# Super Admin Personal Work Programme Architecture

- **Prompt:** `SUPER-ADMIN-WORK-1A`
- **Implementation branch:** `feature/super-admin-work-programme-1a`
- **Starting checkpoint:** `467204394a0ca891fe6e9ac4d55fe59d0814aa17`
- **Implementation status:** `CLEARED`

## Purpose and boundary

The Personal Work Programme turns the cleared Command Center's Diary, Tasks &
Reminders, and Contacts & Suppliers cards into one compact `My Work` product.
It does not add Universal Search, Smart AI, a whiteboard editor, automatic
external messages, procurement, payment automation, or academic-policy work.

The dependency order is fixed:

`Diary / Tasks / Contacts -> Universal Search -> Smart AI`

Universal Search and Smart AI remain unavailable until their own governed
phases. Whiteboard remains planned and Canvs remains the visual planning
surface.

## Exact-role and ownership model

Both the page and API require `VIEW_DASHBOARD` plus the exact active role
`SUPER_ADMIN`. Permission profiles, delegated custom profiles, Director,
Principal, Accountant, Admin, Computer Operator, Teacher, Parent, Student,
Gate Staff and Viewer access are denied on the server.

Every record has an immutable `ownerUserId` foreign key to `User`. Every read,
count, update and lookup includes that owner identity. Public record keys do
not bypass owner scope. The schema has no sharing, delegation or team-access
field. This supports more than one Super Admin without automatically exposing
one Super Admin's private records to another.

## Data model

The additive migration creates four new tables only:

- `SuperAdminDiaryEntry` for dated, plain structured notes, category, safe
  context reference, state, priority and follow-up;
- `SuperAdminTask` for private due work, local reminder time, lifecycle and
  optional safe module/entity references;
- `SuperAdminContact` for a non-financial contact/reference directory; and
- `SuperAdminWorkAudit` for privacy-safe lifecycle metadata.

The migration does not alter examination marks, Teacher examination
assignments, report calculation/publication, existing IAM capabilities,
payments, expenses or procurement records. Foreign keys use `RESTRICT` and
all high-use owner/date/status fields are indexed.

The migration was applied to a copied operational database containing four
protected users. SQLite `integrity_check` returned `ok`, all four new tables
were empty, the original database SHA-256 remained unchanged, and a byte-exact
post-migration database backup was created. Rollback before activation is the
original copied database; after activation, rollback requires preserving these
four tables or exporting the full database before removing the additive
schema.

## Diary contract

Diary notes use the existing safe plain-text editor pattern. Text is bounded
and rendered as text, never as HTML. A record supports title, date, structured
notes, category, priority, status, optional safe module/reference, optional
follow-up and timestamps. Lists are owner-scoped and bounded to 60 recent
entries. Close/reopen changes lifecycle timestamps and produces a safe audit
event without copying the note body.

## Task and reminder contract

Task status is one of `TO_DO`, `IN_PROGRESS`, `WAITING`, `DONE` or
`CANCELLED`. Tasks have a due date, optional due time, optional reminder time,
category, priority, bounded notes and optional safe record reference.
Completion and reopening update `completedAt` consistently.

Reminder times are stored and shown only inside My Work and the private Command
Center. The feature does not create Notification Campaign provider work and
does not call SMS, WhatsApp or email. External-provider activation therefore
remains impossible in this phase.

## Contact-directory contract

The directory is a reference surface for publishers, book/uniform/stationery/
laboratory/IT suppliers, service vendors, consultants and other useful school
contacts. It is not a procurement or accounting system. Contact validation
rejects text that appears to contain card details, banking passwords, OTPs,
PINs or login credentials. The UI explicitly warns against credentials,
government IDs and sensitive financial secrets.

## Audit and privacy

Every create/update and status lifecycle action writes an owner-scoped audit
event in the same database transaction. Audit metadata contains only entity
type/key, lifecycle states, category, priority/preferred flags, tag count and
whether a reminder/follow-up/safe link exists. Diary bodies, task descriptions,
contact notes, phone numbers, email addresses and addresses are not copied into
the broad audit metadata.

Private API responses use `private, no-store`, `nosniff`, `no-referrer`,
`noindex` and `Vary: Cookie`. Serialization returns public keys and bounded
business fields but never database IDs or owner IDs.

## Command Center integration

The cleared read-only Command Center now loads an independent owner-scoped work
summary source. It shows bounded counts for today's tasks, overdue work,
upcoming reminders, recent diary entries, follow-ups and active/preferred
contacts. The source has its own timeout/failure boundary, so a work-programme
failure does not blank school pulse, OBS-1A or recent activity.

Diary, Tasks & Reminders, and Contacts & Suppliers cards link to My Work and
are marked `LIVE`. Universal Search and Smart AI remain dependency-blocked;
Whiteboard remains planned.

## Responsive and accessible UX

`My Work` is one concise sidebar destination with three internal tabs. Desktop
uses a form/list workspace. At narrow widths it becomes one column; filters,
forms, cards and task buckets cannot force horizontal page overflow. Controls
have 44 px minimum targets, visible `focus-visible` outlines, programmatic
labels, keyboard-operable tabs/actions, loading skeletons, live save/error
status and useful empty states. No native `alert`, `confirm` or `prompt` is
used. All date formatting is fixed to `Asia/Kolkata` to avoid server/client
hydration differences.

## Independent QA clearance

`SUPER-ADMIN-WORK-1A-QA` independently repeated exact-role and delegated-profile
denial, direct API authorization, two-Super-Admin owner isolation,
Diary/Task/Contact lifecycle and validation, date/reminder boundaries, bounded
Command Center summaries, privacy-safe audit, provider-side-effect absence,
copied and fresh migration/recovery, representative volume, and responsive
Browser QA. Desktop `1366x768` and exact mobile `390x844` passed in light and
dark modes with no overflow, hydration error or browser console error.

The final serialized gate passed 335 page routes, 549 API routes, lifecycle dry
run, typecheck, 217 passing test files with 1 intentional skipped file (1,935
passing tests and 3 intentional qpdf-runtime skips), production build, backup
version 41 and Git safety. The operational database remained byte-identical at
SHA-256 `65f47efa37da321023439303770645f8d656f2be58458c1a03b341408ef9a6fa`.
The additive migration is source-cleared but remains unapplied to the
operational database until a separately authorised deployment/onboarding gate.
No provider was activated and no deployment, real data or real user was used.
Status: `SUPER_ADMIN_WORK_CLEARED`. Next dependency: `UNIVERSAL-SEARCH-1A`.

## Downstream Universal Search implementation boundary (2026-08-22)

`UNIVERSAL-SEARCH-1A` now consumes Diary, Task and Contact records through
exact-owner server adapters. The authenticated Super Admin user ID is closed
over by the composition service; no owner field exists in the request. Diary
title/category/body, Task title/description/category/status and Contact
name/person/category/phone/email/tags are searchable. Contact notes remain
excluded to protect latent secret/private-path content. Search serializes no
owner or My Work database ID and changes no Work record.

Universal Search is `READY_FOR_INDEPENDENT_QA`, not cleared. The Personal Work
Programme's prior independent clearance and operational-migration boundary are
unchanged. See [Universal Search Architecture](./UNIVERSAL_SEARCH_ARCHITECTURE.md).
