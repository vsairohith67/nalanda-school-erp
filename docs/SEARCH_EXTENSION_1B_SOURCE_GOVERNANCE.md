# Search Extension 1B Source Governance

- **Prompt:** `SEARCH-EXTENSION-1B`
- **Scope:** governed metadata adapters for Parent Meetings, Transport, Cafeteria, KG Report Cards and Event Media
- **Authorization:** exact active `SUPER_ADMIN` only
- **Classification:** every source is `SAFE_METADATA_ONLY`
- **Retrieval boundary:** Universal Search only; Smart AI has no direct module or database adapter
- **Operational defaults:** all five owning-module dependencies remain off by default

## Machine-readable authority

`lib/universal-search-contract.ts` is the machine-readable source registry. Each
1B entry records its module, release-flag dependency, classification, safe
fields, prohibited fields, per-source limit, timeout, destination type and
Smart AI eligibility. `tests/universal-search.test.ts` compares the post-1A
adapter inventory with the governed registry. A later adapter added without a
governed registry entry fails that test.

All adapters return only the normalized Search result contract. They never
return a Prisma object, client-selected projection, nested operational record,
raw internal database ID or model/browser-generated destination.

## Source decisions

| Source | Flag dependency | Safe metadata | Prohibited data | Destination |
| --- | --- | --- | --- | --- |
| Parent Meetings | `PARENT_MEETINGS_V1_5=true` | Opaque meeting reference, safe Student identity, academic year, category, status, schedule, mode, no-show/follow-up state | Subject/request reason, Parent-visible or leadership-private text, cancellation narrative, Guardian IDs, participants, notes, audit/notification content | `/parent-meetings` |
| Transport | release flag `transport-v1-5` | Opaque references, route/vehicle/stop code and label, status, Student-specific assignment snapshots and effective dates | Approved-reference free text, addresses, driver/attendant identity or contact, route roster, change reason, GPS/maps/tracking and Safe Exit data | `/operations/transport` |
| Cafeteria | release flag `cafeteria-v1-5` | Item code/name/category, availability, menu date/day, safe Student identity, enrollment and participation state | Meal-plan/dietary free text, diagnosis/allergy/medical inference, change reason, price/payment/fee/wallet/card/gateway data | `/operations/cafeteria` |
| KG Report Cards | release flag `kg-report-cards-v1-5` | Issued report number, safe Student identity, year/class/section, reporting period, status, version and issue date | Internal IDs, draft/rubric/grade/comment/snapshot data, signatures, moderation, PDF bytes and write actions | `/report-cards` |
| Event Media | `EVENT_MEDIA_PUBLIC_GALLERY_ENABLED=true` | Opaque album/media references, event date, visibility/lifecycle/review/publication state, count and safe technical type/dimensions | Title/description/caption, bytes, paths, hashes, Student links/identity, consent detail, EXIF/GPS/OCR/face data and unpublished URLs | `/event-media` |

The environment or release flag is checked before the adapter promise is
started. An off source returns `UNAVAILABLE`, never `EMPTY`, and its Prisma
delegate is not called. Synthetic copied-database QA may explicitly enable the
dependency using the owning module's approved QA mechanism.

## Matching, limits and failures

Ranking remains deterministic: exact opaque reference, exact safe name/title/
code, prefix, token/contains, then secondary safe metadata. Stable source order,
title, timestamp and server-owned destination break ties. There are no vectors,
embeddings, fuzzy model ranking, external Search calls or client-controlled SQL
fields.

Each 1B source is limited to six results and 650 ms. The complete response is
bounded to 50 by default and 60 maximum. Queries must contain at least two
useful characters and are limited to 120 characters. Unknown/duplicate sources,
unknown fields and invalid limits are rejected. One adapter can report
`DEGRADED`, `UNAVAILABLE` or `TIMEOUT` without crashing other sources.

## Privacy and no-write boundary

Copied fixtures place unique sentinels in every prohibited family and verify no
match, normalized result, serialized API evidence, Smart AI envelope or
citation contains them. Hostile text in safe display fields is untrusted data;
the Search and Smart AI React surfaces render it as text and do not use
`dangerouslySetInnerHTML`.

Search and Smart AI contain no mutation, export, report-generation or direct
SQL path. Requests to reschedule meetings, change Transport assignments, record
meals, edit KG grades, issue reports, publish Event Media or revoke consent are
refused and cannot call an operational service.

## Release boundary

Software clearance does not activate any module, provider, real data, AI write
action, cloud/image AI, public publishing, deployment or official UDISE
submission. Operational activation requires a later separately authorised
decision.
