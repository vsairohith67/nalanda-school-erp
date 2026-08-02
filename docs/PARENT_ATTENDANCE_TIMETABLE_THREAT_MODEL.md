# Parent Attendance and Timetable Threat Model

| Threat | Control | Verification |
| --- | --- | --- |
| Raw Student ID or cross-family tampering | Opaque version-bound handle plus active Guardian/enrollment resolver | Unrelated-handle copied-DB denial |
| Permission-only Parent or multi-role leakage | Exact active Parent assignment and session role context | Teacher + Parent and Director + Parent denial before switch |
| Removed link or stale tab | Revalidate link and compare context version on every request | Link removal and child-switch stale-handle denial |
| Draft attendance/timetable disclosure | Official attendance and current-published timetable allowlists | Draft records and versions absent from DTO |
| Sensitive note/Staff/raw-ID disclosure | Minimal Prisma selects and explicit Parent DTO | Serialized response inspection |
| Published timetable tampering/deletion | Immutable lifecycle/row database triggers | Direct mutation refusal |
| Duplicate/concurrent publication | Unique current key, serializable transaction, CAS version | Stale and concurrent refusal |
| Audit destruction | Append-only event triggers | Forced delete rollback |
| Cross-site mutation | Same-origin/CSRF middleware; GET is read-only | API/source tests |
| Cache/browser residue | Private/no-store and authenticated print | Header and runtime probes |
| Oversized requests/DoS | 128 KB route cap, 100-row cap, bounded lists | Unit/source tests |
| External data exfiltration | No AI/provider call or live notification | Architecture inspection |

Residual risks are the supported single-writer SQLite architecture, screenshots/physical print after authorised display, and the unresolved attendance calendar/percentage policy. Distributed publication, offline Parent caching and live provider delivery require separate threat models and approval.
