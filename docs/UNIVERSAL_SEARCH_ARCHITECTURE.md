# Universal Search Architecture

- **Prompt:** `UNIVERSAL-SEARCH-1A`
- **Implementation branch:** `feature/universal-search-1a`
- **Handoff baseline:** `53a805be7ad5299e76e30b2989a052f1b5f935e8`
- **Reconciled starting main:** `61aac47f4f8f716a0fa61104124907002a2d36fb`
- **Release status:** `UNIVERSAL_SEARCH_CLEARED`
- **Independent QA:** [UNIVERSAL-SEARCH-1A QA Clearance](./evidence/UNIVERSAL_SEARCH_1A_QA_CLEARANCE.md)
- **Primary route:** `/super-admin/search`
- **Primary API:** `POST /api/super-admin/search`

## Purpose and hard boundary

Universal Search is deterministic retrieval for the exact active
`SUPER_ADMIN` workspace. It finds a small, permission-filtered result and then
navigates to the existing owning module. Search itself never creates, edits,
approves, publishes, completes, imports, exports, notifies or otherwise mutates
an operational record.

Both the page and API require the existing `VIEW_DASHBOARD` permission plus the
exact `SUPER_ADMIN` role on the server. Director, Principal, Accountant, Admin,
Computer Operator, Teacher, Parent, Student, Gate Staff, Viewer, delegated
marks-entry operators and arbitrary custom/delegated profiles are denied even
if navigation is guessed or a direct API request is made. Navigation hiding is
only a secondary presentation control.

Academic Integrity v1.1 is preserved. Search exposes examination and report
card results only as read/navigation results; it introduces no mark-entry
action and changes none of the permanent Teacher marks-write denials or exact
non-teaching delegation rules.

## Request flow

```text
Authenticated Actor
  -> validated authorised search request
  -> one server-side Universal Search composition service
  -> bounded permission-aware source adapters
  -> normalized privacy-safe results and per-source states
  -> existing independently authorised destination route
```

The browser makes one POST request to the Universal Search endpoint. It does
not independently call privileged module APIs. The authenticated user ID and
role come from the server session. The client can select source filters but
cannot supply an owner, actor, field name, sort expression or raw query plan.

## Request validation and limits

- Query text is trimmed and whitespace-normalized.
- Ordinary queries require 2–120 characters and at least one useful letter or
  number token.
- `%`, `_` and punctuation-only input cannot act as a wildcard module dump.
- Source filters must be known, non-empty, bounded and unique.
- Overall result limit defaults to 50 and cannot exceed 60.
- Every enabled source returns at most 6 results after ranking and reads at
  most 32 bounded candidates.
- Empty requests never list an entire module.
- Query tokens are passed through Prisma's parameterized filters; no
  user-controlled SQL, field or sort fragment is constructed.

No cursor is accepted in this phase. More results are reached by the explicit
"Open module" destination rather than an unbounded Search export.

## Normalized result contract

Search adapters return only this stable internal shape:

```ts
type UniversalSearchResult = {
  source: UniversalSearchSourceId;
  type: string;
  title: string;
  subtitle: string;
  snippet: string | null;
  status: string | null;
  href: string;
  score: number;
  timestamp: string | null;
};
```

Raw Prisma/database objects are never returned. Internal IDs appear only where
an existing authorised detail route requires that ID in its destination URL.
My Work owner IDs and database record IDs are never serialized. Phone and email
metadata is masked where it is useful to distinguish a Guardian or Contact.
Text is bounded, control characters are removed, and React renders it as text.

Each selected source also reports `OK`, `EMPTY`, `DEGRADED`, `UNAVAILABLE` or
`TIMEOUT`. `EMPTY` means the source completed and found no match.
`UNAVAILABLE` means no approved safe adapter exists. These states are never
collapsed into a fake zero result.

## Included and deferred sources

| Priority | Source | Status in this phase | Searchable safe fields and boundary |
| ---: | --- | --- | --- |
| 1 | Students | Included | Name, admission number, parent/guardian names and class metadata; no Aadhaar, address, phones, remarks or hidden fields |
| 1 | Admissions | Included | Enquiry/application reference, applicant/child name, Guardian name, class/year and status; no invitation token, contact value, document path or raw snapshot |
| 1 | Guardians | Included | Name, relationship, phone/email for matching; displayed contact is masked; notes are excluded |
| 1 | Staff | Included | Staff code, name, designation and department; no emergency contact, address, payroll or private notes |
| 1 | Diary | Included | Exact owner only; title, category, notes and safe context reference |
| 1 | Tasks & Reminders | Included | Exact owner only; title, description, category, status and safe linked reference |
| 1 | Contacts & Suppliers | Included | Exact owner only; name, contact person, category, phone, email and tags; notes are deferred to avoid latent secret/private-path matching |
| 2 | Fees / receipts | Included | Receipt number, admission number and Student name; no amount, account, payment instrument or full financial metadata is returned |
| 2 | Attendance | `UNAVAILABLE` | No dedicated safe bounded reference adapter is proven; Student matches are not relabelled as attendance results |
| 2 | Examinations | Included | Exam code, name, type, year and description; destinations are navigation only and contain no mark-edit action |
| 2 | Report Cards | Included | Report number, Student name/admission, class, year, type and publication status; no draft/snapshot/comment body is searched |
| 2 | Support / complaints | Included | Reference, subject, requester name/type and linked receipt reference; original statements, internal notes, attachments and archived cases are excluded |
| 2 | Safe Exit | Included | Non-restricted request reference, verification reference and Student identity/class metadata; restricted incidents, handover contacts and reason details are excluded |
| 2 | Events / calendar | Included | Title, safe description, venue, event/audience type and lifecycle status; internal notes are excluded |
| 3 | Users / IAM | Included, safe metadata only | Name, username/email for matching, designation, role and lifecycle state; password hashes, sessions, reset/recovery, MFA and authorization internals are absent |
| 3 | Audit / Recent Activity | `UNAVAILABLE` | Unified audit text search is deferred until a privacy-safe searchable metadata contract is separately approved |
| 3 | Release Operations | Included, safe metadata only | Release version, environment, commit/build and migration identifiers; no secrets, packages or file paths |
| 3 | Observability / System Health | Included, safe metadata only | Fields explicitly named `titleSafe`, `summarySafe` or `evidenceSummarySafe`, plus domain/severity/status; no raw telemetry or runbook path is returned |

No migration, search-index table, backfill, vector store or external search
infrastructure is introduced. Existing indexed identifiers and owner/status/date
indexes are reused with bounded reads. No attachment, PDF, report or private
file content is parsed during search.

## Exact-owner My Work privacy

Diary, Tasks and Contacts adapters close over the authenticated Super Admin's
server-derived user ID. Every database read contains that exact `ownerUserId`.
The request schema has no owner field, and unknown fields are rejected. A
result cannot be expanded by supplying another owner, record ID, filter or
source value. Two-Super-Admin copied-data tests prove A sees A only and B sees
B only.

Diary and Task private bodies may be matched because their adapter is exact
owner only, bounded and private. Contact notes are intentionally not searched
in this phase; new Contact validation rejects common secret patterns, but
excluding notes also protects older/latent content from becoming searchable.

## Deterministic matching and ranking

Text uses Unicode normalization, case normalization, punctuation-to-space and
collapsed whitespace. Candidate queries require all useful query tokens across
the approved fields. Ranking is stable and testable:

1. exact approved reference/identifier — score 1000;
2. exact primary name/title — score 900;
3. reference prefix — score 860;
4. primary name/title prefix — score 800;
5. primary contains/full token match — scores 740/680;
6. approved secondary metadata matches — scores 640 down to 520.

Final ties use fixed source order, case-insensitive title, timestamp and safe
destination. There is no fuzzy, semantic, random or ML ranking.

## Failure isolation and private delivery

Adapters run in bounded parallel composition with a 650 ms per-source timeout.
A thrown adapter becomes `DEGRADED`; a slow adapter becomes `TIMEOUT`; all other
sources still render. The overall API error never serializes the underlying
database error.

The API and page use `private, no-store, max-age=0`, `Vary: Cookie`,
`no-referrer`, `nosniff`, `noindex` and the existing authenticated middleware
headers. The query is POSTed in a bounded JSON body, not placed in the route
URL, analytics or an immutable audit event. Universal Search writes no query
history. If a later security policy requires access auditing, it may add only
actor/action/filter/count/result/timestamp metadata unless a separately
approved policy explicitly permits query text.

## Destination authorization

Search results link to existing Student, Guardian, Staff, examination, report
card or owning module routes. Search does not duplicate their workflows. Every
destination retains its independent permission/object-scope enforcement; a
safe Search result does not weaken the target route.

## Smart AI retrieval boundary

SMART-AI-1A uses the normalized composition service through this sequence:

```text
Authenticated Actor
  -> Authorized Search Request
  -> Permission-filtered Normalized Results
  -> bounded Smart AI source envelope
  -> disabled or loopback-only provider adapter
  -> validated answer and citations
```

Smart AI does not bypass Search authorization or replace target-route
authorization. Universal Search itself still implements no prompt, RAG,
embedding, vector table, provider call, autonomous action or generated answer.
The separate Smart AI layer consumes only this normalized response, and its
default runtime is disabled. See [Smart AI Architecture](./SMART_AI_ARCHITECTURE.md).

## Implementation validation boundary

Focused implementation coverage includes exact-role route/API/service denial,
request abuse, Unicode and hostile text handling, stable ranking, source
failure/timeout/unavailable states, Priority 1 normalized results, prohibited
field non-matching, two-owner isolation, result/query bounds, no-write/no-AI
source inspection, copied-database scale/performance and responsive Browser QA
at 1366 x 768 and exact 390 x 844 in light/dark modes. The operational database
hash is checked before and after copied/synthetic testing.

The final copied-database implementation profile used 1,200 Students, 600
Guardians, 320 Staff, 360 admission enquiries, 432 Diary entries, 1,512 Tasks,
532 Contacts, 240 fee receipts, 140 examinations, 120 support requests and 80
Safe Exit requests. Across 25 steady-state all-source searches it measured
local p95 48.32 ms and maximum 51.19 ms, with at most 19 Prisma queries per
request and a 50-result client bound. Owner A/B isolation passed. The copied
fixture was removed, and the operational database remained byte-identical at
SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.

Independent `UNIVERSAL-SEARCH-1A-QA` cleared this private/local release on
2026-08-22. The complete authorization, ownership, secret-field, failure,
performance, Browser, security, full-suite and operational-database evidence
is recorded in the linked clearance. Deployment, real-data indexing/import,
providers and Smart AI remain outside this Search clearance. SMART-AI-1A later
passed its own independent security, privacy and release gate without changing
Search semantics; see its [QA clearance](./evidence/SMART_AI_1A_QA_CLEARANCE.md).
