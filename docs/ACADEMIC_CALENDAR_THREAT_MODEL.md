# Academic Calendar Threat Model

| Threat | Control |
|---|---|
| Parent receives Staff/leadership/unrelated-child event | Server-held role/child context plus live Guardian/enrollment scope; minimal DTOs |
| Teacher receives unrelated class event | Exact active Staff -> timetable teacher -> assignment resolution |
| Client tampers with IDs or role | Opaque context and server-side object authorization; client IDs are not trusted |
| Event silently becomes holiday | Separate operational-day and event models/services |
| Posted attendance is rewritten | Immutable former versions, mandatory impact reason and no automatic attendance mutation |
| Concurrent/stale publication | Expected-version CAS, transaction and unique current-publication invariant |
| Retry duplicates notification | Deterministic campaign key and exactly-once recipient ledger |
| Published history is deleted/edited | Database triggers plus append-only audit and replacement links |
| CSV injection/data overreach | Permission gate, bounded rows, formula escaping and no private notes/actor IDs |
| Cache or public URL leaks content | Authenticated routes, private/no-store, no public calendar/feed route |
| Notification failure corrupts publication | Publication commits independently; notification result is audited without rollback corruption |
| External transmission | No AI/provider call, attachment, public website publish, email, SMS or WhatsApp adapter |

SQLite remains a single-instance writer. Horizontal publication and public/private calendar feeds require a separate deployment/governance phase.

