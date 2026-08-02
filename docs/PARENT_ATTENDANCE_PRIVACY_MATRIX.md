# Parent Attendance Privacy Matrix

| Data | Parent response | Enforcement |
| --- | --- | --- |
| Selected child name, admission number, class, section, roll number | Allowed | Exact active linked-child and enrollment resolver |
| Official daily state and approved label | Allowed | `SUBMITTED`/`LOCKED` sessions only |
| Status counts and latest official update | Allowed | Server calculation over the same scoped rows |
| Percentage or working-day count | Not available | No approved policy exists; no inferred denominator |
| Unrecorded date | “No official record” only | Never inferred absent or non-working |
| Other Students or class-wide lists | Denied | Student-scoped record predicate and DTO projection |
| Guardian records or family links | Denied | Used for authorization, never returned |
| Teacher/Staff identities, session notes, record remarks | Denied | Not selected from Prisma and absent from DTO |
| Raw database IDs, audit payloads, context link IDs | Denied | Opaque handle in; public projection out |
| Draft attendance | Denied | Official-status allowlist |
| Medical/sensitive notes | Denied | Remarks and notes excluded |
| Print | Allowed while authenticated | Same server resolver, private/no-store |

Denied and stale requests return generic linked-child-unavailable responses. Logs must not contain Student payloads, opaque handles, raw IDs, notes or attendance rows.
